// ---------------------------------------------------------------------------
// Team ke log (users).
//
// Dhaancha wahi hai jo templates.js me hai — list, banao, badlo, hatao. Do
// khaas baatein yahan hain:
//
//   1. Password kabhi bhi API se bahar nahi jata. Naya user banane par uske
//      paas password hota hi nahi — use "Invited" rakhte hain aur email se
//      link bhejte hain.
//   2. Koi bhi apne aap ko band ya delete nahi kar sakta, aur aakhri Super
//      Admin ko bhi nahi hataya ja sakta. Warna app me koi ghus hi nahi payega.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { notifySuperAdmins, sendSystemEmail } from '../services/systemMail.js';
import { hashPassword } from '../lib/password.js';
import { newRefreshToken } from '../lib/tokens.js';
import { env } from '../env.js';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE } from '../lib/languages.js';

const router = Router();

const userInput = z.object({
  name: z.string().trim().min(1, 'Naam zaroori hai').max(120),
  email: z.string().trim().email('Sahi email daalo').max(200),
  role: z.string().trim().min(1, 'Role chuno'),
  department: z.string().trim().max(120).default(''),
  status: z.enum(['Active', 'Invited', 'Disabled']).default('Invited'),
  // Yeh person ke real system emails (invite, password reset, waghairah) isi
  // language me jaate hain. Campaigns se alag hai — wo har baar manually
  // choose ki jaati hain.
  language: z.enum(LANGUAGE_CODES).default(DEFAULT_LANGUAGE),
});

/** Naam se initials — "Rohit Sharma" se "RS". */
function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function userToApi(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role_key,
    department: row.department ?? '',
    status: row.status,
    initials: row.initials,
    lastActive: row.last_active,
    language: row.language,
    // Batata hai ki user ne apna password set kiya hai ya nahi. Password khud
    // kabhi nahi bhejte.
    hasPassword: Boolean(row.password_hash),
  };
}

const USER_SELECT = `
  SELECT id, name, email, role_key, status, department, initials, last_active, password_hash, language
    FROM users
`;

// --- 1. saare users ---------------------------------------------------------
router.get(
  '/',
  requireModule('users', 'view'),
  asyncHandler(async (req, res) => {
    const totalRow = await one('SELECT count(*)::int AS n FROM users');
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(`${USER_SELECT} ORDER BY created_at ASC LIMIT $1 OFFSET $2`, [
      limit,
      offset,
    ]);

    res.json({
      ...paginated(rows.map(userToApi), { page, limit }, totalRow?.n ?? 0),
      users: rows.map(userToApi),
    });
  })
);

// --- 2. naya user -----------------------------------------------------------
router.post(
  '/',
  requireModule('users', 'create'),
  validate(userInput),
  asyncHandler(async (req, res) => {
    const { name, email, role, department, status, language } = req.body;

    const roleRow = await one('SELECT key FROM roles WHERE key = $1', [role]);
    if (!roleRow) throw badRequest('Yeh role hai hi nahi');

    const clash = await one('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (clash) throw badRequest('Is email se ek user pehle se hai');

    const id = newId('u');

    // Naye user ka password hum nahi banate. Wo khud email ke link se banata
    // hai — isse password kabhi kisi teesre ke haath nahi lagta.
    await query(
      `INSERT INTO users (id, name, email, password_hash, role_key, status, department, initials, language)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8)`,
      [id, name, email, role, status, department, initialsOf(name), language]
    );

    await logActivity(req, {
      action: 'created',
      module: 'users',
      item: name,
      detail: `Naya user bana. Role: ${role}`,
    });

    await sendInvite(req, { id, name, email, role, language });

    // "admin.userCreated" ka wada hai "har naya user banne par Super Admin ko
    // ek copy" — pehle yeh kabhi bulaya hi nahi jata tha, isliye System Emails
    // page par yeh template dikhta to tha par kabhi jata nahi tha.
    await notifySuperAdmins('admin.userCreated', {
      name,
      email,
      role,
      created_by: req.user.name,
      change_time: new Date().toUTCString(),
      activity_url: `${env.appUrl}/activity`,
    });

    const row = await one(`${USER_SELECT} WHERE id = $1`, [id]);
    res.status(201).json({ user: userToApi(row) });
  })
);

// --- 3. user badlo ----------------------------------------------------------
router.put(
  '/:id',
  requireModule('users', 'edit'),
  validate(userInput),
  asyncHandler(async (req, res) => {
    const existing = await one(`${USER_SELECT} WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound('Yeh user nahi mila');

    const { name, email, role, department, status, language } = req.body;

    const roleRow = await one('SELECT key FROM roles WHERE key = $1', [role]);
    if (!roleRow) throw badRequest('Yeh role hai hi nahi');

    const clash = await one('SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2', [
      email,
      req.params.id,
    ]);
    if (clash) throw badRequest('Is email se ek aur user pehle se hai');

    // Apne aap ko band kar lena ya apna hi role ghata lena — dono se aadmi
    // bahar ho jata hai aur phir andar nahi aa pata.
    if (existing.id === req.user.id && status !== 'Active') {
      throw badRequest('Apne aap ko band nahi kar sakte');
    }
    if (existing.id === req.user.id && role !== existing.role_key) {
      throw badRequest('Apna khud ka role nahi badal sakte. Kisi doosre Super Admin se karwao.');
    }
    if (existing.role_key === 'super_admin' && role !== 'super_admin') {
      await guardLastSuperAdmin(existing.id);
    }

    // Email seedha nahi badalte — pehle naye address par ek confirm-link
    // jaata hai. Jab tak wahan se confirm na ho, purana email hi chalta rehta
    // hai. Warna galti se typo kiya hua email save ho jaata aur wo user kabhi
    // andar hi nahi aa pata.
    const emailChanged = email.toLowerCase() !== existing.email.toLowerCase();

    await query(
      `UPDATE users
          SET name = $1, role_key = $2, department = $3, status = $4,
              initials = $5, language = $6, updated_at = now()
        WHERE id = $7`,
      [name, role, department, status, initialsOf(name), language, req.params.id]
    );

    if (emailChanged) {
      await sendEmailChangeConfirm(req, existing, email);
    }

    // Band kiye gaye user ki har khuli session turant band ho jaye.
    if (status === 'Disabled') {
      await query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [req.params.id]
      );
    }

    const changes = [];
    if (existing.role_key !== role) changes.push(`Role: ${existing.role_key} se ${role}`);
    if (existing.status !== status) changes.push(`Status: ${existing.status} se ${status}`);
    if (emailChanged) changes.push(`Naya email jodne ke liye "${email}" par confirm-link bheja`);

    await logActivity(req, {
      action: 'updated',
      module: 'users',
      item: name,
      detail: changes.length ? changes.join(', ') : 'User ki detail badli',
      before: changes.length ? `${existing.role_key} / ${existing.status}` : null,
      after: changes.length ? `${role} / ${status}` : null,
    });

    // Purana email hi abhi bhi asli hai (naya wala sirf tab lagta hai jab
    // confirm ho chuka ho) — isliye ye do notification usi purane par jaati
    // hain, naye (abhi tak validate na hue) address par nahi.
    if (existing.role_key !== role) {
      await sendSystemEmail(
        'user.roleChanged',
        { email: existing.email, name, language },
        {
          old_role: existing.role_key,
          new_role: role,
          changed_by: req.user.name,
          change_time: new Date().toUTCString(),
        }
      );
    }

    if (existing.status !== 'Disabled' && status === 'Disabled') {
      await sendSystemEmail(
        'user.disabled',
        { email: existing.email, name, language },
        { changed_by: req.user.name, change_time: new Date().toUTCString() }
      );
    }

    const row = await one(`${USER_SELECT} WHERE id = $1`, [req.params.id]);
    res.json({ user: userToApi(row), pendingEmail: emailChanged ? email : null });
  })
);

// --- 4. user hatao ----------------------------------------------------------
router.delete(
  '/:id',
  requireModule('users', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one(`${USER_SELECT} WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound('Yeh user nahi mila');

    if (existing.id === req.user.id) throw badRequest('Apne aap ko delete nahi kar sakte');
    if (existing.role_key === 'super_admin') await guardLastSuperAdmin(existing.id);

    await query('DELETE FROM users WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'users',
      item: existing.name,
      detail: 'User hata diya gaya',
    });

    res.json({ ok: true });
  })
);

// --- 5. password set karne ka link bhejo ------------------------------------
router.post(
  '/:id/reset-link',
  requireModule('users', 'edit'),
  asyncHandler(async (req, res) => {
    const user = await one('SELECT id, name, email, language FROM users WHERE id = $1', [req.params.id]);
    if (!user) throw notFound('Yeh user nahi mila');

    await sendInvite(req, { ...user, role: null });

    await logActivity(req, {
      action: 'sent',
      module: 'users',
      item: user.name,
      detail: 'Password set karne ka link bheja gaya',
    });

    res.json({ ok: true });
  })
);

// --- 6. admin khud password set kare ----------------------------------------
/**
 * Yeh reset link se kam surakshit hai — password admin ko pata chal jata hai.
 * Isliye user ko turant email jata hai ki uska password badla gaya, aur uski
 * saari khuli sessions band kar di jati hain.
 */
router.post(
  '/:id/password',
  requireModule('users', 'edit'),
  validate(
    z.object({
      password: z.string().min(8, 'Kam se kam 8 akshar'),
      // User ko email jaye ya nahi. Default "haan" — apna password badla hai
      // yeh pata chalna insaan ka haq hai, aur agar wo usne nahi karwaya to
      // isi email se use pata chalega.
      notify: z.boolean().default(true),
    })
  ),
  asyncHandler(async (req, res) => {
    const user = await one('SELECT id, name, email, language FROM users WHERE id = $1', [req.params.id]);
    if (!user) throw notFound('Yeh user nahi mila');

    await query(
      `UPDATE users SET password_hash = $1, status = 'Active', updated_at = now() WHERE id = $2`,
      [await hashPassword(req.body.password), user.id]
    );
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'users',
      item: user.name,
      detail: 'Admin ne password set kiya',
    });

    if (req.body.notify) {
      await sendSystemEmail(
        'password.setByAdmin',
        { email: user.email, name: user.name, language: user.language },
        {
          changed_by: req.user.name,
          change_time: new Date().toUTCString(),
          sign_in_url: `${env.appUrl}/login`,
        }
      );
    }

    res.json({ ok: true });
  })
);

/**
 * Aakhri Super Admin ko hataane ya ghataane se rokta hai.
 *
 * Yeh sirf "achha rehta hai" wali baat nahi hai. Agar ek bhi Super Admin na
 * bache, to roles kabhi badle hi nahi ja sakte — app hamesha ke liye atak
 * jata hai.
 */
async function guardLastSuperAdmin(exceptId) {
  const row = await one(
    `SELECT count(*)::int AS n FROM users
      WHERE role_key = 'super_admin' AND status = 'Active' AND id <> $1`,
    [exceptId]
  );

  if ((row?.n ?? 0) === 0) {
    throw badRequest('Yeh aakhri Super Admin hai. Pehle kisi aur ko Super Admin banao.');
  }
}

/** Naye user ko "apna password banao" wala link email karta hai. */
async function sendInvite(req, user) {
  const { token, hash } = newRefreshToken();

  await query(
    `INSERT INTO password_tokens (id, user_id, token_hash, purpose, expires_at)
     VALUES ($1,$2,$3,'invite', now() + interval '7 days')`,
    [newId('pt'), user.id, hash]
  );

  // Invite ka apna page hai — "naya password banao" wala. /reset-password
  // "password bhool gaye" ke liye hai; naye user ko wo dikhana confusing hai.
  const inviteUrl = `${env.appUrl}/set-password?token=${token}`;

  const sent = await sendSystemEmail(
    'user.invited',
    { email: user.email, name: user.name, language: user.language },
    {
      // Naam bilkul wahi hona chahiye jo template me likha hai. Pehle yahan
      // `invite_url` bheja jata tha jabki template `set_password_url` maangta
      // hai — isliye email me button ka link KHALI jata tha aur naya user
      // kabhi andar nahi aa pata tha.
      set_password_url: inviteUrl,
      invited_by: req.user.name,
      role: user.role ?? '',
      email: user.email,
    }
  );

  // Email na ja paye to link server ke console par — warna naya user kabhi
  // andar hi nahi aa payega aur kisi ko pata bhi nahi chalega.
  if (!sent.ok) {
    console.warn(
      `[users] ${user.email} ko invite email nahi ja saka (${sent.reason}). Link neeche hai, 7 din chalega:\n  ${inviteUrl}`
    );
  }
}

/**
 * Email badalne se pehle NAYE address par ek confirm-link bhejta hai. Jab tak
 * wahan se click nahi hota, users.email waisa hi rehta hai jaisa pehle tha —
 * isliye ek typo se kisi ka account lock nahi hota.
 */
async function sendEmailChangeConfirm(req, existing, newEmail) {
  const { token, hash } = newRefreshToken();

  await query(
    `INSERT INTO email_change_tokens (id, user_id, new_email, token_hash, expires_at)
     VALUES ($1,$2,$3,$4, now() + interval '1 hour')`,
    [newId('ect'), existing.id, newEmail, hash]
  );

  const confirmUrl = `${env.appUrl}/confirm-email?token=${token}`;

  const sent = await sendSystemEmail(
    'user.emailChangeConfirm',
    { email: newEmail, name: existing.name, language: existing.language },
    { new_email: newEmail, confirm_url: confirmUrl, changed_by: req.user.name }
  );

  // Email na ja paye to link console par — warna naya email kabhi confirm hi
  // nahi ho payega.
  if (!sent.ok) {
    console.warn(
      `[users] ${newEmail} ko confirm-email link nahi ja saka (${sent.reason}). Link neeche hai, 1 ghanta chalega:\n  ${confirmUrl}`
    );
  }
}

export default router;

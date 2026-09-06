import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { sendSystemEmail } from '../services/systemMail.js';
import { asyncHandler, badRequest, unauthorized } from '../lib/http.js';
import { clientIp, logActivity } from '../lib/activity.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { hashToken, newRefreshToken, refreshExpiry, signAccessToken } from '../lib/tokens.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { permissionsFor } from '../middleware/permissions.js';

const router = Router();

/**
 * Password guess karne wale ko rokna — bina asli logon ko roke.
 *
 * Ginti EK ACCOUNT ki hoti hai, poore office ki nahi.
 *
 * Pehle ginti sirf IP se hoti thi. Ek office me sab log ek hi internet par
 * hote hain — to das logon ke subah login karne se hi budget khatam ho jata
 * aur sabka darwaza band ho jata, jabki galti kisi ne ki hi nahi thi.
 *
 * Ab har email ka apna hisaab hai: kisi ek account par baar-baar galat
 * password daalne wala hi rukta hai, baaki sab chalte rehte hain.
 */
function accountKey(req) {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  // Email na ho (jaise reset-password me sirf token hota hai) to IP hi sahi.
  return email ? `acct:${email}` : `ip:${req.ip}`;
}

const perAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: accountKey,

  // SIRF GALAT koshish gini jati hai.
  //
  // Yeh sabse zaroori baat hai. Rok isliye hai ki koi password guess na kar
  // sake — sahi password daalna guess karna nahi hai. Agar sahi login bhi
  // gine jate, to ek aadmi apne phone aur computer se din me kai baar login
  // karke khud hi bahar ho jata.
  skipSuccessfulRequests: true,

  message: {
    error: {
      code: 'rate_limited',
      message: 'Is account par bahut baar galat password daala gaya. Kuch minute baad dobara try karo.',
    },
  },
});

/**
 * Aur ek chaudi rok — ek hi jagah se bahut saare alag-alag account try karne
 * walon ke liye. Yeh sankhya jaan-boojh kar badi rakhi hai, taki ek office ke
 * saare log aaram se kaam kar sakein.
 */
const perIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Bahut zyada koshish ho rahi hai. Kuch minute baad dobara try karo.',
    },
  },
});

/**
 * "Password bhool gaye" aur "naya password set karo" ke liye alag rok.
 *
 * Yahan SAHI request bhi gini jati hai. Wajah: koi kisi ka email daal kar
 * baar-baar reset ka mail bhijwa sakta hai — har baar wo request "sahi" hi
 * hoti hai, par saamne wale ka inbox bhar jata hai.
 */
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: accountKey,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Bahut baar koshish ho chuki. Kuch minute baad dobara try karo.',
    },
  },
});

// Login ke liye: ek account ko bachata hai, aur ek chaudi rok poori jagah ke
// liye.
const authLimiter = [perIpLimiter, perAccountLimiter];

// Sirf "password bhool gaye" ke liye — kyunki wahi email bhejta hai.
//
// "Naya password set karo" (reset-password) ispar NAHI hai. Wo apne aap
// surakshit hai: uske liye email wala token chahiye, jo andaza nahi lagaya ja
// sakta, ek baar hi chalta hai aur 1 ghante me khatam ho jata hai. Us par
// sakht rok lagane se ek nuksaan hota — ek saath 10 naye logon ko invite
// karo to aakhri log apna password set hi nahi kar paate.
const mailLimiter = [perIpLimiter, resetLimiter];

const credentials = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/** Everything the app needs about the signed-in person, in one shape. */
async function sessionPayload(user) {
  const role = await one(
    `SELECT key, label, label_key, descr, descr_key, tone, icon, locked, custom
       FROM roles WHERE key = $1`,
    [user.role_key]
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials,
      department: user.department,
      status: user.status,
      role: user.role_key,
    },
    role: role
      ? {
          key: role.key,
          label: role.label,
          labelKey: role.label_key,
          desc: role.descr,
          descKey: role.descr_key,
          tone: role.tone,
          icon: role.icon,
          locked: role.locked,
          custom: role.custom,
          permissions: await permissionsFor(role.key),
        }
      : null,
  };
}

async function issueSession(req, res, user) {
  const { token, hash } = newRefreshToken();
  const expires = refreshExpiry();

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [newId('rt'), user.id, hash, expires, req.get('user-agent')?.slice(0, 200) ?? null, clientIp(req)]
  );

  await query('UPDATE users SET last_active = now() WHERE id = $1', [user.id]);

  // httpOnly: JavaScript in the page can never read the refresh token, so an
  // XSS bug cannot walk away with a long-lived credential.
  res.cookie('mw_refresh', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    expires,
    path: '/api/auth',
  });

  return {
    accessToken: signAccessToken(user),
    expiresIn: env.accessTokenTtl,
    ...(await sessionPayload(user)),
  };
}

// --- sign in ----------------------------------------------------------------

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    // Deliberately the same error whether the address is unknown, the password
    // is wrong, or the field was empty — no hints for someone guessing.
    if (!parsed.success) throw unauthorized('That email and password do not match');

    const { email, password } = parsed.data;

    const user = await one(
      `SELECT id, name, email, password_hash, role_key, status, initials, department
         FROM users WHERE lower(email) = lower($1)`,
      [email]
    );

    const ok = await verifyPassword(password, user?.password_hash);
    if (!user || !ok) throw unauthorized('That email and password do not match');
    if (user.status === 'Disabled') throw unauthorized('That account has been turned off');

    // Pehli baar is IP se login — permanent record hai, session/refresh_token
    // ki tarah expire ya revoke nahi hota. UNIQUE constraint khud dedup kar
    // deta hai, isliye ek hi jagah se do login request ek saath aayein to bhi
    // email sirf ek hi jaati hai.
    const newDevice = await one(
      `INSERT INTO known_devices (user_id, ip) VALUES ($1, $2)
       ON CONFLICT (user_id, ip) DO NOTHING
       RETURNING user_id`,
      [user.id, clientIp(req)]
    );

    const payload = await issueSession(req, res, user);
    await logActivity({ ...req, user }, {
      action: 'signedIn',
      module: 'users',
      item: user.name,
      detail: 'Signed in',
    });

    if (newDevice) {
      await sendSystemEmail('login.newDevice', { email: user.email, name: user.name }, {
        device: req.get('user-agent')?.slice(0, 120) || 'unknown device',
        request_ip: clientIp(req),
        // Geo-IP lookup abhi app me nahi hai, isliye shehar ka naam nahi bata
        // sakte — jhooth batane se behtar hai saaf "Unknown" likhna.
        location: 'Unknown',
        change_time: new Date().toUTCString(),
      });
    }

    res.json(payload);
  })
);

// --- keep a session alive ---------------------------------------------------

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.mw_refresh;
    if (!token) throw unauthorized('No session to refresh');

    const stored = await one(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
      [hashToken(token)]
    );

    if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
      res.clearCookie('mw_refresh', { path: '/api/auth' });
      throw unauthorized('Your session has expired');
    }

    const user = await one(
      `SELECT id, name, email, role_key, status, initials, department FROM users WHERE id = $1`,
      [stored.user_id]
    );
    if (!user || user.status === 'Disabled') throw unauthorized('That account is no longer active');

    // Rotate: the old token dies with this request, so a stolen one is usable
    // at most once and the theft shows up as an unexpected logout.
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);

    res.json(await issueSession(req, res, user));
  })
);

// --- sign out ---------------------------------------------------------------

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.mw_refresh;
    if (token) {
      await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(token)]);
    }
    res.clearCookie('mw_refresh', { path: '/api/auth' });
    res.json({ ok: true });
  })
);

/** Signs out every device — used after a password change. */
router.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [req.user.id]
    );
    res.clearCookie('mw_refresh', { path: '/api/auth' });
    res.json({ ok: true });
  })
);

// --- who am I ---------------------------------------------------------------

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await sessionPayload(req.user));
  })
);

/** Naam se initials — "Rohit Sharma" se "RS". */
function initialsOf(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/**
 * Apni khud ki profile badalna — naam aur department. Email yahan se nahi
 * badalta: wo Users page se hota hai, jahan naye address par ek confirm-link
 * jaata hai (isliye ki galti se type kiya hua email account lock na kar de).
 * Yeh kisi permission ke peeche nahi hai — apna naam badalna sabka haq hai,
 * role kuch bhi ho.
 */
router.put(
  '/me',
  requireAuth,
  validate(
    z.object({
      name: z.string().trim().min(1, 'Naam khali nahi ho sakta').max(120),
      department: z.string().trim().max(120).default(''),
    })
  ),
  asyncHandler(async (req, res) => {
    await query(
      'UPDATE users SET name = $1, department = $2, initials = $3, updated_at = now() WHERE id = $4',
      [req.body.name, req.body.department, initialsOf(req.body.name), req.user.id]
    );

    await logActivity({ ...req, user: { ...req.user, name: req.body.name } }, {
      action: 'updated',
      module: 'users',
      item: req.body.name,
      detail: 'Apni profile badli',
    });

    const user = await one(
      `SELECT id, name, email, role_key, status, initials, department FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json(await sessionPayload(user));
  })
);

// --- password ---------------------------------------------------------------

router.post(
  '/forgot-password',
  mailLimiter,
  asyncHandler(async (req, res) => {
    const email = z.string().trim().email().safeParse(req.body?.email);

    // Always the same answer, so this cannot be used to find out which
    // addresses have accounts.
    const answer = { ok: true };
    if (!email.success) {
      res.json(answer);
      return;
    }

    const user = await one('SELECT id, name FROM users WHERE lower(email) = lower($1)', [email.data]);
    if (!user) {
      res.json(answer);
      return;
    }

    const { token, hash } = newRefreshToken();
    await query(
      `INSERT INTO password_tokens (id, user_id, token_hash, purpose, expires_at)
       VALUES ($1,$2,$3,'reset', now() + interval '1 hour')`,
      [newId('pt'), user.id, hash]
    );

    await logActivity({ ...req, user: { ...user, initials: null } }, {
      action: 'sent',
      module: 'users',
      item: user.name,
      detail: 'Password reset link requested',
    });

    const resetUrl = `${env.appUrl}/reset-password?token=${token}`;

    const sent = await sendSystemEmail(
      'password.reset',
      { email: email.data, name: user.name },
      {
        reset_url: resetUrl,
        request_ip: req.ip || '',
        request_time: new Date().toUTCString(),
      }
    );

    // Link ko kabhi bhi HTTP jawab me wapas nahi bhejte. Bhej dete to koi bhi
    // kisi ka bhi email daal kar uska reset link le leta aur account khol leta
    // — mailbox tak pahunch ke bina.
    //
    // Agar email ja hi nahi paya (abhi tak koi account juda nahi hai), to link
    // server ke console par chhap dete hain. Sirf wahi insaan ise dekh sakta
    // hai jo khud server chala raha hai.
    if (!sent.ok) {
      console.warn(
        `[auth] ${email.data} ka password reset email nahi ja saka (${sent.reason}). Link neeche hai — 1 ghanta chalega:
  ${resetUrl}`
      );
    }

    res.json(answer);
  })
);

/**
 * "Aapka password badal diya gaya" wali email. Password reset se ho ya user ne
 * khud badla ho — dono jagah yahi jaati hai.
 */
async function notifyPasswordChanged(req, user) {
  if (!user?.email) return;

  await sendSystemEmail(
    'password.changed',
    { email: user.email, name: user.name },
    {
      change_time: new Date().toUTCString(),
      request_ip: clientIp(req) || '',
      device: req.get('user-agent')?.slice(0, 120) || 'unknown device',
    }
  );
}

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      token: z.string().min(10, 'That link is not valid'),
      password: z.string().min(8, 'Use at least 8 characters'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the form', parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    })));

    const stored = await one(
      `SELECT id, user_id, expires_at, used_at FROM password_tokens WHERE token_hash = $1`,
      [hashToken(parsed.data.token)]
    );

    if (!stored || stored.used_at || new Date(stored.expires_at) < new Date()) {
      throw badRequest('That link has expired. Ask for a new one.');
    }

    const hash = await hashPassword(parsed.data.password);

    await query('UPDATE users SET password_hash = $1, status = $2, updated_at = now() WHERE id = $3', [
      hash,
      'Active',
      stored.user_id,
    ]);
    await query('UPDATE password_tokens SET used_at = now() WHERE id = $1', [stored.id]);
    // A password change invalidates every existing session.
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [stored.user_id]
    );

    const user = await one('SELECT id, name, email FROM users WHERE id = $1', [stored.user_id]);
    await logActivity({ ...req, user }, {
      action: 'updated',
      module: 'users',
      item: user?.name ?? stored.user_id,
      detail: 'Password changed from a reset link',
      before: 'Password: unchanged',
      after: 'Password: replaced',
    });

    // Password badalne ki khabar user ko zaroor jaani chahiye. Agar yeh usne
    // nahi kiya, to isi email se use pata chalega.
    await notifyPasswordChanged(req, user);

    res.json({ ok: true });
  })
);

/**
 * Email change ka doosra pehlu: naya address wale link par click karte hi
 * yahan tak pahunchta hai. Tabhi jaake users.email asal me badalta hai.
 */
router.post(
  '/confirm-email-change',
  authLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({ token: z.string().min(10, 'That link is not valid') });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('That link is not valid');

    const stored = await one(
      `SELECT id, user_id, new_email, expires_at, used_at FROM email_change_tokens WHERE token_hash = $1`,
      [hashToken(parsed.data.token)]
    );

    if (!stored || stored.used_at || new Date(stored.expires_at) < new Date()) {
      throw badRequest('That link has expired. Ask a Super Admin to change your email again.');
    }

    const clash = await one('SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2', [
      stored.new_email,
      stored.user_id,
    ]);
    if (clash) throw badRequest('Is email se ek aur user pehle se hai');

    await query('UPDATE users SET email = $1, updated_at = now() WHERE id = $2', [
      stored.new_email,
      stored.user_id,
    ]);
    await query('UPDATE email_change_tokens SET used_at = now() WHERE id = $1', [stored.id]);

    const user = await one('SELECT id, name, email FROM users WHERE id = $1', [stored.user_id]);
    await logActivity({ ...req, user }, {
      action: 'updated',
      module: 'users',
      item: user?.name ?? stored.user_id,
      detail: 'Email confirm ho gaya',
      after: `Email: ${stored.new_email}`,
    });

    res.json({ ok: true, email: stored.new_email });
  })
);

/** Changing your own password, while signed in. */
router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      currentPassword: z.string().min(1, 'Enter your current password'),
      newPassword: z.string().min(8, 'Use at least 8 characters'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Check the form', parsed.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })));
    }

    const row = await one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const ok = await verifyPassword(parsed.data.currentPassword, row?.password_hash);
    if (!ok) throw badRequest('Your current password is not right');

    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      await hashPassword(parsed.data.newPassword),
      req.user.id,
    ]);
    await query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [req.user.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'users',
      item: req.user.name,
      detail: 'Changed their own password',
    });

    await notifyPasswordChanged(req, req.user);

    res.json({ ok: true });
  })
);

/** The languages/roles the sign-in screen needs before anyone is signed in. */
router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT key, label, label_key FROM roles ORDER BY sort_order');
    res.json({ roles: rows.map((r) => ({ key: r.key, label: r.label, labelKey: r.label_key })) });
  })
);

export default router;

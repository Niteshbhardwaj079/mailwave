// ---------------------------------------------------------------------------
// Email accounts — jin se mail jayega.
//
// Sabse zaroori baat: SAVE KARNE SE PEHLE CONNECTION TEST hota hai.
// Agar password galat hai to abhi pata chal jayega, na ki campaign bhejne ke
// baad jab 500 email fail ho chuke honge.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import nodemailer from 'nodemailer';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { maskSecrets, openSecrets, sealSecrets } from '../lib/secretbox.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { explainSmtpError, providerList, providerPreset } from '../services/providers.js';
import { sendMail } from '../services/mailer.js';

const router = Router();

const accountInput = z.object({
  email: z.string().trim().email('Sahi email address daalo'),
  displayName: z.string().trim().max(120).optional().nullable(),
  provider: z.string().trim().min(1).default('smtp'),
  dailyLimit: z.number().int().min(1).max(1_000_000).optional(),
  // Custom SMTP ke liye — baaki providers me preset se bhar jate hain.
  host: z.string().trim().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().trim().max(200).optional(),
  pass: z.string().max(500).optional(),
});

function toApi(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    provider: row.provider,
    providerName: providerPreset(row.provider).name,
    status: row.status,
    dailyLimit: row.daily_limit,
    sentToday: row.sent_today,
    // Password kabhi bahar nahi jata — sirf "bhara hua hai ya nahi".
    smtp: maskSecrets(row.secrets || {}),
    createdAt: row.created_at,
  };
}

/** User ne jo bhara + provider ka preset = final SMTP setting. */
function buildSecrets(body) {
  const preset = providerPreset(body.provider);

  return {
    host: body.host?.trim() || preset.host,
    port: body.port ?? preset.port,
    secure: body.secure ?? preset.secure,
    // SendGrid jaise providers me username fixed hota hai.
    user: preset.fixedUser || body.user?.trim() || body.email,
    pass: body.pass ?? '',
  };
}

/** Sirf connection jodkar dekhta hai — koi email nahi bhejta. */
async function testConnection(secrets, providerKey) {
  if (!secrets.host) throw badRequest('SMTP server ka naam (host) bharo');
  if (!secrets.pass) throw badRequest('Password bharo');

  const transport = nodemailer.createTransport({
    host: secrets.host,
    port: Number(secrets.port) || 587,
    secure: Number(secrets.port) === 465 || secrets.secure === true,
    auth: { user: secrets.user, pass: secrets.pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: explainSmtpError(error, providerKey) };
  } finally {
    transport.close();
  }
}

// --- providers ki list (screen par dropdown bharne ke liye) -----------------
router.get(
  '/providers',
  asyncHandler(async (req, res) => {
    res.json({ providers: providerList() });
  })
);

// --- accounts ki list -------------------------------------------------------
router.get(
  '/',
  requireModule('accounts', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT * FROM email_accounts ORDER BY created_at');
    res.json({ accounts: rows.map(toApi) });
  })
);

router.get(
  '/:id',
  requireModule('accounts', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one('SELECT * FROM email_accounts WHERE id = $1', [req.params.id]);
    if (!row) throw notFound('Yeh account nahi mila');
    res.json({ account: toApi(row) });
  })
);

// --- save karne se PEHLE test karo ------------------------------------------
// Frontend ise "Test connection" button par bulata hai.
router.post(
  '/test-connection',
  requireModule('accounts', 'create'),
  validate(accountInput),
  asyncHandler(async (req, res) => {
    const secrets = buildSecrets(req.body);
    const result = await testConnection(secrets, req.body.provider);

    if (!result.ok) {
      res.status(400).json({
        ok: false,
        error: { code: 'smtp_failed', message: result.message },
        // Screen par steps dikha sakein.
        help: providerPreset(req.body.provider).help,
      });
      return;
    }

    res.json({ ok: true, message: 'Connection ban gaya. Ab save kar sakte ho.' });
  })
);

// --- naya account jodo ------------------------------------------------------
router.post(
  '/',
  requireModule('accounts', 'create'),
  validate(accountInput),
  asyncHandler(async (req, res) => {
    const body = req.body;

    const duplicate = await one('SELECT id FROM email_accounts WHERE lower(email) = lower($1)', [body.email]);
    if (duplicate) throw conflict('Yeh email account pehle se juda hua hai');

    const secrets = buildSecrets(body);
    const preset = providerPreset(body.provider);

    // Yahi wo jagah hai jahan galti pakdi jati hai — save se pehle.
    const test = await testConnection(secrets, body.provider);
    if (!test.ok) {
      res.status(400).json({
        ok: false,
        error: { code: 'smtp_failed', message: test.message },
        help: preset.help,
      });
      return;
    }

    const id = newId('acc');
    await query(
      `INSERT INTO email_accounts (id, email, display_name, provider, status, daily_limit, secrets, quota_date)
       VALUES ($1,$2,$3,$4,'Connected',$5,$6, current_date)`,
      [
        id,
        body.email,
        body.displayName ?? null,
        body.provider,
        body.dailyLimit ?? preset.dailyLimitHint,
        JSON.stringify(sealSecrets(secrets)), // password encrypt hokar jata hai
      ]
    );

    await logActivity(req, {
      action: 'created',
      module: 'accounts',
      item: body.email,
      detail: `${preset.name} account juda`,
    });

    const row = await one('SELECT * FROM email_accounts WHERE id = $1', [id]);
    res.status(201).json({ account: toApi(row) });
  })
);

// --- account badlo ----------------------------------------------------------
router.put(
  '/:id',
  requireModule('accounts', 'edit'),
  validate(accountInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT * FROM email_accounts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh account nahi mila');

    const body = req.body;
    const preset = providerPreset(body.provider);

    // Password khali chhoda hai to matlab "purana hi rehne do".
    const secrets = buildSecrets(body);
    if (!body.pass) {
      secrets.pass = openSecrets(existing.secrets || {}).pass ?? '';
    }

    const test = await testConnection(secrets, body.provider);
    if (!test.ok) {
      res.status(400).json({ ok: false, error: { code: 'smtp_failed', message: test.message }, help: preset.help });
      return;
    }

    await query(
      `UPDATE email_accounts
          SET email = $1, display_name = $2, provider = $3, daily_limit = $4,
              secrets = $5, status = 'Connected', updated_at = now()
        WHERE id = $6`,
      [
        body.email,
        body.displayName ?? null,
        body.provider,
        body.dailyLimit ?? existing.daily_limit,
        JSON.stringify(sealSecrets(secrets)),
        req.params.id,
      ]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'accounts',
      item: body.email,
      detail: 'Account ki setting badli',
    });

    const row = await one('SELECT * FROM email_accounts WHERE id = $1', [req.params.id]);
    res.json({ account: toApi(row) });
  })
);

// --- jude hue account ka test (asli email bhejta hai) -----------------------
router.post(
  '/:id/test-email',
  requireModule('accounts', 'edit'),
  validate(z.object({ to: z.string().trim().email('Sahi email daalo') })),
  asyncHandler(async (req, res) => {
    const row = await one('SELECT * FROM email_accounts WHERE id = $1', [req.params.id]);
    if (!row) throw notFound('Yeh account nahi mila');

    // mailer khud decrypt karta hai, isliye row seedhi bhej rahe hain.
    const account = row;

    try {
      const result = await sendMail(account, {
        to: req.body.to,
        fromName: account.display_name,
        subject: `${env.brand.name} test email`,
        html: `<p>Yeh ek test email hai.</p>
               <p>Agar yeh aap tak pahunch gaya, to <b>${account.email}</b> se email bhejna kaam kar raha hai.</p>`,
        text: 'Yeh ek test email hai. Agar yeh pahunch gaya to account kaam kar raha hai.',
      });

      await query(`UPDATE email_accounts SET status = 'Connected', updated_at = now() WHERE id = $1`, [row.id]);
      await logActivity(req, {
        action: 'sent',
        module: 'accounts',
        item: account.email,
        detail: `Test email ${req.body.to} par bheja`,
      });

      res.json({ ok: true, messageId: result.messageId, previewUrl: result.previewUrl });
    } catch (error) {
      await query(`UPDATE email_accounts SET status = 'Needs attention' WHERE id = $1`, [row.id]);
      res.status(400).json({
        ok: false,
        error: { code: 'send_failed', message: explainSmtpError(error, row.provider) },
        help: providerPreset(row.provider).help,
      });
    }
  })
);

// --- account hatao ----------------------------------------------------------
router.delete(
  '/:id',
  requireModule('accounts', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, email FROM email_accounts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh account nahi mila');

    const inUse = await one(
      `SELECT count(*)::int AS n FROM campaigns WHERE account_id = $1 AND status IN ('Sending','Scheduled')`,
      [req.params.id]
    );
    if ((inUse?.n ?? 0) > 0) {
      throw badRequest('Yeh account abhi kisi chalte hue campaign me lag raha hai. Pehle wo campaign roko.');
    }

    await query('DELETE FROM email_accounts WHERE id = $1', [req.params.id]);
    await logActivity(req, {
      action: 'deleted',
      module: 'accounts',
      item: existing.email,
      detail: 'Account hata diya gaya',
    });

    res.json({ ok: true });
  })
);

export default router;

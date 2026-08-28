import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { asyncHandler, badRequest, unauthorized } from '../lib/http.js';
import { clientIp, logActivity } from '../lib/activity.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { hashToken, newRefreshToken, refreshExpiry, signAccessToken } from '../lib/tokens.js';
import { newId } from '../lib/ids.js';
import { requireAuth } from '../middleware/auth.js';
import { permissionsFor } from '../middleware/permissions.js';

const router = Router();

// Credential endpoints are the ones worth guessing at, so they get their own
// budget. Everything else is covered by the global limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } },
});

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

    const payload = await issueSession(req, res, user);
    await logActivity({ ...req, user }, {
      action: 'signedIn',
      module: 'users',
      item: user.name,
      detail: 'Signed in',
    });

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

// --- password ---------------------------------------------------------------

router.post(
  '/forgot-password',
  authLimiter,
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
       VALUES ($1,$2,$3,'reset', now() + interval '2 hours')`,
      [newId('pt'), user.id, hash]
    );

    await logActivity({ ...req, user: { ...user, initials: null } }, {
      action: 'sent',
      module: 'users',
      item: user.name,
      detail: 'Password reset link requested',
    });

    // Until an email account is connected there is nowhere to send this, so in
    // development the link is returned instead of silently going nowhere.
    if (env.nodeEnv !== 'production') answer.resetUrl = `${env.appUrl}/reset-password?token=${token}`;

    res.json(answer);
  })
);

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

    const user = await one('SELECT id, name FROM users WHERE id = $1', [stored.user_id]);
    await logActivity({ ...req, user }, {
      action: 'updated',
      module: 'users',
      item: user?.name ?? stored.user_id,
      detail: 'Password changed from a reset link',
      before: 'Password: unchanged',
      after: 'Password: replaced',
    });

    res.json({ ok: true });
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

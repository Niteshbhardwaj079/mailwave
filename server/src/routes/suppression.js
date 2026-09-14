// ---------------------------------------------------------------------------
// Suppression List — jinhe kabhi campaign email nahi jaani chahiye.
//
// Yeh table apne aap bharti hai jab koi REAL signal milta hai — kisi ne
// unsubscribe kiya (routes/track.js), ya SMTP ne recipient ko permanent
// (5xx) reject kar diya, matlab hard bounce (services/sender.js). Yeh screen
// sirf usi data ko dikhati, search/filter karti, aur ek admin ko HAATH SE
// bhi koi email suppress/un-suppress karne deti hai (jaise koi khud email
// karke bola "mujhe mat bhejo").
//
// 'complaint' reason isi tarah ka hai — sirf ek asli email-provider
// webhook/event se hi bharna chahiye, kabhi guess se nahi. Abhi koi aisa
// provider integration nahi hai, isliye 'complaint' sirf admin khud manual
// add kare tabhi lagta hai — system khud kabhi nahi jodta.
//
// Manually admin se joda gaya entry hamesha GLOBAL hota hai (account_id ''),
// taaki wo kisi ek campaign/account tak seemit na rahe — poori app me har
// future send se yeh address hamesha bahar rahe.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, conflict, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

const REASONS = ['bounced', 'unsubscribed', 'complaint', 'manual', 'invalid'];

const addInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  reason: z.enum(REASONS, { errorMap: () => ({ message: 'Pick a valid reason' }) }),
  detail: z.string().trim().max(500).optional().nullable(),
});

function toApi(row) {
  return {
    email: row.email,
    reason: row.reason,
    detail: row.detail,
    accountId: row.account_id || null,
    // '' account_id = applies to every connected account (see schema.sql's
    // comment on the suppression table) — the frontend shows this as
    // "All accounts" rather than a blank value.
    accountEmail: row.account_id ? row.account_email ?? null : null,
    createdAt: row.created_at,
  };
}

const SELECT = `
  SELECT s.account_id, s.email, s.reason, s.detail, s.created_at, a.email AS account_email
    FROM suppression s
    LEFT JOIN email_accounts a ON a.id = s.account_id
`;

function buildFilter(req) {
  const search = String(req.query.search ?? '').trim();
  const reason = String(req.query.reason ?? '').trim();

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`lower(s.email) LIKE $${params.length}`);
  }

  if (reason && reason !== 'All') {
    if (!REASONS.includes(reason)) throw badRequest('Unknown reason filter');
    params.push(reason);
    where.push(`s.reason = $${params.length}`);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// --- list, search aur filter ke saath ----------------------------------------
router.get(
  '/',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const { clause, params } = buildFilter(req);

    const totalRow = await one(`SELECT count(*)::int AS n FROM suppression s ${clause}`, params);
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `${SELECT} ${clause} ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0));
  })
);

// --- haath se ek email jodo ---------------------------------------------------
router.post(
  '/',
  requireModule('contacts', 'edit'),
  validate(addInput),
  asyncHandler(async (req, res) => {
    const { email, reason, detail } = req.body;

    // Global entry — '' account_id, jaise track.js ka unsubscribe() bhi
    // "Apply globally" chalu hone par karta hai.
    const existing = await one('SELECT email FROM suppression WHERE account_id = $1 AND email = $2', ['', email]);
    if (existing) throw conflict('This email is already on the suppression list (all accounts)');

    await query(
      `INSERT INTO suppression (account_id, email, reason, detail) VALUES ('', $1, $2, $3)`,
      [email, reason, detail || null]
    );

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: email,
      detail: `Suppression list me haath se jodi (${reason})`,
    });

    const row = await one(`${SELECT} WHERE s.account_id = '' AND s.email = $1`, [email]);
    res.status(201).json({ suppression: toApi(row) });
  })
);

// --- hata do (un-suppress) ----------------------------------------------------
// accountId query param se batate hain kaunsi row — khaali/absent = global
// (''). Composite primary key (account_id, email) hone ki wajah se dono
// chahiye, sirf email kaafi nahi.
router.delete(
  '/:email',
  requireModule('contacts', 'edit'),
  asyncHandler(async (req, res) => {
    const email = String(req.params.email).trim().toLowerCase();
    const accountId = String(req.query.accountId ?? '');

    const existing = await one('SELECT email, reason FROM suppression WHERE account_id = $1 AND email = $2', [
      accountId,
      email,
    ]);
    if (!existing) throw notFound('This email is not on the suppression list');

    await query('DELETE FROM suppression WHERE account_id = $1 AND email = $2', [accountId, email]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: email,
      detail: `Suppression list se hataya (tha: ${existing.reason})`,
    });

    res.status(204).send();
  })
);

export default router;

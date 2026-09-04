// ---------------------------------------------------------------------------
// Subscribers — wo log jinhone khud form bhar kar list join ki.
//
// Yeh contacts se alag hain. Contacts hum khud import karte hain; subscribers
// khud aate hain. Isliye inka email pehle se hi "confirmed" mana jata hai.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

function toApi(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email,
    company: row.company ?? '',
    city: row.city ?? '',
    campaign: row.campaign_name ?? null,
    campaignId: row.campaign_id ?? null,
    status: row.status,
    subscribedAt: row.subscribed_at,
  };
}

const SELECT = `
  SELECT s.*, c.name AS campaign_name
    FROM subscribers s
    LEFT JOIN campaigns c ON c.id = s.campaign_id
`;

router.get(
  '/',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const where = [];
    const params = [];

    if (req.query.status && req.query.status !== 'all') {
      params.push(req.query.status);
      where.push(`s.status = $${params.length}`);
    }

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      const n = params.length;
      where.push(`(s.name ILIKE $${n} OR s.email ILIKE $${n} OR s.company ILIKE $${n})`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = await one(`SELECT count(*)::int AS n FROM subscribers s ${clause}`, params);
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `${SELECT} ${clause} ORDER BY s.subscribed_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      subscribers: rows.map(toApi),
    });
  })
);

/**
 * Chune hue subscribers hatao.
 *
 * Ek saath kai hatane ki wajah: screen par checkbox se select karke "Remove"
 * dabaya jata hai. Ek-ek karke bhejte to 200 subscribers par 200 request
 * jatin.
 */
router.post(
  '/delete',
  requireModule('contacts', 'delete'),
  validate(z.object({ ids: z.array(z.string()).min(1, 'Kam se kam ek chuno').max(1000) })),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;

    const rows = await many('SELECT id, email FROM subscribers WHERE id = ANY($1)', [ids]);
    if (rows.length === 0) throw badRequest('Inme se koi subscriber nahi mila');

    await query('DELETE FROM subscribers WHERE id = ANY($1)', [ids]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: `${rows.length} subscriber`,
      detail: 'Subscriber list se hataye gaye',
    });

    res.json({ ok: true, removed: rows.length });
  })
);

/**
 * Nayi entry — public signup form yahi bulata hai.
 *
 * Wahi email dobara aaye to nayi row nahi banti, purani hi update ho jati hai.
 * Isse ek insaan list me do baar kabhi nahi aata.
 */
router.post(
  '/',
  requireModule('contacts', 'create'),
  validate(
    z.object({
      name: z.string().trim().max(120).default(''),
      email: z.string().trim().email('Sahi email daalo').max(200),
      company: z.string().trim().max(120).default(''),
      city: z.string().trim().max(120).default(''),
      campaignId: z.string().trim().max(60).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { name, email, company, city, campaignId } = req.body;

    const existing = await one('SELECT id FROM subscribers WHERE lower(email) = lower($1)', [email]);

    if (existing) {
      await query(
        `UPDATE subscribers SET name = $1, company = $2, city = $3, status = 'Subscribed'
          WHERE id = $4`,
        [name, company, city, existing.id]
      );
      const row = await one(`${SELECT} WHERE s.id = $1`, [existing.id]);
      res.json({ subscriber: toApi(row), duplicate: true });
      return;
    }

    const id = newId('sub');
    await query(
      `INSERT INTO subscribers (id, name, email, company, city, campaign_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Subscribed')`,
      [id, name, email, company, city, campaignId ?? null]
    );

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: email,
      detail: 'Naya subscriber juda',
    });

    const row = await one(`${SELECT} WHERE s.id = $1`, [id]);
    res.status(201).json({ subscriber: toApi(row), duplicate: false });
  })
);

export default router;

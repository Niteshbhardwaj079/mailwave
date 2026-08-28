// ---------------------------------------------------------------------------
// Contacts — wo log jinhe email bheja jayega.
//
// Do zaroori niyam yahan lagte hain:
//   1. Ek email address list me sirf ek baar aa sakta hai (database khud rokta hai).
//   2. Jo unsubscribe ya bounce ho chuka hai, wo suppression list me jata hai
//      aur usse dobara kabhi email nahi jayega.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, conflict, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

const contactInput = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email('Sahi email address daalo'),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  groupId: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  consentSource: z.string().trim().max(80).optional().nullable(),
});

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    city: row.city,
    tags: row.tags ?? [],
    group: row.group_name ?? null,
    groupId: row.group_id,
    status: row.status,
    consentSource: row.consent_source,
    addedOn: row.added_on,
  };
}

const SELECT = `
  SELECT c.id, c.name, c.email, c.phone, c.company, c.city, c.tags, c.group_id,
         c.status, c.consent_source, c.added_on, g.name AS group_name
    FROM contacts c
    LEFT JOIN contact_groups g ON g.id = c.group_id
`;

// --- list, search aur filter ke saath ----------------------------------------
router.get(
  '/',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    // Search ko hamesha parameter ki tarah bhejte hain ($1), SQL me jodte nahi —
    // isi se SQL injection rukta hai.
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const groupId = String(req.query.groupId ?? '').trim();

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(c.name) LIKE $${params.length}
                OR lower(c.email) LIKE $${params.length}
                OR lower(c.company) LIKE $${params.length})`);
    }
    if (status) {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }
    if (groupId) {
      params.push(groupId);
      where.push(`c.group_id = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await many(`${SELECT} ${clause} ORDER BY c.added_on DESC LIMIT 500`, params);
    const total = await one(`SELECT count(*)::int AS n FROM contacts c ${clause}`, params);

    res.json({ contacts: rows.map(toApi), total: total?.n ?? 0 });
  })
);

router.get(
  '/:id',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    if (!row) throw notFound('Yeh contact nahi mila');
    res.json({ contact: toApi(row) });
  })
);

// --- naya contact -----------------------------------------------------------
router.post(
  '/',
  requireModule('contacts', 'create'),
  validate(contactInput),
  asyncHandler(async (req, res) => {
    const body = req.body;

    const duplicate = await one('SELECT id FROM contacts WHERE lower(email) = lower($1)', [body.email]);
    if (duplicate) throw conflict('Yeh email pehle se list me hai');

    const id = newId('c');
    await query(
      `INSERT INTO contacts (id, name, email, phone, company, city, group_id, tags, consent_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, body.name ?? null, body.email, body.phone ?? null, body.company ?? null,
       body.city ?? null, body.groupId || null, body.tags, body.consentSource ?? null]
    );

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: body.email,
      detail: 'Naya contact joda gaya',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [id]);
    res.status(201).json({ contact: toApi(row) });
  })
);

// --- contact badlo ----------------------------------------------------------
router.put(
  '/:id',
  requireModule('contacts', 'edit'),
  validate(contactInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, email FROM contacts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh contact nahi mila');

    const body = req.body;

    // Email badla ja raha hai to dekh lo kisi aur ke paas to nahi hai.
    if (body.email.toLowerCase() !== existing.email.toLowerCase()) {
      const clash = await one(
        'SELECT id FROM contacts WHERE lower(email) = lower($1) AND id <> $2',
        [body.email, req.params.id]
      );
      if (clash) throw conflict('Yeh email kisi aur contact ke paas hai');
    }

    await query(
      `UPDATE contacts
          SET name = $1, email = $2, phone = $3, company = $4, city = $5,
              group_id = $6, tags = $7, consent_source = $8, updated_at = now()
        WHERE id = $9`,
      [body.name ?? null, body.email, body.phone ?? null, body.company ?? null, body.city ?? null,
       body.groupId || null, body.tags, body.consentSource ?? null, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'contacts',
      item: body.email,
      detail: 'Contact ki details badli',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json({ contact: toApi(row) });
  })
);

// --- contact hatao ----------------------------------------------------------
router.delete(
  '/:id',
  requireModule('contacts', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, email FROM contacts WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh contact nahi mila');

    await query('DELETE FROM contacts WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: existing.email,
      detail: 'Contact hata diya gaya',
    });

    res.json({ ok: true });
  })
);

// --- ek se zyada ek saath hatao (table ke tick-box wale bulk action) ---------
router.post(
  '/bulk-delete',
  requireModule('contacts', 'delete'),
  validate(z.object({ ids: z.array(z.string()).min(1, 'Kam se kam ek contact chuno') })),
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM contacts WHERE id = ANY($1)', [req.body.ids]);

    await logActivity(req, {
      action: 'deleted',
      module: 'contacts',
      item: `${req.body.ids.length} contacts`,
      detail: 'Ek saath kai contact hataye gaye',
    });

    res.json({ ok: true, deleted: result.affectedRows ?? req.body.ids.length });
  })
);

// --- contact groups ---------------------------------------------------------
router.get(
  '/groups/all',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(`
      SELECT g.id, g.name, g.tone, count(c.id)::int AS count
        FROM contact_groups g
        LEFT JOIN contacts c ON c.group_id = g.id
       GROUP BY g.id, g.name, g.tone
       ORDER BY g.name
    `);
    res.json({ groups: rows });
  })
);

router.post(
  '/groups',
  requireModule('contacts', 'create'),
  validate(z.object({
    name: z.string().trim().min(1, 'Group ko naam do').max(80),
    tone: z.string().trim().max(20).default('primary'),
  })),
  asyncHandler(async (req, res) => {
    const id = newId('g');
    await query('INSERT INTO contact_groups (id, name, tone) VALUES ($1,$2,$3)', [
      id,
      req.body.name,
      req.body.tone,
    ]);

    await logActivity(req, {
      action: 'created',
      module: 'contacts',
      item: req.body.name,
      detail: 'Naya contact group bana',
    });

    res.status(201).json({ group: { id, name: req.body.name, tone: req.body.tone, count: 0 } });
  })
);

// --- suppression list -------------------------------------------------------
// Jinhe kabhi email nahi jayega. Yeh sirf padhne ke liye hai; entries
// unsubscribe/bounce hone par apne aap banti hain.
router.get(
  '/suppression/all',
  requireModule('contacts', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT email, reason, detail, created_at FROM suppression ORDER BY created_at DESC');
    res.json({ suppression: rows });
  })
);

export default router;

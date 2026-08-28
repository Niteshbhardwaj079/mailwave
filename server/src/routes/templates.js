// ---------------------------------------------------------------------------
// Email templates.
//
// Har route file ka dhaancha ek jaisa hai:
//   1. list      GET    /
//   2. ek item   GET    /:id
//   3. banao     POST   /
//   4. badlo     PUT    /:id
//   5. hatao     DELETE /:id
//
// Ek file samajh li, toh baaki sab samajh aa jayengi.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

// Zod schema = "aane wale data ka form". Galat data yahin ruk jata hai,
// database tak pahunchta hi nahi.
const templateInput = z.object({
  name: z.string().trim().min(1, 'Template ko ek naam do').max(120),
  category: z.string().trim().max(60).default('Custom'),
  subject: z.string().trim().max(300).default(''),
  html: z.string().max(500_000, 'Yeh template bahut bada hai').default(''),
});

/** Database ki row ko us shape me badalta hai jo frontend padhta hai. */
function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subject: row.subject,
    html: row.html,
    createdBy: row.created_by_name ?? null,
    updated: row.updated_at,
    created: row.created_at,
  };
}

const SELECT = `
  SELECT t.id, t.name, t.category, t.subject, t.html, t.created_at, t.updated_at,
         u.name AS created_by_name
    FROM templates t
    LEFT JOIN users u ON u.id = t.created_by
`;

// --- 1. saari templates -----------------------------------------------------
router.get(
  '/',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const totalRow = await one('SELECT count(*)::int AS n FROM templates');
    const { page, limit, offset } = pagination(req, { defaultLimit: 24, maxLimit: 100 });

    const rows = await many(
      `${SELECT} ORDER BY t.updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      templates: rows.map(toApi),
    });
  })
);

// --- 2. ek template ---------------------------------------------------------
router.get(
  '/:id',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one(`${SELECT} WHERE t.id = $1`, [req.params.id]);
    if (!row) throw notFound('Yeh template nahi mila');
    res.json({ template: toApi(row) });
  })
);

// --- 3. nayi template banao -------------------------------------------------
router.post(
  '/',
  requireModule('templates', 'create'),
  validate(templateInput),
  asyncHandler(async (req, res) => {
    const { name, category, subject, html } = req.body;
    const id = newId('tpl');

    await query(
      `INSERT INTO templates (id, name, category, subject, html, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, name, category, subject, html, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'templates',
      item: name,
      detail: 'Nayi HTML template save hui',
    });

    const row = await one(`${SELECT} WHERE t.id = $1`, [id]);
    res.status(201).json({ template: toApi(row) });
  })
);

// --- 4. template badlo ------------------------------------------------------
router.put(
  '/:id',
  requireModule('templates', 'edit'),
  validate(templateInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM templates WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh template nahi mila');

    const { name, category, subject, html } = req.body;

    await query(
      `UPDATE templates
          SET name = $1, category = $2, subject = $3, html = $4, updated_at = now()
        WHERE id = $5`,
      [name, category, subject, html, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'templates',
      item: name,
      detail: 'Template edit hui',
      before: existing.name !== name ? `Naam: ${existing.name}` : null,
      after: existing.name !== name ? `Naam: ${name}` : null,
    });

    const row = await one(`${SELECT} WHERE t.id = $1`, [req.params.id]);
    res.json({ template: toApi(row) });
  })
);

// --- 5. template ki copy ----------------------------------------------------
router.post(
  '/:id/duplicate',
  requireModule('templates', 'create'),
  asyncHandler(async (req, res) => {
    const source = await one('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!source) throw notFound('Yeh template nahi mila');

    const id = newId('tpl');
    const name = `${source.name} (copy)`;

    await query(
      `INSERT INTO templates (id, name, category, subject, html, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, name, source.category, source.subject, source.html, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'templates',
      item: name,
      detail: 'Purani template se copy bani',
    });

    const row = await one(`${SELECT} WHERE t.id = $1`, [id]);
    res.status(201).json({ template: toApi(row) });
  })
);

// --- 6. template hatao ------------------------------------------------------
router.delete(
  '/:id',
  requireModule('templates', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM templates WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh template nahi mila');

    await query('DELETE FROM templates WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'templates',
      item: existing.name,
      detail: 'Template hata di gayi',
    });

    res.json({ ok: true });
  })
);

export default router;

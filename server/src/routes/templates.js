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
//
// Default (is_default) templates ek chhoti si istisna hain: DELETE unhe
// kabhi nahi chhoo sakta — app ke saath aaye 14 master templates hamesha
// maujood rehte hain. PUT (edit) allowed hai — Super Admin inhe seedha
// sudhaar sakta hai, aur wo edit hamesha ke liye usi row me save hoti hai.
// /:id/duplicate se ek bilkul alag, independent copy bhi kabhi bhi banai ja
// sakti hai — us copy par baad me kiya gaya kaam is master ko kabhi nahi
// chhoota, aur na is master me future edits us copy ko.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE } from '../lib/languages.js';

const router = Router();

// Zod schema = "aane wale data ka form". Galat data yahin ruk jata hai,
// database tak pahunchta hi nahi.
const templateInput = z.object({
  name: z.string().trim().min(1, 'Template ko ek naam do').max(120),
  category: z.string().trim().max(60).default('Custom'),
  subject: z.string().trim().max(300).default(''),
  html: z.string().max(500_000, 'Yeh template bahut bada hai').default(''),
  language: z.enum(LANGUAGE_CODES).default(DEFAULT_LANGUAGE),
  // "Design" tab ka form-data — raw "Code" tab se edit karne par frontend
  // isse null bhejta hai (structured fields ab bharose ke layak nahi rahe).
  contentSchema: z.record(z.any()).nullable().optional(),
});

/** Database ki row ko us shape me badalta hai jo frontend padhta hai. */
function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    subject: row.subject,
    html: row.html,
    language: row.language,
    isDefault: Boolean(row.is_default),
    contentSchema: row.content_schema ?? null,
    createdBy: row.created_by_name ?? null,
    updated: row.updated_at,
    created: row.created_at,
  };
}

const SELECT = `
  SELECT t.id, t.name, t.category, t.subject, t.html, t.language, t.is_default, t.content_schema,
         t.created_at, t.updated_at, u.name AS created_by_name
    FROM templates t
    LEFT JOIN users u ON u.id = t.created_by
`;

/** `template_categories` me naya naam pehli baar dikhte hi jud jaata hai — yehi "custom category" banana hai. */
async function ensureCategory(name, userId) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  const countRow = await one('SELECT count(*)::int AS n FROM template_categories');
  await query(
    `INSERT INTO template_categories (id, name, sort_order, created_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (name) DO NOTHING`,
    [newId('cat'), trimmed, countRow?.n ?? 0, userId]
  );
}

// --- categories --------------------------------------------------------------
router.get(
  '/categories',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT id, name FROM template_categories ORDER BY sort_order, name');
    res.json({ categories: rows.map((r) => r.name) });
  })
);

router.post(
  '/categories',
  requireModule('templates', 'create'),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) throw badRequest('Category ka naam do');
    await ensureCategory(name, req.user.id);
    const rows = await many('SELECT id, name FROM template_categories ORDER BY sort_order, name');
    res.status(201).json({ categories: rows.map((r) => r.name) });
  })
);

// --- 1. saari templates -----------------------------------------------------
router.get(
  '/',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const conditions = [];
    const params = [];

    const search = String(req.query.search || '').trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`t.name ILIKE $${params.length}`);
    }

    const category = String(req.query.category || '').trim();
    if (category && category !== 'All') {
      params.push(category);
      conditions.push(`t.category = $${params.length}`);
    }

    const language = String(req.query.language || '').trim();
    if (language && language !== 'All') {
      params.push(language);
      conditions.push(`t.language = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRow = await one(`SELECT count(*)::int AS n FROM templates t ${where}`, params);

    const rows = await many(
      `${SELECT} ${where} ORDER BY t.is_default DESC, t.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
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
    const { name, category, subject, html, language, contentSchema } = req.body;
    const id = newId('tpl');

    await query(
      `INSERT INTO templates (id, name, category, subject, html, language, content_schema, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, name, category, subject, html, language, contentSchema ? JSON.stringify(contentSchema) : null, req.user.id]
    );
    await ensureCategory(category, req.user.id);

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
    // Default (master) templates CAN be edited in place — unlike delete, this
    // is intentional: a Super Admin can correct/improve a built-in template
    // and have it save permanently. Only delete stays blocked (below).
    const existing = await one('SELECT id, name FROM templates WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh template nahi mila');

    const { name, category, subject, html, language, contentSchema } = req.body;

    await query(
      `UPDATE templates
          SET name = $1, category = $2, subject = $3, html = $4, language = $5, content_schema = $6, updated_at = now()
        WHERE id = $7`,
      [name, category, subject, html, language, contentSchema ? JSON.stringify(contentSchema) : null, req.params.id]
    );
    await ensureCategory(category, req.user.id);

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
    const name = source.is_default ? source.name : `${source.name} (copy)`;

    await query(
      `INSERT INTO templates (id, name, category, subject, html, language, content_schema, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        name,
        source.category,
        source.subject,
        source.html,
        source.language,
        source.content_schema ? JSON.stringify(source.content_schema) : null,
        req.user.id,
      ]
    );

    await logActivity(req, {
      action: 'created',
      module: 'templates',
      item: name,
      detail: source.is_default ? 'Default template se apni copy banayi' : 'Purani template se copy bani',
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
    const existing = await one('SELECT id, name, is_default FROM templates WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh template nahi mila');
    if (existing.is_default) {
      throw badRequest('Yeh ek default (master) template hai — isse hataya nahi ja sakta.');
    }

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

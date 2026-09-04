// ---------------------------------------------------------------------------
// Segments — contacts ka ek saved chhaanta hua group.
//
// "Jinhone pichhli campaign kholi thi" jaisa. Rule save rehta hai, ginti har
// baar taaza gini jati hai — warna screen par purani ginti dikhti rahegi aur
// bharosa nahi rahega.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

/**
 * Ek condition.
 *
 * `kind` wahi list hai jo screen par dropdown me dikhti hai — na kam, na zyada.
 * Isse ek fayda hai: screen kabhi aisi cheez nahi maang sakti jo server samajh
 * na sake, aur server me aisa kuch pada nahi rehta jo kahin se bulaya hi na
 * jaye.
 *
 * Kuch conditions ko value chahiye (jaise tag ka naam), kuch ko nahi (jaise
 * "opened").
 */
const condition = z.object({
  kind: z.enum([
    // email kholne / click karne se jude — campaign_recipients se aate hain
    'opened',
    'not_opened',
    'clicked',
    'not_clicked',
    'failed',
    'unsubscribed',
    // contact ki apni detail
    'status',
    'tag',
    'group',
    'company',
    'city',
  ]),
  value: z.string().trim().max(200).default(''),
});

const segmentInput = z.object({
  name: z.string().trim().min(1, 'Segment ko ek naam do').max(120),
  tone: z.enum(['danger', 'primary', 'info', 'success', 'warning', 'muted']).default('primary'),
  rule: z
    .object({
      description: z.string().trim().max(300).default(''),
      join: z.enum(['and', 'or']).default('and'),
      conditions: z.array(condition).max(20).default([]),
    })
    .default({ description: '', join: 'and', conditions: [] }),
});

/**
 * Rule ko SQL me badalta hai.
 *
 * Har value $1, $2 ki tarah alag se jati hai — kabhi seedha SQL me nahi. Isi
 * se koi apni marzi ka SQL ghusa nahi sakta.
 */
function ruleToSql(rule) {
  const parts = [];
  const params = [];

  /**
   * "Is contact ko kabhi koi campaign bheji gayi thi jisme yeh hua?"
   *
   * Contact aur recipient ko EMAIL se jodte hain, contact_id se nahi. Wajah:
   * contact delete ho jaye to recipient row me contact_id khali ho jata hai,
   * par email waisa hi rehta hai — aur history bachi rehni chahiye.
   */
  const sent = (test) =>
    `EXISTS (SELECT 1 FROM campaign_recipients r
              WHERE lower(r.email) = lower(c.email) AND ${test})`;

  for (const item of rule?.conditions ?? []) {
    switch (item.kind) {
      case 'opened':
        parts.push(sent('r.open_count > 0'));
        break;

      case 'not_opened':
        // "Kholi nahi" ka matlab hai: bheji to gayi thi, par kholi nahi. Jise
        // kabhi koi email gayi hi nahi, wo ismein nahi aana chahiye.
        parts.push(`${sent("r.status IN ('Sent','Delivered')")} AND NOT ${sent('r.open_count > 0')}`);
        break;

      case 'clicked':
        parts.push(sent('r.click_count > 0'));
        break;

      case 'not_clicked':
        parts.push(`${sent("r.status IN ('Sent','Delivered')")} AND NOT ${sent('r.click_count > 0')}`);
        break;

      case 'failed':
        parts.push(sent("r.status IN ('Failed','Bounced')"));
        break;

      case 'unsubscribed':
        parts.push(`(c.status = 'Unsubscribed' OR ${sent('r.unsubscribed = true')})`);
        break;

      case 'tag':
        // tags ek list hai — "is list me yeh tag hai kya".
        params.push(item.value);
        parts.push(`$${params.length} = ANY(c.tags)`);
        break;

      case 'status':
      case 'group':
        params.push(item.value);
        parts.push(`${item.kind === 'status' ? 'c.status' : 'c.group_id'} = $${params.length}`);
        break;

      case 'company':
      case 'city':
        params.push(`%${item.value}%`);
        parts.push(`c.${item.kind} ILIKE $${params.length}`);
        break;

      default:
        // Zod pehle hi rok chuka hai, par yahan bhi chup rehna behtar hai —
        // anjaan condition ko chhod dena galat ginti dene se accha hai.
        break;
    }
  }

  if (parts.length === 0) return { clause: '', params: [] };

  // Har condition apne bracket me — warna "A AND B OR C" ka matlab badal jata
  // hai aur ginti chup-chap galat aa jati.
  const join = rule?.join === 'or' ? ' OR ' : ' AND ';
  return { clause: `WHERE (${parts.map((p) => `(${p})`).join(join)})`, params };
}

/** Is segment me abhi kitne contacts aate hain. */
async function countFor(rule) {
  const { clause, params } = ruleToSql(rule);
  const row = await one(`SELECT count(*)::int AS n FROM contacts c ${clause}`, params);
  return row?.n ?? 0;
}

async function toApi(row) {
  const rule = row.rule ?? {};

  return {
    id: row.id,
    name: row.name,
    tone: row.tone,
    rule,
    // Screen par ek line me dikhane ke liye.
    ruleText: rule.description ?? '',
    count: await countFor(rule),
    updated: row.updated_at,
  };
}

router.get(
  '/',
  requireModule('segments', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT * FROM segments ORDER BY created_at ASC');
    res.json({ segments: await Promise.all(rows.map(toApi)) });
  })
);

router.post(
  '/',
  requireModule('segments', 'create'),
  validate(segmentInput),
  asyncHandler(async (req, res) => {
    const { name, tone, rule } = req.body;
    const id = newId('seg');

    await query(
      'INSERT INTO segments (id, name, rule, tone, created_by) VALUES ($1,$2,$3,$4,$5)',
      [id, name, JSON.stringify(rule), tone, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'segments',
      item: name,
      detail: 'Naya segment bana',
    });

    const row = await one('SELECT * FROM segments WHERE id = $1', [id]);
    res.status(201).json({ segment: await toApi(row) });
  })
);

router.put(
  '/:id',
  requireModule('segments', 'edit'),
  validate(segmentInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM segments WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh segment nahi mila');

    const { name, tone, rule } = req.body;

    await query(
      'UPDATE segments SET name = $1, rule = $2, tone = $3, updated_at = now() WHERE id = $4',
      [name, JSON.stringify(rule), tone, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'segments',
      item: name,
      detail: 'Segment ka rule ya naam badla',
    });

    const row = await one('SELECT * FROM segments WHERE id = $1', [req.params.id]);
    res.json({ segment: await toApi(row) });
  })
);

router.delete(
  '/:id',
  requireModule('segments', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM segments WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh segment nahi mila');

    await query('DELETE FROM segments WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'segments',
      item: existing.name,
      detail: 'Segment hata diya gaya',
    });

    res.json({ ok: true });
  })
);

/**
 * Is segment me abhi kaun-kaun aata hai.
 *
 * Segment ek list nahi, ek RULE hai — isliye log har baar taaza chhaante jate
 * hain. Kal jo aadmi email khol lega, wo apne aap "Opened" wale segment me aa
 * jayega, bina kisi ke kuch kiye.
 */
router.get(
  '/:id/contacts',
  requireModule('segments', 'view'),
  asyncHandler(async (req, res) => {
    const segment = await one('SELECT * FROM segments WHERE id = $1', [req.params.id]);
    if (!segment) throw notFound('Yeh segment nahi mila');

    const { clause, params } = ruleToSql(segment.rule ?? {});

    const rows = await many(
      `SELECT c.id, c.name, c.email, c.phone, c.company, c.city, c.status
         FROM contacts c ${clause}
        ORDER BY c.added_on DESC
        LIMIT 50000`,
      params
    );

    await logActivity(req, {
      action: 'exported',
      module: 'segments',
      item: segment.name,
      detail: `${rows.length} contacts nikale gaye`,
    });

    res.json({ contacts: rows, total: rows.length });
  })
);

/**
 * Rule save kiye bina uski ginti dekho.
 *
 * Segment banate waqt yeh sabse kaam ki cheez hai: rule badal kar turant pata
 * chal jata hai ki kitne log aayenge — save karne se pehle hi.
 */
router.post(
  '/preview',
  requireModule('segments', 'view'),
  validate(segmentInput.pick({ rule: true })),
  asyncHandler(async (req, res) => {
    res.json({ count: await countFor(req.body.rule) });
  })
);

export default router;

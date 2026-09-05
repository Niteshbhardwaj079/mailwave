// ---------------------------------------------------------------------------
// Activity log — "kisne kya kiya".
//
// Entries khud banti hain: har route apna kaam karke logActivity() bula deta
// hai (lib/activity.js) — koi seedha POST karke jhooti entry nahi bana sakta.
//
// Purane records ko purge karna alag baat hai — storage/privacy ke liye kabhi
// kabhi zaroori hota hai, aur sirf 'delete' permission wale role hi kar
// sakte hain (Super Admin). Delete khud bhi ek entry chhod jata hai, taaki
// "kisne kab log saaf kiya" pata rahe.
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, paginated, pagination } from '../lib/http.js';
import { requireModule } from '../middleware/permissions.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

function toApi(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    initials: row.initials,
    action: row.action,
    module: row.module,
    item: row.item,
    detail: row.detail,
    before: row.before_val,
    after: row.after_val,
    ip: row.ip,
    device: row.device,
    at: row.at,
  };
}

/**
 * Filter banata hai.
 *
 * Har value sawaal me $1, $2 ki tarah jati hai — kabhi seedha SQL me nahi.
 * Isi se SQL injection rukti hai.
 */
function buildFilter(source) {
  const where = [];
  const params = [];

  const { action, module, user, search, from, to } = source;

  if (action && action !== 'all') {
    params.push(action);
    where.push(`action = $${params.length}`);
  }

  if (module && module !== 'all') {
    params.push(module);
    where.push(`module = $${params.length}`);
  }

  if (user && user !== 'all') {
    params.push(user);
    where.push(`user_id = $${params.length}`);
  }

  if (from) {
    params.push(from);
    where.push(`at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    where.push(`at <= $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    where.push(`(item ILIKE $${n} OR detail ILIKE $${n} OR user_name ILIKE $${n})`);
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get(
  '/',
  requireModule('activity', 'view'),
  asyncHandler(async (req, res) => {
    const { clause, params } = buildFilter(req.query);
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const totalRow = await one(`SELECT count(*)::int AS n FROM activity_log ${clause}`, params);

    const rows = await many(
      `SELECT * FROM activity_log ${clause}
        ORDER BY at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      activity: rows.map(toApi),
    });
  })
);

/**
 * Purane ya chuni hui entries hatata hai.
 *
 *   { ids: [...] }                     — sirf ye rows (checkbox se chuni hui)
 *   { from, to, action, module, ... }  — inhi filters se milne wali sab rows
 *
 * Koi filter na diya ho (poora log ek saath) to `confirmAll: true` bhejna
 * zaroori hai — warna galti se poora log gayab ho sakta hai.
 */
router.delete(
  '/',
  requireModule('activity', 'delete'),
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => typeof id === 'string' && id) : [];

    let clause;
    let params;

    if (ids.length > 0) {
      params = [ids];
      clause = 'WHERE id = ANY($1::text[])';
    } else {
      const built = buildFilter(req.body ?? {});
      if (!built.clause && req.body?.confirmAll !== true) {
        throw badRequest('Kam se kam ek filter chuno, ya poora log ek saath saaf karne ke liye confirm karo.');
      }
      clause = built.clause;
      params = built.params;
    }

    const countRow = await one(`SELECT count(*)::int AS n FROM activity_log ${clause}`, params);
    const removed = countRow?.n ?? 0;

    if (removed > 0) {
      await query(`DELETE FROM activity_log ${clause}`, params);
    }

    // Delete khud ek naya entry ban jaata hai — "kisne kab log saaf kiya"
    // hamesha pata rahega, chahe purani entries mit gayi hon.
    await logActivity(req, {
      action: 'deleted',
      module: 'activity',
      item: ids.length > 0 ? `${removed} chuni hui entries` : `${removed} entries (filter se)`,
      detail: ids.length > 0 ? 'Selected log rows removed' : 'Filtered date-range removed',
    });

    res.json({ removed });
  })
);

export default router;

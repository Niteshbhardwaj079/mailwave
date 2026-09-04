// ---------------------------------------------------------------------------
// Activity log — "kisne kya kiya".
//
// Yeh sirf padhne ke liye hai. Koi entry haath se banai ya mitai nahi ja sakti
// — API me wo raasta hai hi nahi. Log ka poora matlab hi yahi hai ki uspar
// bharosa kiya ja sake; agar use badla ja sake to wo kisi kaam ka nahi.
//
// Entries khud banti hain: har route apna kaam karke logActivity() bula deta
// hai (lib/activity.js).
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { many, one } from '../db/client.js';
import { asyncHandler, paginated, pagination } from '../lib/http.js';
import { requireModule } from '../middleware/permissions.js';

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
function buildFilter(req) {
  const where = [];
  const params = [];

  const { action, module, user, search, from, to } = req.query;

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
    const { clause, params } = buildFilter(req);
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

export default router;

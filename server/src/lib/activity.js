import { query } from '../db/client.js';
import { newId } from './ids.js';

/**
 * The activity trail is written here, on the server, so it records what
 * actually happened rather than what a browser claims happened.
 *
 * Deliberately never throws: a failed log line must not fail the action the
 * user asked for.
 */
export async function logActivity(req, entry) {
  try {
    await query(
      `INSERT INTO activity_log
         (id, user_id, user_name, initials, action, module, item, detail, before_val, after_val, ip, device)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        newId('a'),
        req?.user?.id ?? null,
        req?.user?.name ?? 'System',
        req?.user?.initials ?? null,
        entry.action,
        entry.module,
        entry.item ?? null,
        entry.detail ?? null,
        entry.before ?? null,
        entry.after ?? null,
        clientIp(req),
        req?.get?.('user-agent')?.slice(0, 200) ?? null,
      ]
    );
  } catch (error) {
    console.error('[activity] could not record entry', error);
  }
}

export function clientIp(req) {
  if (!req) return null;
  const forwarded = req.get?.('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || null;
}

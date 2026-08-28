import { many, one } from '../db/client.js';
import { asyncHandler, forbidden } from '../lib/http.js';

/**
 * The same permission model the UI draws: 10 modules × 6 actions, with
 * super_admin always allowed so nobody can lock themselves out.
 *
 * Hiding a link in the sidebar is not access control — this is. Every route
 * that touches a module carries one of these.
 */
export async function roleCan(roleKey, module, action) {
  if (roleKey === 'super_admin') return true;

  const row = await one(
    `SELECT 1 FROM role_permissions WHERE role_key = $1 AND module = $2 AND action = $3`,
    [roleKey, module, action]
  );
  return Boolean(row);
}

export function requireModule(module, action = 'view') {
  return asyncHandler(async (req, res, next) => {
    const allowed = await roleCan(req.user.role_key, module, action);
    if (!allowed) throw forbidden(`Your role cannot ${action} ${module}`);
    next();
  });
}

/** The full permission map for a role, in the shape the frontend already uses. */
export async function permissionsFor(roleKey) {
  const rows = await many(
    `SELECT module, action FROM role_permissions WHERE role_key = $1`,
    [roleKey]
  );

  return rows.reduce((acc, row) => {
    acc[row.module] = acc[row.module] || [];
    acc[row.module].push(row.action);
    return acc;
  }, {});
}

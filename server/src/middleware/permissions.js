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

/**
 * Which connected email accounts a role may send from/work with.
 *
 * No rows for this role = unrestricted (every connected account) — see the
 * comment on role_account_access in schema.sql for why the default is the
 * opposite of role_permissions.
 *
 * @returns {null | string[]} null means "no restriction, every account is
 *   allowed" — kept distinct from an empty array (which would mean "this
 *   role restricted itself down to zero accounts", a real, if unusual, state).
 */
export async function allowedAccountIds(roleKey) {
  if (roleKey === 'super_admin') return null;

  const rows = await many('SELECT account_id FROM role_account_access WHERE role_key = $1', [roleKey]);
  if (!rows.length) return null;
  return rows.map((row) => row.account_id);
}

/** True if this role may use this specific account — honours the "no rows = unrestricted" rule above. */
export async function roleCanUseAccount(roleKey, accountId) {
  const allowed = await allowedAccountIds(roleKey);
  return allowed === null || allowed.includes(accountId);
}

/** Route guard: the campaign's/request's account must be one this role is allowed to use. */
export function requireAccountAccess(getAccountId) {
  return asyncHandler(async (req, res, next) => {
    const accountId = getAccountId(req);
    if (!accountId) return next();

    const allowed = await roleCanUseAccount(req.user.role_key, accountId);
    if (!allowed) throw forbidden('Your role cannot use this email account');
    next();
  });
}

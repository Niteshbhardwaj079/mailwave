import { one } from '../db/client.js';
import { asyncHandler, unauthorized } from '../lib/http.js';
import { verifyAccessToken } from '../lib/tokens.js';

/**
 * Establishes req.user for everything behind it.
 *
 * The token is checked cryptographically AND the user is re-read, so disabling
 * an account takes effect on the next request instead of whenever their token
 * happens to expire.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw unauthorized();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (error) {
    throw unauthorized('Your session has expired');
  }

  const user = await one(
    `SELECT id, name, email, role_key, status, initials, department
       FROM users WHERE id = $1`,
    [claims.sub]
  );

  if (!user) throw unauthorized('That account no longer exists');
  if (user.status === 'Disabled') throw unauthorized('That account has been turned off');

  req.user = user;
  next();
});

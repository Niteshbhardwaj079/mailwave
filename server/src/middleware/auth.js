import { one, query } from '../db/client.js';
import { asyncHandler, unauthorized } from '../lib/http.js';
import { hashToken, isApiKeyFormat, verifyAccessToken } from '../lib/tokens.js';

/**
 * "mw_live_..." wali key ko jaanchta hai. Jisne key banayi thi, uski hi
 * permissions se kaam karti hai — key ka apna alag role nahi hota.
 */
async function authenticateApiKey(token) {
  const row = await one(
    `SELECT k.id AS key_id, u.id, u.name, u.email, u.role_key, u.status, u.initials, u.department
       FROM api_keys k
       JOIN users u ON u.id = k.created_by
      WHERE k.key_hash = $1`,
    [hashToken(token)]
  );

  if (!row || row.status === 'Disabled') return null;

  // Kab istemal hui, yeh jaan kaam ki hai (dikhata hai kaunsi key abhi bhi
  // zinda hai) — par request ko iske liye rokna nahi hai, isliye await nahi.
  query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.key_id]).catch(() => {});

  const { key_id: _keyId, ...user } = row;
  return user;
}

/**
 * Establishes req.user for everything behind it.
 *
 * Do tarah se sign in mana jata hai:
 *   - Normal JWT access token (login se milta hai, thodi der me expire hota)
 *   - API key ("mw_live_..." se shuru) — bahar ke program ke liye, kabhi
 *     expire nahi hoti, sirf revoke hone par band hoti hai
 *
 * Dono me user ko dobara database se padha jata hai, taki disable kiya hua
 * account turant bahar ho jaye, purane token/key ke expire hone ka intezaar
 * na karna pade.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) throw unauthorized();

  if (isApiKeyFormat(token)) {
    const user = await authenticateApiKey(token);
    if (!user) throw unauthorized('That API key is not valid or has been revoked');
    req.user = user;
    req.viaApiKey = true;
    next();
    return;
  }

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

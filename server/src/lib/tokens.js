import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../env.js';

/** Short-lived, stateless, sent on every request. */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role_key },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl, issuer: 'mailwave' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: 'mailwave' });
}

/**
 * Refresh tokens are opaque random strings. Only their hash is stored, so a
 * stolen database dump cannot be replayed against the API.
 */
export function newRefreshToken() {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry() {
  return new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
}

/**
 * API key jo bahar ka koi program istemal kar sake — poori tarah asli, ek
 * baar dikhti hai (banते hi), uske baad database me sirf hash rehta hai.
 *
 * "mw_live_" prefix se requireAuth ko turant pata chal jata hai ki yeh JWT
 * nahi, API key hai — alag jaanch honi chahiye.
 */
export function newApiKey() {
  const token = `mw_live_${randomBytes(24).toString('base64url')}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 16) };
}

export function isApiKeyFormat(token) {
  return typeof token === 'string' && token.startsWith('mw_live_');
}

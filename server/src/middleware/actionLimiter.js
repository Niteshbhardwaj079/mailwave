// ---------------------------------------------------------------------------
// Per-user rate limits for a handful of heavy/sensitive authenticated
// actions — app.js's global 300/min-per-IP ceiling is deliberately generous
// (it covers ordinary UI traffic for a whole office behind one IP), so it
// does nothing to stop ONE logged-in account from hammering a specific
// expensive or abuse-prone action. These are keyed by user id (not IP),
// since every route below already requires a signed-in user — this way a
// shared office IP is never at risk of blocking a colleague, and a
// compromised single account is the one throttled.
//
// Numbers are deliberately generous for real marketing/admin work, not tight
// security theatre — the goal is to stop runaway/scripted abuse, not to get
// in a real admin's way.
// ---------------------------------------------------------------------------
import rateLimit from 'express-rate-limit';

function byUser(req) {
  return req.user?.id || req.ip;
}

/** Creating/sending/scheduling/resending campaigns — the actual "send email" trigger points. */
export const campaignActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many campaign actions in a short time.',
    },
  },
});

/** Image uploads — sharp() re-encoding is CPU work, and each one is a DB/storage write. */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many uploads in a short time.',
    },
  },
});

/** Manual backup create/upload/restore — each one reads or writes the ENTIRE database. */
export const backupActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many backup operations in a short time.',
    },
  },
});

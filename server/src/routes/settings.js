// ---------------------------------------------------------------------------
// Workspace-wide settings — sending, tracking, contacts, unsubscribe.
//
// Yeh chaar hi keys chalti hain, aur har ek ka apna shape hai (Zod se
// jaancha jata hai) — isliye koi apni marzi ka naya key ya galat shape wala
// data nahi daal sakta.
//
// Ek hi row asal me KAAM karti hai: 'unsubscribe' — sender.js ismein se
// unsubscribe link ka text padhta hai jab bhi koi campaign bhejta hai. Baaki
// teen (sending/tracking/contacts) abhi sirf save/load hoti hain; inhe
// campaign wizard ya import ke real logic se jodna alag kaam hai.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

/** Har key ka apna shape — screen bhi yehi bhejti hai, isse zyada ya kam kuch nahi bachta. */
const SCHEMAS = {
  sending: z.object({
    defaultBatchSize: z.number().int().min(0).max(100_000),
    batchDelayMinutes: z.number().int().min(0).max(1440),
    retryOnce: z.boolean(),
    quietHours: z.boolean(),
  }),
  tracking: z.object({
    openByDefault: z.boolean(),
    clickByDefault: z.boolean(),
    recordDevice: z.boolean(),
    recordLocation: z.boolean(),
  }),
  contacts: z.object({
    dedupeOnImport: z.boolean(),
    requireConsent: z.boolean(),
    customFields: z.array(z.string().trim().min(1).max(60)).max(30),
  }),
  unsubscribe: z.object({
    linkText: z.string().trim().min(1).max(200),
    confirmation: z.string().trim().min(1).max(500),
    oneClickHeader: z.boolean(),
  }),
};

router.get(
  '/',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT key, value FROM settings WHERE key = ANY($1)', [Object.keys(SCHEMAS)]);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    res.json({ settings: byKey });
  })
);

/** `validate()` ek fixed schema ke liye bana hai — yahan key ke hisaab se schema khud chunna padta hai. */
function validateSettingBody(req, res, next) {
  const schema = SCHEMAS[req.params.key];
  if (!schema) return next(badRequest('Aisi koi setting nahi hai'));
  return validate(schema)(req, res, next);
}

router.put(
  '/:key',
  requireModule('settings', 'edit'),
  validateSettingBody,
  asyncHandler(async (req, res) => {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [req.params.key, JSON.stringify(req.body)]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: req.params.key,
      detail: `"${req.params.key}" settings badli`,
    });

    const row = await one('SELECT key, value FROM settings WHERE key = $1', [req.params.key]);
    res.json({ key: row.key, value: row.value });
  })
);

export default router;

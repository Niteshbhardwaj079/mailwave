// ---------------------------------------------------------------------------
// Workspace-wide settings — sending, tracking, contacts, unsubscribe,
// templateSources.
//
// Har key ka apna shape hai (Zod se jaancha jata hai) — isliye koi apni
// marzi ka naya key ya galat shape wala data nahi daal sakta.
//
// Kaam karne wali keys: 'unsubscribe' — sender.js ismein se unsubscribe link
// ka text padhta hai jab bhi koi campaign bhejta hai; 'sending' ka
// `retryOnce` — sender.js har campaign khatam hone par ismein se padh kar
// failed recipients ko ek baar khud-ba-khud dobara bhejta hai; aur
// 'templateSources' — server/src/routes/templates.js har naya template
// banate waqt aur Templates list dikhate waqt ismein se padhta hai (kaunsa
// source — custom/html_upload/builder — abhi allowed hai). 'sending' ka
// `quietHours`, aur 'tracking'/'contacts' poori tarah, abhi sirf save/load
// hote hain; inhe real logic se jodna alag kaam hai.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { BUILTIN_DYNAMIC_FIELD_KEYS, isValidFieldKey } from '../../../src/data/dynamicFields.js';

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
    // Default false: unsubscribing from one sending account only blocks
    // future sends from THAT account, not every account in the workspace.
    // true = old behaviour — one unsubscribe blocks every account.
    applyGlobally: z.boolean().default(false),
  }),
  // Kaunsa template-creation tareeka (source) abhi allowed hai — OFF karne
  // se sirf HIDE hota hai (naya banana + Library me dikhna), DELETE kabhi
  // nahi. templates.js is exact shape ko padhta hai.
  templateSources: z.object({
    custom: z.boolean(),
    html_upload: z.boolean(),
    builder: z.boolean(),
  }),
  // Naya image upload/edit kis backend me jaaye — apni DB me, ya connected
  // external provider me. OFF karne se sirf naye uploads us backend par
  // jaana band hote hain — purani images/rows kabhi nahi chhuti (dekho
  // server/src/routes/images.js ka resolveImageStorageMode()).
  imageStorage: z.object({
    db: z.boolean(),
    external: z.boolean(),
  }),
  // Client ke apne "Dynamic Fields" (WordPress custom-fields jaisa) — sirf
  // CUSTOM fields yahan store hote hain, builtins (name/email/company/...)
  // hamesha src/data/dynamicFields.js se aate hain, kabhi DB me nahi.
  dynamicFields: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(50),
        label: z.string().trim().min(1).max(80),
        key: z.string().trim().refine(isValidFieldKey, 'Key can only contain lowercase letters/numbers/underscore, starting with a letter'),
      })
    )
    .max(200)
    .refine((fields) => {
      const keys = fields.map((f) => f.key);
      if (keys.some((k) => BUILTIN_DYNAMIC_FIELD_KEYS.includes(k))) return false;
      return new Set(keys).size === keys.length;
    }, 'Each key belongs to one field only — it cannot repeat or duplicate a builtin field key'),
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
  if (!schema) return next(badRequest('No such setting exists'));
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

// ---------------------------------------------------------------------------
// Webhook settings — Settings > Webhooks page ke peeche.
//
// Secret bilkul API key jaisa: banते/badalte hi ek hi baar poora dikhta hai,
// uske baad hamesha sirf pehla hissa. Poori tarah admin/Super Admin ke liye.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many } from '../db/client.js';
import { asyncHandler, badRequest } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { requireModule } from '../middleware/permissions.js';
import {
  getWebhookConfig,
  rotateWebhookSecret,
  sendTestWebhook,
  setWebhookUrl,
} from '../services/webhooks.js';

const router = Router();

function toApi(config) {
  return {
    url: config?.url ?? '',
    enabled: Boolean(config?.enabled),
    hasSecret: Boolean(config?.secret),
    secretPrefix: config?.secret ? `${config.secret.slice(0, 12)}…` : null,
  };
}

router.get(
  '/',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    const config = await getWebhookConfig();
    res.json({ webhook: toApi(config) });
  })
);

router.put(
  '/',
  requireModule('settings', 'edit'),
  validateWebhookUrl,
  asyncHandler(async (req, res) => {
    const config = await setWebhookUrl({ url: req.body.url, enabled: req.body.enabled });

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'webhook',
      detail: req.body.enabled ? `Webhook chalu kiya: ${req.body.url}` : 'Webhook band kiya',
    });

    res.json({ webhook: toApi(config) });
  })
);

function validateWebhookUrl(req, res, next) {
  const schema = z.object({
    url: z.string().trim().refine((value) => value === '' || /^https:\/\//.test(value), {
      message: 'Webhook URL https:// se shuru honi chahiye',
    }),
    enabled: z.boolean(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(badRequest('Some fields need attention', result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }))));
  }
  if (result.data.enabled && !result.data.url) {
    return next(badRequest('Chalu karne se pehle ek URL do'));
  }
  req.body = result.data;
  return next();
}

router.post(
  '/rotate-secret',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const secret = await rotateWebhookSecret();

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'webhook',
      detail: 'Webhook secret badla — purana kaam karna band ho gaya',
    });

    // Poora secret SIRF is ek jawab me — dobara kabhi nahi milega.
    res.json({ secret });
  })
);

router.post(
  '/test',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const result = await sendTestWebhook();
    if (!result.ok && result.reason === 'no-url') throw badRequest('Pehle ek webhook URL bharo');
    res.json(result);
  })
);

router.get(
  '/deliveries',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT id, event, status, attempts, last_status_code, last_error, created_at, delivered_at
         FROM webhook_deliveries
        ORDER BY created_at DESC
        LIMIT 30`
    );
    res.json({
      deliveries: rows.map((row) => ({
        id: row.id,
        event: row.event,
        status: row.status,
        attempts: row.attempts,
        lastStatusCode: row.last_status_code,
        lastError: row.last_error,
        createdAt: row.created_at,
        deliveredAt: row.delivered_at,
      })),
    });
  })
);

export default router;

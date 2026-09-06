// ---------------------------------------------------------------------------
// API keys — bahar ka koi program (Zapier, apna script) is app se seedha
// baat kar sake, login form ke bina.
//
// Zaroori niyam: asli key sirf BANTE HI ek baar dikhti hai. Uske baad
// database me aur is app me kahin bhi sirf uska hash rehta hai — password
// jaisa hi tareeka. Isliye "GET" list me kabhi key wapas nahi aati, sirf
// pehle kuch akshar (prefix) — taki pehchan sako kaunsi key kaunsi hai.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newApiKey } from '../lib/tokens.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdBy: row.created_by_name,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

router.get(
  '/',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(`
      SELECT k.*, u.name AS created_by_name
        FROM api_keys k
        LEFT JOIN users u ON u.id = k.created_by
       ORDER BY k.created_at DESC
    `);
    res.json({ keys: rows.map(toApi) });
  })
);

router.post(
  '/',
  requireModule('settings', 'edit'),
  validate(z.object({ name: z.string().trim().min(1, 'Key ko ek naam do').max(120) })),
  asyncHandler(async (req, res) => {
    const { token, hash, prefix } = newApiKey();
    const id = newId('ak');

    await query(
      `INSERT INTO api_keys (id, name, key_prefix, key_hash, created_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, req.body.name, prefix, hash, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'settings',
      item: req.body.name,
      detail: 'Nayi API key banayi',
    });

    const row = await one(
      `SELECT k.*, u.name AS created_by_name FROM api_keys k LEFT JOIN users u ON u.id = k.created_by WHERE k.id = $1`,
      [id]
    );

    // Asli key SIRF is ek jawab me — dobara kabhi nahi milegi.
    res.status(201).json({ key: { ...toApi(row), token } });
  })
);

router.delete(
  '/:id',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM api_keys WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh API key nahi mili');

    await query('DELETE FROM api_keys WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'settings',
      item: existing.name,
      detail: 'API key revoke ki gayi',
    });

    res.json({ ok: true });
  })
);

export default router;

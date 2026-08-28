// ---------------------------------------------------------------------------
// Backup ke buttons — ek click wala kaam.
//
// Sirf Super Admin. Backup file me poora database hota hai, isliye ise koi aur
// download nahi kar sakta.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';

import { asyncHandler, badRequest, forbidden, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import {
  EVERY_DAYS,
  KEEP_COUNT,
  backupPath,
  createBackup,
  deleteBackup,
  listBackups,
  markForRestore,
  pendingRestorePath,
} from '../services/backup.js';

const router = Router();

/** Backup me sab kuch hota hai — password hashes tak. Sirf Super Admin. */
const onlySuperAdmin = (req, res, next) => {
  if (req.user.role_key !== 'super_admin') {
    next(forbidden('Backup sirf Super Admin sambhal sakta hai'));
    return;
  }
  next();
};

router.use(onlySuperAdmin);

// --- backup ki list + settings ----------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const backups = await listBackups();

    res.json({
      backups: backups.map((b) => ({
        name: b.name,
        size: b.size,
        sizeText: `${(b.size / 1024 / 1024).toFixed(1)} MB`,
        createdAt: b.createdAt,
      })),
      settings: {
        everyDays: EVERY_DAYS,
        keepCount: KEEP_COUNT,
        note: `Har ${EVERY_DAYS} din me apne aap backup banta hai. Sabse naye ${KEEP_COUNT} rakhe jate hain, purane apne aap hat jate hain.`,
      },
    });
  })
);

// --- ek click me backup banao -----------------------------------------------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = await createBackup({ reason: 'manual' });

    await logActivity(req, {
      action: 'created',
      module: 'settings',
      item: result.name,
      detail: 'Backup banaya gaya',
    });

    res.status(201).json({
      ok: true,
      backup: {
        name: result.name,
        size: result.size,
        sizeText: `${(result.size / 1024 / 1024).toFixed(1)} MB`,
        createdAt: result.createdAt,
      },
      removed: result.removed,
    });
  })
);

// --- download ---------------------------------------------------------------
router.get(
  '/:name/download',
  asyncHandler(async (req, res) => {
    const path = await backupPath(req.params.name);
    if (!path) throw notFound('Yeh backup file nahi mili');

    await logActivity(req, {
      action: 'exported',
      module: 'settings',
      item: req.params.name,
      detail: 'Backup download kiya gaya',
    });

    res.download(path);
  })
);

// --- backup hatao -----------------------------------------------------------
router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const removed = await deleteBackup(req.params.name);
    if (!removed) throw notFound('Yeh backup file nahi mili');

    await logActivity(req, {
      action: 'deleted',
      module: 'settings',
      item: req.params.name,
      detail: 'Backup hataya gaya',
    });

    res.json({ ok: true });
  })
);

// --- restore ----------------------------------------------------------------
// Do kadam: pehle nishaan lagao, phir server restart. Isse beech me database
// aadha-adhoora nahi hota.
router.post(
  '/:name/restore',
  validate(z.object({
    confirm: z.literal('RESTORE', {
      errorMap: () => ({ message: 'Pakka karne ke liye RESTORE likho' }),
    }),
  })),
  asyncHandler(async (req, res) => {
    const ok = await markForRestore(req.params.name);
    if (!ok) throw notFound('Yeh backup file nahi mili');

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: req.params.name,
      detail: 'Restore ka nishaan lagaya — server restart hone par lagega',
    });

    res.json({
      ok: true,
      message: 'Ho gaya. Ab server ko band karke dobara chalu karo — database is backup se wapas aa jayega.',
      restartRequired: true,
    });
  })
);

// --- apne computer se backup file wapas daalo -------------------------------
// Purana backup jo aapne download karke rakha tha, use wapas laane ke liye.
router.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const type = req.get('content-type') || '';
    if (!type.includes('application/gzip') && !type.includes('application/octet-stream')) {
      throw badRequest('Backup file .tar.gz honi chahiye');
    }

    // Seedha file me likhte hain — bade backup ko memory me nahi uthate.
    await pipeline(req, createWriteStream(pendingRestorePath));

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'upload',
      detail: 'Backup file upload hui — server restart hone par lagegi',
    });

    res.json({
      ok: true,
      message: 'File mil gayi. Ab server band karke dobara chalu karo.',
      restartRequired: true,
    });
  })
);

export default router;

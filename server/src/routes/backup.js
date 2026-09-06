// ---------------------------------------------------------------------------
// Backup ke buttons — ek click wala kaam.
//
// Sirf Super Admin. Backup file me poora database hota hai, isliye ise koi aur
// download nahi kar sakta.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { currentDriver } from '../db/client.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { getBackupStorage } from '../services/backupStorage.js';
import {
  EVERY_DAYS,
  KEEP_COUNT,
  createBackup,
  deleteBackup,
  getBackup,
  listBackups,
  markForRestore,
  pendingRestorePath,
  restoreFromBackup,
  storeUploadedBackup,
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
    const storage = getBackupStorage();
    const lastGood = backups.find((b) => b.status === 'successful');

    res.json({
      backups,
      settings: {
        everyDays: EVERY_DAYS,
        keepCount: KEEP_COUNT,
        note: `Har ${EVERY_DAYS} din me apne aap backup banta hai. Sabse naye ${KEEP_COUNT} rakhe jate hain, purane apne aap hat jate hain.`,
        storage: {
          durable: storage.isDurable(),
          description: storage.describe(),
        },
        lastSuccessfulAt: lastGood?.createdAt ?? null,
      },
    });
  })
);

// --- ek click me backup banao -----------------------------------------------
router.post(
  '/',
  asyncHandler(async (req, res) => {
    let backup;
    try {
      backup = await createBackup({ reason: 'manual', userId: req.user.id });
    } catch (error) {
      throw badRequest(`Backup nahi ban paya: ${String(error?.message || error)}`);
    }

    await logActivity(req, {
      action: 'created',
      module: 'settings',
      item: backup.name,
      detail: `Backup banaya gaya (${backup.tableCount ?? '?'} tables, ${backup.rowCount ?? '?'} rows)`,
    });

    res.status(201).json({ ok: true, backup, removed: backup.removed ?? [] });
  })
);

// --- download ---------------------------------------------------------------
router.get(
  '/:name/download',
  asyncHandler(async (req, res) => {
    const meta = await getBackup(req.params.name);
    if (!meta || meta.status !== 'successful') throw notFound('Yeh backup file nahi mili');

    const storage = getBackupStorage();
    if (!(await storage.exists(req.params.name))) throw notFound('Yeh backup file nahi mili');

    const buffer = await storage.read(req.params.name);

    await logActivity(req, {
      action: 'exported',
      module: 'settings',
      item: req.params.name,
      detail: 'Backup download kiya gaya',
    });

    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${req.params.name}"`,
      'Content-Length': String(buffer.length),
    });
    res.send(buffer);
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
// Asli Postgres par turant, ek transaction me ho jata hai — dobara restart
// karne ki zarurat nahi. PGlite par ab bhi do kadam me hai (nishaan lagao,
// phir restart), kyunki chalte hue PGlite ko badalna surakshit nahi.
router.post(
  '/:name/restore',
  validate(z.object({
    confirm: z.literal('RESTORE', {
      errorMap: () => ({ message: 'Pakka karne ke liye RESTORE likho' }),
    }),
  })),
  asyncHandler(async (req, res) => {
    if (currentDriver() === 'postgres') {
      let result;
      try {
        result = await restoreFromBackup(req.params.name);
      } catch (error) {
        // Yeh saari galtiyan (kharab file, checksum match nahi, jaanch fail)
        // pehle se hi saaf, samajhne layak Hinglish me likhi hain — isliye
        // seedha admin ko dikhate hain, generic "kuch gadbad hai" nahi.
        throw badRequest(String(error?.message || error));
      }
      if (!result) throw notFound('Yeh backup nahi mili ya abhi kaam ki nahi hai');

      await logActivity(req, {
        action: 'updated',
        module: 'settings',
        item: req.params.name,
        detail: `Database restore hua — ${result.tables} tables, ${result.rows} rows`,
      });

      res.json({
        ok: true,
        message: `Done — ${result.tables} tables, ${result.rows} rows restored. Everyone (including you) will need to sign in again.`,
        restartRequired: false,
      });
      return;
    }

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
      message: 'Done. Now stop the server and start it again — the database will come back from this backup.',
      restartRequired: true,
    });
  })
);

// --- apne computer se backup file wapas daalo -------------------------------
// Yeh SIRF file lekar jaanchti aur backup list me jodti hai — restore turant
// nahi karti. Restore uske baad, list se, ek alag (RESTORE type karke pakka
// kiya hua) kadam hai — jaisa kisi bhi doosre backup ke liye hota hai.
router.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const type = req.get('content-type') || '';
    if (!type.includes('application/gzip') && !type.includes('application/octet-stream')) {
      throw badRequest('Backup file .tar.gz honi chahiye');
    }

    // Bade backup ko poori tarah memory me uthana theek nahi, par jaanch se
    // pehle poori file chahiye (gunzip + JSON.parse ek saath karna padta hai)
    // — isliye yahan seedha buffer me le rahe hain.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (currentDriver() === 'postgres') {
      let backup;
      try {
        backup = await storeUploadedBackup(buffer, { userId: req.user.id });
      } catch (error) {
        // Kharab file, purana/naya format, checksum match nahi — yeh saari
        // wajah pehle se saaf Hinglish me likhi hain.
        throw badRequest(String(error?.message || error));
      }

      await logActivity(req, {
        action: 'created',
        module: 'settings',
        item: backup.name,
        detail: `Upload ki hui backup jaanchi aur list me jodi — ${backup.tableCount} tables, ${backup.rowCount} rows`,
      });

      res.status(201).json({ ok: true, backup, message: 'File checked and added to the list. Press "Restore" on it now.' });
      return;
    }

    // PGlite ka backup file bilkul alag format (poore folder ka tar) me hoti
    // hai, Postgres wale JSON dump se nahi milti — isliye yahan jaanch/store
    // nahi kar sakte, seedha pending restore me rakh dete hain jaisa pehle
    // hota tha.
    const { writeFile } = await import('node:fs/promises');
    await writeFile(pendingRestorePath, buffer);

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'upload',
      detail: 'Backup file upload hui — server restart hone par lagegi',
    });

    res.json({
      ok: true,
      message: 'File received. Now stop the server and start it again.',
      restartRequired: true,
    });
  })
);

export default router;

// ---------------------------------------------------------------------------
// Backup ke buttons — ek click wala kaam.
//
// Sirf Super Admin. Backup file me poora database hota hai, isliye ise koi aur
// download nahi kar sakta.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { currentDriver } from '../db/client.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { getBackupStorage } from '../services/backupStorage.js';
import {
  EVERY_DAYS,
  acknowledgeMonthlyNotice,
  bytesToText,
  createBackup,
  deleteBackup,
  getBackup,
  getBackupSettings,
  getBackupUsage,
  getPendingMonthlyNotice,
  listBackups,
  markForRestore,
  pendingRestorePath,
  restoreFromBackup,
  storeUploadedBackup,
} from '../services/backup.js';

const router = Router();

// Backup me sab kuch hota hai — password hashes tak. Isliye Super Admin ko
// hamesha (roleCan() ka pehla check) sab mil jata hai, aur har doosre role ke
// liye har action apni alag permission maangta hai — jab tak koi Super Admin
// Roles & Permissions se khud na de, kisi aur role ko yahan by default kuch
// nahi milta (bilkul us purane hardcoded "sirf Super Admin" jaisa hi asar,
// bas ab configurable hai).

// --- backup ki list + settings ----------------------------------------------
router.get(
  '/',
  requireModule('backups', 'view'),
  asyncHandler(async (req, res) => {
    const backups = await listBackups();
    const storage = getBackupStorage();
    const lastGood = backups.find((b) => b.status === 'successful');

    const [backupSettings, usedBytes, pendingMonthlyNotice] = await Promise.all([
      getBackupSettings(),
      getBackupUsage(),
      getPendingMonthlyNotice(),
    ]);

    res.json({
      backups,
      settings: {
        everyDays: EVERY_DAYS,
        retentionMonths: backupSettings.retentionMonths,
        maxStorageBytes: backupSettings.maxStorageBytes,
        maxStorageText: bytesToText(backupSettings.maxStorageBytes),
        usedBytes,
        usedText: bytesToText(usedBytes),
        usagePercent: backupSettings.maxStorageBytes > 0
          ? Math.min(100, Math.round((usedBytes / backupSettings.maxStorageBytes) * 100))
          : 0,
        note: `Har ${EVERY_DAYS} din me apne aap backup banta hai. Mahina poora hote hi ek monthly file ban jaati hai. Retention: ${backupSettings.retentionMonths} mahine, storage limit: ${bytesToText(backupSettings.maxStorageBytes)}.`,
        storage: {
          durable: storage.isDurable(),
          description: storage.describe(),
        },
        lastSuccessfulAt: lastGood?.createdAt ?? null,
        pendingMonthlyNotice,
      },
    });
  })
);

// --- ek click me backup banao -----------------------------------------------
router.post(
  '/',
  requireModule('backups', 'create'),
  asyncHandler(async (req, res) => {
    let backup;
    try {
      backup = await createBackup({ reason: 'manual', userId: req.user.id });
    } catch (error) {
      throw badRequest(`Backup could not be created: ${String(error?.message || error)}`);
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
  requireModule('backups', 'download'),
  asyncHandler(async (req, res) => {
    const meta = await getBackup(req.params.name);
    if (!meta || meta.status !== 'successful') throw notFound('This backup file was not found');

    const storage = getBackupStorage();
    if (!(await storage.exists(req.params.name))) throw notFound('This backup file was not found');

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
  requireModule('backups', 'delete'),
  asyncHandler(async (req, res) => {
    const removed = await deleteBackup(req.params.name);
    if (!removed) throw notFound('This backup file was not found');

    await logActivity(req, {
      action: 'deleted',
      module: 'settings',
      item: req.params.name,
      detail: 'Backup hataya gaya',
    });

    res.json({ ok: true });
  })
);

// --- "Monthly Backup Ready" modal band karo ---------------------------------
// Download ya Later, dono se — is monthly backup ka modal dobara refresh par
// nahi dikhna chahiye, isliye response ka button dabte hi yeh bulaya jata hai.
router.post(
  '/:name/acknowledge',
  requireModule('backups', 'view'),
  asyncHandler(async (req, res) => {
    const ok = await acknowledgeMonthlyNotice(req.params.name);
    if (!ok) throw notFound('This monthly backup was not found');
    res.json({ ok: true });
  })
);

// --- restore ----------------------------------------------------------------
// Asli Postgres par turant, ek transaction me ho jata hai — dobara restart
// karne ki zarurat nahi. PGlite par ab bhi do kadam me hai (nishaan lagao,
// phir restart), kyunki chalte hue PGlite ko badalna surakshit nahi.
router.post(
  '/:name/restore',
  requireModule('backups', 'restore'),
  validate(z.object({
    confirm: z.literal('RESTORE', {
      errorMap: () => ({ message: 'Type RESTORE to confirm' }),
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
      if (!result) throw notFound('This backup was not found or is not yet usable');

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
    if (!ok) throw notFound('This backup file was not found');

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
  requireModule('backups', 'upload'),
  asyncHandler(async (req, res) => {
    const type = req.get('content-type') || '';
    if (!type.includes('application/gzip') && !type.includes('application/octet-stream')) {
      throw badRequest('The backup file must be a .tar.gz');
    }

    // Bade backup ko poori tarah memory me uthana theek nahi, par jaanch se
    // pehle poori file chahiye (gunzip + JSON.parse ek saath karna padta hai)
    // — isliye yahan seedha buffer me le rahe hain.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (currentDriver() === 'postgres') {
      let result;
      try {
        result = await storeUploadedBackup(buffer, { userId: req.user.id });
      } catch (error) {
        // Kharab file, purana/naya format, checksum match nahi — yeh saari
        // wajah pehle se saaf Hinglish me likhi hain.
        throw badRequest(String(error?.message || error));
      }

      // Sirf filename se nahi — asli data checksum se pehchana gaya ki yeh
      // upload abhi ke database jaisa hi hai, ya kisi already-saved backup
      // jaisa hi hai. Dono surat me kuch naya nahi jodte, restore/copy nahi
      // karte.
      if (result.duplicate) {
        await logActivity(req, {
          action: 'updated',
          module: 'settings',
          item: 'upload',
          detail: 'Upload ki hui backup already maujood/current jaisi hai — nayi copy nahi jodi',
        });

        res.status(200).json({
          ok: true,
          duplicate: true,
          message: result.message,
          matchedBackup: result.matchedBackup ?? null,
        });
        return;
      }

      await logActivity(req, {
        action: 'created',
        module: 'settings',
        item: result.backup.name,
        detail: `Upload ki hui backup jaanchi aur list me jodi — ${result.backup.tableCount} tables, ${result.backup.rowCount} rows`,
      });

      res.status(201).json({
        ok: true,
        duplicate: false,
        different: true,
        backup: result.backup,
        message: 'Different backup detected — checked and added to the list. Press "Restore" on it now.',
      });
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

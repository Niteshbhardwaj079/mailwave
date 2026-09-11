// ---------------------------------------------------------------------------
// Backup — poora database ek file me.
//
// Yeh sabse zaroori cheez hai. Database ek folder hai; wo folder gaya to saara
// data gaya — contacts, campaigns, sab. Iska koi doosra copy nahi hota.
//
// Teen hisse alag-alag hain, jaan-boojh kar:
//   - db/client.js       -> KYA backup hota hai (dump/restore ka asli kaam)
//   - backupStorage.js   -> KAHAN rakha jaata hai (disk ya S3-jaisi jagah)
//   - yeh file           -> IN DONO ko jodta hai + list/status/schedule/prune
//
// Isse Neon se kisi doosre Postgres par jaana ho, ya disk se S3 par — sirf
// upar wale do hisson me se ek badalta hai, yeh orchestration wala hissa nahi.
//
// Do tarah ke backup, jaan-boojh kar alag:
//   - 'daily'   -> rolling backup: manual click, automatic schedule, startup,
//                  upload, ya restore se pehle wali "safety" backup. Yeh
//                  Settings ke retention/storage-limit ke hisaab se aate-jaate
//                  rehte hain.
//   - 'monthly' -> ek poora, ab-complete-ho-chuka mahina, ek hi file me
//                  (mailwave-backup-2026-09.tar.gz jaisa). Us mahine ke daily
//                  backups isi ke banne ke turant baad hata diye jaate hain —
//                  ek mahine ke liye ek hi file, dher saari nahi.
// ---------------------------------------------------------------------------
import { stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  currentDatabaseChecksum,
  currentDriver,
  dumpDatabase,
  many,
  one,
  query,
  readAndValidateBackup,
  restoreDatabase,
  withAdvisoryLock,
} from '../db/client.js';
import { serverRoot } from '../env.js';
import { newId } from '../lib/ids.js';
import { getBackupStorage } from './backupStorage.js';

/** Har kitne din me apne aap backup bane. */
export const EVERY_DAYS = Number.parseInt(process.env.BACKUP_EVERY_DAYS ?? '7', 10) || 7;

/** Settings page se badli na gayi ho to yeh defaults chalte hain — user ka apna example (500 MB) hi default rakha hai. */
const DEFAULT_BACKUP_SETTINGS = {
  retentionMonths: 2,
  maxStorageBytes: 500 * 1024 * 1024,
};

/**
 * `name` has a UNIQUE constraint (backups.name) — seconds + a short random
 * suffix (not just hours:minutes) so two backups started in the same minute
 * never collide. This is a real scenario, not just theoretical: a restore's
 * automatic safety backup can land in the same minute as another backup
 * (manual click, monthly consolidation, automatic schedule), and a fast
 * double-click on "Back up now" collides even sooner than that.
 */
function timestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6);
  return `mailwave-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
         `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}.tar.gz`;
}

/** 'YYYY-MM' — monthly consolidation aur retention, dono isi se mahine pehchante hain. Local time, timestampName() jaisa hi. */
function monthKeyOf(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthlyName(monthKey) {
  return `mailwave-backup-${monthKey}.tar.gz`;
}

export function bytesToText(bytes) {
  if (bytes == null) return '—';
  const mb = Number(bytes) / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function toBackupApi(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    reason: row.reason,
    kind: row.kind ?? 'daily',
    monthKey: row.month_key ?? null,
    storageDriver: row.storage_driver,
    formatVersion: row.format_version ?? null,
    size: row.size_bytes ? Number(row.size_bytes) : null,
    sizeText: row.size_bytes ? bytesToText(row.size_bytes) : '—',
    tableCount: row.table_count,
    rowCount: row.row_count ? Number(row.row_count) : null,
    error: row.error,
    restoredAt: row.restored_at,
    restoreError: row.restore_error,
    notifiedAt: row.notified_at ?? null,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

/** Storage abstraction ke pichhe kaunsa driver hai — 'local' ya 's3'. UI ko sach batane ke liye. */
function currentStorageDriverName() {
  return getBackupStorage().isDurable() ? 's3' : 'local';
}

/** Settings page ki Backup Settings — na bachi ho to defaults (2 mahine, 500 MB). */
export async function getBackupSettings() {
  const row = await one(`SELECT value FROM settings WHERE key = 'backupSettings'`);
  const value = row?.value ?? {};
  return {
    retentionMonths: Number.isInteger(value.retentionMonths) ? value.retentionMonths : DEFAULT_BACKUP_SETTINGS.retentionMonths,
    maxStorageBytes: Number.isInteger(value.maxStorageBytes) ? value.maxStorageBytes : DEFAULT_BACKUP_SETTINGS.maxStorageBytes,
  };
}

/** Abhi kitni jagah successful backups le rahe hain — storage usage bar ke liye. */
export async function getBackupUsage() {
  const row = await one(`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used FROM backups WHERE status = 'successful'`);
  return Number(row?.used ?? 0);
}

/**
 * Asli database abhi kitni jagah le rahi hai — `pg_database_size()` har real
 * Postgres (kisi bhi host — Render/Neon/Supabase/apna VPS/kal koi aur) aur
 * PGlite, dono par kaam karta hai, isliye yahan koi provider-specific cheez
 * nahi hai. Kabhi bhi database migrate ho, yeh function jaisa hai waisa hi
 * kaam karta rahega.
 */
export async function getDatabaseSizeBytes() {
  try {
    const row = await one(`SELECT pg_database_size(current_database()) AS bytes`);
    return row?.bytes != null ? Number(row.bytes) : null;
  } catch (error) {
    // Koi bahut purana/anjaan driver ho jo yeh function na jaanta ho — chup-
    // chap "pata nahi" bol dete hain, screen isse crash nahi karti.
    return null;
  }
}

/** Sabse nayi monthly backup jiska modal abhi dikhana baaki hai — ek baar dikh jaaye to dobara nahi (notified_at). */
export async function getPendingMonthlyNotice() {
  const row = await one(
    `SELECT name, month_key, size_bytes, created_at FROM backups
      WHERE kind = 'monthly' AND status = 'successful' AND notified_at IS NULL
      ORDER BY created_at DESC LIMIT 1`
  );
  if (!row) return null;
  return {
    name: row.name,
    monthKey: row.month_key,
    size: row.size_bytes ? Number(row.size_bytes) : null,
    sizeText: bytesToText(row.size_bytes),
    createdAt: row.created_at,
  };
}

/** "Download" ya "Later" — dono modal ko hamesha ke liye band kar dete hain, chahe kuch bhi dabaya ho. */
export async function acknowledgeMonthlyNotice(name) {
  const result = await query(`UPDATE backups SET notified_at = now() WHERE name = $1 AND kind = 'monthly'`, [name]);
  // pg gives rowCount, PGlite gives affectedRows — same pattern already used
  // elsewhere in this codebase (routes/campaigns.js, routes/contacts.js).
  return (result.affectedRows ?? result.rowCount ?? 0) > 0;
}

/**
 * Naya backup banata hai — 7 kadam, aur "successful" tabhi jab saaton ho jayein:
 *   1. Record banao (status: running)
 *   2. Asli database se data uthao (dumpDatabase)
 *   3. Jaanch lo ki jo bana wo khud khul bhi sakta hai (validate)
 *   4. Persistent storage me rakho
 *   5. Record ko "successful" karo, poori jaankari ke saath
 *   6. Monthly consolidation + retention/storage-limit cleanup (dono naye
 *      backup ke SUCCESSFUL/verified ho jaane ke BAAD hi chalte hain — kabhi
 *      pehle nahi, warna verify hone se pehle purana hat sakta hai)
 *   7. Kuch bhi beech me fail ho, to record "failed" ho jata hai — kabhi
 *      jhoothi "successful" nahi dikhti
 */
export async function createBackup({ reason = 'manual', userId = null } = {}) {
  const storage = getBackupStorage();
  const id = newId('bak');
  const name = timestampName();
  const storageDriver = currentStorageDriverName();

  await query(
    `INSERT INTO backups (id, name, status, reason, kind, storage_driver, created_by, started_at)
     VALUES ($1,$2,'running',$3,'daily',$4,$5, now())`,
    [id, name, reason, storageDriver, userId]
  );

  try {
    const { buffer, meta } = await dumpDatabase();

    // Banते hi khud jaanch lo — gunzip + parse wapas se ho, tabhi "successful"
    // bolna. Isse ek kharab/adhoori file kabhi list me "safal" dikh kar kisi
    // ko galat bharosa nahi degi.
    if (meta.tableCount !== null) {
      await readAndValidateBackup(buffer);
    }

    await storage.save(name, buffer);

    await query(
      `UPDATE backups
          SET status = 'successful', format_version = $1, size_bytes = $2, table_count = $3,
              row_count = $4, checksum = $5, finished_at = now()
        WHERE id = $6`,
      [meta.formatVersion, buffer.length, meta.tableCount, meta.rowCount, meta.checksum, id]
    );

    console.log(`[backup] bana: ${name} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${reason}, ${storageDriver})`);

    const { consolidated, removed } = await runMaintenance();
    if (consolidated.length) console.log(`[backup] Monthly consolidation: ${consolidated.join(', ')}`);
    if (removed.length) console.log(`[backup] Retention/storage-limit ke hisaab se hataye: ${removed.join(', ')}`);

    const row = await one('SELECT * FROM backups WHERE id = $1', [id]);
    return { ...toBackupApi(row), removed };
  } catch (error) {
    const message = String(error?.message || error).slice(0, 500);
    await query(`UPDATE backups SET status = 'failed', error = $1, finished_at = now() WHERE id = $2`, [
      message,
      id,
    ]);
    console.error(`[backup] "${name}" banane me dikkat:`, error);
    throw error;
  }
}

/** Saare backup, naye se purane — asli source database hai, disk/S3 nahi. */
export async function listBackups() {
  const rows = await many('SELECT * FROM backups ORDER BY created_at DESC');
  return rows.map(toBackupApi);
}

export async function getBackup(name) {
  const row = await one('SELECT * FROM backups WHERE name = $1', [name]);
  return row ? toBackupApi(row) : null;
}

async function deleteBackupRows(rows) {
  const storage = getBackupStorage();
  const removed = [];
  for (const row of rows) {
    try {
      await storage.delete(row.name);
    } catch (error) {
      console.warn(`[backup] "${row.name}" storage se hatane me dikkat (aage badh rahe hain):`, error.message);
    }
    await query('DELETE FROM backups WHERE id = $1', [row.id]);
    removed.push(row.name);
  }
  return removed;
}

/**
 * Ek poora, ab-complete-ho-chuka calendar mahina mile, jiski abhi tak koi
 * monthly file nahi bani — us mahine ka sabse naya (aakhri) daily backup
 * uthao, use "mailwave-backup-YYYY-MM.tar.gz" naam se copy karo, monthly
 * record banao, aur ab-zaroorat-na-rahi daily backups (usi mahine ke)
 * hata do — ek mahine ke liye ek hi file, dher saari nahi.
 *
 * Chalu (abhi wala) mahina kabhi consolidate nahi hota — wo poora hua hi
 * nahi hai.
 */
async function consolidateMonthlyBackups() {
  const currentMonthKey = monthKeyOf(new Date());

  const dailyRows = await many(
    `SELECT id, name, created_at FROM backups
      WHERE status = 'successful' AND kind = 'daily'
      ORDER BY created_at ASC`
  );

  const byMonth = new Map();
  for (const row of dailyRows) {
    const mk = monthKeyOf(row.created_at);
    if (mk >= currentMonthKey) continue; // abhi chalu mahina — poora hua hi nahi
    if (!byMonth.has(mk)) byMonth.set(mk, []);
    byMonth.get(mk).push(row);
  }

  const created = [];
  const storage = getBackupStorage();

  for (const [monthKey, rows] of byMonth) {
    const already = await one(`SELECT id FROM backups WHERE kind = 'monthly' AND month_key = $1`, [monthKey]);
    if (already) continue;

    const latest = await one('SELECT * FROM backups WHERE id = $1', [rows[rows.length - 1].id]);

    let buffer;
    try {
      buffer = await storage.read(latest.name);
    } catch (error) {
      console.warn(
        `[backup] "${latest.name}" (${monthKey}) monthly consolidation ke liye padha nahi ja saka, is mahine ko agli baar try karenge: ${error.message}`
      );
      continue;
    }

    const name = monthlyName(monthKey);
    const id = newId('bak');
    await storage.save(name, buffer);
    await query(
      `INSERT INTO backups
         (id, name, status, reason, kind, month_key, storage_driver, format_version,
          size_bytes, table_count, row_count, checksum, started_at, finished_at)
       VALUES ($1,$2,'successful','monthly-consolidation','monthly',$3,$4,$5,$6,$7,$8,$9, now(), now())`,
      [
        id,
        name,
        monthKey,
        currentStorageDriverName(),
        latest.format_version,
        latest.size_bytes,
        latest.table_count,
        latest.row_count,
        latest.checksum,
      ]
    );

    // Is (ab complete ho chuke) mahine ke baaki saare daily backups —
    // monthly file wahi data mehfooz rakhती hai, isliye ek se zyada file
    // rakhne ki zarurat nahi.
    const allMonthRows = await many(
      `SELECT id, name FROM backups WHERE kind = 'daily' AND status = 'successful' AND id = ANY($1)`,
      [rows.map((r) => r.id)]
    );
    await deleteBackupRows(allMonthRows);

    console.log(`[backup] Monthly backup bani: ${name} (${monthKey}, "${latest.name}" se)`);
    created.push(name);
  }

  return created;
}

/**
 * Retention (kitne mahine) + storage limit (kitni jagah) dono milkar tay
 * karte hain kaunse backup rakhne hain. Yeh kabhi nahi hataata:
 *   - sabse naya (latest) successful backup, chahe kuch bhi ho
 *   - kisi bhi abhi-tak-consolidate-na-hui (purani, complete-ho-chuki)
 *     mahine ka SABSE NAYA daily backup — agla consolidation pass isی se
 *     us mahine ki monthly file banayega
 *   - akhri bacha hua ek backup (data loss kabhi nahi)
 */
export async function enforceRetention() {
  const settings = await getBackupSettings();
  const all = await many(
    `SELECT id, name, kind, month_key, created_at, size_bytes
       FROM backups WHERE status = 'successful' ORDER BY created_at ASC`
  );
  if (all.length <= 1) return [];

  const latestId = all[all.length - 1].id;
  const currentMonthKey = monthKeyOf(new Date());

  // Har (abhi tak consolidate na hui, poori ho chuki) mahine ka sabse naya
  // daily backup — yehi consolidation ka source banega, isliye surakshit.
  const latestDailyPerPastMonth = new Map();
  for (const row of all) {
    if (row.kind !== 'daily') continue;
    const mk = monthKeyOf(row.created_at);
    if (mk === currentMonthKey) continue;
    const prev = latestDailyPerPastMonth.get(mk);
    if (!prev || new Date(row.created_at) > new Date(prev.created_at)) latestDailyPerPastMonth.set(mk, row);
  }
  const protectedIds = new Set([latestId, ...[...latestDailyPerPastMonth.values()].map((r) => r.id)]);
  const isProtected = (row) => protectedIds.has(row.id);

  const removed = [];
  let remaining = [...all];

  // 1) Retention months — monthly backups jo window se purani hain.
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - settings.retentionMonths);
  const cutoffKey = monthKeyOf(cutoff);

  for (const row of remaining) {
    if (remaining.length <= 1) break;
    if (row.kind !== 'monthly' || !row.month_key) continue;
    if (row.month_key >= cutoffKey) continue;
    if (isProtected(row)) continue;

    const [deletedName] = await deleteBackupRows([row]);
    if (deletedName) {
      removed.push(deletedName);
      remaining = remaining.filter((r) => r.id !== row.id);
    }
  }

  // 2) Storage limit — oldest eligible first, daily before monthly (monthly
  // archives are what the retention setting is meant to protect).
  let usedBytes = remaining.reduce((sum, row) => sum + Number(row.size_bytes ?? 0), 0);

  if (usedBytes > settings.maxStorageBytes) {
    const rank = (row) => (row.kind === 'daily' ? 0 : 1);
    const eligible = remaining
      .filter((row) => !isProtected(row))
      .sort((a, b) => (rank(a) !== rank(b) ? rank(a) - rank(b) : new Date(a.created_at) - new Date(b.created_at)));

    for (const row of eligible) {
      if (usedBytes <= settings.maxStorageBytes) break;
      if (remaining.length <= 1) break;

      const [deletedName] = await deleteBackupRows([row]);
      if (deletedName) {
        removed.push(deletedName);
        usedBytes -= Number(row.size_bytes ?? 0);
        remaining = remaining.filter((r) => r.id !== row.id);
      }
    }
  }

  return removed;
}

/** Monthly consolidation, phir retention/storage-limit cleanup — hamesha isi order me (consolidate pehle, warna cleanup abhi-poori-hui mahine ke akele backup ko hi na hata de). */
async function runMaintenance() {
  const consolidated = await consolidateMonthlyBackups();
  const removed = await enforceRetention();
  return { consolidated, removed };
}

export async function deleteBackup(name) {
  const row = await one('SELECT id FROM backups WHERE name = $1', [name]);
  if (!row) return false;

  const storage = getBackupStorage();
  await storage.delete(name).catch(() => {});
  await query('DELETE FROM backups WHERE id = $1', [row.id]);
  return true;
}

/**
 * Backup se turant restore — sirf asli Postgres ke liye.
 *
 * Sabse pehle: ABHI ke database ki apni, banते-hi-verify-hui "safety" backup
 * — jab tak yeh safaltapoorvak na ban jaaye, restore shuru hi nahi hota. Yeh
 * fail ho jaaye to maujooda database ko haath tak nahi lagaya jata.
 *
 * PGlite ke liye restore alag hai (markForRestore + restart), kyunki chalte
 * hue PGlite ko badalna surakshit nahi. Asli Postgres par aisi koi rok nahi,
 * isliye yeh seedha, ek transaction me, turant ho jata hai.
 */
export async function restoreFromBackup(name) {
  const meta = await one('SELECT * FROM backups WHERE name = $1', [name]);
  if (!meta || meta.status !== 'successful') return null;

  const storage = getBackupStorage();
  const exists = await storage.exists(name);
  if (!exists) {
    throw new Error('This backup file was not found in storage — it may have been removed.');
  }

  try {
    await createBackup({ reason: 'safety' });
  } catch (error) {
    throw new Error(
      `Restore could not start — a fresh safety backup of the current database could not be created and verified (${String(
        error?.message || error
      )}). Your existing data was not touched.`
    );
  }

  try {
    const buffer = await storage.read(name);
    const result = await restoreDatabase(buffer);
    await query(`UPDATE backups SET restored_at = now(), restore_error = NULL WHERE name = $1`, [name]);
    return result;
  } catch (error) {
    const message = String(error?.message || error).slice(0, 500);
    await query(`UPDATE backups SET restore_error = $1 WHERE name = $2`, [message, name]);
    throw error;
  }
}

/**
 * Upload ki hui file ko jaanch kar backup list me joड़ देता है — TURANT
 * restore NAHI karta. Restore alag, apna confirm-wala kadam hai (jaisa kisi
 * bhi doosre backup ke liye hota hai) — upload sirf file lana aur jaanchna
 * hai, database badalna nahi.
 *
 * Pehle checksum se dekhta hai: yeh upload abhi ke database jaisa hi hai, ya
 * kisi already-saved backup jaisa hi hai — dono me duplicate ADD nahi karta
 * (sirf filename se nahi, asli data checksum se pehchanta hai).
 */
export async function storeUploadedBackup(buffer, { userId = null } = {}) {
  const payload = await readAndValidateBackup(buffer);
  const uploadedChecksum = payload.checksum ?? null;

  if (uploadedChecksum) {
    const liveChecksum = await currentDatabaseChecksum();
    if (liveChecksum && liveChecksum === uploadedChecksum) {
      return {
        duplicate: true,
        message: 'This backup is identical to the current database — nothing to restore.',
        matchedBackup: null,
      };
    }

    const existing = await one(`SELECT * FROM backups WHERE checksum = $1 AND status = 'successful' LIMIT 1`, [
      uploadedChecksum,
    ]);
    if (existing) {
      return {
        duplicate: true,
        message: 'This backup already exists in your saved list.',
        matchedBackup: toBackupApi(existing),
      };
    }
  }

  const storage = getBackupStorage();
  const id = newId('bak');
  const name = timestampName().replace('.tar.gz', '-uploaded.tar.gz');
  const rowCount = Object.values(payload.tables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);

  await storage.save(name, buffer);
  await query(
    `INSERT INTO backups
       (id, name, status, reason, kind, storage_driver, created_by, format_version, size_bytes,
        table_count, row_count, checksum, started_at, finished_at)
     VALUES ($1,$2,'successful','upload','daily',$3,$4,$5,$6,$7,$8,$9, now(), now())`,
    [
      id,
      name,
      currentStorageDriverName(),
      userId,
      payload.formatVersion,
      buffer.length,
      Object.keys(payload.tables).length,
      rowCount,
      payload.checksum ?? null,
    ]
  );

  const row = await one('SELECT * FROM backups WHERE id = $1', [id]);
  const { removed } = await runMaintenance();

  return {
    duplicate: false,
    different: true,
    backup: { ...toBackupApi(row), removed },
  };
}

/**
 * Restore ke liye taiyari — SIRF PGlite ke liye (dekho startBackupSchedule ka
 * comment). Asli Postgres par restore turant hota hai (upar restoreFromBackup
 * dekho), is do-kadam wale raaste ki zarurat hi nahi padti.
 */
export const pendingRestorePath = resolve(serverRoot, 'data/restore.pending');

export async function markForRestore(name) {
  const storage = getBackupStorage();
  if (!(await storage.exists(name))) return false;

  const buffer = await storage.read(name);
  await writeFile(pendingRestorePath, buffer);
  return true;
}

export async function hasPendingRestore() {
  try {
    await stat(pendingRestorePath);
    return true;
  } catch (error) {
    return false;
  }
}

// --- apne aap chalne wala backup --------------------------------------------

let timer = null;

/** Sabse naye SUCCESSFUL backup ki umar (dinon me). Kabhi banaya hi nahi to Infinity. */
async function daysSinceLastBackup() {
  const row = await one(`SELECT created_at FROM backups WHERE status = 'successful' ORDER BY created_at DESC LIMIT 1`);
  if (!row) return Infinity;
  return (Date.now() - new Date(row.created_at).getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * Ek waqt me sirf EK process automatic backup banaye — agar kal ko yeh app
 * ek se zyada instance/process me chale (jaise scaling), to bhi 5 instance ek
 * saath 5 backup nahi bana denge. Postgres ka advisory lock isi ke liye hai:
 * har provider (Neon/Supabase/RDS/koi bhi) me yeh ek jaisa kaam karta hai,
 * kisी khaas provider ki cheez nahi hai.
 *
 * PGlite single-process hoti hai (dusra instance ho hi nahi sakta usi
 * dataDir par), isliye wahan lock ki zarurat nahi.
 */
const AUTO_BACKUP_LOCK_KEY = 727299001;

async function withAutoBackupLock(fn) {
  if (currentDriver() !== 'postgres') {
    return fn();
  }

  // Session-scoped locks (pg_try_advisory_lock/pg_advisory_unlock) turned out
  // NOT to be safe here: measured directly against this project's own Neon
  // connection, its pooler can silently hand two different clients the same
  // backend session whenever neither has an open transaction, so two
  // "different" connections could both successfully take the same session
  // lock at once — no real mutual exclusion. A transaction-scoped lock
  // (pg_try_advisory_xact_lock, via withAdvisoryLock) does not have this
  // problem: transaction pooling dedicates one real backend for as long as a
  // transaction stays open (confirmed the same way), and the lock releases
  // itself on COMMIT — no separate unlock call to risk running on the wrong
  // connection. fn() itself still runs through the ordinary pool, so its own
  // writes (the backup's "running" → "successful" row) commit and become
  // visible normally, not only once the whole backup finishes.
  const { acquired, result } = await withAdvisoryLock(AUTO_BACKUP_LOCK_KEY, fn);
  if (!acquired) {
    console.log('[backup] koi doosra process pehle se automatic backup kar raha hai — is baar skip.');
    return null;
  }
  return result;
}

/**
 * Har 6 ghante me dekhta hai: "pichhle backup ko EVERY_DAYS din ho gaye
 * kya?" — agar haan, naya backup banta hai (jo khud hi consolidation +
 * retention/storage-limit cleanup bhi chala deta hai). Agar nahi, tab bhi
 * consolidation + cleanup chalाते hain — taaki mahina poora hote hi, ya
 * Settings me retention/storage badalte hi, agle 6 ghante ke andar khud
 * theek ho jaaye, kisi naye backup ka intezaar kiye bina.
 *
 * Cron ki tarah "har Sunday raat 2 baje" nahi rakha — kyunki agar us waqt
 * server band hua to backup poora skip ho jata. Aise poochne se, server jab
 * bhi chalu ho, backup ho jata hai.
 */
export function startBackupSchedule() {
  if (timer) return;

  const CHECK_EVERY = 6 * 60 * 60 * 1000; // 6 ghante

  async function check() {
    try {
      await withAutoBackupLock(async () => {
        const age = await daysSinceLastBackup();
        if (age >= EVERY_DAYS) {
          await createBackup({ reason: 'automatic' });
        } else {
          await runMaintenance();
        }
      });
    } catch (error) {
      console.error('[backup] automatic backup fail hua:', error);
    }
  }

  /**
   * Server chalu hote hi EK BACKUP — chahe pichhla kitna bhi naya ho.
   *
   * Yeh sabse zaroori suraksha hai. PGlite ka folder achanak band hone par toot
   * sakta hai; asli Postgres par bhi yeh ek extra, apne app ke andar wala
   * safety net hai (hosting provider ka apna backup alag se chalu rakhna
   * chahiye, yeh uski jagah nahi leta). Har baar chalu hote hi backup lene ka
   * matlab: bura se bura ho to sirf PICHHLI baar ke baad ka kaam jayega, poora
   * data nahi.
   *
   * 4 second ruk kar isliye ki server pehle chalu ho jaye, warna pehla page
   * khulne me der lagegi.
   */
  setTimeout(async () => {
    try {
      await withAutoBackupLock(() => createBackup({ reason: 'startup' }));
    } catch (error) {
      console.error('[backup] chalu hote hi backup nahi ban paya:', error);
    }
  }, 4_000);

  timer = setInterval(check, CHECK_EVERY);

  // Yeh timer server ko band hone se na roke.
  if (timer.unref) timer.unref();

  console.log(
    `[backup] Har baar chalu hone par backup banega. Uske baad har ${EVERY_DAYS} din. ` +
      `Mahina poora hote hi ek monthly file ban jaati hai. Retention/storage-limit Settings se control hote hain. ` +
      `Storage: ${currentStorageDriverName()}.`
  );
}

export function stopBackupSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
}

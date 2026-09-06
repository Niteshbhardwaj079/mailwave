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
// ---------------------------------------------------------------------------
import { stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { currentDriver, dumpDatabase, many, one, query, readAndValidateBackup, restoreDatabase, withAdvisoryLock } from '../db/client.js';
import { serverRoot } from '../env.js';
import { newId } from '../lib/ids.js';
import { getBackupStorage } from './backupStorage.js';

/** Kitne successful backup rakhne hain. Isse purane apne aap hat jate hain. Kam se kam 1 hamesha bachta hai. */
export const KEEP_COUNT = Number.parseInt(process.env.BACKUP_KEEP ?? '8', 10) || 8;

/** Har kitne din me apne aap backup bane. 7 = har hafte. */
export const EVERY_DAYS = Number.parseInt(process.env.BACKUP_EVERY_DAYS ?? '7', 10) || 7;

function timestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `mailwave-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
         `-${pad(now.getHours())}${pad(now.getMinutes())}.tar.gz`;
}

function toBackupApi(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    reason: row.reason,
    storageDriver: row.storage_driver,
    size: row.size_bytes ? Number(row.size_bytes) : null,
    sizeText: row.size_bytes ? `${(Number(row.size_bytes) / 1024 / 1024).toFixed(1)} MB` : '—',
    tableCount: row.table_count,
    rowCount: row.row_count ? Number(row.row_count) : null,
    error: row.error,
    restoredAt: row.restored_at,
    restoreError: row.restore_error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

/** Storage abstraction ke pichhe kaunsa driver hai — 'local' ya 's3'. UI ko sach batane ke liye. */
function currentStorageDriverName() {
  return getBackupStorage().isDurable() ? 's3' : 'local';
}

/**
 * Naya backup banata hai — 7 kadam, aur "successful" tabhi jab saaton ho jayein:
 *   1. Record banao (status: running)
 *   2. Asli database se data uthao (dumpDatabase)
 *   3. Jaanch lo ki jo bana wo khud khul bhi sakta hai (validate)
 *   4. Persistent storage me rakho
 *   5. Record ko "successful" karo, poori jaankari ke saath
 *   6. Purane, zarurat se zyada backup hatao
 *   7. Kuch bhi beech me fail ho, to record "failed" ho jata hai — kabhi
 *      jhoothi "successful" nahi dikhti
 */
export async function createBackup({ reason = 'manual', userId = null } = {}) {
  const storage = getBackupStorage();
  const id = newId('bak');
  const name = timestampName();
  const storageDriver = currentStorageDriverName();

  await query(
    `INSERT INTO backups (id, name, status, reason, storage_driver, created_by, started_at)
     VALUES ($1,$2,'running',$3,$4,$5, now())`,
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
    const removed = await pruneOldBackups();
    if (removed.length) console.log(`[backup] purane hataye: ${removed.join(', ')}`);

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

/** Sirf KEEP_COUNT jitne SUCCESSFUL backup rakhta hai. Kam se kam 1 hamesha bachta hai. */
export async function pruneOldBackups() {
  const successful = await many(
    `SELECT id, name FROM backups WHERE status = 'successful' ORDER BY created_at DESC`
  );
  const keep = Math.max(1, KEEP_COUNT);
  const extra = successful.slice(keep);
  if (extra.length === 0) return [];

  const storage = getBackupStorage();
  const removed = [];
  for (const row of extra) {
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
    throw new Error('Yeh backup ki file storage me nahi mili — shayad hat chuki hai.');
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
 */
export async function storeUploadedBackup(buffer, { userId = null } = {}) {
  const payload = await readAndValidateBackup(buffer);
  const storage = getBackupStorage();

  const id = newId('bak');
  const name = timestampName().replace('.tar.gz', '-uploaded.tar.gz');
  const rowCount = Object.values(payload.tables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);

  await storage.save(name, buffer);
  await query(
    `INSERT INTO backups
       (id, name, status, reason, storage_driver, created_by, format_version, size_bytes,
        table_count, row_count, checksum, started_at, finished_at)
     VALUES ($1,$2,'successful','upload',$3,$4,$5,$6,$7,$8,$9, now(), now())`,
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
  const removed = await pruneOldBackups();
  return { ...toBackupApi(row), removed };
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
 * Har 6 ghante me dekhta hai: "pichhle backup ko 7 din ho gaye kya?"
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
      `Sabse naye ${KEEP_COUNT} rakhe jayenge. Storage: ${currentStorageDriverName()}.`
  );
}

export function stopBackupSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
}

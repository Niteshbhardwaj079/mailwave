// ---------------------------------------------------------------------------
// Backup — poora database ek file me.
//
// Yeh sabse zaroori cheez hai. Database ek folder hai; wo folder gaya to saara
// data gaya — contacts, campaigns, sab. Iska koi doosra copy nahi hota.
//
// Yahan char cheezein hain:
//   1. Ek click me backup banao
//   2. Backup file download karo (apne computer/drive par rakhne ke liye)
//   3. Backup se wapas restore karo
//   4. Har hafte apne aap backup bane, aur purane apne aap hat jayein
//
// File ka naam: mailwave-backup-2026-08-29-1430.tar.gz
// ---------------------------------------------------------------------------
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { basename, resolve } from 'node:path';

import { env, serverRoot } from '../env.js';
import { currentDriver, dumpDatabase } from '../db/client.js';

export const backupDir = process.env.BACKUP_DIR || resolve(serverRoot, 'data/backups');

/** Kitne backup rakhne hain. Isse purane apne aap hat jate hain. */
export const KEEP_COUNT = Number.parseInt(process.env.BACKUP_KEEP ?? '8', 10) || 8;

/** Har kitne din me apne aap backup bane. 7 = har hafte. */
export const EVERY_DAYS = Number.parseInt(process.env.BACKUP_EVERY_DAYS ?? '7', 10) || 7;

function timestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `mailwave-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
         `-${pad(now.getHours())}${pad(now.getMinutes())}.tar.gz`;
}

/**
 * Naya backup banata hai.
 *
 * PGlite khud poore database ka ek .tar.gz bana kar deta hai — hum use file me
 * likh dete hain. Yeh file apne aap me poora database hai.
 */
export async function createBackup({ reason = 'manual' } = {}) {
  await mkdir(backupDir, { recursive: true });

  const blob = await dumpDatabase();

  const name = timestampName();
  const path = resolve(backupDir, name);

  // Blob ko seedha file me likhte hain — poori file memory me nahi uthate,
  // taki bada database bhi bina dikkat backup ho jaye.
  await pipeline(Readable.fromWeb(blob.stream()), createWriteStream(path));

  const info = await stat(path);
  const removed = await pruneOldBackups();

  console.log(`[backup] bana: ${name} (${(info.size / 1024 / 1024).toFixed(1)} MB, ${reason})`);
  if (removed.length) console.log(`[backup] purane hataye: ${removed.join(', ')}`);

  return { name, size: info.size, createdAt: info.mtime, reason, removed };
}

/** Saare backup, naye se purane. */
export async function listBackups() {
  await mkdir(backupDir, { recursive: true });
  const files = await readdir(backupDir);

  const rows = [];
  for (const file of files) {
    if (!file.endsWith('.tar.gz')) continue;
    const info = await stat(resolve(backupDir, file));
    rows.push({ name: file, size: info.size, createdAt: info.mtime });
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Sirf KEEP_COUNT jitne naye rakhta hai, baaki hata deta hai. */
export async function pruneOldBackups() {
  const all = await listBackups();
  const extra = all.slice(KEEP_COUNT);

  for (const file of extra) {
    await rm(resolve(backupDir, file.name), { force: true });
  }

  return extra.map((f) => f.name);
}

/**
 * File ka pura rasta deta hai — download ke liye.
 *
 * Naam ko basename() se guzarte hain taki koi `../../etc/passwd` jaisa naam
 * bhej kar server ki doosri file na maang le.
 */
export async function backupPath(name) {
  const safe = basename(String(name));
  if (!safe.endsWith('.tar.gz')) return null;

  const path = resolve(backupDir, safe);
  try {
    await stat(path);
    return path;
  } catch (error) {
    return null;
  }
}

export async function deleteBackup(name) {
  const path = await backupPath(name);
  if (!path) return false;
  await rm(path, { force: true });
  return true;
}

/**
 * Restore ke liye taiyari.
 *
 * PGlite chalte-chalte database nahi badal sakta, isliye restore do kadam me
 * hota hai:
 *   1. Yahan backup file ko "restore.pending" me rakh dete hain
 *   2. Server restart hota hai, aur boot par wo file uthakar us se database
 *      shuru karta hai
 *
 * Yeh jaan-boojh kar do kadam me hai — beech me kuch aadha-adhoora nahi hota.
 */
export const pendingRestorePath = resolve(serverRoot, 'data/restore.pending');

export async function markForRestore(name) {
  const path = await backupPath(name);
  if (!path) return false;

  const { copyFile } = await import('node:fs/promises');
  await copyFile(path, pendingRestorePath);
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

/** Sabse naye backup ki umar (dinon me). Kabhi banaya hi nahi to Infinity. */
async function daysSinceLastBackup() {
  const all = await listBackups();
  if (all.length === 0) return Infinity;
  return (Date.now() - new Date(all[0].createdAt).getTime()) / (24 * 60 * 60 * 1000);
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
      // Asli Postgres par backup hosting provider leta hai (Render/Supabase me
      // roz apne aap hota hai). Wahan yeh file-copy wala backup kaam nahi karta.
      if (currentDriver() !== 'pglite') return;

      const age = await daysSinceLastBackup();
      if (age >= EVERY_DAYS) {
        await createBackup({ reason: 'automatic' });
      }
    } catch (error) {
      console.error('[backup] automatic backup fail hua:', error);
    }
  }

  /**
   * Server chalu hote hi EK BACKUP — chahe pichhla kitna bhi naya ho.
   *
   * Yeh sabse zaroori suraksha hai. PGlite ka folder achanak band hone par toot
   * sakta hai. Har baar chalu hote hi backup lene ka matlab: bura se bura ho
   * to sirf PICHHLI baar ke baad ka kaam jayega, poora data nahi.
   *
   * 4 second ruk kar isliye ki server pehle chalu ho jaye, warna pehla page
   * khulne me der lagegi.
   */
  setTimeout(async () => {
    try {
      if (currentDriver() !== 'pglite') return;
      await createBackup({ reason: 'startup' });
    } catch (error) {
      console.error('[backup] chalu hote hi backup nahi ban paya:', error);
    }
  }, 4_000);

  timer = setInterval(check, CHECK_EVERY);

  // Yeh timer server ko band hone se na roke.
  if (timer.unref) timer.unref();

  console.log(
    `[backup] Har baar chalu hone par backup banega. Uske baad har ${EVERY_DAYS} din. ` +
      `Sabse naye ${KEEP_COUNT} rakhe jayenge.`
  );
}

export function stopBackupSchedule() {
  if (timer) clearInterval(timer);
  timer = null;
}

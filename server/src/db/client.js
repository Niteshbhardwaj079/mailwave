// ---------------------------------------------------------------------------
// Database se baat karne wali ek hi jagah.
//
// Do tarah se chal sakta hai — server/.env me DATABASE_URL se decide hota hai:
//
//   DATABASE_URL bhara hai  -> ASLI POSTGRES. Client ke liye YAHI use karo.
//   DATABASE_URL khali hai  -> PGlite. Kuch install nahi karna padta, par
//                              sirf apne computer par try karne ke liye.
//
// PGlite ko client ke server par kyun nahi?
// ------------------------------------------
// PGlite database ko ek folder me rakhta hai. Agar server ka process beech me
// achanak band ho jaye (bijli chali gayi, process kill ho gaya), to wo folder
// TOOT SAKTA HAI aur poora data chala jata hai. Humne khud yeh dekha hai.
//
// Asli Postgres iske liye bana hai — wo achanak band hone par bhi apna data
// bacha leta hai. Isliye jahan asli data ho, wahan asli Postgres.
//
// Achhi baat: SQL dono me bilkul ek jaisa hai. Sirf DATABASE_URL bharna hai,
// baaki code me kuch nahi badalta.
// ---------------------------------------------------------------------------
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { gunzip as gunzipCb, gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';

import { env } from '../env.js';

const gzip = promisify(gzipCb);
const gunzip = promisify(gunzipCb);

// pool.query()/pool.connect() can hand out a DIFFERENT physical connection on
// every call — fine for one-off statements, but BEGIN and the statements that
// are meant to be inside it must all land on the exact same connection, or
// they silently autocommit outside the transaction and COMMIT/ROLLBACK end up
// running on a connection that was never in one. This tracks "is there a
// pinned client for the current async call chain?" so query()/exec() route to
// it automatically — every existing caller keeps using the same query() they
// already call, with no signature change.
const pgTxClient = new AsyncLocalStorage();

let instance = null;
let driver = null;

/** Abhi kaun sa database chal raha hai — health check aur logs ke liye. */
export function currentDriver() {
  return driver;
}

// --- asli Postgres ----------------------------------------------------------

async function connectPostgres() {
  const { default: pg } = await import('pg');

  const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    // Hosted Postgres (Render, Supabase, Neon) par TLS lagta hai.
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Ek connection le kar dekh lo — galat URL ka pata abhi chal jaye, baad me
  // pehli request par nahi.
  const probe = await pool.connect();
  probe.release();

  driver = 'postgres';
  console.log('[db] Asli Postgres se juda');

  return {
    // A transaction pins one client via pgTxClient (see runInTransaction /
    // withClient below) — when that's set, every query()/exec() call made
    // anywhere inside it, however deeply nested, must reuse that exact
    // connection instead of asking the pool for a fresh one.
    query: (sql, params) => {
      const pinned = pgTxClient.getStore();
      return pinned ? pinned.query(sql, params) : pool.query(sql, params);
    },
    exec: async (sql) => {
      const pinned = pgTxClient.getStore();
      if (pinned) {
        await pinned.query(sql);
        return;
      }
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
    // A dedicated lock connection, deliberately NOT pinned via pgTxClient —
    // fn() keeps using the ordinary pool for its own queries, autocommitted
    // and visible to other viewers as it goes, exactly as if no lock were
    // involved. Only the lock itself lives inside a transaction, because that
    // is the only way pg_advisory_xact_lock's mutual exclusion is reliable
    // through a transaction-pooled connection (see AUTO_BACKUP_LOCK_KEY's
    // comment in services/backup.js for what was actually observed).
    withExclusiveLock: async (lockKey, fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT pg_try_advisory_xact_lock($1) AS ok', [lockKey]);
        if (!rows[0]?.ok) {
          await client.query('ROLLBACK');
          return { acquired: false };
        }
        try {
          const result = await fn();
          return { acquired: true, result };
        } finally {
          // Commits (not rolls back) even if fn() threw — losing the lock's
          // holder is fine either way since it only ever wrapped fn(), never
          // fn()'s own writes; what matters is releasing it promptly.
          await client.query('COMMIT');
        }
      } finally {
        client.release();
      }
    },
    // BEGIN/COMMIT/ROLLBACK sirf tab kaam karte hain jab teeno EK HI physical
    // connection par chalein — pool.query() har baar alag connection de sakta
    // hai. Isliye restore jaisa "sab kuch ek saath ya kuch nahi" kaam ek hi
    // client pakad kar karte hain.
    withClient: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await pgTxClient.run(client, () => fn(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    // Same one-client guarantee as withClient, but for transaction() below,
    // whose callers keep using the ambient query()/exec() helpers instead of
    // an explicit client argument.
    runInTransaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await pgTxClient.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

// --- PGlite (sirf local) ----------------------------------------------------

/**
 * Restore ka nishaan laga ho to boot par wahi backup chadha dete hain.
 *
 * Do kadam me isliye ki chalte hue database ko badalna khatarnak hai — aadha
 * purana, aadha naya reh sakta hai.
 */
async function applyPendingRestore(PGlite) {
  const { access, cp, readFile, rm, unlink } = await import('node:fs/promises');
  const { resolve } = await import('node:path');

  const pending = resolve(env.dataDir, '..', 'restore.pending');

  try {
    await access(pending);
  } catch (error) {
    return null; // koi restore pending nahi — sab normal
  }

  console.log('[db] Restore mila — backup chadha rahe hain');

  const file = await readFile(pending);
  const safety = `${env.dataDir}.before-restore`;

  // Purane data ka copy bacha lete hain — restore galat nikle to wapas laya
  // ja sake. Copy karte hain, rename nahi: Windows par folder rename aksar
  // EPERM de deta hai (antivirus ya koi khula handle), aur tab restore beech
  // me hi atak jata hai.
  await rm(safety, { recursive: true, force: true });
  try {
    await cp(env.dataDir, safety, { recursive: true });
    console.log(`[db] Purane data ka copy rakh diya: ${safety}`);
  } catch (error) {
    // Pehli baar chal raha ho to dataDir hai hi nahi — tab copy ki zarurat bhi
    // nahi. Koi aur wajah ho to aage badhna khatarnak hai.
    if (error.code !== 'ENOENT') {
      throw new Error(`Restore rok diya: purane data ka copy nahi ban paya (${error.code}). Data safe hai.`);
    }
  }

  // PGlite khali folder chahta hai, warna "already exists" bolta hai.
  await rm(env.dataDir, { recursive: true, force: true });

  const db = await PGlite.create({
    dataDir: env.dataDir,
    loadDataDir: new Blob([file], { type: 'application/gzip' }),
  });

  await unlink(pending);
  console.log('[db] Restore poora ho gaya');
  return db;
}

/**
 * Folder toot gaya — sabse naya backup khud chadha do.
 *
 * Yeh sabse zaroori suraksha hai. Backup har baar server chalu hone par banta
 * hai, isliye zyada se zyada utna hi kaam jaata hai jitna pichhli baar server
 * chalu hone ke baad kiya gaya tha.
 *
 * Toote hue folder ko mitate nahi — ".broken-<time>" naam se rakh dete hain,
 * taki zarurat pade to koi jaankaar usme se data nikaal sake.
 *
 * Lautata hai: khula hua database, ya null agar koi backup hi na mile.
 */
async function recoverFromNewestBackup(PGlite) {
  const { cp, readFile, rm } = await import('node:fs/promises');
  const { listBackups, backupPath } = await import('../services/backup.js');

  let newest = null;
  try {
    const all = await listBackups();
    newest = all[0] ?? null;
  } catch (error) {
    console.error(`[db] Backup folder padha nahi ja saka: ${error.message}`);
  }

  if (!newest) return null;

  const file = await readFile(await backupPath(newest.name));

  // Toote hue folder ko ek taraf rakhte hain. Copy karte hain, rename nahi —
  // Windows par rename aksar EPERM de deta hai.
  const broken = `${env.dataDir}.broken-${Date.now()}`;
  try {
    await cp(env.dataDir, broken, { recursive: true });
    console.error(`[db] Toota hua folder yahan rakh diya: ${broken}`);
  } catch (copyError) {
    console.error(`[db] Toote hue folder ka copy nahi ban paya (${copyError.code}) — aage badh rahe hain.`);
  }

  await rm(env.dataDir, { recursive: true, force: true });

  const db = await PGlite.create({
    dataDir: env.dataDir,
    loadDataDir: new Blob([file], { type: 'application/gzip' }),
  });

  console.error(`[db] APNE AAP THEEK KAR DIYA — backup "${newest.name}" chadha diya.`);
  console.error(`[db] Us backup ke BAAD ka kaam wapas nahi aayega. Backup ka time: ${newest.createdAt}`);
  console.error('[db] Aisa dobara na ho iske liye DATABASE_URL me asli Postgres lagao.\n');

  return db;
}

async function connectPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  let db = await applyPendingRestore(PGlite);

  if (!db) {
    try {
      db = await PGlite.create({ dataDir: env.dataDir });
    } catch (error) {
      // Achanak band hone par PGlite ka folder toot sakta hai (bijli gayi,
      // process kill ho gaya). Aisa hone par hum apne aap sabse naya backup
      // chadha dete hain — kisi ko kuch karna nahi padta.
      console.error('\n[db] Database folder khul nahi raha. Sabse aam wajah: server achanak band hua tha.');
      console.error(`[db] Folder: ${env.dataDir}`);

      db = await recoverFromNewestBackup(PGlite);

      if (!db) {
        console.error('[db] Koi backup bhi nahi mila. Kya karo:');
        console.error(`       ${env.dataDir} folder delete karke "npm run seed" chalao (sample data wapas aa jayega)`);
        console.error('[db] Aisa dobara na ho iske liye DATABASE_URL me asli Postgres lagao.\n');
        throw new Error('Database folder kharab hai aur koi backup nahi mila — upar likhe steps follow karo');
      }
    }
  }

  driver = 'pglite';
  console.log('[db] PGlite chalu (sirf local istemal ke liye)');
  console.warn('[db] CHETAVNI: client ke server par DATABASE_URL me asli Postgres lagana zaroori hai');

  return {
    query: (sql, params) => db.query(sql, params ?? []),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
    // Backup ke liye PGlite ka apna handle chahiye.
    raw: db,
  };
}

// --- sab ke liye ek jaisa interface -----------------------------------------

async function getConnection() {
  if (!instance) {
    instance = env.databaseUrl ? await connectPostgres() : await connectPglite();
  }
  return instance;
}

export async function getDb() {
  const conn = await getConnection();
  return conn;
}

/** Parameter wali query. SQL me kabhi value jodkar mat likhna. */
export async function query(sql, params = []) {
  const conn = await getConnection();
  return conn.query(sql, params);
}

/** Saari milne wali rows. */
export async function many(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

/** Pehli row, ya null. */
export async function one(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

/** Bina result wale statements (CREATE TABLE waghairah). */
export async function exec(sql) {
  const conn = await getConnection();
  return conn.exec(sql);
}

/**
 * Sab kuch hua ya kuch nahi — beech me adhoora nahi.
 *
 * On Postgres this pins one physical connection for fn()'s entire run (via
 * runInTransaction), so every query()/many()/one()/exec() call fn() makes —
 * directly or through nested helpers — lands in the same transaction. PGlite
 * has no pool to begin with, so plain BEGIN/COMMIT/ROLLBACK is already safe.
 */
export async function transaction(fn) {
  const conn = await getConnection();

  if (conn.runInTransaction) {
    return conn.runInTransaction(fn);
  }

  await conn.exec('BEGIN');
  try {
    const result = await fn();
    await conn.exec('COMMIT');
    return result;
  } catch (error) {
    await conn.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Runs fn() only if lockKey isn't already held elsewhere; returns
 * `{ acquired: false }` without calling fn() if it is. Unlike transaction(),
 * fn()'s own query()/many()/one() calls are NOT pinned to the lock's
 * connection — they run and commit normally through the pool, so anything
 * fn() writes is visible to other viewers immediately, not only once the
 * whole thing finishes. Only meaningful on Postgres; PGlite is always a
 * single process, so there's nothing to lock against and fn() just runs.
 */
export async function withAdvisoryLock(lockKey, fn) {
  const conn = await getConnection();
  if (!conn.withExclusiveLock) return { acquired: true, result: await fn() };
  return conn.withExclusiveLock(lockKey, fn);
}

/** "table" ya "column" naam SQL me surakshit tarike se likhne ke liye. */
function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Backup format ka version — badlein sirf jab tables/JSON ka dhaancha khud
 * badle. Restore karte waqt isse jaanch hoti hai ki yeh server is backup ko
 * samajh sakta hai ya nahi.
 */
export const BACKUP_FORMAT_VERSION = 1;

// Yeh do table "app ka data" nahi hain — backup system ki apni bookkeeping
// hain. Inhe backup ke andar rakhna ulta-seedha ho jata: restore karte hi
// backup ki apni history bhi purani ho jati, jabki asli files storage me
// jyon ki tyon padi rehti.
// webhook_deliveries bhi isi wajah se: purani, adhoori bhejne wali queue
// wapas aayi to purane events dobara (aur der se) client ko chale jate —
// ek queue restore karne layak cheez nahi hai, wo to bas "abhi kya bhejna
// hai" ki list hai.
const EXCLUDED_FROM_BACKUP = new Set(['backups', 'schema_migrations', 'webhook_deliveries']);

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Har table ka poora data uthata hai aur ek JSON me jod deta hai.
 *
 * pg_dump ki tarah SQL-level dump nahi hai — sirf data hai (koi CREATE TABLE
 * nahi), kyunki structure to migrate() khud, code se, har baar bana deta hai.
 * Restore karte waqt sirf DATA wapas bharna hai.
 *
 * Kaam kisi bhi standard Postgres par chalta hai — sirf information_schema
 * aur SELECT * istemal karte hain, koi Neon/Render-khaas cheez nahi.
 */
async function dumpPostgres() {
  const conn = await getConnection();

  const { rows: tableRows } = await conn.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );

  const tables = {};
  let rowCount = 0;
  for (const { table_name: name } of tableRows) {
    if (EXCLUDED_FROM_BACKUP.has(name)) continue;
    const { rows } = await conn.query(`SELECT * FROM ${quoteIdent(name)}`);
    tables[name] = rows;
    rowCount += rows.length;
  }

  const checksum = `sha256:${sha256(JSON.stringify(tables))}`;

  const payload = JSON.stringify({
    formatVersion: BACKUP_FORMAT_VERSION,
    driver: 'postgres',
    createdAt: new Date().toISOString(),
    counts: { tables: Object.keys(tables).length, rows: rowCount },
    checksum,
    tables,
  });

  const buffer = await gzip(Buffer.from(payload, 'utf8'));
  return {
    buffer,
    meta: {
      formatVersion: BACKUP_FORMAT_VERSION,
      tableCount: Object.keys(tables).length,
      rowCount,
      checksum,
    },
  };
}

/**
 * Backup banata hai — {buffer, meta} lautata hai dono driver ke liye, taki
 * bulane wale ko andar ka farak jaanne ki zarurat na pade.
 */
export async function dumpDatabase() {
  if (driver === 'pglite') {
    const conn = await getConnection();
    const blob = await conn.raw.dumpDataDir('gzip');
    const buffer = Buffer.from(await blob.arrayBuffer());
    return {
      buffer,
      // PGlite ka dump poore folder ka snapshot hai, table-by-table JSON
      // nahi — isliye table/row ginti yahan maloom nahi, checksum phir bhi
      // kaam ki hai (file kharab hui ya nahi, yeh bata degi).
      meta: { formatVersion: null, tableCount: null, rowCount: null, checksum: `sha256:${sha256(buffer)}` },
    };
  }
  return dumpPostgres();
}

/**
 * Backup file khol kar jaanchta hai — kharab, adhoori ya na-samajh-aane
 * wali file ko restore shuru hone se PEHLE hi rok deta hai.
 */
export async function readAndValidateBackup(buffer) {
  let payload;
  try {
    const json = await gunzip(buffer);
    payload = JSON.parse(json.toString('utf8'));
  } catch (error) {
    throw new Error('Yeh backup file padhi nahi ja saki — kharab ya galat file lagti hai.');
  }

  if (!payload?.tables || typeof payload.tables !== 'object' || Array.isArray(payload.tables)) {
    throw new Error('Yeh backup file sahi format me nahi hai.');
  }

  if (typeof payload.formatVersion !== 'number' || payload.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Yeh backup ek naye format (v${payload.formatVersion}) ki hai jo yeh server (v${BACKUP_FORMAT_VERSION}) nahi samajhta.`
    );
  }

  if (payload.checksum) {
    const actual = `sha256:${sha256(JSON.stringify(payload.tables))}`;
    if (actual !== payload.checksum) {
      throw new Error('Yeh backup file kharab (corrupt) hai — checksum match nahi hua.');
    }
  }

  return payload;
}

/**
 * Tables ko us order me sajata hai jisme "parent" hamesha apne "child" se
 * pehle aaye — taki data bharte waqt kisi FK ki galti na aaye.
 *
 * information_schema se dekhta hai kaunsi table kisko reference karti hai
 * (yeh bhi har Postgres par ek jaisa chalta hai, kisi provider ki khaas
 * cheez nahi). Agar kahin chakkar (cycle) mil jaye — is app ke schema me
 * abhi nahi hai, par future-proof rehne ke liye — bache hue tables ko bas
 * kisi bhi order me daal deta hai, crash nahi karta.
 */
async function topologicalTableOrder(client, tableNames) {
  const { rows } = await client.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.constraint_schema = ccu.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);

  const tableSet = new Set(tableNames);
  const dependsOn = new Map(tableNames.map((t) => [t, new Set()]));
  for (const { child, parent } of rows) {
    // Apne aap par nirbhar (self-reference) order ke liye maayne nahi rakhta.
    if (child === parent || !tableSet.has(child) || !tableSet.has(parent)) continue;
    dependsOn.get(child).add(parent);
  }

  const ordered = [];
  const orderedSet = new Set();
  const remaining = new Set(tableNames);

  while (remaining.size > 0) {
    let progressed = false;
    for (const table of remaining) {
      const deps = dependsOn.get(table);
      const ready = [...deps].every((dep) => orderedSet.has(dep) || !remaining.has(dep));
      if (ready) {
        ordered.push(table);
        orderedSet.add(table);
        remaining.delete(table);
        progressed = true;
      }
    }
    if (!progressed) {
      ordered.push(...remaining);
      break;
    }
  }

  return ordered;
}

/**
 * Backup file se poora database wapas bhar deta hai — ASLI POSTGRES ke liye.
 * (PGlite ka restore alag hai: dekho db/client.js ka connectPglite/
 * applyPendingRestore — wahan chalte hue database ko badalna surakshit nahi,
 * isliye woh "nishaan lagao + restart karo" tarike se hota hai. Asli Postgres
 * par aisi koi rok nahi — isliye yahan turant, ek hi transaction me hota hai.)
 *
 * Kadam:
 *   1. File khol kar jaanch lo — sahi shape, jaana-pehchana version, checksum
 *      theek
 *   2. Saari tables ek saath TRUNCATE ... CASCADE — foreign key ke hisaab se
 *      order dhoondhne ki zarurat nahi, CASCADE khud sambhal leta hai
 *   3. Har table ke FK trigger thodi der ke liye band — warna purani (backup
 *      wali) rows ko dobara daalte waqt "abhi tak parent nahi mila" wali
 *      galti aa sakti hai, sirf isliye ki hum kis order me table bhar rahe
 *      hain
 *   4. Data wapas bharo, phir trigger chalu karo
 *   5. Jin columns ka apna counter hai (bigserial, jaise tracking_events.id),
 *      unka counter naye max ID ke hisaab se aage badha do — warna agli baar
 *      koi naya row banega to purane, restore kiye hue ID se takra sakta hai
 *   6. Har table ginkar jaanch lo ki jitni rows backup me thin utni hi ab
 *      maujood hain
 *
 * Sab kuch ek hi transaction me, ek hi dedicated connection par — beech me
 * kuch fail ho to poora wapas, aadha naya-aadha purana database kabhi nahi
 * banta.
 */
export async function restoreDatabase(buffer) {
  if (driver !== 'postgres') {
    throw new Error('Yeh turant wala restore sirf asli Postgres ke liye hai.');
  }

  const payload = await readAndValidateBackup(buffer);
  const conn = await getConnection();

  // Sirf wahi table bharo jo ABHI is database me bhi maujood hai — purani
  // backup me koi aisi table ho sakti hai jo ab hata di gayi ho.
  const { rows: existingRows } = await conn.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const existingTables = new Set(existingRows.map((r) => r.table_name));
  const tableNames = Object.keys(payload.tables).filter(
    (name) => !EXCLUDED_FROM_BACKUP.has(name) && existingTables.has(name)
  );

  if (tableNames.length === 0) {
    throw new Error('Is backup me koi maujooda table nahi mili.');
  }

  return conn.withClient(async (client) => {
    const identList = tableNames.map(quoteIdent).join(', ');

    await client.query(`TRUNCATE TABLE ${identList} RESTART IDENTITY CASCADE`);

    // Pehle socha tha ki FK trigger thodi der band kar denge (DISABLE TRIGGER
    // ALL), taki table kis order me bhari jaye iski fikar na karni pade. Test
    // karne par pata chala: yeh un "system" trigger ko bhi band karne ki
    // koshish karta hai jo FK khud lagata hai, aur unhe band karna sirf
    // superuser kar sakta hai — Neon (aur zyadatar hosted Postgres) apne app
    // wale role ko itni ijaazat nahi deta. Isliye asli tarika: pehle woh
    // table bharo jinhe koi aur reference nahi karta, phir unko jo unhi par
    // nirbhar hain — matlab "parent" table hamesha apne "child" se pehle.
    const orderedTables = await topologicalTableOrder(client, tableNames);

    let totalRows = 0;
    for (const name of orderedTables) {
      const rows = payload.tables[name];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const columnList = columns.map(quoteIdent).join(', ');

      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        const placeholders = columns.map((c, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${quoteIdent(name)} (${columnList}) VALUES (${placeholders})`,
          values
        );
        totalRows += 1;
      }
    }

    // bigserial/serial jaisi columns ka counter aage badhao, warna agla naya
    // row purane restore kiye hue ID se takra sakta hai.
    const { rows: serialColumns } = await client.query(`
      SELECT table_name, column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_default LIKE 'nextval(%'
    `);
    for (const { table_name: table, column_name: column } of serialColumns) {
      if (!tableNames.includes(table)) continue;
      // pg_get_serial_sequence() naam text ke roop me maangta hai (identifier
      // nahi) — isliye yeh do bind parameter se, baaki jagah quoteIdent() se.
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence($1, $2),
           COALESCE((SELECT MAX(${quoteIdent(column)}) FROM ${quoteIdent(table)}), 1),
           (SELECT MAX(${quoteIdent(column)}) FROM ${quoteIdent(table)}) IS NOT NULL
         )`,
        [table, column]
      );
    }

    // Jaanch: jitni rows backup me thin, utni hi ab is table me hain. Ek bhi
    // farak matlab kuch adhoora reh gaya — poori transaction wapas (rollback).
    for (const name of tableNames) {
      const expected = (payload.tables[name] ?? []).length;
      const { rows: countRows } = await client.query(`SELECT count(*)::int AS n FROM ${quoteIdent(name)}`);
      const actual = countRows[0]?.n ?? 0;
      if (actual !== expected) {
        throw new Error(
          `Restore ke baad jaanch fail hui: "${name}" me ${expected} rows honi chahiye thin, ${actual} mili.`
        );
      }
    }

    return { tables: tableNames.length, rows: totalRows };
  });
}

export async function closeDb() {
  if (instance) {
    await instance.close();
    instance = null;
    driver = null;
  }
}

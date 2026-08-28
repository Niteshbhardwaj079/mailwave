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
import { env } from '../env.js';

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
    query: (sql, params) => pool.query(sql, params),
    exec: async (sql) => {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
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

async function connectPglite() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { rm } = await import('node:fs/promises');
  const { resolve } = await import('node:path');

  let db = await applyPendingRestore(PGlite);

  if (!db) {
    try {
      db = await PGlite.create({ dataDir: env.dataDir });
    } catch (error) {
      // Achanak band hone par PGlite ka folder toot sakta hai. Yahan saaf-saaf
      // batate hain ki kya hua aur kya karna hai — chup-chap crash nahi.
      console.error('\n[db] Database folder khul nahi raha. Sabse aam wajah: server achanak band hua tha.');
      console.error(`[db] Folder: ${env.dataDir}`);
      console.error('[db] Kya karo:');
      console.error('       1. server/data/backups me se koi backup restore karo, YA');
      console.error(`       2. ${env.dataDir} folder delete karke "npm run seed" chalao (sample data wapas aa jayega)`);
      console.error('[db] Aisa dobara na ho iske liye DATABASE_URL me asli Postgres lagao.\n');

      // Toota hua folder ek taraf rakh dete hain — mitate nahi. Ho sakta hai
      // koi expert usme se data nikaal le.
      const broken = `${env.dataDir}.broken-${Date.now()}`;
      try {
        const { rename } = await import('node:fs/promises');
        await rename(env.dataDir, broken);
        console.error(`[db] Toota hua folder yahan rakh diya: ${broken}\n`);
      } catch (renameError) {
        await rm(resolve(env.dataDir, 'postmaster.pid'), { force: true });
      }

      throw new Error('Database folder kharab hai — upar likhe steps follow karo');
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

/** Sab kuch hua ya kuch nahi — beech me adhoora nahi. */
export async function transaction(fn) {
  const conn = await getConnection();
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

/** PGlite ka backup. Asli Postgres par pg_dump use hota hai. */
export async function dumpDatabase() {
  if (driver !== 'pglite') {
    throw new Error(
      'Asli Postgres ka backup pg_dump se lena hota hai. Hosting provider ka automatic backup bhi chalu rakho.'
    );
  }
  const conn = await getConnection();
  return conn.raw.dumpDataDir('gzip');
}

export async function closeDb() {
  if (instance) {
    await instance.close();
    instance = null;
    driver = null;
  }
}

import { PGlite } from '@electric-sql/pglite';

import { env } from '../env.js';

/**
 * One database handle for the process.
 *
 * PGlite is real Postgres compiled to WebAssembly: no server to install, and
 * the SQL is the same SQL a hosted Postgres runs. Swapping to `pg` later means
 * replacing this file, nothing else — every caller only uses query/one/many.
 */
let instance = null;

export async function getDb() {
  if (!instance) {
    instance = await PGlite.create({ dataDir: env.dataDir });
  }
  return instance;
}

/** Runs a parameterised statement. Never build SQL by string concatenation. */
export async function query(sql, params = []) {
  const db = await getDb();
  return db.query(sql, params);
}

/** Every matching row. */
export async function many(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

/** The first row, or null. */
export async function one(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

/** Statements with no result set (DDL, multi-statement scripts). */
export async function exec(sql) {
  const db = await getDb();
  return db.exec(sql);
}

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * PGlite is single-connection, so this is a plain BEGIN/COMMIT rather than a
 * pooled client — which is exactly what we want: no nested transactions.
 */
export async function transaction(fn) {
  const db = await getDb();
  await db.exec('BEGIN');
  try {
    const result = await fn();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

export async function closeDb() {
  if (instance) {
    await instance.close();
    instance = null;
  }
}

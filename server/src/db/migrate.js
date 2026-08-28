import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { closeDb, exec, one } from './client.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The schema is written so every statement is IF NOT EXISTS — running this
 * twice is a no-op, which makes it safe to call on every boot.
 */
export async function migrate() {
  const sql = readFileSync(resolve(here, 'schema.sql'), 'utf8');
  await exec(sql);

  const applied = await one('SELECT version FROM schema_migrations WHERE version = 1');
  if (!applied) {
    await exec('INSERT INTO schema_migrations (version) VALUES (1)');
  }

  return true;
}

// Also runnable on its own: npm run migrate.
// pathToFileURL rather than string-building, so Windows backslashes and spaces
// in the path (this project lives in one) compare correctly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate()
    .then(() => {
      console.log('Schema is up to date.');
      return closeDb();
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

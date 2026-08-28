import { createApp } from './app.js';
import { env } from './env.js';
import { migrate } from './db/migrate.js';
import { closeDb } from './db/client.js';

const app = createApp();

// The schema is applied on every boot. It is idempotent, so a fresh checkout
// and an existing database take exactly the same path.
await migrate();

const server = app.listen(env.port, () => {
  console.log(`MailWave API listening on http://localhost:${env.port}`);
  console.log(`  data directory : ${env.dataDir}`);
  console.log(`  allowed origins: ${env.corsOrigins.join(', ')}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

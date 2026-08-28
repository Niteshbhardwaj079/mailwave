import { createApp } from './app.js';
import { env } from './env.js';
import { migrate } from './db/migrate.js';
import { closeDb, currentDriver } from './db/client.js';
import { startBackupSchedule } from './services/backup.js';

const app = createApp();

// Schema har boot par lagta hai. Idempotent hai, isliye naya aur purana
// database dono ek hi raste se guzarte hain.
await migrate();

// Har baar chalu hone par ek backup — data bachane ka sabse bada bharosa.
startBackupSchedule();

const server = app.listen(env.port, () => {
  console.log(`MailWave API listening on http://localhost:${env.port}`);
  console.log(`  database       : ${currentDriver()}`);
  console.log(`  data directory : ${env.dataDir}`);
  console.log(`  allowed origins: ${env.corsOrigins.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Theek se band hona — sabse zaroori hissa.
//
// PGlite ka data folder tabhi surakshit rehta hai jab database ko theek se band
// kiya jaye. Isliye har us tarike ko pakadte hain jisse process band ho sakta
// hai — Ctrl+C, window ka cross, Ctrl+Break, ya koi anjaan error.
//
// Windows par window ka cross dabane se SIGHUP aata hai, aur Ctrl+Break se
// SIGBREAK — dono ko pakadna zaroori hai, warna data toot sakta hai.
// ---------------------------------------------------------------------------
let shuttingDown = false;

async function shutdown(reason, exitCode = 0) {
  // Do signal ek saath aa sakte hain; dobara band karne ki koshish nahi karni.
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[server] Band ho raha hai (${reason})...`);

  // Naye requests lena band, phir database theek se band.
  server.close();

  try {
    await closeDb();
    console.log('[server] Database theek se band ho gaya. Data surakshit hai.');
  } catch (error) {
    console.error('[server] Database band karte waqt dikkat:', error);
  }

  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => shutdown(signal));
}

// Koi anjaan error aaye to bhi database theek se band karke jaayen — chup-chap
// mar jaana sabse khatarnak hai, wahi folder todta hai.
process.on('uncaughtException', (error) => {
  console.error('[server] Anjaan error:', error);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] Anjaan rejection:', reason);
  shutdown('unhandledRejection', 1);
});

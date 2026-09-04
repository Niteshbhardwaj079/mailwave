import net from 'node:net';

import './log.js';
import { createApp } from './app.js';
import { env } from './env.js';
import { migrate } from './db/migrate.js';
import { closeDb, currentDriver } from './db/client.js';
import { startBackupSchedule } from './services/backup.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

/**
 * Server chalu karne se PEHLE dekh lete hain ki port khali hai ya nahi.
 *
 * Yeh sirf ek achhi error message ki baat nahi hai. Agar do copies ek saath
 * chal jayein, to dono ek hi data folder kholti hain — aur PGlite ka folder
 * isi tarah tootta hai. Isliye doosri copy ko database chhune se pehle hi rok
 * dete hain.
 */
function ensurePortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} par pehle se kuch chal raha hai — shayad ${env.brand.name} ki ek aur copy already khuli hai.
` +
              `Us window ko band karo, ya .env me PORT=4001 karke dobara chalao.`
          )
        );
        return;
      }
      reject(error);
    });

    probe.once('listening', () => probe.close(() => resolve()));
    probe.listen(port);
  });
}

try {
  await ensurePortFree(env.port);
} catch (error) {
  // Database abhi khula hi nahi hai, isliye seedha nikal jaana surakshit hai.
  console.error(`
[server] ${error.message}
`);
  process.exit(1);
}

const app = createApp();

// Schema har boot par lagta hai. Idempotent hai, isliye naya aur purana
// database dono ek hi raste se guzarte hain.
await migrate();

// Har baar chalu hone par ek backup — data bachane ka sabse bada bharosa.
startBackupSchedule();

// Jin campaigns ka time aa chuka hai unhe chalu karta hai. Server band raha ho
// to bhi kuch nahi bigadta — chalu hote hi wo campaign turant chali jati hai.
startScheduler();

const server = app.listen(env.port, () => {
  console.log(`${env.brand.name} API listening on http://localhost:${env.port}`);
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
  stopScheduler();

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

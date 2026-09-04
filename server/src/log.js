// Server ka poora console output ek file me bhi likh dete hain
// (%TEMP%\mw-server.log, ya MW_SERVER_LOG se apna rasta do).
//
// Kyun: password reset jaisa link jab email nahi ja pata to console par chhapta
// hai (routes/auth.js dekho). Do windows me bat kar chalane par woh sirf us
// window me dikhta hai — kahin save nahi hota. Test suite (test-reset.mjs,
// test-template-image.mjs) aur support ke liye use file me bhi rakhna zaroori
// hai, taaki server kaise bhi chalu kiya gaya ho, log hamesha usi jagah mile.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import util from 'node:util';

const logPath = process.env.MW_SERVER_LOG || path.join(os.tmpdir(), 'mw-server.log');
const stream = fs.createWriteStream(logPath, { flags: 'a' });

for (const method of ['log', 'warn', 'error', 'info']) {
  const original = console[method].bind(console);
  console[method] = (...args) => {
    original(...args);
    stream.write(`${util.format(...args)}\n`);
  };
}

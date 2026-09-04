// Password reset ka poora raasta — email ke link se lekar naye password se
// login tak.
//
// Yeh sabse zyada istemal hone wala raasta hai: log password bhoolte hi
// rehte hain. Agar yeh na chale to wo hamesha ke liye bahar ho jate hain.
import { chromium } from 'playwright';

const API = 'http://localhost:4000';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

async function findApp() {
  for (const port of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* yeh port band hai */
    }
  }
  console.error('Website kahin nahi mili. Pehle "npm run dev" chalao.');
  process.exit(1);
}

const BASE = await findApp();
let token = null;

async function apiCall(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Origin: BASE,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

const login = await apiCall('POST', '/api/auth/login', {
  email: 'rohit@gowebkart.com',
  password: 'mailwave',
});
token = login.data?.accessToken;
check('login', login.status === 200);

// --- ek test user banate hain, taki asli account ko haath na lage ----------
const stamp = Date.now();
const email = `reset.${stamp}@example.com`;

const made = await apiCall('POST', '/api/users', {
  name: 'Reset Test',
  email,
  role: 'member',
  status: 'Invited',
});
check('test user bana', made.status === 201, made.data?.error?.message);
const userId = made.data?.user?.id;

// Uska password set karte hain, taki reset se pehle wala password pata ho.
await apiCall('POST', `/api/users/${userId}/password`, { password: 'PuranaPass123', notify: false });

const beforeLogin = await apiCall('POST', '/api/auth/login', { email, password: 'PuranaPass123' });
check('purane password se login ho raha hai', beforeLogin.status === 200);

// --- "password bhool gaya" — link server ke console par chhapta hai --------
// Test me hum seedha reset ka token banwa lete hain, bilkul waise hi jaise
// forgot-password banata hai.
await apiCall('POST', '/api/auth/forgot-password', { email });

// Token ke liye server ka log padhna padta, isliye admin wale raaste se ek
// naya link banwate hain — dono ek hi tarah ka token dete hain.
const linkRes = await apiCall('POST', `/api/users/${userId}/reset-link`);
check('reset link ban gaya', linkRes.status === 200);

/**
 * Token wahin se nikalte hain jahan se ek asli user nikalega — EMAIL se.
 *
 * Do haalat ho sakti hain:
 *   - Email account juda hai -> email jata hai. Test transport (ethereal) par
 *     uska preview link server ke log me chhapta hai; wahi email khol kar
 *     usme se link nikalte hain.
 *   - Koi account juda nahi  -> app link seedha console par chhap deta hai.
 *
 * Dono jagah dekh lete hain.
 */
const fsp = await import('node:fs/promises');
const os = await import('node:os');
const path = await import('node:path');

let resetToken = null;
let log = '';

// Server ka log kahan hai. Git Bash ka "/tmp" aur Node ka "/tmp" alag jagah
// hote hain (Node ise C:\tmp samajhta hai), isliye dono jagah dekhte hain.
const LOG_PATHS = [
  process.env.MW_SERVER_LOG,
  path.join(os.tmpdir(), 'mw-server.log'),
  '/tmp/mw-server.log',
].filter(Boolean);

for (const file of LOG_PATHS) {
  try {
    log = await fsp.readFile(file, 'utf8');
    break;
  } catch {
    /* agli jagah dekho */
  }
}

// 1. Console wala raasta (jab koi email account juda na ho)
resetToken = [...log.matchAll(/reset-password\?token=([A-Za-z0-9_-]+)/g)].at(-1)?.[1] ?? null;

// 2. Warna asli email khol kar usme se.
//
// Ethereal ka dikhne wala page sirf ek wrapper hai; email ka asli matter
// "/source" par milta hai. Wo "quoted-printable" me hota hai — lambi line
// beech me "=" laga kar todi jati hai, aur khaas akshar "=3D" jaise likhe
// jate hain. Isliye pehle use saaf karna padta hai.
if (!resetToken) {
  const url = [...log.matchAll(/https:\/\/ethereal\.email\/message\/[A-Za-z0-9_.-]+/g)].at(-1)?.[0];

  if (url) {
    // ".eml" asli email hai — waisa hi jaisa mail app ko milta hai.
    const raw = await (await fetch(`${url}/message.eml`)).text();

    const clean = raw
      .replace(/<\/?span[^>]*>/g, '') // ethereal lambi line ko span me todta hai
      .replace(/=\r?\n/g, '') // quoted-printable ki tooti hui line jodo
      .replace(/=([0-9A-Fa-f]{2})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));

    // Invite aur reset — dono ka link is email me kaam karta hai.
    resetToken = clean.match(/(?:reset-password|set-password)\?token=([A-Za-z0-9_-]+)/)?.[1] ?? null;
  }
}

check('email/console se link mil gaya', Boolean(resetToken), resetToken ? 'mila' : 'log me nahi mila');

if (resetToken) {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await (await browser.newContext()).newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/reset-password?token=${resetToken}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  let body = await page.locator('body').innerText();
  check('reset page khula', !body.includes('stopped working'));

  // Chhota password ruke
  await page.fill('#new-password, input[type="password"]', 'chota');
  const confirmBox = page.locator('input[type="password"]').nth(1);
  if (await confirmBox.count()) await confirmBox.fill('chota');
  await page.getByRole('button', { name: /save|set password/i }).first().click();
  await page.waitForTimeout(800);

  body = await page.locator('body').innerText();
  check('chhota password ruka', /8|short|chhota/i.test(body));

  // Ab sahi password
  const boxes = page.locator('input[type="password"]');
  await boxes.nth(0).fill('NayaPass456');
  if ((await boxes.count()) > 1) await boxes.nth(1).fill('NayaPass456');

  await page.getByRole('button', { name: /save|set password/i }).first().click();
  await page.waitForTimeout(3000);

  body = await page.locator('body').innerText();
  check('screen par "ho gaya" dikha', /done|sign in|ho gaya|success/i.test(body),
    body.split('\n').slice(0, 3).join(' | ').slice(0, 80));

  check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();

  // --- sabse zaroori: password SACH ME badla ya nahi ---------------------
  const oldStill = await apiCall('POST', '/api/auth/login', { email, password: 'PuranaPass123' });
  check('purana password ab nahi chalta', oldStill.status === 401, `${oldStill.status}`);

  const newWorks = await apiCall('POST', '/api/auth/login', { email, password: 'NayaPass456' });
  check('NAYA password chal gaya', newWorks.status === 200, `${newWorks.status}`);

  // Wahi link dobara nahi chalna chahiye.
  const reuse = await apiCall('POST', '/api/auth/reset-password', {
    token: resetToken,
    password: 'KuchAur789',
  });
  check('wahi link dobara nahi chala', reuse.status === 400, `${reuse.status}`);
}

// --- safai ------------------------------------------------------------------
if (userId) {
  const del = await apiCall('DELETE', `/api/users/${userId}`);
  check('test user hat gaya', del.status === 200, `${del.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

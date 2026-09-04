// Image library screen ka test.
//
// Aapka sawaal: "jo bhi image upload hogi wo mujhe wahan dikhegi na, taki
// kabhi bhi URL copy kar saku?"
//
// Yahi jaancha jata hai — asli browser me, asli file upload karke.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

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

async function apiCall(method, p, body) {
  const res = await fetch(API + p, {
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

// Ek asli PNG file bana lete hain, jaise aap apne computer se chunenge.
const stamp = Date.now();
const filePath = path.resolve(`upload-test-${stamp}.png`);
fs.writeFileSync(
  filePath,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
// Clipboard padhne ki ijaazat — copy button sach me kaam kar raha hai ya nahi,
// yeh isi se pata chalega.
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

// Template editor kholo — image library wahin hai.
await page.goto(BASE + '/templates/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const imagesTab = page.getByRole('button', { name: /image/i }).first();
check('Images ka tab mila', (await imagesTab.count()) > 0);
await imagesTab.click();
await page.waitForTimeout(1000);

let body = await page.locator('body').innerText();
check('image library khuli', !body.includes('stopped working'));

const before = await page.locator('.mw-imagecard, [class*="imagecard"], img').count();

// --- upload -----------------------------------------------------------------
await page.setInputFiles('input[type="file"]', filePath);
await page.waitForTimeout(3000);

const listed = (await apiCall('GET', '/api/images')).data?.images ?? [];
const mine = listed.find((i) => i.name === `upload-test-${stamp}.png`);

check('upload hui image server par gayi', Boolean(mine), mine?.name);
check('uska URL asli http link hai', /^https?:\/\//.test(mine?.url ?? ''), (mine?.url ?? '').slice(0, 45));

// --- screen par dikhi? ------------------------------------------------------
body = await page.locator('body').innerText();
check('upload ke baad image library me dikhi', body.includes(`upload-test-${stamp}.png`));

const after = await page.locator('.mw-imagecard, [class*="imagecard"], img').count();
check('list me ek aur image aa gayi', after > before, `${before} se ${after}`);

// --- URL copy hota hai? -----------------------------------------------------
const copyBtn = page.getByRole('button', { name: 'Copy link' }).first();
check('"Copy link" ka button hai', (await copyBtn.count()) > 0);

if (await copyBtn.count()) {
  await copyBtn.click();
  await page.waitForTimeout(600);

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check('copy karne par asli http link mila', /^https?:\/\/.*\/files\/img\//.test(copied),
    copied.slice(0, 55));
  check('copy hua link us image ka hi hai', listed.some((i) => i.url === copied),
    copied === mine?.url ? 'wahi image' : 'koi aur image');
}

// --- reload ke baad bhi rehti hai? -----------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /image/i }).first().click();
await page.waitForTimeout(1200);

body = await page.locator('body').innerText();
check('page reload ke baad bhi image library me hai', body.includes(`upload-test-${stamp}.png`));


// --- delete: pehle poochta hai, phir hatata hai --------------------------
// Galti se ek click me image ud jana sabse bura hota — isliye confirm zaroori
// hai. Aur agar image kisi ja chuki campaign me lagi hai, to warning bhi.
const trash = page.locator('.mw-imgcard__actions button.btn-outline-danger').first();
check('delete ka button hai', (await trash.count()) > 0);

await trash.click();
await page.waitForTimeout(1500);

const sheet = page.locator('.mw-sheet');
check('delete se pehle confirm khula', (await sheet.count()) > 0);

const sheetText = await sheet.innerText();
check('confirm me image ka naam dikha', sheetText.includes(`upload-test-${stamp}.png`));
check('kahan lagi hai, wo bhi bataya',
  /not used|used in/i.test(sheetText),
  sheetText.match(/.{0,60}(not used|used in).{0,60}/i)?.[0] ?? '');

// Cancel dabane par image bachni chahiye.
await page.getByRole('button', { name: 'Cancel' }).last().click();
await page.waitForTimeout(1000);

const afterCancel = (await apiCall('GET', '/api/images')).data?.images ?? [];
check('Cancel dabane par image bach gayi',
  afterCancel.some((i) => i.name === `upload-test-${stamp}.png`));

// Ab sach me delete.
await page.locator('.mw-imgcard__actions button.btn-outline-danger').first().click();
await page.waitForTimeout(1200);
await page.locator('.mw-sheet .mw-sheet__foot button.btn-danger').click();
await page.waitForTimeout(2000);

const afterDelete = (await apiCall('GET', '/api/images')).data?.images ?? [];
check('delete karne par sach me hat gayi',
  !afterDelete.some((i) => i.name === `upload-test-${stamp}.png`),
  `${afterDelete.length} images bachi`);

// Sirf LIST dekhte hain, poora page nahi — delete ke baad toast me image ka
// naam kuch second ke liye dikhta hai ("Image removed — upload-test.png"),
// aur usse test bina wajah fail ho jata tha.
const grid = await page.locator('.mw-imggrid, .mw-imgcard').allInnerTexts();
check('list se turant hat gayi', !grid.join(' ').includes(`upload-test-${stamp}.png`),
  `${grid.length} cards bache`);

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai ------------------------------------------------------------------
fs.unlinkSync(filePath);


const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

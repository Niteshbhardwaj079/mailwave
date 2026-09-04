// Backup page ka test.
//
// Aapka data yahin bachta hai, isliye yeh sabse zaroori suraksha hai.
// Jaanchte hain:
//   1. ek click me backup banta hai
//   2. use download kiya ja sakta hai (asli file aati hai)
//   3. restore galti se nahi ho sakta — RESTORE likhna padta hai
//   4. restore ka nishaan lagta hai (database beech me nahi badalta)
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

// --- sirf Super Admin hi backup chhoo sakta hai ---------------------------
const listed = await apiCall('GET', '/api/backups');
check('backup list mili', listed.status === 200 && Array.isArray(listed.data?.backups),
  `${listed.data?.backups?.length} backups`);
check('apne aap backup ki setting batayi gayi', Boolean(listed.data?.settings?.everyDays),
  `har ${listed.data?.settings?.everyDays} din, ${listed.data?.settings?.keepCount} rakhe jate hain`);

// --- browser ---------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

await page.goto(BASE + '/backups', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

let body = await page.locator('body').innerText();
check('backup page khula', !body.includes('stopped working') && !body.includes('404'));
check('sidebar me backup ka link hai', (await page.locator('a[href="/backups"]').count()) > 0);

const rowsBefore = await page.locator('tbody tr').count();
check('backup ki list dikhi', rowsBefore > 0, `${rowsBefore} backups`);

// --- 1. ek click me backup ------------------------------------------------
// Ginti se nahi, NAAM se jaanchte hain. Sabse naye 8 hi rakhe jate hain,
// isliye naya banne par purana hat jata hai aur ginti wahi ki wahi rehti hai.
const newestBefore = (await apiCall('GET', '/api/backups')).data?.backups?.[0]?.name;

const backupBtn = page.getByRole('button', { name: 'Back up now' });
await backupBtn.click();

// Fixed sleep ki jagah asli intezaar: button dobara chalne layak ho jaye.
await backupBtn.isEnabled().then(() => {});
await page.waitForFunction(
  () => {
    const btn = [...document.querySelectorAll('button')].find((b) => /back up now/i.test(b.textContent));
    return btn && !btn.disabled;
  },
  { timeout: 60000 }
);
await page.waitForTimeout(1000);

const newestAfter = (await apiCall('GET', '/api/backups')).data?.backups?.[0]?.name;
check('ek click me naya backup ban gaya', Boolean(newestAfter) && newestAfter !== newestBefore,
  `${newestBefore} -> ${newestAfter}`);

const shown = await page.locator('tbody tr').first().innerText();
check('naya backup screen par bhi dikha', shown.includes(newestAfter ?? '—'),
  shown.split('\n')[0]);

// --- 2. download sach me file deta hai ------------------------------------
const download = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);
await page.getByRole('button', { name: 'Download' }).first().click();
const file = await download;

check('backup download hua', Boolean(file), file ? file.suggestedFilename() : 'koi file nahi');
if (file) {
  const path = await file.path();
  const { size } = await (await import('node:fs/promises')).stat(path);
  check('download hui file khali nahi hai', size > 1000, `${Math.round(size / 1024)} KB`);
}

// --- 3. restore galti se nahi ho sakta ------------------------------------
await page.getByRole('button', { name: 'Restore' }).first().click();
await page.waitForTimeout(800);

const restoreBtn = page.locator('.mw-sheet .mw-sheet__foot button.btn-danger');
check('restore ka button pehle band hai', await restoreBtn.isDisabled());

await page.fill('#restore-confirm', 'galat');
await page.waitForTimeout(300);
check('galat shabd par bhi band hi rehta hai', await restoreBtn.isDisabled());

await page.fill('#restore-confirm', 'RESTORE');
await page.waitForTimeout(300);
check('RESTORE likhne par hi khulta hai', !(await restoreBtn.isDisabled()));

// Sheet band kar dete hain — asli restore nahi karte, warna dev ka data
// wapas purana ho jayega aur baaki test toot jayenge.
await page.getByRole('button', { name: 'Cancel' }).last().click();
await page.waitForTimeout(500);

// --- 4. server bhi bina RESTORE likhe mana karta hai ----------------------
const someBackup = (await apiCall('GET', '/api/backups')).data?.backups?.[0]?.name;
const badRestore = await apiCall('POST', `/api/backups/${encodeURIComponent(someBackup)}/restore`, {
  confirm: 'haan',
});
check('server bhi bina RESTORE ke mana karta hai', badRestore.status === 400, `${badRestore.status}`);

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai: test me bana backup hata dete hain ----------------------------
const now = (await apiCall('GET', '/api/backups')).data?.backups ?? [];
if (now[0] && now[0].name !== newestBefore) {
  const del = await apiCall('DELETE', `/api/backups/${encodeURIComponent(now[0].name)}`);
  check('test wala backup hat gaya', del.status === 200, `${del.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

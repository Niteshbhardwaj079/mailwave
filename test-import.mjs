// Contacts import ka test — asli file ke saath.
//
// Yeh wo hissa hai jiski aapko sabse zyada zarurat hai: duplicate pakde jate
// hain ya nahi. Teen tarah ke duplicate hote hain aur teenon alag-alag ginne
// chahiye:
//   1. jo email pehle se contacts me hai
//   2. jo email isi file me do baar aa gaya
//   3. jo pehle unsubscribe ya bounce ho chuka hai
import fs from 'node:fs';
import path from 'node:path';
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

async function apiCall(method, apiPath, body) {
  const res = await fetch(API + apiPath, {
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

// --- ek aisi file banate hain jisme har tarah ki dikkat ho -----------------
const stamp = Date.now();
const existing = (await apiCall('GET', '/api/contacts?limit=1')).data?.contacts?.[0]?.email;
const suppressed = (await apiCall('GET', '/api/contacts/suppression/all')).data?.suppression?.[0]?.email;

const good = [
  `imp.${stamp}.1@example.com`,
  `imp.${stamp}.2@example.com`,
  `imp.${stamp}.3@example.com`,
];

// Column ke naam jaan-boojh kar alag rakhe hain — app ko khud pehchanna chahiye.
const lines = [
  'Full Name,Email Address,Phone,Company Name',
  `Naya Banda 1,${good[0]},9820011223,"Verma Traders, Mumbai"`,
  `Naya Banda 2,${good[1]},9820011224,Kumar Infotech`,
  `Naya Banda 3,${good[2]},9820011225,Patel Exports`,
  `Wahi Banda,${good[0]},9820011226,Duplicate Co`, // isi file me dobara
  `Bina Email,,9820011227,No Email Co`, // email hai hi nahi
  `Galat Email,yeh-email-nahi-hai,9820011228,Bad Co`, // email galat hai
];

if (existing) lines.push(`Pehle Se Hai,${existing},9820011229,Already Co`);
if (suppressed) lines.push(`Unsub Wala,${suppressed},9820011230,Unsub Co`);

const csvPath = path.resolve(`import-test-${stamp}.csv`);
fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

const expectedGood = 3;
console.log(`      (file me ${lines.length - 1} rows, ${expectedGood} sahi hone chahiye)`);

// --- browser ---------------------------------------------------------------
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await (await browser.newContext()).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

await page.goto(BASE + '/contacts/import', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

check('import page khula', !(await page.locator('body').innerText()).includes('stopped working'));

// --- 1. file chuno ---------------------------------------------------------
await page.setInputFiles('input[type="file"]', csvPath);
await page.waitForTimeout(2000);

let body = await page.locator('body').innerText();
check('file padh li gayi', body.includes(String(lines.length - 1)) || /rows found|पंक्तियाँ/i.test(body),
  body.split('\n').find((l) => /rows found/i.test(l)) ?? '');

// --- 2. column apne aap pehchane gaye --------------------------------------
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1200);

const emailSelect = page.locator('select[data-source="Email Address"]');
check('"Email Address" khud email pehchana gaya', (await emailSelect.inputValue()) === 'email',
  await emailSelect.inputValue());

const nameSelect = page.locator('select[data-source="Full Name"]');
check('"Full Name" khud name pehchana gaya', (await nameSelect.inputValue()) === 'name',
  await nameSelect.inputValue());

// --- 3. jaanch — kuch save nahi hona chahiye -------------------------------
const beforeCount = (await apiCall('GET', '/api/contacts?limit=1')).data?.total ?? 0;

await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(2500);

body = await page.locator('body').innerText();
check('jaanch ka natija dikha', /valid|सही/i.test(body));

const afterValidate = (await apiCall('GET', '/api/contacts?limit=1')).data?.total ?? 0;
check('jaanch se kuch SAVE nahi hua', afterValidate === beforeCount,
  `${beforeCount} se ${afterValidate}`);

check('sahi rows ki ginti theek hai', body.includes(String(expectedGood)), `${expectedGood} hone chahiye`);

// Teen tarah ke duplicate alag-alag dikhne chahiye.
check('duplicate alag-alag ginte gaye',
  /already in your contacts/i.test(body) && /repeated inside this file/i.test(body),
  body.split('\n').filter((l) => /already in|repeated inside|unsubscribed or/i.test(l)).join(' | ').slice(0, 120));

// --- 4. preview me har row par nishaan --------------------------------------
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1500);

const rowCount = await page.locator('tbody tr').count();
check('preview me har row dikhi', rowCount === lines.length - 1, `${rowCount} rows`);

// --- 5. asli import ---------------------------------------------------------
await page.getByRole('button', { name: /import/i }).last().click();
await page.waitForTimeout(3000);

body = await page.locator('body').innerText();
check('import poora hua', /added|जुड़/i.test(body), body.split('\n').find((l) => /added/i.test(l)) ?? '');

const afterImport = (await apiCall('GET', '/api/contacts?limit=1')).data?.total ?? 0;
check('sirf sahi rows hi judi (duplicate nahi)', afterImport === beforeCount + expectedGood,
  `${beforeCount} se ${afterImport}, ${expectedGood} judni chahiye thi`);

// --- 6. wahi file dobara — ab sab duplicate hone chahiye -------------------
await page.goto(BASE + '/contacts/import', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.setInputFiles('input[type="file"]', csvPath);
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(2500);

// Ginti seedha us hi khane se padhte hain jispar "Valid" likha hai. Poore
// page ke text me regex chalana galat tha — wahi shabd aur jagah bhi hai.
const validAgain = await page
  .locator('.mw-importstat')
  .filter({ hasText: /valid/i })
  .first()
  .locator('.mw-importstat__value')
  .innerText();

const dupAgain = await page
  .locator('.mw-importstat')
  .filter({ hasText: /duplicate/i })
  .first()
  .locator('.mw-importstat__value')
  .innerText();

check('dobara wahi file — ek bhi naya nahi', validAgain.trim() === '0', `valid ab ${validAgain}`);
check('dobara wahi file — sab duplicate mile', Number(dupAgain) >= expectedGood,
  `duplicate ${dupAgain}`);

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai ------------------------------------------------------------------
fs.unlinkSync(csvPath);

const all = (await apiCall('GET', '/api/contacts?limit=500')).data?.contacts ?? [];
const ids = all.filter((c) => good.includes(c.email)).map((c) => c.id);
if (ids.length) await apiCall('POST', '/api/contacts/bulk-delete', { ids });
check('test contacts hat gaye', ids.length === expectedGood, `${ids.length} hataye`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

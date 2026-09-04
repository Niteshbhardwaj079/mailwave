// Contacts page ka test — khaaskar wo cheezein jo pagination ke saath tootti hain.
//
// Sabse zaroori sawaal jiska jawab yeh test deta hai:
// "10 page wali list me 'Select all' dabaya to sach me saare chune ya sirf
//  dikhne wale 50?" — kyunki galat hone par delete ya send me bada nuksaan
//  hota hai.
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

// --- 120 test contacts banao, taki asli pagination ho ----------------------
// Seed me kuch contacts pehle se hain; 120 aur daalne se kai page ban jate hain.
const madeIds = [];
const stamp = Date.now();

for (let i = 0; i < 120; i += 1) {
  const res = await apiCall('POST', '/api/contacts', {
    email: `pagetest.${stamp}.${i}@example.com`,
    name: `Page Test ${i}`,
    company: 'PageTest Co',
    tags: ['pagetest'],
  });
  if (res.data?.contact?.id) madeIds.push(res.data.contact.id);
}
check('120 test contacts bane', madeIds.length === 120, `${madeIds.length} bane`);

const totals = await apiCall('GET', '/api/contacts?limit=1');
const TOTAL = totals.data?.total ?? 0;
console.log(`      (kul ${TOTAL} contacts)`);

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

await page.goto(BASE + '/contacts', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// --- 1. server se data aaya --------------------------------------------
const body = await page.locator('body').innerText();
check('contacts server se aaye', body.includes('PageTest Co') || body.includes('Page Test'));
check('page par error screen nahi', !body.includes('stopped working'));

// --- 2. ek page par sirf 50 rows ---------------------------------------
const rowCount = await page.locator('tbody tr:has(input.mw-rowcheck)').count();
check('ek page par 50 se zyada rows nahi', rowCount <= 50, `${rowCount} rows`);

// --- 3. pagination me poori ginti dikhti hai ----------------------------
const pagerText = await page.locator('.mw-pagination, [class*="pagination"]').first().innerText().catch(() => '');
check(
  'pagination me poori ginti dikhi',
  new RegExp(`\\b${TOTAL}\\b`).test(pagerText + body),
  `${TOTAL} dhoondha, mila: ${pagerText.replace(/\n/g, ' ').slice(0, 60)}`
);

// --- 4. SELECT ALL — sabse zaroori test ---------------------------------
// Header ka tick-box sirf is page ko chunta hai.
await page.locator('.mw-tablewrap table.mw-table thead input[type="checkbox"]').click();
await page.waitForTimeout(600);

const bulkAfterPage = await page.locator('.mw-bulkbar').innerText();
check('header tick-box ne sirf is page ko chuna (50)', /\b50\b/.test(bulkAfterPage),
  bulkAfterPage.replace(/\n/g, ' ').slice(0, 90));

// Ab "Select all 128" dabao — server se saare id aane chahiye.
const selectAllBtn = page.locator('.mw-bulkbar__selectall');
check('"Select all" ka button dikha', await selectAllBtn.count() > 0);

if (await selectAllBtn.count()) {
  await selectAllBtn.click();
  await page.waitForTimeout(1200);

  const bulkAfterAll = await page.locator('.mw-bulkbar').innerText();
  check(
    `"Select all" ne SAARE ${TOTAL} chune (sirf 50 nahi)`,
    new RegExp(`\\b${TOTAL}\\b`).test(bulkAfterAll),
    bulkAfterAll.replace(/\n/g, ' ').slice(0, 90)
  );
}

// --- 5. search server par chalti hai ------------------------------------
await page.fill('.mw-filterbar__search input', 'Page Test 7');
await page.waitForTimeout(1200);
const searched = await page.locator('body').innerText();
check('search ne list chhoti ki', !searched.includes('Neha') || /Page Test 7/.test(searched));

const searchRows = await page.locator('tbody tr:has(input.mw-rowcheck)').count();
check('search ke baad thodi hi rows', searchRows > 0 && searchRows < 50, `${searchRows} rows`);

// --- 6. naya contact UI se ----------------------------------------------
await page.fill('.mw-filterbar__search input', '');
await page.waitForTimeout(1000);

const newEmail = `ui.${stamp}@example.com`;
await page.getByRole('button', { name: /add contact|new contact/i }).first().click();
await page.waitForTimeout(500);
await page.fill('#new-name', 'UI Se Bana');
await page.fill('#new-email', newEmail);
await page.getByRole('button', { name: /save contact/i }).click();
await page.waitForTimeout(1800);

const check6 = await apiCall('GET', `/api/contacts?search=${encodeURIComponent(newEmail)}`);
check('UI se bana contact server par hai', (check6.data?.contacts ?? []).some((c) => c.email === newEmail));

// --- 7. wahi email dobara — saaf message aaye ---------------------------
await page.getByRole('button', { name: /add contact|new contact/i }).first().click();
await page.waitForTimeout(500);
await page.fill('#new-email', newEmail);
await page.getByRole('button', { name: /save contact/i }).click();
await page.waitForTimeout(1500);

const sheetText = await page.locator('.mw-sheet').innerText().catch(() => '');
check('duplicate email par form me saaf message', /already|pehle|exist/i.test(sheetText),
  sheetText.split('\n').find((l) => /already|pehle|exist/i.test(l)) ?? sheetText.slice(0, 80));

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai ---------------------------------------------------------------
const cleanup = await apiCall('POST', '/api/contacts/bulk-delete', { ids: madeIds });
check('test contacts hat gaye', cleanup.status === 200);

const uiOne = await apiCall('GET', `/api/contacts?search=${encodeURIComponent(newEmail)}`);
const uiId = uiOne.data?.contacts?.[0]?.id;
if (uiId) await apiCall('DELETE', `/api/contacts/${uiId}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

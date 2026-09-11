// Confirms: Database storage shows on Backups; Media storage shows on Media
// Library; and setting the optional limits in Settings makes the % bar
// appear correctly on both.
import { chromium } from 'playwright';

const API = 'http://localhost:4000';
const BASE = 'http://localhost:5173';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const login = await api('POST', '/api/auth/login', { email: 'rohit@gowebkart.com', password: 'mailwave' });
const token = login.data.accessToken;

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

// --- 1. Backups page, no limit set yet: shows plain "used" ---------------
await page.goto(BASE + '/backups', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
let text = await page.locator('body').innerText();
check('Backups page shows "Database storage" section', text.includes('Database storage'));
check('shows a real used amount (MB/GB), not zero/blank', /\d+(\.\d+)?\s*(MB|GB)\s*used/.test(text), text.match(/[\d.]+\s*(MB|GB)\s*used/)?.[0]);

// --- 2. Media Library, no limit set yet -----------------------------------
await page.goto(BASE + '/media', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
text = await page.locator('body').innerText();
check('Media Library shows a storage-used note', /used/.test(text) && /app database/i.test(text));

// --- 3. set both limits from Settings -------------------------------------
await page.goto(BASE + '/settings?section=backup', { waitUntil: 'networkidle' }).catch(() => page.goto(BASE + '/settings', { waitUntil: 'networkidle' }));
await page.waitForTimeout(700);
await page.locator('button[data-key="backup"]').click().catch(() => {});
await page.waitForTimeout(500);
const dbInput = page.locator('#s-db-storage');
check('database storage limit field exists in Settings', (await dbInput.count()) === 1);
if (await dbInput.count()) {
  await dbInput.fill('100');
  await page.getByRole('button', { name: /save changes/i }).first().click();
  await page.waitForTimeout(800);
}

// Two nav tabs are both literally labelled "Image Storage" (pre-existing,
// unrelated to this feature: 'storage' = the S3/bucket connection settings,
// 'imageStorage' = the db/external toggle + our new limit field) — target
// by data-key, not visible text, to hit the right one.
await page.locator('button[data-key="imageStorage"]').click().catch(() => {});
await page.waitForTimeout(500);
const mediaInput = page.locator('#s-media-storage');
check('media storage limit field exists in Settings', (await mediaInput.count()) === 1);
if (await mediaInput.count()) {
  await mediaInput.fill('50');
  await page.getByRole('button', { name: /save changes/i }).first().click();
  await page.waitForTimeout(800);
}

// --- 4. Backups page now shows a percentage / bar -------------------------
await page.goto(BASE + '/backups', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
text = await page.locator('body').innerText();
check('Backups now shows "used / 100 MB" style value', /\/\s*100(\.0)?\s*MB/.test(text), text.match(/[\d.]+\s*MB\s*\/\s*[\d.]+\s*MB/)?.[0] || 'not found');
const dbProgressBar = await page.locator('.progress').count();
check('a progress bar renders on Backups page', dbProgressBar > 0);

// --- 5. Media Library now shows a percentage / bar ------------------------
await page.goto(BASE + '/media', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
text = await page.locator('body').innerText();
check('Media Library now shows "/ 50 MB" style value', /\/\s*50(\.0)?\s*MB/.test(text), text.match(/[\d.]+\s*MB\s*\/\s*[\d.]+\s*MB/)?.[0] || 'not found');

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

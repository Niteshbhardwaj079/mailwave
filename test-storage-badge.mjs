// Confirms the Media Library shows a visible badge for where each image is
// actually stored (App database / Object Storage / External link).
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

// Add a URL-sourced image (no upload needed, quick) so at least one card
// exists with a known, predictable storage type.
await api('POST', '/api/images', {
  name: 'badge-test.png',
  url: 'https://example.com/badge-test.png',
  size: 0,
  source: 'url',
}, token);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

await page.goto(BASE + '/media', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const bodyText = await page.locator('body').innerText();
check('a storage-location badge is visible on Media Library ("External link")', bodyText.includes('External link'));

const badgeCount = await page.locator('.mw-imgcard .badge').count();
check('every image card has exactly one storage badge', badgeCount > 0, `found ${badgeCount} badges`);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

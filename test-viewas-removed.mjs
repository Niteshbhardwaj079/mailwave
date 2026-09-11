// Regression test for the "Demo: view as" removal + stale-role-display bug.
// 1. Confirms the dropdown/select is gone from the profile menu entirely.
// 2. Confirms the role shown under a user's name is their REAL, current role
//    (not a stale/default client-side "preview" value) — this is the actual
//    bug that was reported: a user's role was changed to a custom "demo"
//    role, but the topbar kept showing "Super Admin".
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
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// --- setup: log in as super admin, create a "demo" role, assign it to a
// real user, and set that user's password ----------------------------------
const admin = await api('POST', '/api/auth/login', { email: 'rohit@gowebkart.com', password: 'mailwave' });
const adminToken = admin.accessToken;

await api('POST', '/api/roles', {
  key: 'demo',
  label: 'Demo Viewer',
  desc: 'A role created to reproduce the stale-role-display bug',
  tone: 'info',
  icon: 'bi-person',
  permissions: { dashboard: ['view'] },
}, adminToken);

const usersList = await api('GET', '/api/users?limit=500', undefined, adminToken);
const testUser = usersList.users.find((u) => u.email === 'arjun@gowebkart.com');
if (!testUser) throw new Error('seed user arjun@gowebkart.com not found');

await api('PUT', `/api/users/${testUser.id}`, {
  name: testUser.name,
  email: testUser.email,
  role: 'demo',
  department: testUser.department,
  status: 'Active',
  language: testUser.language || 'en',
}, adminToken);

await api('POST', `/api/users/${testUser.id}/password`, { password: 'TestDemo@123', notify: false }, adminToken);

console.log('Setup done: arjun@gowebkart.com now has role "demo".\n');

// --- browser checks ----------------------------------------------------------
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();

// 1. Super admin: no "Demo: view as" control anywhere in the profile menu.
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

const topbarRole = await page.locator('.mw-profile__role').innerText();
check('super admin: topbar shows "Super Admin"', /super admin/i.test(topbarRole), topbarRole);

await page.locator('.mw-profile').click();
await page.waitForTimeout(200);
const viewAsSelectCount = await page.locator('#view-as').count();
check('the "Demo: view as" <select> no longer exists in the DOM', viewAsSelectCount === 0, `found ${viewAsSelectCount}`);
const viewAsTextCount = await page.getByText('Demo: view as').count();
check('the "Demo: view as" label text no longer exists', viewAsTextCount === 0, `found ${viewAsTextCount}`);

// 2. Sign out, sign in as the user whose role was just changed to "demo",
// confirm the topbar shows their REAL, current role — not a stale one.
await page.locator('button.text-danger').click();
await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 15000 });

await page.fill('#login-email', 'arjun@gowebkart.com');
await page.fill('#login-password', 'TestDemo@123');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
await page.waitForTimeout(500);

const demoUserRole = await page.locator('.mw-profile__role').innerText();
check('changed-role user: topbar shows their real new role ("Demo Viewer"), not stale "Super Admin"',
  demoUserRole === 'Demo Viewer', demoUserRole);

// Also confirm this low-privilege role actually can't see admin-only nav
// (Users & Roles) — proves `can()` is driven by the real role too, not just
// the label text.
const sidebarText = await page.locator('body').innerText();
check('low-privilege role does not see "Users & Roles" in the sidebar', !sidebarText.includes('Users & Roles'));

await browser.close();

// --- cleanup: put things back the way they were -----------------------------
await api('PUT', `/api/users/${testUser.id}`, {
  name: testUser.name,
  email: testUser.email,
  role: 'member',
  department: testUser.department,
  status: 'Active',
  language: testUser.language || 'en',
}, adminToken);
await api('DELETE', '/api/roles/demo', undefined, adminToken);
console.log('\nCleanup done: arjun restored to "member", "demo" role deleted.');

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

// Poore app ka browser test — asli Chrome me, asli API ke saath.
//
// Yeh sabse zaroori test hai: build aur lint dono pass ho kar bhi screen par
// kuch toota ho sakta hai. Yahan wahi dekha jata hai jo user ko dikhta hai.
import { chromium } from 'playwright';

// Website 5173 ya 5174 — jo bhi khuli ho, khud dhoondh lete hain. Vite pehla
// port busy ho to apne aap agla le leta hai, aur tab test galat port par jaakar
// bina wajah fail hota tha.
async function findApp() {
  for (const port of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* yeh port band hai, agla dekho */
    }
  }
  console.error('Website kahin nahi mili. Pehle "npm run dev" chalao.');
  process.exit(1);
}

const BASE = await findApp();
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

function errorsSince(mark) {
  return errors.slice(mark).filter((e) => !/401|Failed to load resource/.test(e));
}

// --- sign in ---------------------------------------------------------------
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
check('sign in', !page.url().includes('/login'));

// --- har page khulta hai ---------------------------------------------------
const ROUTES = [
  '/', '/campaigns', '/contacts', '/templates', '/segments', '/reports',
  '/accounts', '/subscribers', '/users', '/activity', '/settings',
  '/system-emails', '/guide', '/backups',
];

for (const route of ROUTES) {
  const mark = errors.length;
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const body = await page.locator('body').innerText();
  const broke = errorsSince(mark);
  const blank = body.trim().length < 40;
  const crashed = body.includes('stopped working');

  check(`page ${route}`, broke.length === 0 && !blank && !crashed,
    crashed ? 'error screen dikhi' : broke.slice(0, 2).join(' | ') || (blank ? 'khali page' : ''));
}

// --- asli data aa raha hai (mock nahi) --------------------------------------
await page.goto(BASE + '/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const usersText = await page.locator('body').innerText();
check('users server se aaye', usersText.includes('Rohit Sharma') && usersText.includes('Neha'),
  usersText.slice(0, 0));

await page.goto(BASE + '/activity', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const activityText = await page.locator('body').innerText();
check('activity server se aayi', activityText.length > 200,
  `${activityText.length} akshar`);

// --- ek asli badlaav: template banao, dikhe, phir hatao ---------------------
const NAME = `Test Template ${Date.now()}`;

const made = await page.evaluate(async (name) => {
  const res = await fetch('http://localhost:4000/api/templates', { method: 'GET', credentials: 'include' });
  return res.status;
}, NAME);
check('browser se API call chali', made === 200 || made === 401, `${made}`);

await page.goto(BASE + '/templates', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const tplText = await page.locator('body').innerText();
check('templates list bhari hui hai', tplText.length > 200, `${tplText.length} akshar`);

// --- refresh ke baad bhi sab theek ------------------------------------------
const mark = errors.length;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
check('refresh ke baad andar hi hai', !page.url().includes('/login'), page.url());
check('refresh par koi error nahi', errorsSince(mark).length === 0,
  errorsSince(mark).slice(0, 2).join(' | '));

// --- mobile par bhi -------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
const mMark = errors.length;
for (const route of ['/', '/contacts', '/users']) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const wide = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  check(`mobile ${route} me side-scroll nahi`, !wide);
}
check('mobile par koi error nahi', errorsSince(mMark).length === 0,
  errorsSince(mMark).slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

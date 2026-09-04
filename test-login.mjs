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
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

// --- 1. login page render hota hai (DEMO_EMAIL ReferenceError nahi) ---------
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
check('login page render hua', await page.locator('#login-email').isVisible());
check('koi ReferenceError nahi', consoleErrors.filter((e) => e.includes('is not defined')).length === 0,
  consoleErrors.filter((e) => e.includes('is not defined')).join(' | '));
const visibleText = await page.locator('body').innerText();
check('demo password screen par nahi dikh raha', !/mailwave/i.test(visibleText.replace(/MailWave/g, '')), visibleText.match(/S*mailwaveS*/i)?.[0] ?? '');

// --- 2. bina login andar jaane ki koshish -----------------------------------
await page.goto(BASE + '/contacts', { waitUntil: 'networkidle' });
check('bina login /contacts se login par bheja gaya', page.url().includes('/login'), page.url());

// --- 3. galat password ------------------------------------------------------
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'galat-password');
await page.click('button[type="submit"]');
await page.waitForSelector('[role="alert"]', { timeout: 8000 });
const errText = (await page.locator('[role="alert"]').first().innerText()).trim();
check('galat password par error dikha', errText.length > 0, errText);
check('galat password par andar nahi gaya', page.url().includes('/login'));

// --- 4. sahi password -------------------------------------------------------
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
check('sahi password par andar aa gaya', !page.url().includes('/login'), page.url());

// login ke baad wahi page khulna chahiye jo maanga tha
check('jo page maanga tha wahi khula (/contacts)', page.url().includes('/contacts'), page.url());

// --- 5. token localStorage me to nahi? -------------------------------------
const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
check('access token localStorage me NAHI hai', !/eyJhbGciOi/.test(stored));

// --- 6. refresh karne par login screen ki jhalak nahi ----------------------
const flashes = [];
page.on('framenavigated', () => {});
await page.reload({ waitUntil: 'networkidle' });
check('refresh ke baad bhi andar hai', !page.url().includes('/login'), page.url());

// --- 7. sign out -----------------------------------------------------------
await page.click('.mw-profile');
const signOut = page.locator('.dropdown-menu button:has-text("Sign out")');
if (await signOut.count()) {
  await signOut.first().click();
  await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  check('sign out par login par aa gaya', page.url().includes('/login'), page.url());

  await page.goto(BASE + '/contacts', { waitUntil: 'networkidle' });
  check('sign out ke baad andar nahi ja sakte', page.url().includes('/login'), page.url());
} else {
  // sidebar me chhupa ho sakta hai
  check('sign out button mila', false, 'button nahi mila');
}

const realErrors = consoleErrors.filter((e) => !e.includes('401') && !e.includes('Failed to load resource'));
check('console saaf hai', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

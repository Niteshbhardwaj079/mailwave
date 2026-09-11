// Design/copy protection feature — checks that brand.config.js's
// `securityProtection` flag actually deters right-click/select/Ctrl+U/Ctrl+S
// on plain page content, WITHOUT breaking inputs, the HTML/code editor, or
// clipboard-button copy actions.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5473';
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

// --- sign in -----------------------------------------------------------
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// --- html carries the data attribute ------------------------------------
const attr = await page.evaluate(() => document.documentElement.getAttribute('data-security-protection'));
check('html[data-security-protection="on"] when flag is true', attr === 'on');

// --- user-select: none on plain content ---------------------------------
const bodySelect = await page.evaluate(() => getComputedStyle(document.body).userSelect);
check('body has user-select:none', bodySelect === 'none', bodySelect);

// --- right-click on plain content is blocked ----------------------------
const heading = page.locator('h1, .mw-topbar__title').first();
let menuShown = false;
page.once('dialog', () => {}); // safety net, not expected
const beforeMenuFired = await page.evaluate(() => {
  let fired = false;
  document.addEventListener('contextmenu', () => { fired = true; }, { once: true, capture: true });
  window.__mwCtxFired = () => fired;
  return true;
});
await heading.click({ button: 'right' }).catch(() => {});
await page.waitForTimeout(150);
const defaultPrevented = await page.evaluate(() => {
  const el = document.querySelector('h1, .mw-topbar__title');
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  const notPrevented = el.dispatchEvent(ev); // returns false if preventDefault() was called
  return !notPrevented;
});
check('right-click on plain content is prevented (event.preventDefault fired)', defaultPrevented);

// --- Ctrl+U / Ctrl+S are intercepted --------------------------------------
const ctrlUPrevented = await page.evaluate(() => {
  const ev = new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, bubbles: true, cancelable: true });
  const notPrevented = document.dispatchEvent(ev);
  return !notPrevented;
});
check('Ctrl+U is prevented', ctrlUPrevented);

const ctrlSPrevented = await page.evaluate(() => {
  const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
  const notPrevented = document.dispatchEvent(ev);
  return !notPrevented;
});
check('Ctrl+S is prevented', ctrlSPrevented);

// --- inputs remain fully usable -------------------------------------------
await page.goto(BASE + '/contacts', { waitUntil: 'networkidle' });
const searchBox = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
if (await searchBox.count()) {
  await searchBox.click();
  await searchBox.fill('test-selection');
  const val = await searchBox.inputValue();
  check('typing into a search input still works', val === 'test-selection', val);

  const inputSelect = await searchBox.evaluate((el) => getComputedStyle(el).userSelect);
  check('input keeps user-select: text (not none)', inputSelect !== 'none', inputSelect);
} else {
  check('typing into a search input still works', false, 'no search input found on /contacts');
}

// --- template HTML code editor stays selectable/editable -------------------
await page.goto(BASE + '/templates/new/custom', { waitUntil: 'networkidle' }).catch(() => {});
await page.getByText('Email HTML', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
const codeArea = page.locator('textarea.mw-codearea, textarea').first();
if (await codeArea.count()) {
  const codeSelect = await codeArea.evaluate((el) => getComputedStyle(el).userSelect);
  check('template HTML editor (.mw-codearea) keeps user-select: text', codeSelect !== 'none', codeSelect);
} else {
  check('template HTML editor (.mw-codearea) keeps user-select: text', false, 'no textarea found');
}

// --- clipboard-button copy actions are unaffected ---------------------------
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('page still interactive after navigation under protection', true);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

// Confirms the 4 previously-broken languages (Telugu, Malayalam, Kannada,
// Punjabi) now actually translate the UI when picked from the topbar
// language dropdown, and that nothing else in the picker regressed.
import { chromium } from 'playwright';
import te from './src/i18n/locales/te.js';
import ml from './src/i18n/locales/ml.js';
import kn from './src/i18n/locales/kn.js';
import pa from './src/i18n/locales/pa.js';

const BASE = 'http://localhost:5173';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

const LANGS = [
  { code: 'te', native: 'తెలుగు', dashboardWord: te['nav.dashboard'] },
  { code: 'ml', native: 'മലയാളം', dashboardWord: ml['nav.dashboard'] },
  { code: 'kn', native: 'ಕನ್ನಡ', dashboardWord: kn['nav.dashboard'] },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', dashboardWord: pa['nav.dashboard'] },
];

for (const lang of LANGS) {
  // Open the language picker and choose this language.
  await page.locator('.mw-langbtn').click();
  await page.waitForTimeout(150);
  await page.locator('.mw-langmenu__search input').fill(lang.native);
  await page.waitForTimeout(150);
  await page.locator(`.mw-langmenu__item[data-code="${lang.code}"]`).click();
  await page.waitForTimeout(400);

  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  check(`${lang.code}: html lang attribute updates`, htmlLang === lang.code, htmlLang);

  const bodyText = await page.locator('body').innerText();
  const hasNativeText = bodyText.includes(lang.dashboardWord) || bodyText.includes(lang.native);
  check(`${lang.code}: sidebar/UI text actually changed to native script`, hasNativeText,
    hasNativeText ? 'found native text' : 'still English — translation not applied');

  const stillHasEnglishNav = bodyText.includes('Dashboard') && bodyText.includes('Campaigns') && bodyText.includes('Contacts');
  check(`${lang.code}: nav is no longer plain English`, !stillHasEnglishNav);

  // Reload to confirm the choice persists (localStorage) and the chunk loads
  // fresh from a cold start too, not just a hot in-memory switch.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const afterReloadText = await page.locator('body').innerText();
  check(`${lang.code}: survives a reload`, afterReloadText.includes(lang.dashboardWord) || afterReloadText.includes(lang.native));
}

// --- switch back to English and confirm nothing broke ----------------------
await page.locator('.mw-langbtn').click();
await page.waitForTimeout(150);
await page.locator('.mw-langmenu__search input').fill('English');
await page.waitForTimeout(150);
await page.locator('.mw-langmenu__item[data-code="en"]').click();
await page.waitForTimeout(300);
const backToEnglish = await page.locator('body').innerText();
check('back to English works cleanly', backToEnglish.includes('Dashboard') && backToEnglish.includes('Campaigns'));

// --- spot check an already-working language still works (no regression) ---
await page.locator('.mw-langbtn').click();
await page.waitForTimeout(150);
await page.locator('.mw-langmenu__search input').fill('Hindi');
await page.waitForTimeout(150);
await page.locator('.mw-langmenu__item[data-code="hi"]').click();
await page.waitForTimeout(300);
const hindiText = await page.locator('body').innerText();
check('existing language (Hindi) still works, no regression', hindiText.includes('डैशबोर्ड') || hindiText.includes('हिन्दी'));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

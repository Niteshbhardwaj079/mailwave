// Notification bell: count badge + scrollable panel + responsive check.
// Wizard: validation errors now also show as a toast (visible regardless of
// scroll position).
import { chromium } from 'playwright';

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
await page.waitForTimeout(800);

// --- bell count badge --------------------------------------------------------
const badge = page.locator('.mw-iconbtn__badge');
check('bell shows a count badge (not just a plain dot)', (await badge.count()) === 1);
const badgeText = await badge.innerText().catch(() => '');
check('badge shows a real number', /^\d+\+?$/.test(badgeText.trim()), badgeText);

// --- panel opens with scroll-ready CSS ----------------------------------------
await page.locator('button[aria-label="Notifications"]').click();
await page.waitForTimeout(300);
const panel = page.locator('.mw-notifpanel');
check('notification panel renders with the new class', (await panel.count()) === 1);

const listMetrics = await page.locator('.mw-notifpanel__list').evaluate((el) => {
  const s = getComputedStyle(el);
  return { maxHeight: s.maxHeight, overflowY: s.overflowY };
}).catch(() => null);
check('the list has a max-height and scrolls on its own (Bootstrap forces display:block on this element, so the constraint lives on the list, not the outer flex box)',
  listMetrics && parseFloat(listMetrics.maxHeight) > 0 && listMetrics.overflowY === 'auto', JSON.stringify(listMetrics));

// --- mobile responsive ---------------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
const mobilePanelStyle = await panel.evaluate((el) => getComputedStyle(el).width).catch(() => null);
const viewportWidth = 390;
check('on mobile the panel goes full-width (no off-screen overflow)', mobilePanelStyle && parseFloat(mobilePanelStyle) <= viewportWidth + 1, mobilePanelStyle);
const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
check('no horizontal page scroll caused by the panel on mobile', !wide);

await page.setViewportSize({ width: 1280, height: 800 });
await page.keyboard.press('Escape').catch(() => {});
await page.mouse.click(700, 50);

// --- wizard validation error also shows as a toast ----------------------------
await page.goto(BASE + '/campaigns/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /continue/i }).first().click();
await page.waitForTimeout(500);
const toastVisible = await page.locator('.mw-toast--error').count();
check('a toast appears when Continue is clicked with required fields missing', toastVisible > 0, `${toastVisible} error toasts`);
const inlineBanner = await page.locator('.mw-note--warning').count();
check('the inline warning banner still shows too (not replaced, just backed up by a toast)', inlineBanner > 0);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

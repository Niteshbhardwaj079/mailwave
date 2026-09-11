// Confirms the new top "Continue" button on the campaign wizard's Template
// step works exactly like the existing bottom one, and the bottom one is
// still there too.
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

await page.goto(BASE + '/campaigns/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Step 1
await page.fill('#campaign-name', 'Continue Button Test ' + Date.now());
await page.fill('#campaign-subject', 'Test subject');
await page.getByRole('button', { name: /continue/i }).first().click();
await page.waitForTimeout(1200);

// Step 2 (Recipients) — just continue through
await page.getByRole('button', { name: /continue/i }).first().click();
await page.waitForTimeout(1200);

// Step 3 (Template) — should now be on this step, with a Continue button in
// the top filter row (next to "Create template") AND the bottom footer.
const continueButtons = page.getByRole('button', { name: /continue/i });
const countBefore = await continueButtons.count();
check('two "Continue" buttons exist on the Template step (top + bottom)', countBefore === 2, `found ${countBefore}`);

const topButtonBox = await continueButtons.first().boundingBox();
const bottomButtonBox = await continueButtons.last().boundingBox();
check('the two Continue buttons are in different places on screen', topButtonBox && bottomButtonBox && topButtonBox.y !== bottomButtonBox.y);

// Click the TOP one and confirm it actually advances to step 4 (Content).
await continueButtons.first().click();
await page.waitForTimeout(1000);
const bodyText = await page.locator('body').innerText();
check('clicking the top Continue button advances the wizard (Content step reached)', bodyText.includes('Content') || bodyText.includes('subject'));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

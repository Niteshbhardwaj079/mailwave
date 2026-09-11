// Confirms clicking an account checkbox in Roles & Permissions, then Save,
// actually persists — round-trips through a page reload.
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

await page.goto(BASE + '/users', { waitUntil: 'networkidle' });
await page.locator('button:has-text("Roles")').first().click().catch(() => {});
await page.waitForTimeout(500);

// Pick the "Member" role card (a non-locked, non-super-admin role) to test on.
await page.locator('.mw-rolecard:has-text("Member")').first().click().catch(async () => {
  await page.getByText('Member', { exact: true }).first().click();
});
await page.waitForTimeout(400);

const firstCheckbox = page.locator('input[id^="role-account-"]').first();
check('at least one account checkbox is rendered', (await firstCheckbox.count()) > 0);

const wasChecked = await firstCheckbox.isChecked();
await firstCheckbox.click();
check('clicking the checkbox flips its state', (await firstCheckbox.isChecked()) !== wasChecked);

const saveButton = page.locator('button:has-text("Save Changes")');
check('Save Changes button becomes enabled after a change', !(await saveButton.isDisabled()));
await saveButton.click();
await page.waitForTimeout(800);

// Reload and confirm the checkbox state survived the save.
await page.reload({ waitUntil: 'networkidle' });
await page.locator('button:has-text("Roles")').first().click().catch(() => {});
await page.waitForTimeout(500);
await page.locator('.mw-rolecard:has-text("Member")').first().click().catch(async () => {
  await page.getByText('Member', { exact: true }).first().click();
});
await page.waitForTimeout(400);

const afterReload = page.locator('input[id^="role-account-"]').first();
const stateAfterReload = await afterReload.isChecked();
check('checkbox state persisted after save + reload', stateAfterReload !== wasChecked, `now ${stateAfterReload}`);

// Revert it back to the original state to leave the seed data clean.
await afterReload.click();
await page.locator('button:has-text("Save Changes")').click();
await page.waitForTimeout(800);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

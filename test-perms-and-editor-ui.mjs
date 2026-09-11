// Covers: template editor toolbar cleanup + back-button routing, and the
// Roles & Permissions UI (new modules + the "which accounts" section).
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

// --- 1. Template chooser has a Back button ----------------------------------
await page.goto(BASE + '/templates/new', { waitUntil: 'networkidle' });
const chooserBack = page.locator('.mw-pagehead__actions a[href="/templates"]');
check('chooser page has a Back button', (await chooserBack.count()) > 0);
if (await chooserBack.count()) {
  await chooserBack.click();
  await page.waitForURL((u) => u.pathname === '/templates', { timeout: 8000 });
  check('chooser Back button goes to /templates', page.url().endsWith('/templates'));
}

// --- 2. Custom editor toolbar: removed buttons gone, Back goes to chooser ---
await page.goto(BASE + '/templates/new/custom', { waitUntil: 'networkidle' });
const bodyText = await page.locator('body').innerText();
check('"Manage fields" / Dynamic Fields button is gone', !bodyText.includes('Manage fields'));
check('"Duplicate" button is gone from toolbar', (await page.locator('button:has-text("Duplicate")').count()) === 0);
check('"Open preview in new tab" link is gone', (await page.locator('a:has-text("Open preview")').count()) === 0);
check('"Preview" button still present', (await page.locator('button:has-text("Preview")').count()) > 0);
check('"Save" button still present', (await page.locator('button:has-text("Save")').count()) > 0);

const editorBack = page.locator('.mw-pagehead__actions a[href="/templates/new"]');
check('custom editor Back link points at /templates/new', (await editorBack.count()) > 0);
await editorBack.click();
await page.waitForURL((u) => u.pathname === '/templates/new', { timeout: 8000 });
check('custom editor Back button goes to the chooser (/templates/new)', page.url().endsWith('/templates/new'));

// --- 3. Roles & Permissions: new modules appear in the matrix ---------------
await page.goto(BASE + '/users', { waitUntil: 'networkidle' });
await page.locator('button:has-text("Roles")').first().click().catch(() => {});
await page.waitForTimeout(500);

const rolesBodyText = await page.locator('body').innerText();
check('Media Library appears as its own permission row', rolesBodyText.includes('Media Library'));
check('Backups appears as its own permission row', rolesBodyText.includes('Backups'));
check('System Emails appears as its own permission row', rolesBodyText.includes('System Emails'));

// --- 4. "Which email accounts" section renders with real connected accounts -
check('account-access section heading present', rolesBodyText.includes('Which email accounts can this role use'));
check('a real connected account email appears as a checkbox label', /offers@gowebkart\.com|hello@gowebkart\.com|courses@gowebkart\.com|shop@gowebkart\.com/.test(rolesBodyText));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

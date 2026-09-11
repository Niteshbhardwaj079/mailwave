// Confirms the login page's demo-access banner shows the credentials and
// the "Use the demo account" button actually signs a visitor in.
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

const bannerText = await page.locator('body').innerText();
check('login page shows the demo credentials', bannerText.includes('mailwave.demo@gmail.com') && bannerText.includes('mailwave@1234'));

const demoButton = page.getByRole('button', { name: /use the demo account/i });
check('"Use the demo account" button is present', await demoButton.count() === 1);

await demoButton.click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
check('clicking it signs the visitor in (redirected off /login)', !page.url().includes('/login'), page.url());

await page.waitForTimeout(400);
const name = await page.locator('.mw-profile__name').innerText().catch(() => '');
check('signed in as the demo account', name.includes('Demo'), name);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

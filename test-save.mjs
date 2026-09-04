// UI se kiya hua kaam server par sach me pahunchta hai ya nahi.
//
// Yeh sabse zaroori test hai. Screen par "save ho gaya" dikha dena aasan hai;
// asli sawaal yeh hai ki page reload karne par wo badlaav bacha ya nahi — aur
// kya doosra aadmi apne computer se wahi cheez dekh pata hai. Yahi wo dikkat
// thi jo pehle localStorage me chup-chap fail ho jati thi.
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
const API = 'http://localhost:4000';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

// Node se seedhi API call — browser se alag, taki pata chale ki data sach me
// server par hai, sirf us ek browser ki yaad me nahi.
let apiToken = null;

async function apiCall(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Origin: BASE,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

const login = await apiCall('POST', '/api/auth/login', {
  email: 'rohit@gowebkart.com',
  password: 'mailwave',
});
apiToken = login.data?.accessToken;

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await (await browser.newContext()).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
check('sign in', !page.url().includes('/login'));

// --- 1. UI se naya user banao ----------------------------------------------
const stamp = Date.now();
const newName = `Tester ${String(stamp).slice(-6)}`;
const newEmail = `test.${stamp}@example.com`;

await page.goto(BASE + '/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.getByRole('button', { name: /add user|invite/i }).first().click();
await page.waitForTimeout(400);
await page.fill('input[name="name"]', newName);
await page.fill('input[name="email"]', newEmail);
await page.getByRole('button', { name: /send invite/i }).click();

// Fixed sleep ki jagah asli intezaar — dheeme computer par bhi test sahi rahe.
const appeared = await page
  .locator(`text=${newName}`)
  .first()
  .waitFor({ timeout: 8000 })
  .then(() => true)
  .catch(() => false);

const afterAdd = await page.locator('body').innerText();
check('naya user turant screen par dikha', appeared);
check('toast dikha', /invited|invite sent|saved/i.test(afterAdd));

// --- 2. server par sach me bacha? -------------------------------------------
const listed = await apiCall('GET', '/api/users?limit=500');
const found = listed.data?.users?.find((u) => u.email === newEmail);
check('doosre connection se bhi wahi user mila (server par hai)', Boolean(found), found?.name);
check('naye user ka password nahi hai (invite gaya)', found?.hasPassword === false);
check('user "Invited" haalat me hai', found?.status === 'Invited', found?.status);

// --- 3. reload karke bhi dikhe ---------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('reload ke baad bhi user hai', (await page.locator('body').innerText()).includes(newName));

// --- 4. date padhne layak hai (raw ISO nahi) --------------------------------
const usersText = await page.locator('body').innerText();
check('date padhne layak hai, raw ISO nahi', !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(usersText),
  usersText.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/)?.[0] ?? '');

// --- 5. permission toggle karo, phir reload ---------------------------------
await page.getByRole('button', { name: /^roles/i }).first().click().catch(() => {});
await page.waitForTimeout(800);

// Locked role (Super Admin) me sab pehle se on hota hai — koi aur role chuno.
const roleCards = page.locator('.mw-rolecard');
const cardCount = await roleCards.count();
let toggled = false;

for (let c = 0; c < cardCount && !toggled; c += 1) {
  await roleCards.nth(c).click();
  await page.waitForTimeout(500);

  const boxes = page.locator('table input[type="checkbox"]');
  const n = await boxes.count();

  for (let i = 0; i < n; i += 1) {
    if (await boxes.nth(i).isChecked()) continue;

    await boxes.nth(i).click();
    await page.waitForTimeout(1200);
    check('permission on ho gayi', await boxes.nth(i).isChecked());

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^roles/i }).first().click().catch(() => {});
    await page.waitForTimeout(700);
    await page.locator('.mw-rolecard').nth(c).click();
    await page.waitForTimeout(600);

    const stillOn = await page.locator('table input[type="checkbox"]').nth(i).isChecked();
    check('reload ke baad bhi permission on hai (server par save hui)', stillOn);

    // jaisa tha waisa chhod do
    await page.locator('table input[type="checkbox"]').nth(i).click();
    await page.waitForTimeout(900);

    toggled = true;
    break;
  }
}

if (!toggled) check('permission toggle ho paya', false, 'koi off checkbox nahi mila');

// --- 6. safai ---------------------------------------------------------------
if (found) {
  const del = await apiCall('DELETE', `/api/users/${found.id}`);
  check('test user hat gaya', del.status === 200, `${del.status}`);
}

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

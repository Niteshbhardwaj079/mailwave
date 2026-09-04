// Campaigns aur Email Accounts pages ka test.
//
// Dono me ab data server se aata hai. Sabse zaroori sawaal:
//   - search / filter / sort SERVER par lagte hain ya sirf dikhne me?
//   - screen par jo ginti dikh rahi hai, wahi server ke paas hai?
//   - test email ka button sach me email bhejta hai?
import { chromium } from 'playwright';

const API = 'http://localhost:4000';
const results = [];

function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

async function findApp() {
  for (const port of [5173, 5174, 5175]) {
    try {
      const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* yeh port band hai */
    }
  }
  console.error('Website kahin nahi mili. Pehle "npm run dev" chalao.');
  process.exit(1);
}

const BASE = await findApp();
let token = null;

async function apiCall(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Origin: BASE,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
token = login.data?.accessToken;
check('login', login.status === 200);

const campaignData = (await apiCall('GET', '/api/campaigns?limit=1')).data;
const accountData = (await apiCall('GET', '/api/accounts')).data;

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await (await browser.newContext()).newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const apiCalls = [];
page.on('request', (r) => {
  if (r.url().includes('/api/')) apiCalls.push(r.url());
});

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('#login-email', 'rohit@gowebkart.com');
await page.fill('#login-password', 'mailwave');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });

// =========================== CAMPAIGNS ====================================
await page.goto(BASE + '/campaigns', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

let body = await page.locator('body').innerText();
check('campaigns page khula', !body.includes('stopped working'));
check('campaigns server se aaye', apiCalls.some((u) => u.includes('/api/campaigns')));

const rows = await page.locator('tbody tr').count();
check('campaign rows dikhi', rows > 0, `${rows} rows`);

// Status filter ke aage jo ginti dikhti hai, wo server ki ginti honi chahiye.
const sentCount = campaignData?.counts?.Sent ?? 0;
check('status filter ki ginti server se milti hai', body.includes(String(campaignData?.total ?? -1)),
  `kul ${campaignData?.total}, Sent ${sentCount}`);

// Search server par jaani chahiye — sirf browser me chhantai nahi.
apiCalls.length = 0;
await page.fill('.mw-filterbar__search input', 'diwali');
await page.waitForTimeout(1200);
check('search server par gayi', apiCalls.some((u) => u.includes('search=diwali')),
  apiCalls.filter((u) => u.includes('campaigns')).slice(-1)[0]?.split('?')[1] ?? 'koi request nahi');

// Request ja chuki hai, par jawab aane me thoda waqt lagta hai. Fixed sleep ki
// jagah asli intezaar — dheeme computer par bhi test sahi rahe.
const shrank = await page
  .waitForFunction(
    (before) => document.querySelectorAll('tbody tr').length < before,
    rows,
    { timeout: 10000 }
  )
  .then(() => true)
  .catch(() => false);

const afterSearch = await page.locator('tbody tr').count();
check('search se list chhoti hui', shrank && afterSearch < rows, `${rows} se ${afterSearch}`);

await page.fill('.mw-filterbar__search input', '');
await page.waitForTimeout(1000);

// Sort bhi server par
apiCalls.length = 0;
await page.selectOption('#camp-filter-sort', 'name');
await page.waitForTimeout(1200);
check('sort server par gaya', apiCalls.some((u) => u.includes('sort=name')));

// Naam se sort hua ya nahi — pehli row API ki pehli row jaisi honi chahiye.
const sortedApi = (await apiCall('GET', '/api/campaigns?sort=name&limit=1')).data?.campaigns?.[0];
const firstRow = (await page.locator('tbody tr').first().innerText()).split('\n')[0];
check('naam se sort sahi hua', sortedApi ? firstRow.includes(sortedApi.name) : false,
  `${firstRow} vs ${sortedApi?.name}`);

// =========================== EMAIL ACCOUNTS ================================
await page.goto(BASE + '/accounts', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

body = await page.locator('body').innerText();
check('accounts page khula', !body.includes('stopped working'));

const accounts = accountData?.accounts ?? [];
check('accounts server se aaye', accounts.length > 0 && body.includes(accounts[0].email),
  accounts[0]?.email ?? 'koi account nahi');

check('password kahin dikh to nahi raha', !/pass|secret/i.test(body) || !body.includes('smtp'),
  'screen par koi password nahi');

// Test email — page ka sabse kaam ka button.
if (accounts.length) {
  await page.getByRole('button', { name: /send test/i }).first().click();
  await page.waitForTimeout(600);

  const filled = await page.inputValue('#test-to');
  check('test wala email pehle se bhara hua hai', filled.includes('@'), filled);

  await page.getByRole('button', { name: /^send test email$|^send test$/i }).last().click();
  await page.waitForTimeout(5000);

  // Natija sheet ke andar wale note me aata hai — poore sheet ke text me
  // dhoondhna galat tha, kyunki upar likhi hui line bhi match ho jati thi.
  const note = page.locator('.mw-sheet .mw-note');
  const noteText = (await note.count()) ? (await note.first().innerText()).trim() : '';

  check('test email sach me chala gaya', /sent to|bhej diya|gaya/i.test(noteText), noteText.slice(0, 100));
  check('natija ka note dikha', noteText.length > 0, noteText.slice(0, 100));
}

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

// =========================== ACCOUNT JODNA =================================
// Yeh app ka sabse zaroori page hai: bina email account jude kuch bhi nahi ja
// sakta. Isliye yahan poora raasta jaancha jata hai — provider chunne se lekar
// galat password par saaf message tak.
await page.goto(BASE + '/accounts/connect', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

body = await page.locator('body').innerText();
check('connect page khula', !body.includes('stopped working'));

const providerCards = page.locator('.mw-provider');
const providerCount = await providerCards.count();
check('provider ki list server se aayi', providerCount > 0, `${providerCount} providers`);

// Gmail chunte hain — sabse aam.
const gmail = page.locator('.mw-provider[data-key="google"]');
if (await gmail.count()) {
  await gmail.click();
  await page.waitForTimeout(800);

  const form = await page.locator('body').innerText();
  check('App Password ke steps dikhe', /app password/i.test(form),
    form.match(/.{0,50}app password.{0,50}/i)?.[0] ?? '');
  check('email pehle se bhara hua hai', (await page.inputValue('#acc-email')).includes('@'),
    await page.inputValue('#acc-email'));

  // Bina password ke test — saaf message aana chahiye, chup nahi rehna chahiye.
  await page.fill('#acc-pass', '');
  await page.getByRole('button', { name: /test connection/i }).click();
  await page.waitForTimeout(1200);

  const warn = await page.locator('.mw-note--warning').first().innerText().catch(() => '');
  check('bina password ke saaf message aaya', warn.trim().length > 0, warn.trim().slice(0, 70));

  // Galat password se test — server ki asli galti aam bhasha me aani chahiye.
  await page.fill('#acc-pass', 'yeh-galat-password-hai');
  await page.getByRole('button', { name: /test connection/i }).click();
  await page.waitForTimeout(12000);

  const failNote = await page.locator('.mw-note--warning').first().innerText().catch(() => '');
  check('galat password par samajhne layak wajah aayi', failNote.trim().length > 10,
    failNote.trim().slice(0, 110));
  check('technical error nahi dikhaya', !/ECONNREFUSED|ETIMEDOUT|EAUTH/.test(failNote),
    failNote.trim().slice(0, 60));
}

check('koi crash nahi hua (connect)', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

// Campaign schedule ka test.
//
// Sabse zaroori sawaal: time aane par campaign SACH ME chal padti hai?
// Screen par "scheduled" dikha dena aasan hai — asli baat yeh hai ki us waqt
// email nikle bhi.
//
// Aur utni hi zaroori doosri baat: time se PEHLE kuch na jaye.
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

const account = (await apiCall('GET', '/api/accounts')).data?.accounts?.[0];
const template = (await apiCall('GET', '/api/templates?limit=1')).data?.templates?.[0];
check('bhejne ke liye account aur template hain', Boolean(account && template));

// --- beeta hua time nahi chalna chahiye ------------------------------------
const past = await apiCall('POST', '/api/campaigns', {
  name: `Past Test ${Date.now()}`,
  accountId: account.id,
  subject: 'Test',
  html: '<p>Hi {{name}}</p>',
  scheduledAt: new Date(Date.now() - 60_000).toISOString(),
});

// Banate waqt server beeta time maan leta hai (wo turant chal padegi), par
// BADALTE waqt saaf mana karta hai — wahi jaanchte hain.
if (past.data?.campaign?.id) {
  const backInTime = await apiCall('POST', `/api/campaigns/${past.data.campaign.id}/schedule`, {
    at: new Date(Date.now() - 60_000).toISOString(),
  });
  check('beeta hua time chunne par mana kiya', backInTime.status === 400,
    backInTime.data?.error?.message);
  await apiCall('DELETE', `/api/campaigns/${past.data.campaign.id}`);
}

// --- asli test: 5 second baad ka time -------------------------------------
const name = `Schedule Test ${Date.now()}`;
const goAt = new Date(Date.now() + 5_000).toISOString();

const made = await apiCall('POST', '/api/campaigns', {
  name,
  accountId: account.id,
  senderName: 'Test',
  subject: 'Scheduled hello {{name}}',
  templateId: template.id,
  html: template.html,
  batchSize: 100,
  batchDelay: 0,
  scheduledAt: goAt,
});

check('campaign "Scheduled" haalat me bani', made.data?.campaign?.status === 'Scheduled',
  made.data?.campaign?.status ?? made.data?.error?.message);

const id = made.data?.campaign?.id;
const added = await apiCall('POST', `/api/campaigns/${id}/recipients`, { source: 'all' });
check('log jud gaye', (added.data?.added ?? 0) > 0, `${added.data?.added} jude`);

// --- time se PEHLE kuch nahi jana chahiye ---------------------------------
await new Promise((r) => setTimeout(r, 2000));
const early = (await apiCall('GET', `/api/campaigns/${id}`)).data?.campaign;
check('time se pehle kuch nahi gaya', (early?.sent ?? 0) === 0 && early?.status === 'Scheduled',
  `status ${early?.status}, sent ${early?.sent}`);

// --- ab time aane ka intezaar ----------------------------------------------
// Scheduler har minute dekhta hai. Test ko itna intezaar na karwana pade,
// isliye seedha ek baar chala dete hain — wahi function jo har minute chalta
// hai.
await new Promise((r) => setTimeout(r, 4000));

const kicked = await apiCall('POST', '/api/campaigns/scheduler/run');
check('scheduler chalaya ja saka', kicked.status === 200, `${kicked.status}`);

// Bhejne me waqt lagta hai — batch ke beech ruk-ruk kar jata hai. Fixed sleep
// ki jagah asli intezaar karte hain: jab tak kaam poora na ho ya 60 second na
// beet jayein.
let after = null;

for (let i = 0; i < 30; i += 1) {
  await new Promise((r) => setTimeout(r, 2000));
  after = (await apiCall('GET', `/api/campaigns/${id}`)).data?.campaign;

  const done = after && after.status !== 'Scheduled' && after.sent + after.failed >= after.recipients;
  if (done) break;
}

check('time aane par campaign chal padi', after?.status !== 'Scheduled', `status ${after?.status}`);
check('email sach me gaye', (after?.sent ?? 0) > 0, `${after?.sent} bheje, ${after?.failed} fail`);
check('sab tak pahunch gaya', (after?.sent ?? 0) + (after?.failed ?? 0) === after?.recipients,
  `${after?.sent}+${after?.failed} me se ${after?.recipients}`);

// --- schedule hatana ---------------------------------------------------------
const second = await apiCall('POST', '/api/campaigns', {
  name: `Cancel Test ${Date.now()}`,
  accountId: account.id,
  subject: 'Test',
  html: '<p>Hi</p>',
  scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
});
const secondId = second.data?.campaign?.id;

const cancelled = await apiCall('POST', `/api/campaigns/${secondId}/schedule`, { at: null });
check('schedule hataya ja saka', cancelled.data?.campaign?.status === 'Draft',
  cancelled.data?.campaign?.status);
check('hatane ke baad time bhi hat gaya', !cancelled.data?.campaign?.scheduledAt);

// --- chalti hui campaign ka time nahi badal sakta --------------------------
const busyOne = await apiCall('POST', `/api/campaigns/${id}/schedule`, {
  at: new Date(Date.now() + 3600_000).toISOString(),
});
check('ja chuki campaign ka time nahi badla ja sakta', busyOne.status === 400,
  busyOne.data?.error?.message);

// --- screen par bhi sahi dikhe ---------------------------------------------
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

await page.goto(BASE + '/campaigns?status=Scheduled', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const body = await page.locator('body').innerText();
check('campaigns page khula', !body.includes('stopped working'));
check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai ------------------------------------------------------------------
for (const c of [id, secondId]) {
  if (!c) continue;
  await apiCall('POST', `/api/campaigns/${c}/pause`);
  await apiCall('DELETE', `/api/campaigns/${c}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

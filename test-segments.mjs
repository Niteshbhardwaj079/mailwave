// Segments page ka test.
//
// Segment ek SAVED RULE hai, list nahi. Isliye do cheezein sabse zaroori hain:
//   1. ginti har baar taazi giني jaye (purani chipki hui na dikhe)
//   2. rule badalte hi "kitne log aayenge" save karne se PEHLE dikh jaye
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

// --- 1. har condition ki ginti aapas me milti hai --------------------------
const counts = {};
for (const kind of ['opened', 'not_opened', 'clicked', 'not_clicked', 'failed', 'unsubscribed']) {
  const res = await apiCall('POST', '/api/segments/preview', {
    rule: { join: 'and', conditions: [{ kind, value: '' }] },
  });
  counts[kind] = res.data?.count ?? -1;
}
console.log('      ', JSON.stringify(counts));

check('opened aur not_opened alag-alag log hain',
  counts.opened >= 0 && counts.not_opened >= 0 && counts.opened !== counts.not_opened,
  `${counts.opened} vs ${counts.not_opened}`);

// "Kholi nahi" ka matlab: bheji to gayi thi. Jise kabhi mail gayi hi nahi, wo
// ismein nahi aana chahiye — warna ginti poore contact list jitni ho jati.
const total = (await apiCall('GET', '/api/contacts?limit=1')).data?.total ?? 0;
check('"kholi nahi" me sirf wahi hain jinhe mail gayi thi', counts.not_opened < total,
  `${counts.not_opened} me se kul ${total}`);

// --- 2. AND aur OR ka farq padta hai --------------------------------------
const andRes = await apiCall('POST', '/api/segments/preview', {
  rule: { join: 'and', conditions: [{ kind: 'opened', value: '' }, { kind: 'clicked', value: '' }] },
});
const orRes = await apiCall('POST', '/api/segments/preview', {
  rule: { join: 'or', conditions: [{ kind: 'opened', value: '' }, { kind: 'clicked', value: '' }] },
});
check('AND ki ginti OR se zyada nahi', andRes.data.count <= orRes.data.count,
  `AND ${andRes.data.count} / OR ${orRes.data.count}`);

// --- 3. galat condition ruke ----------------------------------------------
const bad = await apiCall('POST', '/api/segments/preview', {
  rule: { join: 'and', conditions: [{ kind: 'nakli_cheez', value: '' }] },
});
check('nakli condition ruki', bad.status === 400, `${bad.status}`);

// --- browser ---------------------------------------------------------------
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

await page.goto(BASE + '/segments', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const body = await page.locator('body').innerText();
check('segments page khula', !body.includes('stopped working'));
check('segment cards dikhe', (await page.locator('.mw-option').count()) > 0);

// Server ki ginti wahi honi chahiye jo screen par dikh rahi hai.
const fromApi = (await apiCall('GET', '/api/segments')).data?.segments ?? [];
const first = fromApi[0];
check('screen ki ginti server se milti hai',
  first ? body.includes(String(first.count)) : false,
  first ? `${first.name} = ${first.count}` : 'koi segment nahi');

// --- 4. builder me live ginti ---------------------------------------------
await page.getByRole('button', { name: /new segment|create segment/i }).first().click();
await page.waitForTimeout(1500);

// Ginti sheet ke andar wale green note me dikhti hai, footer button me nahi.
const countNote = page.locator('.mw-sheet .mw-note--success');
const before = (await countNote.innerText()).trim();
check('builder me ginti dikhi (loading nahi)', /\d/.test(before), before);

// Condition badalne par server se DOBARA poocha jana chahiye.
//
// Sirf number badalne se check nahi karte — do alag rules ka jawab sanyog se
// ek hi number ho sakta hai (aur yahan hota bhi hai). Isliye dekhte hain ki
// request gayi ya nahi.
let previewCalls = 0;
page.on('request', (r) => {
  if (r.url().includes('/api/segments/preview')) previewCalls += 1;
});

await page.selectOption('#segment-c1', 'failed');
await page.waitForTimeout(1500);
check('condition badalne par server se dobara poocha', previewCalls > 0, `${previewCalls} request`);

const after = (await countNote.innerText()).trim();
check('nayi ginti aa gayi', /\d/.test(after), `${before} -> ${after}`);

// --- 5. naya segment save ho -----------------------------------------------
const name = `Test Segment ${Date.now()}`;
await page.fill('#segment-name', name);
await page.getByRole('button', { name: /save segment|^save$/i }).first().click();
await page.waitForTimeout(2000);

const listed = (await apiCall('GET', '/api/segments')).data?.segments ?? [];
const made = listed.find((s) => s.name === name);
check('naya segment server par bana', Boolean(made), made ? `count ${made.count}` : '');
check('naye segment me rule save hua', (made?.rule?.conditions ?? []).length === 2,
  JSON.stringify(made?.rule?.conditions ?? []));

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

if (made) await apiCall('DELETE', `/api/segments/${made.id}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

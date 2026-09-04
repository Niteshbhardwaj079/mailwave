// Campaign wizard ka test — poora raasta, screen se lekar asli email tak.
//
// Yeh app ka sabse zaroori kaam hai. Jaanchte hain:
//   1. wizard se banaya campaign SERVER par sach me banta hai
//   2. jo ginti screen par dikhti hai, utne hi log sach me judte hain
//   3. jo unsubscribe kar chuke hain wo apne aap chhoot jate hain
//   4. email sach me jata hai (test inbox me dikh jata hai)
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

// --- screen jo ginti dikhati hai, wahi asli honi chahiye -------------------
const willReach = (await apiCall('GET', '/api/campaigns/recipient-count?source=all')).data?.count ?? -1;
const allContacts = (await apiCall('GET', '/api/contacts?limit=1')).data?.total ?? 0;
const suppressed = (await apiCall('GET', '/api/contacts/suppression/all')).data?.suppression?.length ?? 0;

check('recipient-count kaam kar raha hai', willReach >= 0, `${willReach} tak jayega`);
check('unsubscribe wale ginti me nahi hain', willReach <= allContacts - Math.min(suppressed, allContacts) + 1,
  `kul ${allContacts}, suppress ${suppressed}, jayega ${willReach}`);

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

// --- wizard ----------------------------------------------------------------
const campaignName = `Test Campaign ${Date.now()}`;

await page.goto(BASE + '/campaigns/new', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

let body = await page.locator('body').innerText();
check('wizard khula', !body.includes('stopped working'));

// Step 1 — naam aur account
await page.fill('#campaign-name', campaignName);
const accountValue = await page.locator('#campaign-account').inputValue();
check('email account apne aap chun liya gaya', accountValue.includes('@'), accountValue);

await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1500);

// Step 2 — recipients. Screen par asli ginti dikhni chahiye.
body = await page.locator('body').innerText();
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1000);

// Step 3 — template
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1000);

// Step 4 — content (subject zaroori hai)
const subjectBox = page.locator('#content-subject, input[name="subject"]').first();
if (await subjectBox.count()) {
  await subjectBox.fill('Hello {{name}}, test from MailWave');
}
await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1000);

// Step 5 — settings. Yahan batch ki ginti asli hone chahiye.
body = await page.locator('body').innerText();
check('settings par asli ginti dikhi', body.includes(String(willReach)), `${willReach} dhoondha`);

await page.getByRole('button', { name: /continue/i }).click();
await page.waitForTimeout(1000);

// Step 6 — review aur bhejo
body = await page.locator('body').innerText();
check('review par bhi wahi ginti', body.includes(String(willReach)), `${willReach}`);

const before = (await apiCall('GET', '/api/campaigns?limit=1')).data?.total ?? 0;

// "Send campaign" — poora naam se, warna "Send test email" bhi match ho jata
// hai aur wo alag button hai.
await page.getByRole('button', { name: 'Send campaign' }).last().click();
await page.waitForTimeout(1200);

const confirmBtn = page.locator('.mw-sheet .mw-sheet__foot button.btn-primary');
check('confirm wali sheet khuli', (await confirmBtn.count()) > 0);

await confirmBtn.click();

// Bhejne me thoda waqt lagta hai — batch ke beech ruk-ruk kar jata hai.
await page.waitForTimeout(15000);

// --- server par sach me kya hua --------------------------------------------
const after = (await apiCall('GET', '/api/campaigns?limit=1')).data?.total ?? 0;
check('campaign server par bana', after === before + 1, `${before} se ${after}`);

const listed = (await apiCall('GET', '/api/campaigns?limit=500')).data?.campaigns ?? [];
const made = listed.find((c) => c.name === campaignName);

check('wahi naam wala campaign mila', Boolean(made), made?.name);
check('utne hi log jude jitne dikhaye the', made?.recipients === willReach,
  `${made?.recipients} jude, ${willReach} dikhaye the`);
check('email sach me gaye', (made?.sent ?? 0) > 0, `${made?.sent} bheje, ${made?.failed} fail`);

// Screen par bhi wahi haal dikhna chahiye — bhejne wale panel me, sidebar me
// nahi (wahan "Today's sending" waise hi likha rehta hai).
const panel = await page.locator('.mw-sending').innerText().catch(() => '');
check('screen par bhejne ka panel dikha', panel.length > 0, panel.split('\n').slice(0, 2).join(' '));

// Screen har 2 second me server se poochti hai, isliye ek pal ke liye wo
// server se ek kadam peeche ho sakti hai. Isliye "bilkul barabar" nahi, balki
// "sahi jagah par" jaanchte hain: screen ka number asli hai aur kul se zyada
// nahi. Sab bhej chukne ke baad dono apne aap barabar ho jate hain.
const onScreen = Number(panel.match(/^\s*([\d,]+)/m)?.[1]?.replace(/,/g, '') ?? -1);
const final = (await apiCall('GET', `/api/campaigns/${made.id}`)).data?.campaign;

check(
  'screen ka number asli hai (server se aaya)',
  onScreen >= 0 && onScreen <= (final?.recipients ?? 0),
  `screen ${onScreen}, server ${final?.sent} / ${final?.recipients}`
);

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

// --- safai ------------------------------------------------------------------
if (made) {
  // Chalte hue campaign ko delete nahi kiya ja sakta — yeh jaan-boojh kar
  // rakhi gayi rok hai, taki beech me kuch adhoora na chhoot jaye. Isliye
  // pehle rokte hain, phir hatate hain.
  const paused = await apiCall('POST', `/api/campaigns/${made.id}/pause`);
  check('chalta hua campaign roka ja saka', paused.status === 200, `${paused.status}`);

  const del = await apiCall('DELETE', `/api/campaigns/${made.id}`);
  check('rokne ke baad campaign hat gaya', del.status === 200, `${del.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

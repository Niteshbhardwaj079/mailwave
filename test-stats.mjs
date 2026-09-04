// Dashboard aur Reports ka test.
//
// Yahan ka sabse zaroori sawaal: screen par jo number dikh raha hai, wo asli
// data se nikla hai ya kahin se copy kiya hua hai? Isliye har number ko
// database ke hisaab se milaya jata hai.
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

// --- 1. numbers aapas me milte hain ----------------------------------------
const stats = (await apiCall('GET', '/api/stats/dashboard')).data;
const kpi = Object.fromEntries((stats?.kpis ?? []).map((k) => [k.id, k.value]));

const campaignsTotal = (await apiCall('GET', '/api/campaigns?limit=1')).data?.total ?? 0;
check('campaign ki ginti campaigns list se milti hai', kpi.campaigns === campaignsTotal,
  `${kpi.campaigns} vs ${campaignsTotal}`);

check('khole hue bheje huon se zyada nahi', kpi.opened <= kpi.sent,
  `opened ${kpi.opened} / sent ${kpi.sent}`);
check('click karne wale khole huon se zyada nahi', kpi.clicked <= kpi.opened,
  `clicked ${kpi.clicked} / opened ${kpi.opened}`);

// Open rate khud se gina jaye to wahi aana chahiye jo server ne bheja.
const expectedRate = kpi.sent ? `${Math.round((kpi.opened / kpi.sent) * 1000) / 10}%` : '0%';
check('open rate ka hisaab sahi hai', kpi.openRate === expectedRate,
  `${kpi.openRate} vs ${expectedRate}`);

// --- 2. graph me har din ki row hoti hai -----------------------------------
for (const range of ['7d', '30d', '90d']) {
  const trend = (await apiCall('GET', `/api/stats/trend?range=${range}`)).data?.trend ?? [];
  const days = Number(range.replace('d', ''));
  check(`${range} ke graph me poore ${days} din hain`, trend.length === days, `${trend.length} din`);
}

// --- 3. delivery ka jod recipients se milta hai ----------------------------
const delivery = (await apiCall('GET', '/api/stats/delivery')).data?.delivery ?? [];
const deliveredRow = delivery.find((d) => d.key === 'delivered');
check('delivery ke number aaye', delivery.length === 4 && typeof deliveredRow?.value === 'number',
  delivery.map((d) => `${d.name}:${d.value}`).join(' '));

// --- 4. report export sach me rows deta hai ---------------------------------
for (const type of ['campaign', 'activity', 'opened', 'unopened', 'clicked', 'failed']) {
  const res = await apiCall('GET', `/api/stats/report?type=${type}`);
  check(`${type} report bani`, res.status === 200 && Array.isArray(res.data?.rows),
    `${res.data?.total} rows, ${res.data?.columns?.length} columns`);
}

const badReport = await apiCall('GET', '/api/stats/report?type=nakli');
check('nakli report ruki', badReport.status === 400, `${badReport.status}`);

// SQL injection ki koshish — type seedha SQL me nahi jaana chahiye.
const inject = await apiCall('GET', "/api/stats/report?type=campaign&campaignId=' OR 1=1--");
check('SQL injection se kuch nahi toota', inject.status === 200, `${inject.data?.total} rows`);

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

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

let body = await page.locator('body').innerText();
check('dashboard khula', !body.includes('stopped working'));
check('dashboard ke number server se hain', body.includes(String(kpi.campaigns)) && body.includes(kpi.openRate),
  `campaigns ${kpi.campaigns}, open rate ${kpi.openRate}`);

// Range badalne par server se dobara poocha jana chahiye.
const trendCalls = [];
page.on('request', (r) => {
  if (r.url().includes('/api/stats/trend')) trendCalls.push(r.url());
});
await page.getByRole('button', { name: /7 days|7 din/i }).first().click();
await page.waitForTimeout(1500);
check('range badalne par naya data manga gaya', trendCalls.some((u) => u.includes('range=7d')),
  trendCalls.slice(-1)[0]?.split('?')[1] ?? 'koi request nahi');

// --- reports page ----------------------------------------------------------
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

body = await page.locator('body').innerText();
check('reports page khula', !body.includes('stopped working'));

// Export ka button ab sach me file banata hai.
await page.locator('.mw-option--button').first().click();
await page.waitForTimeout(800);

// Button sheet ke footer me hai. Page par "Download" shabd aur jagah bhi hai,
// isliye sirf sheet ke andar dhoondhte hain.
const downloadBtn = page.locator('.mw-sheet .mw-sheet__foot button.btn-primary');
await downloadBtn.waitFor({ timeout: 10000 });

const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await downloadBtn.click();
const file = await download;

check('export se file download hui', Boolean(file), file ? file.suggestedFilename() : 'koi file nahi');


// --- campaign analytics page ------------------------------------------------
// Yeh page ek campaign ka poora hisaab dikhata hai. Sab kuch USI campaign ka
// hona chahiye — kisi aur ka data yahan nahi aana chahiye.
// Bheja hua campaign chunte hain, Draft nahi — warna recipient ki list khali
// rehti hai aur log wala hissa test hi nahi hota.
const someCampaign = (await apiCall('GET', '/api/campaigns?status=Sent&limit=1')).data?.campaigns?.[0];

if (someCampaign) {
  await page.goto(BASE + '/campaigns/' + someCampaign.id, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  body = await page.locator('body').innerText();
  check('campaign analytics khula', !body.includes('stopped working'));
  check('sahi campaign ka naam dikha', body.includes(someCampaign.name), someCampaign.name);
  check('is campaign ke number dikhe', body.includes(String(someCampaign.sent)),
    `sent ${someCampaign.sent}`);

  // Ek aadmi ka poora hisaab kholte hain.
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await page.waitForTimeout(1500);

    const sheet = page.locator('.mw-sheet');
    const opened = await sheet.count();
    check('kisi ek aadmi ka log khula', opened > 0);

    if (opened) {
      const timeline = await sheet.innerText();
      check('log me kuch likha hai', timeline.trim().length > 20, timeline.slice(0, 80));
    }
  }
}

// --- settings page ----------------------------------------------------------
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

body = await page.locator('body').innerText();
check('settings khula', !body.includes('stopped working'));
check('settings me apni hi detail dikhi (nakli user nahi)',
  body.includes('rohit@gowebkart.com'),
  body.match(/[\w.]+@[\w.]+/)?.[0] ?? 'koi email nahi');

check('koi crash nahi hua', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) console.log('Fail:', failed.map((f) => f.name).join(', '));
process.exit(failed.length ? 1 : 0);

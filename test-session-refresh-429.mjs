// Session-refresh rate-limit edge case: agar /api/auth/refresh ko baar-baar
// 429 (Too Many Requests) mile, to app ko user ko logout NAHI karna chahiye —
// session shayad ab bhi valid ho, sirf jawaab nahi mila. Sirf 401 (session
// sach me khatam/invalid) par hi turant login dikhana sahi hai.
//
// Real rate limiter ko chhedte nahi (koi zaroorat nahi) — Playwright ke
// page.route() se sirf /api/auth/refresh ka jawaab control karte hain,
// deterministic aur bina kisi shared server state ko disturb kiye. Baaki
// saari calls (login, dashboard data, etc.) asli backend se hi jaati hain.
import { chromium } from 'playwright';

// Website 5173 ya 5174 — jo bhi khuli ho, khud dhoondh lete hain (test-login.mjs
// jaisa hi tarika).
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
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -- ' + extra : ''}`);
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

async function freshSignedInPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'rohit@gowebkart.com');
  await page.fill('#login-password', 'mailwave');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
  return { context, page };
}

// =============================================================================
// Scenario 1: refresh 429s a couple of times, then genuinely succeeds — user
// must end up signed in, never bounced to /login in between.
// =============================================================================
{
  const { context, page } = await freshSignedInPage();
  let refreshCalls = 0;

  await page.route('**/api/auth/refresh', async (route) => {
    refreshCalls += 1;
    if (refreshCalls <= 2) {
      await route.fulfill({ status: 429, body: '' });
    } else {
      // Teesri koshish asli backend tak jaane do — real cookie abhi bhi
      // valid hai, isliye yeh genuinely safal hogi.
      await route.continue();
    }
  });

  // Reload shuru karo (backoff poora khatam hone ka wait NAHI karte — sirf
  // navigation commit hone tak) taaki uske turant baad, retries ke BEECH me,
  // URL ko poll kar sakein.
  await page.reload({ waitUntil: 'commit' });

  // React Router ka client-side redirect (<Navigate>) Playwright ka
  // 'framenavigated' event fire NAHI karta (wo sirf real document navigation
  // ke liye hai) — isliye URL ko poll karte hain taaki backoff ke BEECH me
  // ek pal ke liye bhi /login par gaya ho to pakda jaaye.
  let sawLoginDuringRetry = false;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 5000) {
    if (page.url().includes('/login')) {
      sawLoginDuringRetry = true;
      break;
    }
    await page.waitForTimeout(100);
  }
  await page.waitForLoadState('networkidle').catch(() => {});

  check(
    'Scenario 1: kabhi bhi /login par nahi bheja gaya (429 ke bawajood)',
    !sawLoginDuringRetry && !page.url().includes('/login'),
    page.url()
  );
  check('Scenario 1: aakhir me sign-in state hi dikh rahi hai (header search visible)', await page.locator('#global-search').isVisible().catch(() => false), '');
  check('Scenario 1: refresh calls bounded rahin (429+429+safal = 3, retries ki hadd se kam)', refreshCalls <= 3, `refreshCalls=${refreshCalls}`);

  await context.close();
}

// =============================================================================
// Scenario 2: refresh HAMESHA 429 deta hai (kabhi resolve nahi hota) — user
// ko na to /login bheja jaaye, na hi hamesha ke liye chup-chap spinner me
// atka chhoda jaaye. Bounded retries khatam hone ke baad ek "Try again"
// screen dikhni chahiye, aur retry count kabhi hadd se zyada nahi jaani
// chahiye (rate limiter khud par aur zyada bojh na banein).
// =============================================================================
{
  const { context, page } = await freshSignedInPage();
  let refreshCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/refresh')) refreshCalls += 1;
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 429, body: '' });
  });

  await page.reload({ waitUntil: 'networkidle' });
  // Bounded backoff poora khatam hone ka intezaar: 1+2+4+8 = 15s + thoda buffer.
  await page.waitForTimeout(17000);

  check('Scenario 2: hamesha 429 milne par bhi /login par NAHI bheja gaya', !page.url().includes('/login'), page.url());
  check(
    'Scenario 2: "dobara koshish karein" screen dikh rahi hai (na blank, na hamesha loading)',
    await page.locator('button:has-text("Try again")').isVisible().catch(() => false),
    ''
  );
  check(
    'Scenario 2: retry count bounded rahi (1 pehli + zyada se zyada 4 retries = 5)',
    refreshCalls >= 1 && refreshCalls <= 5,
    `refreshCalls=${refreshCalls}`
  );

  // Route hata kar "Try again" dabao — ab asli backend se safal hona chahiye.
  await page.unroute('**/api/auth/refresh');
  await page.click('button:has-text("Try again")');
  await page.waitForTimeout(2000);
  check('Scenario 2: "Try again" ke baad real session se sign-in ho jaata hai', !page.url().includes('/login'), page.url());

  await context.close();
}

// =============================================================================
// Scenario 3: session SACH ME khatam/invalid (401) — turant login dikhana
// chahiye, koi bewajah retry na ho (401 par retry karna waqt aur requests
// dono barbaad karta hai).
// =============================================================================
{
  const { context, page } = await freshSignedInPage();
  let refreshCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/refresh')) refreshCalls += 1;
  });
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({ status: 401, body: '' });
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForURL((u) => u.pathname.includes('/login'), { timeout: 8000 }).catch(() => {});

  check('Scenario 3: 401 (sach me expired) par turant /login dikhaya gaya', page.url().includes('/login'), page.url());
  check('Scenario 3: 401 par koi retry nahi hui (sirf 1 hi call)', refreshCalls === 1, `refreshCalls=${refreshCalls}`);

  await context.close();
}

// =============================================================================
// Scenario 4 (regression): koi interception nahi — normal, safal refresh ab
// bhi pehle jaisa hi turant kaam karta hai. Is fix se aam, rozana wala
// mamla dheema/toot na jaaye.
// =============================================================================
{
  const { context, page } = await freshSignedInPage();
  let refreshCalls = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/auth/refresh')) refreshCalls += 1;
  });

  const start = Date.now();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const elapsedMs = Date.now() - start;

  check('Scenario 4: normal reload par turant sign-in rehta hai (koi delay nahi)', !page.url().includes('/login'), page.url());
  check('Scenario 4: sirf ek hi refresh call hui (koi fazool retry nahi)', refreshCalls === 1, `refreshCalls=${refreshCalls}`);
  check('Scenario 4: jaldi settle hua (< 3s, backoff ka koi asar nahi)', elapsedMs < 3000, `${elapsedMs}ms`);

  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);

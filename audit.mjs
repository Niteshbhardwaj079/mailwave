// UI smoke test. Walks every route in three viewports and two themes and
// reports anything that looks broken: sideways scroll, untranslated keys,
// elements wider than the screen, dead images, unnamed buttons.
//
//   npm run dev            # in one terminal
//   npm run audit          # in another
//
// Optional environment variables:
//   BASE            the running app       (default http://localhost:5173)
//   SHOTS           where screenshots go  (default ./audit-shots)
//   CHROMIUM_PATH   a browser to use instead of Playwright's own download
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE || 'http://localhost:5173';
const shotsDir = process.env.SHOTS || 'audit-shots';

await mkdir(shotsDir, { recursive: true });

// Routes reachable without signing in. They are audited with the session
// cleared, so the login screen is really the login screen.
const publicRoutes = [
  ['login', '/login'],
  ['reset', '/reset-password?token=abc123'],
  ['setpwd', '/set-password?token=abc123'],
  ['badlink', '/reset-password'],
  ['tplpreview', '/templates/t2/preview'],
];

// Everything behind <RequireAuth>.
const appRoutes = [
  ['dashboard', '/'],
  ['campaigns', '/campaigns'],
  ['wizard', '/campaigns/new'],
  ['analytics', '/campaigns/cmp_1041'],
  ['contacts', '/contacts'],
  ['import', '/contacts/import'],
  ['segments', '/segments'],
  ['templates', '/templates'],
  ['editor', '/templates/new'],
  ['reports', '/reports'],
  ['accounts', '/accounts'],
  ['connect', '/accounts/connect'],
  ['settings', '/settings'],
  ['guide', '/guide'],
  ['users', '/users'],
  ['activity', '/activity'],
  ['sysmail', '/system-emails'],
  ['onboarding', '/onboarding'],
  ['notfound', '/does-not-exist'],
];

const viewports = [
  ['desktop', 1440, 900],
  ['tablet', 834, 1112],
  ['mobile', 390, 844],
];

const problems = [];

// Falls back to the browser Playwright installs with `npx playwright install chromium`.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

for (const theme of ['light', 'dark']) {
  for (const [vpName, width, height] of viewports) {
    // dark mode only checked on desktop + mobile to keep the run short
    if (theme === 'dark' && vpName === 'tablet') continue;

    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('Failed to load resource')) {
        problems.push(`[console] ${theme}/${vpName} ${page.url()} :: ${text}`);
      }
    });
    page.on('pageerror', (err) => {
      problems.push(`[crash] ${theme}/${vpName} ${page.url()} :: ${err.message}`);
    });

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

    async function setSession(signedIn) {
      await page.evaluate(
        ({ t, signedIn: signIn }) => {
          window.localStorage.setItem('mailwave.theme', t);
          window.localStorage.setItem('mailwave.language', 'en');
          window.localStorage.setItem('mailwave.accent', 'indigo');
          // Without a session <RequireAuth> bounces every app route to /login,
          // so the whole run would only ever audit the login screen.
          if (signIn) {
            window.localStorage.setItem(
              'mailwave.session',
              JSON.stringify({ id: 'u1', name: 'Rohit Sharma', email: 'rohit@gowebkart.com', initials: 'RS' })
            );
          } else {
            window.localStorage.removeItem('mailwave.session');
          }
        },
        { t: theme, signedIn }
      );
    }

    await auditRoutes(publicRoutes, false);
    await auditRoutes(appRoutes, true);

    async function auditRoutes(list, signedIn) {
      await setSession(signedIn);

      for (const [name, path] of list) {
        await page.goto(base + path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(450);

        // 1. horizontal overflow of the page body
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (overflow > 2) {
          problems.push(`[overflow] ${theme}/${vpName} ${path} :: page scrolls sideways by ${overflow}px`);
        }

        // 2. untranslated keys leaking through (a raw key like "camp.title" on screen)
        const rawKeys = await page.evaluate(() => {
          const text = document.body.innerText || '';
          const matches = text.match(
            /\b(nav|common|dash|kpi|camp|filter|tpl|img|guide|users|role|log|action|acc|con|rep|set|theme|auth|sysmail|help|note|wiz|rec|imp|ob|nf|perm|sub|topbar|info|send|rev|smtp|seg|content)\.[a-zA-Z0-9.]+/g
          );
          return matches ? Array.from(new Set(matches)).slice(0, 5) : [];
        });
        if (rawKeys.length) {
          problems.push(`[i18n] ${theme}/${vpName} ${path} :: raw keys on screen: ${rawKeys.join(', ')}`);
        }

        // 3. elements wider than the viewport
        const wide = await page.evaluate((vw) => {
          const bad = [];
          document.querySelectorAll('main *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > vw + 4 && r.height > 0) {
              const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
              bad.push(`${el.tagName.toLowerCase()}.${cls}(${Math.round(r.width)}px)`);
            }
          });
          return Array.from(new Set(bad)).slice(0, 3);
        }, width);
        if (wide.length) {
          problems.push(`[wide] ${theme}/${vpName} ${path} :: ${wide.join(', ')}`);
        }

        // 4. images that failed to load
        const brokenImages = await page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.src.slice(0, 60))
        );
        if (brokenImages.length) {
          problems.push(`[image] ${theme}/${vpName} ${path} :: ${brokenImages.join(', ')}`);
        }

        // 5. buttons with no accessible name
        const namelessButtons = await page.evaluate(() => {
          let count = 0;
          document.querySelectorAll('button').forEach((b) => {
            const label = (b.innerText || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title');
            if (!label) count += 1;
          });
          return count;
        });
        if (namelessButtons > 0) {
          problems.push(`[a11y] ${theme}/${vpName} ${path} :: ${namelessButtons} button(s) with no name`);
        }

        if (theme === 'light' && vpName === 'desktop') {
          await page.screenshot({ path: `${shotsDir}/audit-${name}.png`, fullPage: true });
        }
      }
    }

    await ctx.close();
  }
}

await browser.close();

if (problems.length === 0) {
  console.log('CLEAN — no problems found');
} else {
  console.log(`${problems.length} problem(s):`);
  console.log(problems.join('\n'));
}

// Non-zero exit so this can gate a build.
process.exit(problems.length === 0 ? 0 : 1);

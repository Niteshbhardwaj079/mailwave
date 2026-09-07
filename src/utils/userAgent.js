// Raw tracking-pixel User-Agent strings ("Mozilla/5.0 (Linux; Android 14...)
// AppleWebKit/537.36 ... Chrome/138.0.0.0 Mobile Safari/537.36") are useless
// to a non-technical client. This turns one into "📱 Android · Chrome 138" —
// display-only, the raw string sent by the browser is never changed or lost,
// just not shown as-is.

const OS_PATTERNS = [
  { test: /Android/i, label: 'Android', mobile: true },
  { test: /iPhone|iPad|iPod/i, label: 'iOS', mobile: true },
  { test: /Windows/i, label: 'Windows', mobile: false },
  { test: /Mac OS X|Macintosh/i, label: 'macOS', mobile: false },
  { test: /CrOS/i, label: 'ChromeOS', mobile: false },
  { test: /Linux/i, label: 'Linux', mobile: false },
];

// Order matters — Edge/Opera/Samsung Internet/Chrome-on-iOS UAs all also
// contain "Chrome/", and real Chrome also contains "Safari/", so the more
// specific tokens must be checked first.
const BROWSER_PATTERNS = [
  { test: /Edg(?:A|iOS)?\/([\d.]+)/i, label: 'Edge' },
  { test: /OPR\/([\d.]+)/i, label: 'Opera' },
  { test: /SamsungBrowser\/([\d.]+)/i, label: 'Samsung Internet' },
  { test: /FxiOS\/([\d.]+)/i, label: 'Firefox' },
  { test: /Firefox\/([\d.]+)/i, label: 'Firefox' },
  { test: /CriOS\/([\d.]+)/i, label: 'Chrome' },
  { test: /Chrome\/([\d.]+)/i, label: 'Chrome' },
  { test: /Version\/([\d.]+).*Safari/i, label: 'Safari' },
];

/** A raw User-Agent string, formatted as "📱 Android · Chrome 138". Returns null if `ua` is empty. */
export function formatUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return null;

  const os = OS_PATTERNS.find((entry) => entry.test.test(ua));
  const icon = os?.mobile ? '📱' : '🖥️';
  const osLabel = os?.label ?? 'Unknown device';

  const browser = BROWSER_PATTERNS.find((entry) => entry.test.test(ua));
  let browserLabel = 'Unknown browser';
  if (browser) {
    const version = ua.match(browser.test)?.[1]?.split('.')[0];
    browserLabel = version ? `${browser.label} ${version}` : browser.label;
  }

  return `${icon} ${osLabel} · ${browserLabel}`;
}

/** True for a raw browser User-Agent string (as opposed to a URL, error message, etc.). */
export function looksLikeUserAgent(value) {
  return typeof value === 'string' && /^Mozilla\//.test(value);
}

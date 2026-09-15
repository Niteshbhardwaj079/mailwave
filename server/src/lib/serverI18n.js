// ---------------------------------------------------------------------------
// Backend-generated dynamic text (Activity Log entries, storage test
// results, etc.) needs to follow the SAME language the user has picked in
// the topbar — not a fixed English string. Rather than keeping a second,
// separate translation dictionary here, this reuses the frontend's own
// src/i18n/locales/*.js files directly (same cross-import pattern already
// used by routes/systemEmails.js for system_emails translations).
//
// The frontend sends the currently-selected language on every request as
// the `X-App-Language` header (see src/api/client.js) — there is no
// database column for "current UI language" because that picker is a
// per-browser choice, not an account setting (users.language is a
// different thing: the language *emails* are sent in).
// ---------------------------------------------------------------------------
import en from '../../../src/i18n/locales/en.js';

const loaders = {
  hi: () => import('../../../src/i18n/locales/hi.js'),
  'hi-Latn': () => import('../../../src/i18n/locales/hi-Latn.js'),
  gu: () => import('../../../src/i18n/locales/gu.js'),
  mr: () => import('../../../src/i18n/locales/mr.js'),
  bn: () => import('../../../src/i18n/locales/bn.js'),
  ta: () => import('../../../src/i18n/locales/ta.js'),
  te: () => import('../../../src/i18n/locales/te.js'),
  ml: () => import('../../../src/i18n/locales/ml.js'),
  kn: () => import('../../../src/i18n/locales/kn.js'),
  pa: () => import('../../../src/i18n/locales/pa.js'),
  ar: () => import('../../../src/i18n/locales/ar.js'),
  es: () => import('../../../src/i18n/locales/es.js'),
  fr: () => import('../../../src/i18n/locales/fr.js'),
  de: () => import('../../../src/i18n/locales/de.js'),
  pt: () => import('../../../src/i18n/locales/pt.js'),
  zh: () => import('../../../src/i18n/locales/zh.js'),
  ru: () => import('../../../src/i18n/locales/ru.js'),
  th: () => import('../../../src/i18n/locales/th.js'),
  ja: () => import('../../../src/i18n/locales/ja.js'),
  ko: () => import('../../../src/i18n/locales/ko.js'),
};

const cache = { en };

async function dictFor(code) {
  if (cache[code]) return cache[code];
  const loader = loaders[code];
  if (!loader) return en;
  try {
    const mod = await loader();
    cache[code] = mod.default;
    return cache[code];
  } catch (error) {
    // Chunk missing/broken — English is always a usable fallback.
    return en;
  }
}

/** Which language a request should be answered in — never trusts an unknown code. */
export function reqLanguage(req) {
  const header = req?.get?.('x-app-language');
  if (header && (header === 'en' || loaders[header])) return header;
  return 'en';
}

function interpolate(text, params) {
  if (!params) return text;
  return Object.keys(params).reduce(
    (result, name) => result.split(`{${name}}`).join(String(params[name])),
    text
  );
}

// A few Activity Log entries are 0-3 independent fragments joined with ", "
// (e.g. "Role: X to Y, Status: A to B") — each fragment needs its own key
// since the set of fragments varies per edit. This reserved key carries an
// array of [partKey, partParams] tuples in `params.parts` instead of a
// template string; both st()/stFor() translate each part then join them.
const JOINED_KEY = 'act.__joined';

async function render(dict, key, params) {
  if (key === JOINED_KEY) {
    const parts = await Promise.all(
      (params?.parts ?? []).map(([partKey, partParams]) => {
        const text = dict[partKey] ?? en[partKey] ?? partKey;
        return interpolate(text, partParams);
      })
    );
    return parts.join(', ');
  }
  const text = dict[key] ?? en[key] ?? key;
  return interpolate(text, params);
}

/**
 * Translates one key for the language the request asked for (English
 * fallback for anything missing, exactly like the frontend's own t()).
 */
export async function st(req, key, params) {
  const language = reqLanguage(req);
  const dict = await dictFor(language);
  return render(dict, key, params);
}

/** Same translation, but for a language code directly (no request object) — used when re-rendering stored Activity Log rows for a viewer. */
export async function stFor(language, key, params) {
  const dict = await dictFor(language === 'en' || loaders[language] ? language : 'en');
  return render(dict, key, params);
}

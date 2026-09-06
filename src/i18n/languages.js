import en from './locales/en';

// ---------------------------------------------------------------------------
// Only English is bundled with the app. It is the fallback for every missing
// key, so it has to be there the moment the app starts.
//
// The rest are separate chunks, fetched when someone actually picks
// that language — a Hindi user never downloads Arabic, Chinese and Tamil.
// While a dictionary is still on its way, t() falls back to English, which is
// exactly what it already does for a key a translator has not filled in yet.
//
// To add another language:
//   1. copy src/i18n/locales/en.js to e.g. locales/id.js and translate the values
//   2. add one line to `loaders` below
//   3. add one row to LANGUAGES below
// Nothing else in the app needs to change.
// ---------------------------------------------------------------------------
const loaders = {
  hi: () => import('./locales/hi'),
  gu: () => import('./locales/gu'),
  mr: () => import('./locales/mr'),
  bn: () => import('./locales/bn'),
  ta: () => import('./locales/ta'),
  ar: () => import('./locales/ar'),
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  pt: () => import('./locales/pt'),
  zh: () => import('./locales/zh'),
  ru: () => import('./locales/ru'),
  th: () => import('./locales/th'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
};

export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English', flag: '🇬🇧', locale: 'en-IN', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', flag: '🇮🇳', locale: 'hi-IN', dir: 'ltr' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati', flag: '🇮🇳', locale: 'gu-IN', dir: 'ltr' },
  { code: 'mr', native: 'मराठी', english: 'Marathi', flag: '🇮🇳', locale: 'mr-IN', dir: 'ltr' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', flag: '🇧🇩', locale: 'bn-IN', dir: 'ltr' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil', flag: '🇮🇳', locale: 'ta-IN', dir: 'ltr' },
  { code: 'ar', native: 'العربية', english: 'Arabic', flag: '🇸🇦', locale: 'ar', dir: 'rtl' },
  { code: 'es', native: 'Español', english: 'Spanish', flag: '🇪🇸', locale: 'es-ES', dir: 'ltr' },
  { code: 'fr', native: 'Français', english: 'French', flag: '🇫🇷', locale: 'fr-FR', dir: 'ltr' },
  { code: 'de', native: 'Deutsch', english: 'German', flag: '🇩🇪', locale: 'de-DE', dir: 'ltr' },
  { code: 'pt', native: 'Português', english: 'Portuguese', flag: '🇧🇷', locale: 'pt-BR', dir: 'ltr' },
  { code: 'zh', native: '简体中文', english: 'Chinese (Simplified)', flag: '🇨🇳', locale: 'zh-CN', dir: 'ltr' },
  { code: 'ru', native: 'Русский', english: 'Russian', flag: '🇷🇺', locale: 'ru-RU', dir: 'ltr' },
  { code: 'th', native: 'ไทย', english: 'Thai', flag: '🇹🇭', locale: 'th-TH', dir: 'ltr' },
  { code: 'ja', native: '日本語', english: 'Japanese', flag: '🇯🇵', locale: 'ja-JP', dir: 'ltr' },
  { code: 'ko', native: '한국어', english: 'Korean', flag: '🇰🇷', locale: 'ko-KR', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

/** Number and date formatting locale used before a language is chosen. */
export const DEFAULT_LOCALE = 'en-IN';

/** Always available, and the fallback for anything a translation is missing. */
export const englishDictionary = en;

export function findLanguage(code) {
  return LANGUAGES.find((language) => language.code === code) || LANGUAGES[0];
}

const cache = { [DEFAULT_LANGUAGE]: en };

/**
 * The dictionary for `code` if its chunk has already arrived, otherwise null.
 * The provider reads this during render so a language that is already loaded
 * appears instantly, with no flash of English.
 */
export function cachedDictionary(code) {
  return cache[code] || null;
}

/** Fetches a dictionary once and remembers it. Never rejects. */
export function loadDictionary(code) {
  if (cache[code]) return Promise.resolve(cache[code]);

  const loader = loaders[code];
  if (!loader) return Promise.resolve(en);

  return loader().then(
    (module) => {
      cache[code] = module.default;
      return cache[code];
    },
    // A chunk that fails to download (offline, bad deploy) must not take the
    // app with it — English is a perfectly usable fallback.
    () => en
  );
}

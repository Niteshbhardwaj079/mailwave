// Kept in sync by hand with src/i18n/languages.js's LANGUAGES array. Only the
// codes are needed on the backend, for Zod validation — the frontend owns the
// native names/flags/locale metadata.
export const LANGUAGE_CODES = [
  'en',
  'hi',
  'hi-Latn',
  'gu',
  'mr',
  'bn',
  'ta',
  'ar',
  'es',
  'fr',
  'de',
  'pt',
  'zh',
  'ru',
  'th',
  'ja',
  'ko',
];

export const DEFAULT_LANGUAGE = 'en';

export function isValidLanguage(code) {
  return LANGUAGE_CODES.includes(code);
}

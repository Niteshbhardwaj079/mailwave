// Small formatting helpers shared by every page.
//
// Numbers and dates must follow the language the user picked, not a fixed
// Indian/British format. Every helper takes an optional locale; when it is
// left out they use the one <I18nProvider> last set, so the hundreds of
// existing call sites keep working without passing it down by hand.

import { DEFAULT_LOCALE } from '../i18n/languages';

let activeLocale = DEFAULT_LOCALE;

/** Called by <I18nProvider> whenever the chosen language changes. */
export function setActiveLocale(locale) {
  activeLocale = locale || DEFAULT_LOCALE;
}

export function getActiveLocale() {
  return activeLocale;
}

export function formatNumber(value, locale = activeLocale) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return value.toLocaleString(locale);
}

export function formatCompact(value, locale = activeLocale) {
  if (typeof value !== 'number') return value;
  if (value >= 1000000) return `${(value / 1000000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`;
  if (value >= 1000) return `${(value / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
  return value.toLocaleString(locale);
}

export function percent(part, total, digits = 1, locale = activeLocale) {
  if (!total) return formatPercentValue(0, digits, locale);
  return formatPercentValue((part / total) * 100, digits, locale);
}

function formatPercentValue(value, digits, locale) {
  return `${value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function percentValue(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns a generated width utility class instead of an inline style,
 * e.g. widthClass(63.4) -> "mw-w-63".
 */
export function widthClass(percentage) {
  return `mw-w-${Math.round(clamp(percentage || 0, 0, 100))}`;
}

export function formatDate(iso, locale = activeLocale) {
  if (!iso || iso === '—') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function initialsOf(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

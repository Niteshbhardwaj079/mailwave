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

/**
 * Date ke saath time bhi — activity log jaisi jagah ke liye.
 *
 * Server se time hamesha poore ISO roop me aata hai
 * ("2026-08-29T06:40:13.453Z"). Wo screen par waise hi dikha dena bahut bura
 * lagta hai, isliye har jagah yahi se guzaar kar dikhate hain.
 *
 * Time apne aap dekhne wale ke apne time zone me badal jata hai — Mumbai me
 * baitha aadmi Mumbai ka waqt dekhega.
 */
export function formatDateTime(iso, locale = activeLocale) {
  if (!iso || iso === '—') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * "2h ago" jaisi chhoti si duration — notifications ke liye. Purani cheez ke
 * liye poori tareekh hi behtar hai, isliye 7 din se zyada purane par
 * formatDateTime par gir jaate hain.
 */
export function formatRelative(iso, t, locale = activeLocale) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minsAgo', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });

  const days = Math.floor(hours / 24);
  if (days === 1) return t('time.yesterday');
  if (days < 7) return t('time.daysAgo', { count: days });

  return formatDateTime(iso, locale);
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

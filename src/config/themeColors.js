// ---------------------------------------------------------------------------
// Accent colours the user can pick from.
//
// The real CSS lives in src/styles/_theme.scss under [data-accent="<key>"].
// The hex values below are only needed by the charts, because Recharts draws
// on an SVG canvas and takes a colour as a prop, not as a CSS class.
//
// To add a colour: add a row here AND one block in _theme.scss. Keep the hex
// values in the two files the same.
// ---------------------------------------------------------------------------

export const ACCENTS = [
  { key: 'indigo', labelKey: 'theme.indigo', hex: '#4f46e5' },
  { key: 'blue', labelKey: 'theme.blue', hex: '#2563eb' },
  { key: 'teal', labelKey: 'theme.teal', hex: '#0d9488' },
  { key: 'green', labelKey: 'theme.green', hex: '#16a34a' },
  { key: 'amber', labelKey: 'theme.amber', hex: '#d97706' },
  { key: 'rose', labelKey: 'theme.rose', hex: '#e11d48' },
  { key: 'purple', labelKey: 'theme.purple', hex: '#9333ea' },
  { key: 'slate', labelKey: 'theme.slate', hex: '#475569' },
];

export const THEME_MODES = [
  { key: 'light', labelKey: 'theme.light', icon: 'bi-sun' },
  { key: 'dark', labelKey: 'theme.dark', icon: 'bi-moon-stars' },
  { key: 'system', labelKey: 'theme.system', icon: 'bi-circle-half' },
];

export function findAccent(key) {
  return ACCENTS.find((accent) => accent.key === key) || ACCENTS[0];
}

// ---------------------------------------------------------------------------
// "Dynamic Fields" — a WordPress-custom-fields-style friendly layer over the
// {{var}} tokens the send pipeline already understands
// (server/src/services/render.js's mergeVariables()). The client only ever
// sees a label like "Customer Name"; the {{customer_name}}-style token is an
// implementation detail handled automatically.
//
// Built-ins map to the REAL keys the send pipeline already fills in
// (server/src/services/render.js's buildEmail() `data` object) — name,
// email, company, phone, city, subscribe_url, unsubscribe_url — just with a
// friendly label instead of the raw key. Anything a client adds beyond that
// (their own "Order Number" etc.) is a real {{token}}, safely rendered blank
// at send time until a real data source for it exists — exactly the existing
// mergeVariables() fallback, nothing new to build there.
//
// Shared frontend+backend file (plain JS), same convention as
// templateBuilder.js / systemEmailTranslations.js.
// ---------------------------------------------------------------------------

export const BUILTIN_DYNAMIC_FIELDS = [{ key: 'subscribe_url', label: 'Subscribe Link', preview: '#' }].map((f) => ({
  ...f,
  builtin: true,
}));

export const BUILTIN_DYNAMIC_FIELD_KEYS = BUILTIN_DYNAMIC_FIELDS.map((f) => f.key);

const KEY_RE = /^[a-z][a-z0-9_]{0,49}$/;

export function isValidFieldKey(key) {
  return KEY_RE.test(String(key || ''));
}

/** "Order Number" -> "order_number". Never starts with a digit — {{1abc}} is not a valid token anywhere in the app. */
export function slugifyFieldLabel(label) {
  const base = String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base && /^[a-z]/.test(base) ? base : `field_${base || 'x'}`;
}

/** Guarantees a key that collides with neither a built-in nor an existing custom field. */
export function uniqueFieldKey(label, existingKeys) {
  const reserved = new Set([...BUILTIN_DYNAMIC_FIELD_KEYS, ...existingKeys]);
  const base = slugifyFieldLabel(label);
  if (!reserved.has(base)) return base;
  let n = 2;
  while (reserved.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

/** Built-ins + this workspace's custom fields (from GET /api/settings -> settings.dynamicFields), ready for any picker. */
export function combineDynamicFields(customFields = []) {
  return [...BUILTIN_DYNAMIC_FIELDS, ...customFields.map((f) => ({ ...f, builtin: false }))];
}

export function previewValueFor(field) {
  if (field?.preview) return field.preview;
  return field?.label ? `[${field.label}]` : '';
}

/** camelCase/snake_case key -> "Title Case" guess, for tokens with no catalog entry (e.g. legacy {{app_name}}). */
function guessLabelFromKey(key) {
  return String(key)
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Preview-only substitution — never used for the saved html/subject, only
 * for what TemplateEditorPage shows in the live preview pane. Known fields
 * get a realistic sample; anything else still gets a readable bracketed
 * guess instead of a raw {{token}}, so the preview never looks broken.
 */
export function fillDynamicPreview(text, fields) {
  if (!text) return '';
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const field = byKey.get(key);
    if (field) return previewValueFor(field);
    return `[${guessLabelFromKey(key)}]`;
  });
}

// ---------------------------------------------------------------------------
// Structured campaign-template builder — WordPress ACF-style.
//
// Design tab ke saare fields (Heading, Logo, Website, Footer Text, Mobile
// Number, Custom Link, Social Link, ...) sirf DATA hain — har ek ki apni
// friendly label + auto-generated {{key}} hoti hai (bilkul global Dynamic
// Fields, src/data/dynamicFields.js, jaisa hi, bas is EK TEMPLATE ke andar).
// Client khud CHOOSE karta hai ki wo token Code tab ke raw HTML me KAHAN
// rakhna hai — Design tab kabhi khud HTML generate/regenerate nahi karta.
// renderTemplateHtml() sirf ek ONE-TIME "starter scaffold" banane ke liye
// bacha hai (naya blank template, ya "Starters" se koi default template
// starting point ke roop me choose karna) — uske baad html poori tarah
// independent, freely-editable text hai.
//
// resolveTemplateFieldTokens() preview dikhane aur campaign freeze hone se
// THEEK PEHLE chalta hai — is TEMPLATE ke apne {{key}} tokens ko unki asli
// value se badalta hai (Code tab me template khud save hoti hai HAMESHA
// literal token ke saath, taaki reload par wahi token wapas dikhe). Sirf
// recipient/global tokens ({{name}}, {{company}}, {{unsubscribe_url}}, ...)
// jaise-ke-taise pass through hote hain — unhe asli value send time par
// (server/src/services/render.js) milti hai.
//
// Yeh file frontend (Vite) aur backend (Node, server/src/db/seed.js se
// relative import) dono me chalti hai — isliye plain JS, koi browser/Node-
// khaas API nahi. systemEmailTranslations.js jaisa hi convention.
// ---------------------------------------------------------------------------
import { uniqueFieldKey } from './dynamicFields.js';

/**
 * Har email client (khaaskar Outlook) sirf Arial jaisa system font bharose se
 * render karta hai — isliye font ab client ke chunne ki cheez hi nahi hai,
 * hamesha yehi lagta hai.
 */
export const EMAIL_SAFE_FONT = 'Arial,Helvetica,sans-serif';

/**
 * Social links ke liye jaana-pehchana platforms — bas dropdown se chunne ke
 * liye (label auto-bhar jaata hai). Email me KABHI icon-image ke roop me
 * render nahi hote — sirf ek saaf, clickable TEXT link (jaise
 * "Instagram" -> https://...) — image-only social icon email clients me
 * bharose ke layak nahi (block ho sakte hain), isliye text hi asli/sirf
 * tareeka hai.
 */
export const SOCIAL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'other', label: 'Website / Other' },
];

export function findSocialPlatform(id) {
  return SOCIAL_PLATFORMS.find((p) => p.id === id) || SOCIAL_PLATFORMS[SOCIAL_PLATFORMS.length - 1];
}

/** Logo/Brand/Website/Unsubscribe-text hamesha maujood, single (list nahi) fields hain — inki key kabhi nahi badalti. */
export const RESERVED_TEMPLATE_KEYS = ['logo_url', 'brand_name', 'website_url', 'unsubscribe_text'];

export const DEFAULT_SCHEMA = {
  accentColor: '#4f46e5',
  backgroundColor: '#f4f5fa',
  cardColor: '#ffffff',
  fontFamily: EMAIL_SAFE_FONT,
  logoUrl: '',
  brandName: '',
  websiteUrl: '',
  // Ek nayi/khaali template hamesha ek shuruaati Heading + Text field ke
  // saath khulti hai — Code tab me kuch bhi likha jaaye, yeh list kabhi
  // khud-ba-khud khaali/hidden nahi hoti (WordPress custom-fields jaisa).
  fields: [
    { id: 'f_heading', label: 'Heading', key: 'heading', type: 'heading', value: '', keyLocked: true },
    { id: 'f_body', label: 'Body text', key: 'body', type: 'richtext', value: '', keyLocked: true },
  ],
  footerTexts: [],
  mobileNumbers: [],
  customLinks: [],
  socialLinks: [],
  unsubscribeText: 'Unsubscribe from these emails',
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

/** "+91 98765 43210" -> "+919876543210" — sirf href="tel:" ke liye, dikhne wala text jaisa-ka-taisa rehta hai. */
function telHref(value) {
  return String(value ?? '').replace(/(?!^\+)[^\d]/g, '');
}

const STANDARD_TEXT_STYLE = 'margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151';

/** Purane { type:'paragraph', text } block ko naye richtext field ki value (poora HTML fragment) me badalta hai. */
function legacyParagraphToRichValue(text) {
  const html = String(text ?? '').replace(/\n/g, '<br />');
  return `<p style="${STANDARD_TEXT_STYLE}">${html}</p>`;
}

let legacyKeyCounter = 0;
function legacyKey(prefix) {
  legacyKeyCounter += 1;
  return `${prefix}_${legacyKeyCounter}`;
}

/**
 * Purane schema shapes ko naye (id/key-wale) shape me badalta hai, bina kisi
 * stored row ko chhue — sirf render/edit karte waqt, in-memory. Isliye purani
 * templates (14 default samet) kabhi dobara save kiye bina bhi sahi
 * dikhti/render hoti rehti hain. Purane shapes handle hote hain:
 *   1. { heading, blocks: [...] }                        (is feature se pehle)
 *   2. { fields: [...] }                                 (abhi ka, jaisa-ka-taisa)
 *   3. footerTexts/mobileNumbers: string[]                (apni {{key}} kabhi nahi thi)
 *   4. customLinks: {label,url}[], socialLinks: {platform,url}[]  (apni {{key}} kabhi nahi thi)
 *
 * `fields` kabhi `null` nahi lautata — hamesha ek array (khaali ho sakta hai),
 * kyunki "Code tab me hand-edit karne se Design tab ki fields gayab ho jaati
 * hain" wala purana behavior hata diya gaya hai (ACF jaisa: dono independent).
 */
export function normalizeSchema(schemaInput) {
  // Legacy-check karne ke liye ASLI input dekhte hain, DEFAULT_SCHEMA se
  // merge karne se PEHLE — warna DEFAULT_SCHEMA.fields (do khaali starter
  // fields) hamesha jeet jaata, aur purani heading/blocks wali templates
  // (14 default samet) khaali content ke saath render hotin.
  const rawFields = schemaInput?.fields;
  const schema = { ...DEFAULT_SCHEMA, ...schemaInput };

  legacyKeyCounter = 0;
  // Saari arrays me se guzarte waqt ek hi collision-list use karte hain, taaki
  // do alag list (jaise ek footer text aur ek custom link) kabhi ek hi key na
  // paayein.
  const usedKeys = [...RESERVED_TEMPLATE_KEYS];

  // Purani save hui fields (jinme keyLocked property kabhi thi hi nahi) hamesha
  // locked maani jaati hain — sirf ABHI-ABHI "+Add" se bani nayi field, jab tak
  // pehli baar blur na ho, apni key label ke saath live badalti hai.
  let fields = Array.isArray(rawFields) ? rawFields.map((f) => ({ ...f, keyLocked: f.keyLocked !== false })) : [];
  if (!fields.length && (schema.heading || schema.blocks)) {
    fields = [];
    if (typeof schema.heading === 'string' && schema.heading.trim()) {
      fields.push({ id: legacyKey('legacy_h'), label: 'Heading', key: 'heading', type: 'heading', value: schema.heading, keyLocked: true });
    }
    let pIndex = 0;
    let iIndex = 0;
    let bIndex = 0;
    for (const block of schema.blocks || []) {
      if (block.type === 'image') {
        iIndex += 1;
        fields.push({ id: legacyKey('legacy_i'), label: `Image ${iIndex}`, key: `image_${iIndex}`, type: 'image', url: block.url || '', alt: block.alt || '', keyLocked: true });
      } else if (block.type === 'button') {
        bIndex += 1;
        fields.push({ id: legacyKey('legacy_b'), label: `Button ${bIndex}`, key: `button_${bIndex}`, type: 'button', buttonLabel: block.label || '', buttonUrl: block.url || '', keyLocked: true });
      } else {
        pIndex += 1;
        fields.push({ id: legacyKey('legacy_p'), label: `Paragraph ${pIndex}`, key: `paragraph_${pIndex}`, type: 'richtext', value: legacyParagraphToRichValue(block.text), keyLocked: true });
      }
    }
  }
  usedKeys.push(...fields.map((f) => f.key));

  const footerTextsRaw = Array.isArray(schema.footerTexts) ? [...schema.footerTexts] : [];
  if (!footerTextsRaw.length) {
    if (typeof schema.footerText === 'string' && schema.footerText.trim()) footerTextsRaw.push(schema.footerText);
    if (typeof schema.contactDetails === 'string' && schema.contactDetails.trim()) footerTextsRaw.push(schema.contactDetails);
  }
  const footerTexts = footerTextsRaw.map((item) => {
    if (typeof item !== 'string') {
      usedKeys.push(item.key);
      return item;
    }
    const key = uniqueFieldKey('Footer text', usedKeys);
    usedKeys.push(key);
    return { id: legacyKey('legacy_ft'), key, value: item };
  });

  const mobileNumbers = (Array.isArray(schema.mobileNumbers) ? schema.mobileNumbers : []).map((item) => {
    if (typeof item !== 'string') {
      usedKeys.push(item.key);
      return item;
    }
    const key = uniqueFieldKey('Mobile number', usedKeys);
    usedKeys.push(key);
    return { id: legacyKey('legacy_mn'), key, value: item };
  });

  const customLinks = (Array.isArray(schema.customLinks) ? schema.customLinks : []).map((item) => {
    if (item.key) {
      usedKeys.push(item.key);
      return item;
    }
    const key = uniqueFieldKey(item.label || 'Link', usedKeys);
    usedKeys.push(key);
    return { id: legacyKey('legacy_cl'), keyLocked: true, ...item, key };
  });

  const socialLinks = (Array.isArray(schema.socialLinks) ? schema.socialLinks : []).map((item) => {
    const platform = SOCIAL_PLATFORMS.some((p) => p.id === item.platform) ? item.platform : 'other';
    if (item.key) {
      usedKeys.push(item.key);
      return { ...item, platform };
    }
    const key = uniqueFieldKey(findSocialPlatform(platform).label, usedKeys);
    usedKeys.push(key);
    return { id: legacyKey('legacy_sl'), ...item, platform, key };
  });

  return {
    ...schema,
    fontFamily: EMAIL_SAFE_FONT, // ab kabhi kuch aur nahi hota, purani value ho to bhi yahi jeetta hai
    fields,
    footerTexts,
    mobileNumbers,
    customLinks,
    socialLinks,
  };
}

/** Is template ke andar ki SAARI field keys — naya field/link banate waqt collision-check ke liye. */
export function allTemplateFieldKeys(schema) {
  return [
    ...(schema.fields || []).map((f) => f.key),
    ...(schema.footerTexts || []).map((f) => f.key),
    ...(schema.mobileNumbers || []).map((f) => f.key),
    ...(schema.customLinks || []).map((f) => f.key),
    ...(schema.socialLinks || []).map((f) => f.key),
  ].filter(Boolean);
}

/** Naya, khaali field Design tab me jodne ke liye — label existing keys se takrayegi to number apne aap lag jaata hai. */
export function newTemplateField(type, label, existingKeys) {
  const key = uniqueFieldKey(label, [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  const id = newItemId();
  // `keyLocked:false` — TemplateDesignEditor abhi bhi label ke saath key ko
  // live regenerate karta hai jab tak client pehli baar is field se bahar na
  // click kare ("blur"); usके baad key hamesha ke liye lock ho jaati hai.
  // Isse "+Add Heading" karke turant "Heading Two" type karne par key sahi
  // ({{heading_two}}) bante hai, generic "{{heading_2}}" nahi.
  const base = { id, label, key, keyLocked: false };
  if (type === 'image') return { ...base, type: 'image', url: '', alt: '' };
  if (type === 'button') return { ...base, type: 'button', buttonLabel: '', buttonUrl: '' };
  if (type === 'heading') return { ...base, type: 'heading', value: '' };
  return { ...base, type: 'richtext', value: '' };
}

function newItemId() {
  return `f_${Date.now().toString(36)}_${Math.round(Math.random() * 1e4).toString(36)}`;
}

/** Footer text line ki koi "label" nahi hoti — isliye key sirf ek baar, creation par, ban jaati hai aur kabhi nahi badalti. */
export function newFooterTextItem(existingKeys) {
  const key = uniqueFieldKey('Footer text', [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  return { id: newItemId(), key, value: '' };
}

export function newMobileNumberItem(existingKeys) {
  const key = uniqueFieldKey('Mobile number', [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  return { id: newItemId(), key, value: '' };
}

/** Custom link ki apni "label" hoti hai — content field jaisa hi, key label ke saath live-regenerate hoti hai jab tak pehli baar blur na ho. */
export function newCustomLinkItem(existingKeys) {
  const key = uniqueFieldKey('Link', [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  return { id: newItemId(), key, keyLocked: false, label: '', url: '' };
}

/** Social link ka platform ek fixed dropdown hai (free text nahi) — key hamesha platform ke naam se seedhe ban jaati hai. */
export function newSocialLinkItem(existingKeys) {
  const platform = SOCIAL_PLATFORMS[0];
  const key = uniqueFieldKey(platform.label, [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  return { id: newItemId(), key, platform: platform.id, url: '' };
}

/** Platform dropdown badalte hi social link ki key turant naye platform ke naam se dobara ban jaati hai. */
export function rekeySocialLinkForPlatform(platformId, existingKeys) {
  const platform = findSocialPlatform(platformId);
  const key = uniqueFieldKey(platform.label, [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  return { platform: platform.id, key };
}

function renderHeadingField(value) {
  if (!value) return '';
  return `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827;font-family:${EMAIL_SAFE_FONT}">${esc(value)}</h1>`;
}

/** RichTextEditor.jsx ka sanitizer pehle se hi poora, email-safe HTML fragment deta hai — yahan seedha use karte hain. */
function renderRichtextField(value) {
  if (!value) return '';
  return `            ${value}`;
}

function renderImageField(url, alt) {
  if (!url) return '';
  return `            <img src="${escAttr(url)}" alt="${escAttr(alt)}" width="536" style="display:block;max-width:100%;border-radius:8px;margin:0 0 16px" />`;
}

function renderButtonField(label, url, accent) {
  if (!url) return '';
  return `            <p style="margin:8px 0 20px">
              <a href="${escAttr(url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:bold">${esc(label || 'Click here')}</a>
            </p>`;
}

/**
 * `renderField()` ka tokenize-mode — field ke asli content ki jagah uska
 * {{key}} token daalta hai, wrapper/styling bilkul wahi rehta hai. Button
 * field sirf bare token hai (resolveTemplateFieldTokens use hote hi poora
 * styled snippet apne aap ban jaata hai) — dobara wrap karne ki zaroorat
 * nahi. Richtext bhi bare hai — uski value khud hi pehle se poora `<p>...`
 * (ya `<ul>`/`<ol>`) fragment hoti hai (RichTextEditor ke sanitizer se, ya
 * legacy paragraph-conversion se), isliye ek aur `<p>` wrap karna nested
 * `<p><p>...</p></p>` bana deta — invalid HTML, layout tod deta. Sirf
 * renderDefaultTemplateHtml() se, 14 default templates ko ek-baar "connect
 * to tokens" karne ke liye use hota hai.
 */
function renderFieldTokenized(field) {
  const token = `{{${field.key}}}`;
  if (field.type === 'heading') return field.value ? renderHeadingField(token) : '';
  if (field.type === 'image') return field.url ? renderImageField(token, field.alt) : '';
  if (field.type === 'button') return field.buttonUrl ? token : '';
  return field.value ? `            ${token}` : '';
}

function renderField(field, accent, tokenize) {
  if (tokenize) return renderFieldTokenized(field);
  if (field.type === 'heading') return renderHeadingField(field.value);
  if (field.type === 'image') return renderImageField(field.url, field.alt);
  if (field.type === 'button') return renderButtonField(field.buttonLabel, field.buttonUrl, accent);
  return renderRichtextField(field.value);
}

function renderFooterTexts(items, tokenize) {
  return items
    .map((item) => (tokenize ? (item.value ? `{{${item.key}}}` : '') : item.value))
    .filter(Boolean)
    .map((text) => `<p style="margin:0 0 4px">${esc(text)}</p>`)
    .join('\n            ');
}

/** Ek mobile number ka poora clickable tel: link — list-render aur single-token dono jagah reuse hota hai. */
function mobileNumberAnchor(value) {
  return `<a href="tel:${escAttr(telHref(value))}" style="color:#6b7280;text-decoration:none">${esc(value)}</a>`;
}

function renderMobileNumbers(items, tokenize) {
  if (tokenize) {
    const tokens = items.filter((item) => item.value).map((item) => `{{${item.key}}}`);
    if (!tokens.length) return '';
    return `<p style="margin:0 0 4px">${tokens.join(' &middot; ')}</p>`;
  }
  const values = items.map((item) => item.value).filter(Boolean);
  if (!values.length) return '';
  return `<p style="margin:0 0 4px">${values.map((n) => mobileNumberAnchor(n)).join(' &middot; ')}</p>`;
}

/** Ek custom link ka poora clickable anchor — list-render aur single-token dono jagah reuse hota hai. */
function customLinkAnchor(link) {
  return `<a href="${escAttr(link.url)}" style="color:#6b7280;text-decoration:underline">${esc(link.label)}</a>`;
}

function renderCustomLinks(items, tokenize) {
  const valid = items.filter((l) => l?.label && l?.url);
  if (!valid.length) return '';
  if (tokenize) return `<p style="margin:0 0 4px">${valid.map((l) => `{{${l.key}}}`).join(' &middot; ')}</p>`;
  return `<p style="margin:0 0 4px">${valid.map((l) => customLinkAnchor(l)).join(' &middot; ')}</p>`;
}

/**
 * Ek social link ka poora clickable anchor — sirf saaf TEXT (jaise
 * "Instagram"), kabhi image-only icon nahi (email clients aksar image block
 * kar dete hain; text link hamesha kaam karta hai). List-render aur
 * single-token dono jagah reuse hota hai.
 */
function socialLinkAnchor(link) {
  const platform = findSocialPlatform(link.platform);
  return `<a href="${escAttr(link.url)}" style="color:#4f46e5;text-decoration:underline;margin:0 8px">${esc(platform.label)}</a>`;
}

function renderSocialLinks(items, tokenize) {
  const valid = items.filter((l) => l?.url);
  if (!valid.length) return '';
  if (tokenize) return `<p style="margin:0 0 4px">${valid.map((l) => `{{${l.key}}}`).join('')}</p>`;
  return `<p style="margin:0 0 4px">${valid.map((l) => socialLinkAnchor(l)).join('')}</p>`;
}

/**
 * Naya blank template ya "Starters" se koi shuruaati point banane ke liye
 * ek-baar (one-time) ka HTML scaffold — schema se poora, Outlook-safe 600px
 * table-layout banata hai. Uske baad yeh html poori tarah independent,
 * freely-editable text ban jaata hai; Design tab ke field-edits ab kabhi
 * ise dobara generate/regenerate nahi karte.
 *
 * `{ tokenize: true }` — wahi layout/structure, bas har field/item ki asli
 * value ki jagah uska {{key}} token daalta hai. Sirf 14 default templates
 * (defaultTemplates.js) ko ek-baar "connect to tokens" karne ke liye —
 * normal editing flow me kabhi use nahi hota.
 */
export function renderTemplateHtml(schemaInput, { tokenize = false } = {}) {
  const schema = normalizeSchema(schemaInput);
  const accent = schema.accentColor || DEFAULT_SCHEMA.accentColor;

  const fieldsHtml = (schema.fields?.length ? schema.fields : DEFAULT_SCHEMA.fields)
    .map((field) => renderField(field, accent, tokenize))
    .filter(Boolean)
    .join('\n');

  const logoSrc = tokenize ? '{{logo_url}}' : schema.logoUrl;
  const brandText = tokenize ? '{{brand_name}}' : schema.brandName;
  const websiteHref = tokenize ? '{{website_url}}' : schema.websiteUrl;
  const brandBlock = schema.logoUrl
    ? `<img src="${escAttr(logoSrc)}" alt="${escAttr(brandText)}" height="36" style="display:block;border:0" />`
    : `<span style="color:#ffffff;font-size:18px;font-weight:bold">${esc(brandText)}</span>`;
  const headerHtml = schema.websiteUrl
    ? `<a href="${escAttr(websiteHref)}" style="text-decoration:none">${brandBlock}</a>`
    : brandBlock;

  const footerBits = [
    renderFooterTexts(schema.footerTexts, tokenize),
    renderMobileNumbers(schema.mobileNumbers, tokenize),
    renderCustomLinks(schema.customLinks, tokenize),
    renderSocialLinks(schema.socialLinks, tokenize),
  ]
    .filter(Boolean)
    .join('\n            ');

  const unsubscribeLabel = tokenize ? '{{unsubscribe_text}}' : esc(schema.unsubscribeText || DEFAULT_SCHEMA.unsubscribeText);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${schema.backgroundColor};padding:24px 0;font-family:${EMAIL_SAFE_FONT}">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${schema.cardColor};border-radius:10px;overflow:hidden">
        <tr>
          <td align="center" style="background:${accent};padding:20px">
            ${headerHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:${EMAIL_SAFE_FONT}">
${fieldsHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f9fafb;padding:18px;font-size:12px;color:#6b7280">
            ${footerBits}
            <div style="margin-top:10px">
              <a href="{{unsubscribe_url}}" style="color:#6b7280">${unsubscribeLabel}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Heading/Text/Image field ki value bare (plain) hoti hai — client khud apna
 * markup likhta hai (jaise `<img src="{{key}}">`). Button ek poora, indivisible
 * clickable unit hai (label + url ek saath), isliye uska token seedha poora
 * styled snippet deta hai (renderButtonField() reuse karke) — bare URL akela
 * kisi kaam ka nahi, label kahin aur se milta hi nahi.
 */
function fieldPlainValue(field, accent) {
  if (field.type === 'image') return field.url || '';
  if (field.type === 'button') return field.buttonUrl ? renderButtonField(field.buttonLabel, field.buttonUrl, accent) : '';
  return field.value || '';
}

/**
 * Is TEMPLATE ke apne fields aur links (Heading, Logo, Website URL, Footer
 * Text, Mobile Number, Custom Link, Social Link, ...) ke {{key}} tokens ko
 * unki ASLI value se badalta hai — Design tab me jahan bhi rakhe gaye ho.
 * Template khud HAMESHA literal token ke saath save hoti hai (save/reload ke
 * baad bhi Code tab me wahi token dikhta hai) — yeh function sirf preview
 * dikhane aur campaign freeze hone se THEEK PEHLE chalta hai (dekho
 * StepTemplate.jsx). Recipient/global tokens ({{name}}, {{company}},
 * {{unsubscribe_url}}, ...) jaise-ke-taise chhod deta hai — unki jagah send
 * time par bharti hai (server/src/services/render.js).
 */
export function resolveTemplateFieldTokens(html, schemaInput) {
  if (!html) return '';
  const schema = normalizeSchema(schemaInput);
  const accent = schema.accentColor || DEFAULT_SCHEMA.accentColor;

  const map = new Map();
  map.set('logo_url', schema.logoUrl || '');
  map.set('brand_name', schema.brandName || '');
  map.set('website_url', schema.websiteUrl || '');
  map.set('unsubscribe_text', schema.unsubscribeText || DEFAULT_SCHEMA.unsubscribeText);
  for (const field of schema.fields || []) {
    map.set(field.key, fieldPlainValue(field, accent));
  }
  for (const item of schema.footerTexts || []) {
    map.set(item.key, item.value || '');
  }
  for (const item of schema.mobileNumbers || []) {
    map.set(item.key, item.value ? mobileNumberAnchor(item.value) : '');
  }
  for (const item of schema.customLinks || []) {
    map.set(item.key, item.label && item.url ? customLinkAnchor(item) : '');
  }
  for (const item of schema.socialLinks || []) {
    map.set(item.key, item.url ? socialLinkAnchor(item) : '');
  }

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (map.has(key) ? map.get(key) : match));
}

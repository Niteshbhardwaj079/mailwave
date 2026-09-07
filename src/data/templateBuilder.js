// ---------------------------------------------------------------------------
// Structured campaign-template builder.
//
// TemplateEditorPage ka "Design" tab is file ke renderTemplateHtml() se HTML
// banata hai — user kabhi raw HTML nahi chhoota jab tak khud "Code" tab me na
// jaaye. src/data/systemEmails.js ke shell()/button() ka hi generalized roop
// hai, bas ab fields ek fixed schema se aate hain (14 default templates aur
// koi bhi naya custom template dono isi se render hote hain).
//
// Har content field (Heading, Heading Two, Description, ...) ki apni ek
// friendly label + auto-generated {{key}} hoti hai — bilkul global Dynamic
// Fields (src/data/dynamicFields.js) jaisa hi, bas is EK TEMPLATE ke andar.
// Client Code tab me `{{heading_two}}` type kare ya Design tab khud render
// kare — dono jagah asli value hamesha resolveTemplateFieldTokens() se save
// hone se PEHLE bhar di jaati hai, isliye asli bheji gayi email me kabhi koi
// "unresolved" apna-hi-token nahi bachta. Sirf recipient/global tokens
// ({{name}}, {{company}}, ...) jaise-ke-taise pass through hote hain — unhe
// asli value send time par (server/src/services/render.js) milti hai.
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

/** Logo/Brand/Website hamesha maujood, single (list nahi) fields hain — inki key kabhi nahi badalti. */
export const RESERVED_TEMPLATE_KEYS = ['logo_url', 'brand_name', 'website_url'];

export const DEFAULT_SCHEMA = {
  accentColor: '#4f46e5',
  backgroundColor: '#f4f5fa',
  cardColor: '#ffffff',
  fontFamily: EMAIL_SAFE_FONT,
  logoUrl: '',
  brandName: '',
  websiteUrl: '',
  // null = Code tab par haath se HTML likha gaya (structured fields ab bharose
  // ke layak nahi) — TemplateEditorPage isi se "Design" tab ka haal decide
  // karta hai. Ek nayi/khaali template hamesha ek shuruaati Heading + Text
  // field ke saath khulti hai.
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
 * Purane schema shapes ko naye (fields-list) shape me badalta hai, bina kisi
 * stored row ko chhue — sirf render/edit karte waqt, in-memory. Isliye purani
 * templates (14 default samet) kabhi dobara save kiye bina bhi sahi
 * dikhti/render hoti rehti hain. Do purane shapes handle hote hain:
 *   1. { heading, blocks: [...] }               (is feature se pehle)
 *   2. { fields: [...] }                        (abhi ka, jaisa-ka-taisa)
 */
export function normalizeSchema(schemaInput) {
  // Legacy-check karne ke liye ASLI input dekhte hain, DEFAULT_SCHEMA se
  // merge karne se PEHLE — warna DEFAULT_SCHEMA.fields (do khaali starter
  // fields) hamesha jeet jaata, aur purani heading/blocks wali templates
  // (14 default samet) khaali content ke saath render hotin.
  const rawFields = schemaInput?.fields;
  const schema = { ...DEFAULT_SCHEMA, ...schemaInput };

  // Purani save hui fields (jinme keyLocked property kabhi thi hi nahi) hamesha
  // locked maani jaati hain — sirf ABHI-ABHI "+Add" se bani nayi field, jab tak
  // pehli baar blur na ho, apni key label ke saath live badalti hai.
  let fields = Array.isArray(rawFields) ? rawFields.map((f) => ({ ...f, keyLocked: f.keyLocked !== false })) : null;
  if (!fields && (schema.heading || schema.blocks)) {
    legacyKeyCounter = 0;
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

  let footerTexts = Array.isArray(schema.footerTexts) ? schema.footerTexts : null;
  if (!footerTexts) {
    footerTexts = [];
    if (typeof schema.footerText === 'string' && schema.footerText.trim()) footerTexts.push(schema.footerText);
    if (typeof schema.contactDetails === 'string' && schema.contactDetails.trim()) footerTexts.push(schema.contactDetails);
  }

  const mobileNumbers = Array.isArray(schema.mobileNumbers) ? schema.mobileNumbers : [];
  const customLinks = Array.isArray(schema.customLinks) ? schema.customLinks : [];

  const socialLinks = (Array.isArray(schema.socialLinks) ? schema.socialLinks : []).map((link) => {
    const known = SOCIAL_PLATFORMS.some((p) => p.id === link.platform);
    return known ? link : { ...link, platform: 'other' };
  });

  return {
    ...schema,
    fontFamily: EMAIL_SAFE_FONT, // ab kabhi kuch aur nahi hota, purani value ho to bhi yahi jeetta hai
    fields, // null rehta hai agar sach me raw-HTML se detach ho chuki hai (koi heading/blocks/fields kabhi nahi thi)
    footerTexts,
    mobileNumbers,
    customLinks,
    socialLinks,
  };
}

/** Naya, khaali field Design tab me jodne ke liye — label existing keys se takrayegi to number apne aap lag jaata hai. */
export function newTemplateField(type, label, existingKeys) {
  const key = uniqueFieldKey(label, [...RESERVED_TEMPLATE_KEYS, ...existingKeys]);
  const id = `f_${Date.now().toString(36)}_${Math.round(Math.random() * 1e4).toString(36)}`;
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

function renderField(field, accent) {
  if (field.type === 'heading') return renderHeadingField(field.value);
  if (field.type === 'image') return renderImageField(field.url, field.alt);
  if (field.type === 'button') return renderButtonField(field.buttonLabel, field.buttonUrl, accent);
  return renderRichtextField(field.value);
}

function renderFooterTexts(lines) {
  return lines
    .filter(Boolean)
    .map((text) => `<p style="margin:0 0 4px">${esc(text)}</p>`)
    .join('\n            ');
}

function renderMobileNumbers(numbers) {
  const items = numbers.filter(Boolean);
  if (!items.length) return '';
  const links = items
    .map((n) => `<a href="tel:${escAttr(telHref(n))}" style="color:#6b7280;text-decoration:none">${esc(n)}</a>`)
    .join(' &middot; ');
  return `<p style="margin:0 0 4px">${links}</p>`;
}

function renderCustomLinks(links) {
  const items = links.filter((l) => l?.label && l?.url);
  if (!items.length) return '';
  const rendered = items
    .map((l) => `<a href="${escAttr(l.url)}" style="color:#6b7280;text-decoration:underline">${esc(l.label)}</a>`)
    .join(' &middot; ');
  return `<p style="margin:0 0 4px">${rendered}</p>`;
}

/**
 * Social links — sirf saaf, clickable TEXT (jaise "Instagram"), kabhi
 * image-only icon nahi. Email clients aksar image block kar dete hain; text
 * link hamesha kaam karta hai.
 */
function renderSocialLinks(links) {
  const items = links.filter((l) => l?.url);
  if (!items.length) return '';
  const rendered = items
    .map((l) => {
      const platform = findSocialPlatform(l.platform);
      return `<a href="${escAttr(l.url)}" style="color:#4f46e5;text-decoration:underline;margin:0 8px">${esc(platform.label)}</a>`;
    })
    .join('');
  return `<p style="margin:0 0 4px">${rendered}</p>`;
}

/**
 * Schema se poora, Outlook-safe 600px table-layout HTML banata hai.
 * {{var}} tokens jaise-ke-taise pass through hote hain — recipient/global
 * tokens send time par (mergeVariables) resolve hote hain; is TEMPLATE ke
 * apne fields (heading_two, logo_url, ...) resolveTemplateFieldTokens() se,
 * save hone se pehle hi.
 */
export function renderTemplateHtml(schemaInput) {
  const schema = normalizeSchema(schemaInput);
  const accent = schema.accentColor || DEFAULT_SCHEMA.accentColor;

  const fieldsHtml = (schema.fields?.length ? schema.fields : DEFAULT_SCHEMA.fields)
    .map((field) => renderField(field, accent))
    .filter(Boolean)
    .join('\n');

  const brandBlock = schema.logoUrl
    ? `<img src="${escAttr(schema.logoUrl)}" alt="${escAttr(schema.brandName)}" height="36" style="display:block;border:0" />`
    : `<span style="color:#ffffff;font-size:18px;font-weight:bold">${esc(schema.brandName)}</span>`;
  const headerHtml = schema.websiteUrl
    ? `<a href="${escAttr(schema.websiteUrl)}" style="text-decoration:none">${brandBlock}</a>`
    : brandBlock;

  const footerBits = [
    renderFooterTexts(schema.footerTexts),
    renderMobileNumbers(schema.mobileNumbers),
    renderCustomLinks(schema.customLinks),
    renderSocialLinks(schema.socialLinks),
  ]
    .filter(Boolean)
    .join('\n            ');

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
              <a href="{{unsubscribe_url}}" style="color:#6b7280">${esc(schema.unsubscribeText || DEFAULT_SCHEMA.unsubscribeText)}</a>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function fieldPlainValue(field) {
  if (field.type === 'image') return field.url || '';
  if (field.type === 'button') return field.buttonUrl || '';
  return field.value || '';
}

/**
 * Is TEMPLATE ke apne fields (Heading, Heading Two, Logo, Website URL, ...)
 * ke {{key}} tokens ko unki ASLI value se badalta hai — Design tab se ho ya
 * Code tab me haath se likhe gaye ho, dono jagah. Save hone se THEEK PEHLE
 * chalta hai, taaki final saved html me kabhi koi "apna" token unresolved na
 * bache. Recipient/global tokens ({{name}}, {{company}}, {{unsubscribe_url}},
 * ...) jaise-ke-taise chhod deta hai — unki jagah send time par bharti hai
 * (server/src/services/render.js).
 */
export function resolveTemplateFieldTokens(html, schemaInput) {
  if (!html) return '';
  const schema = normalizeSchema(schemaInput);

  const map = new Map();
  map.set('logo_url', schema.logoUrl || '');
  map.set('brand_name', schema.brandName || '');
  map.set('website_url', schema.websiteUrl || '');
  for (const field of schema.fields || []) {
    map.set(field.key, fieldPlainValue(field));
  }

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => (map.has(key) ? map.get(key) : match));
}

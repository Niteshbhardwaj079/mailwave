// ---------------------------------------------------------------------------
// Drag & Drop template builder — block-tree -> Outlook-safe HTML compiler.
//
// Design/Code editor (templateBuilder.js) ke bilkul alag file hai — is
// builder ka apna koi Code tab nahi, isliye Design/Code jaisa do-step
// "token freeze" yahan zaroori nahi. Block tree hi hamesha ki asli source of
// truth hai; compileBuilderHtml() har save par POORA HTML dobara banata hai.
// Sirf recipient/global merge tokens ({{name}}, {{unsubscribe_url}}, ...) —
// jo client khud DynamicFieldPicker se kisi bhi block ke text me daalta hai —
// literal `{{key}}` ke roop me bache rehte hain, send time par
// server/src/services/render.js unhe bharta hai, exactly jaisa Design/Code
// editor me hota hai.
//
// Har output fixed 600px, role="presentation" nested <table>, har style
// inline (koi <style> block nahi — Outlook <head> CSS hata deta hai), font
// hamesha EMAIL_SAFE_FONT. Image/Logo block hamesha /files/img/:id jaisa URL
// hi rakhte hain — data: URI kabhi compile nahi hota, isse spam-risk aur
// file-size dono kaabu me rehte hain.
// ---------------------------------------------------------------------------
import { EMAIL_SAFE_FONT, findSocialPlatform } from './templateBuilder.js';

export { EMAIL_SAFE_FONT };

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

/** "+91 98765 43210" -> "+919876543210" — sirf href="tel:" ke liye. */
function telHref(value) {
  return String(value ?? '').replace(/(?!^\+)[^\d]/g, '');
}

let idCounter = 0;
export function newBlockId(prefix = 'blk') {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${Math.round(Math.random() * 1e4).toString(36)}`;
}

export const BLOCK_TYPES = [
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'spacer',
  'logo',
  'social',
  'websiteLink',
  'phone',
  'customLink',
  'footerText',
  'unsubscribe',
];

/** Naya block, apni type ke sahi khaali defaults ke saath. */
export function newBlock(type) {
  const id = newBlockId();
  switch (type) {
    case 'heading':
      return { id, type, text: '', level: 'h1', align: 'left', color: '#111827', fontSize: 22 };
    case 'text':
      return { id, type, html: '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151">Write something…</p>' };
    case 'image':
      return { id, type, url: '', alt: '', width: 536, align: 'center', link: '' };
    case 'button':
      return { id, type, label: 'Click here', url: '', align: 'left', bgColor: '#4f46e5', textColor: '#ffffff', fontSize: 15 };
    case 'divider':
      return { id, type, color: '#e5e7eb', thickness: 1 };
    case 'spacer':
      return { id, type, height: 24 };
    case 'logo':
      return { id, type, url: '', alt: '', height: 36, link: '' };
    case 'social':
      return { id, type, items: [] };
    case 'websiteLink':
      return { id, type, label: 'Visit our website', url: '' };
    case 'phone':
      return { id, type, label: '', value: '' };
    case 'customLink':
      return { id, type, label: '', url: '' };
    case 'footerText':
      return { id, type, text: '' };
    case 'unsubscribe':
      return { id, type, label: 'Unsubscribe from these emails' };
    default:
      return { id, type: 'text', html: '' };
  }
}

function newColumn(widthPct = 100) {
  return { id: newBlockId('col'), widthPct, blocks: [] };
}

function newRow(columns = 1) {
  const widths = columns === 2 ? [50, 50] : columns === 3 ? [34, 33, 33] : [100];
  return {
    id: newBlockId('row'),
    backgroundColor: '#ffffff',
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    columns: widths.map((w) => newColumn(w)),
  };
}

export function newDefaultRow(columns = 1) {
  return newRow(columns);
}

/**
 * Naya, khaali template ek shuruaati Heading + Text + Unsubscribe ke saath
 * khulta hai — DEFAULT_SCHEMA (templateBuilder.js) jaisa hi idea. Button/
 * Image jaan-boojh kar yahan nahi hain: bina URL ke wo kuch bhi render nahi
 * karte (compileButton/compileImage), isliye scaffold me khaali dikhte —
 * Design tab ka DEFAULT_SCHEMA bhi isi wajah se sirf heading+body rakhta hai.
 */
export function defaultBuilderSchema() {
  const row = newRow(1);
  row.columns[0].blocks = [
    { ...newBlock('heading'), text: 'A special offer, just for you' },
    { ...newBlock('text') },
    newBlock('unsubscribe'),
  ];
  return {
    version: 1,
    globalStyle: { backgroundColor: '#f4f5fa', contentWidth: 600, fontFamily: EMAIL_SAFE_FONT },
    rows: [row],
  };
}

/**
 * Purana/corrupt/hand-edited jsonb blob bhi kabhi crash nahi karega — jo bhi
 * samajh na aaye wo chhod diya jaata hai, missing arrays khaali ban jaate hain.
 */
export function normalizeBuilderSchema(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.rows)) return defaultBuilderSchema();

  const rows = input.rows
    .filter((r) => r && typeof r === 'object' && Array.isArray(r.columns))
    .map((r) => ({
      id: r.id || newBlockId('row'),
      backgroundColor: r.backgroundColor || '#ffffff',
      padding: {
        top: Number.isFinite(r.padding?.top) ? r.padding.top : 24,
        right: Number.isFinite(r.padding?.right) ? r.padding.right : 24,
        bottom: Number.isFinite(r.padding?.bottom) ? r.padding.bottom : 24,
        left: Number.isFinite(r.padding?.left) ? r.padding.left : 24,
      },
      columns: (Array.isArray(r.columns) ? r.columns : [])
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
          id: c.id || newBlockId('col'),
          widthPct: Number.isFinite(c.widthPct) ? c.widthPct : 100,
          blocks: (Array.isArray(c.blocks) ? c.blocks : [])
            .filter((b) => b && typeof b === 'object' && BLOCK_TYPES.includes(b.type))
            .map((b) => ({ ...newBlock(b.type), ...b, id: b.id || newBlockId() })),
        })),
    }))
    .filter((r) => r.columns.length > 0);

  if (!rows.length) return defaultBuilderSchema();

  return {
    version: 1,
    globalStyle: {
      backgroundColor: input.globalStyle?.backgroundColor || '#f4f5fa',
      contentWidth: 600,
      fontFamily: EMAIL_SAFE_FONT,
    },
    rows,
  };
}

/** Poore schema me kitne `unsubscribe` blocks hain — delete se pehle "aakhri wala mat hatao" jaanchne ke liye. */
export function countUnsubscribeBlocks(schema) {
  return schema.rows.reduce((n, r) => n + r.columns.reduce((m, c) => m + c.blocks.filter((b) => b.type === 'unsubscribe').length, 0), 0);
}

/** Har row/column me bhi guarantee karta hai ki kam se kam ek `unsubscribe` block kahin maujood hai — nahi to aakhri row/column me apne aap jod deta hai. Load hone par aur har save se pehle chalta hai. */
export function ensureUnsubscribeBlock(schema) {
  const hasUnsubscribe = schema.rows.some((row) => row.columns.some((col) => col.blocks.some((b) => b.type === 'unsubscribe')));
  if (hasUnsubscribe) return schema;

  const rows = schema.rows.length ? [...schema.rows] : [newRow(1)];
  const lastRowIndex = rows.length - 1;
  const lastRow = { ...rows[lastRowIndex], columns: [...rows[lastRowIndex].columns] };
  const lastColIndex = lastRow.columns.length - 1;
  const lastCol = { ...lastRow.columns[lastColIndex], blocks: [...lastRow.columns[lastColIndex].blocks, newBlock('unsubscribe')] };
  lastRow.columns[lastColIndex] = lastCol;
  rows[lastRowIndex] = lastRow;
  return { ...schema, rows };
}

// --- per-block-type HTML -----------------------------------------------------

function compileHeading(b) {
  if (!b.text) return '';
  const tag = b.level === 'h2' ? 'h2' : 'h1';
  return `<${tag} style="margin:0 0 14px;font-size:${b.fontSize || 22}px;color:${b.color || '#111827'};text-align:${b.align || 'left'};font-family:${EMAIL_SAFE_FONT}">${esc(b.text)}</${tag}>`;
}

function compileText(b) {
  return b.html ? String(b.html) : '';
}

function compileImage(b) {
  if (!b.url) return '';
  const img = `<img src="${escAttr(b.url)}" alt="${escAttr(b.alt)}" width="${Number(b.width) || 536}" style="display:block;max-width:100%;border:0;margin:0 auto 16px" />`;
  const aligned = `<div style="text-align:${b.align || 'center'}">${img}</div>`;
  return b.link ? `<a href="${escAttr(b.link)}" style="display:block">${aligned}</a>` : aligned;
}

function compileButton(b) {
  if (!b.url) return '';
  return `<p style="margin:8px 0 20px;text-align:${b.align || 'left'}">
    <a href="${escAttr(b.url)}" style="display:inline-block;background:${b.bgColor || '#4f46e5'};color:${b.textColor || '#ffffff'};text-decoration:none;padding:13px 26px;border-radius:8px;font-size:${b.fontSize || 15}px;font-weight:bold">${esc(b.label || 'Click here')}</a>
  </p>`;
}

function compileDivider(b) {
  return `<hr style="border:none;border-top:${Number(b.thickness) || 1}px solid ${b.color || '#e5e7eb'};margin:16px 0" />`;
}

function compileSpacer(b) {
  return `<div style="height:${Number(b.height) || 24}px;line-height:${Number(b.height) || 24}px;font-size:1px">&nbsp;</div>`;
}

function compileLogo(b) {
  if (!b.url) return '';
  const img = `<img src="${escAttr(b.url)}" alt="${escAttr(b.alt)}" height="${Number(b.height) || 36}" style="display:block;border:0" />`;
  return b.link ? `<a href="${escAttr(b.link)}" style="text-decoration:none">${img}</a>` : img;
}

function compileSocial(b) {
  const valid = (b.items || []).filter((i) => i?.url);
  if (!valid.length) return '';
  const links = valid
    .map((i) => `<a href="${escAttr(i.url)}" style="color:#4f46e5;text-decoration:underline;margin:0 8px">${esc(findSocialPlatform(i.platform).label)}</a>`)
    .join('');
  return `<p style="margin:0 0 4px;text-align:center">${links}</p>`;
}

function compileWebsiteLink(b) {
  if (!b.url) return '';
  return `<p style="margin:0 0 4px"><a href="${escAttr(b.url)}" style="color:#6b7280;text-decoration:underline">${esc(b.label || b.url)}</a></p>`;
}

function compilePhone(b) {
  if (!b.value) return '';
  const anchor = `<a href="tel:${escAttr(telHref(b.value))}" style="color:#6b7280;text-decoration:none">${esc(b.label ? `${b.label}: ${b.value}` : b.value)}</a>`;
  return `<p style="margin:0 0 4px">${anchor}</p>`;
}

function compileCustomLink(b) {
  if (!b.url || !b.label) return '';
  return `<p style="margin:0 0 4px"><a href="${escAttr(b.url)}" style="color:#6b7280;text-decoration:underline">${esc(b.label)}</a></p>`;
}

function compileFooterText(b) {
  if (!b.text) return '';
  return `<p style="margin:0 0 4px;font-size:12px;color:#6b7280">${esc(b.text)}</p>`;
}

/** Yeh hamesha `{{unsubscribe_url}}` token deta hai — server/src/services/render.js ki hasOwnUnsubscribeLink jaanch isi exact key se match karti hai. */
function compileUnsubscribe(b) {
  return `<p style="margin:8px 0 0;text-align:center;font-size:12px;color:#6b7280"><a href="{{unsubscribe_url}}" style="color:#6b7280;text-decoration:underline">${esc(b.label || 'Unsubscribe from these emails')}</a></p>`;
}

const COMPILERS = {
  heading: compileHeading,
  text: compileText,
  image: compileImage,
  button: compileButton,
  divider: compileDivider,
  spacer: compileSpacer,
  logo: compileLogo,
  social: compileSocial,
  websiteLink: compileWebsiteLink,
  phone: compilePhone,
  customLink: compileCustomLink,
  footerText: compileFooterText,
  unsubscribe: compileUnsubscribe,
};

function compileBlock(block) {
  const fn = COMPILERS[block?.type];
  if (!fn) return '';
  try {
    return fn(block) || '';
  } catch {
    // Ek block ki khaali/adhoori value poori email ko kabhi crash nahi karegi.
    return '';
  }
}

/** Ek single block ka HTML fragment — canvas ke andar WYSIWYG preview ke liye (poore table-wrapper ke bina, sirf sahi tag/style dikhane ke liye). */
export function compileBlockForPreview(block) {
  return compileBlock(block);
}

function compileColumn(col) {
  const blocksHtml = (col.blocks || []).map(compileBlock).filter(Boolean).join('\n');
  return `<td width="${col.widthPct}%" valign="top" style="padding:0 8px;font-family:${EMAIL_SAFE_FONT}">${blocksHtml}</td>`;
}

function compileRow(row) {
  const padding = row.padding || {};
  const cellStyle = `background:${row.backgroundColor || '#ffffff'};padding:${padding.top ?? 24}px ${padding.right ?? 24}px ${padding.bottom ?? 24}px ${padding.left ?? 24}px`;

  if (row.columns.length <= 1) {
    const blocksHtml = (row.columns[0]?.blocks || []).map(compileBlock).filter(Boolean).join('\n');
    return `<tr><td style="${cellStyle};font-family:${EMAIL_SAFE_FONT}">${blocksHtml}</td></tr>`;
  }

  const columnsHtml = row.columns.map(compileColumn).join('\n');
  return `<tr><td style="${cellStyle}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${columnsHtml}</tr></table>
  </td></tr>`;
}

/**
 * Poora block-tree -> ek fixed-width, Outlook-safe HTML string. Har save par
 * poora dobara banta hai (koi partial-diff nahi) — TemplateBuilderPage hamesha
 * ismein se aaya `html` hi server ko bhejta hai.
 */
export function compileBuilderHtml(schemaInput) {
  const schema = normalizeBuilderSchema(schemaInput);
  const width = schema.globalStyle?.contentWidth || 600;
  const bg = schema.globalStyle?.backgroundColor || '#f4f5fa';
  const rowsHtml = schema.rows.map(compileRow).join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 0;font-family:${EMAIL_SAFE_FONT}">
  <tr>
    <td align="center">
      <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">
${rowsHtml}
      </table>
    </td>
  </tr>
</table>`;
}

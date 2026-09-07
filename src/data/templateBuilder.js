// ---------------------------------------------------------------------------
// Structured campaign-template builder.
//
// TemplateEditorPage ka "Design" tab is file ke renderTemplateHtml() se HTML
// banata hai — user kabhi raw HTML nahi chhoota jab tak khud "Code" tab me na
// jaaye. src/data/systemEmails.js ke shell()/button() ka hi generalized roop
// hai, bas ab fields ek fixed schema se aate hain (14 default templates aur
// koi bhi naya custom template dono isi se render hote hain).
//
// Yeh file frontend (Vite) aur backend (Node, server/src/db/seed.js se
// relative import) dono me chalti hai — isliye plain JS, koi browser/Node-
// khaas API nahi. systemEmailTranslations.js jaisa hi convention.
// ---------------------------------------------------------------------------

/** Email clients (khaaskar Outlook) sirf yeh fonts bharose se render karte hain. */
export const EMAIL_SAFE_FONTS = [
  { value: 'Arial,Helvetica,sans-serif', label: 'Arial' },
  { value: 'Georgia,\'Times New Roman\',serif', label: 'Georgia' },
  { value: 'Verdana,Geneva,sans-serif', label: 'Verdana' },
  { value: 'Tahoma,Geneva,sans-serif', label: 'Tahoma' },
  { value: '\'Times New Roman\',Times,serif', label: 'Times New Roman' },
  { value: '\'Courier New\',Courier,monospace', label: 'Courier New' },
];

export const DEFAULT_SCHEMA = {
  accentColor: '#4f46e5',
  backgroundColor: '#f4f5fa',
  cardColor: '#ffffff',
  fontFamily: EMAIL_SAFE_FONTS[0].value,
  logoUrl: '',
  brandName: '{{app_name}}',
  heading: '',
  blocks: [{ type: 'paragraph', text: '' }],
  footerText: '',
  socialLinks: [],
  contactDetails: '',
  unsubscribeText: 'Unsubscribe from these emails',
};

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(value) {
  return esc(value).replace(/"/g, '&quot;');
}

function renderParagraph(text) {
  // {{var}} tokens user ne khud likhe hain, jaan-boojh kar escape nahi karte —
  // subject/body ki tarah hi seedhe render pipeline me jaate hain, jahan
  // asli value se badal jaate hain.
  const html = String(text ?? '').replace(/\n/g, '<br />');
  return `            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151">${html}</p>`;
}

function renderImage(url, alt) {
  if (!url) return '';
  return `            <img src="${escAttr(url)}" alt="${escAttr(alt)}" width="536" style="display:block;max-width:100%;border-radius:8px;margin:0 0 16px" />`;
}

function renderButton(label, url, accent) {
  if (!url) return '';
  return `            <p style="margin:8px 0 20px">
              <a href="${escAttr(url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:bold">${esc(label || 'Click here')}</a>
            </p>`;
}

function renderSocialLinks(links) {
  if (!links?.length) return '';
  const items = links
    .filter((link) => link.url)
    .map(
      (link) =>
        `<a href="${escAttr(link.url)}" style="color:#6b7280;text-decoration:none;margin:0 8px">${esc(link.platform || 'Link')}</a>`
    )
    .join(' · ');
  return items ? `<div style="margin-top:8px">${items}</div>` : '';
}

/**
 * Schema se poora, Outlook-safe 600px table-layout HTML banata hai.
 * {{var}} tokens jaise-ke-taise pass through hote hain — substitution send
 * time par (mergeVariables) hoti hai, yahan nahi.
 */
export function renderTemplateHtml(schemaInput) {
  const schema = { ...DEFAULT_SCHEMA, ...schemaInput };
  const accent = schema.accentColor || DEFAULT_SCHEMA.accentColor;

  const blocksHtml = (schema.blocks?.length ? schema.blocks : DEFAULT_SCHEMA.blocks)
    .map((block) => {
      if (block.type === 'image') return renderImage(block.url, block.alt);
      if (block.type === 'button') return renderButton(block.label, block.url, accent);
      return renderParagraph(block.text);
    })
    .filter(Boolean)
    .join('\n');

  const headerHtml = schema.logoUrl
    ? `<img src="${escAttr(schema.logoUrl)}" alt="${escAttr(schema.brandName)}" height="36" style="display:block;border:0" />`
    : `<span style="color:#ffffff;font-size:18px;font-weight:bold">${esc(schema.brandName)}</span>`;

  const headingHtml = schema.heading
    ? `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827;font-family:${schema.fontFamily}">${esc(schema.heading)}</h1>\n`
    : '';

  const footerParts = [esc(schema.footerText), esc(schema.contactDetails)].filter(Boolean).join(' · ');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${schema.backgroundColor};padding:24px 0;font-family:${schema.fontFamily}">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${schema.cardColor};border-radius:10px;overflow:hidden">
        <tr>
          <td align="center" style="background:${accent};padding:20px">
            ${headerHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:${schema.fontFamily}">
${headingHtml}${blocksHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f9fafb;padding:18px;font-size:12px;color:#6b7280">
            ${footerParts}
            ${renderSocialLinks(schema.socialLinks)}
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

/** Naya, khaali block editor me jodne ke liye. */
export function newBlock(type) {
  if (type === 'image') return { type: 'image', url: '', alt: '' };
  if (type === 'button') return { type: 'button', label: '', url: '' };
  return { type: 'paragraph', text: '' };
}

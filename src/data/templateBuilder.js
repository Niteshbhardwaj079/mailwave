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

/**
 * Har email client (khaaskar Outlook) sirf Arial jaisa system font bharose se
 * render karta hai — isliye font ab client ke chunne ki cheez hi nahi hai,
 * hamesha yehi lagta hai.
 */
export const EMAIL_SAFE_FONT = 'Arial,Helvetica,sans-serif';

/**
 * Social links ke liye jaana-pehchana platforms — client naam nahi likhta,
 * bas ek icon chunta hai. Icon PNGs server/public/social-icons/<id>.png me
 * committed hain (real files, koi external service ya icon-font/CSS nahi —
 * email me wo bharose ke layak nahi hote).
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

export const DEFAULT_SCHEMA = {
  accentColor: '#4f46e5',
  backgroundColor: '#f4f5fa',
  cardColor: '#ffffff',
  fontFamily: EMAIL_SAFE_FONT,
  logoUrl: '',
  brandName: '',
  heading: '',
  blocks: [{ type: 'paragraph', text: '' }],
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

/**
 * Purane (single-value) schema ko naye (multi-value) shape me badalta hai,
 * bina kisi stored row ko chhue — sirf render/edit karte waqt, in-memory.
 * Isliye purani templates (14 default samet) kabhi dobara save kiye bina bhi
 * sahi dikhti/render hoti rehti hain.
 */
export function normalizeSchema(schemaInput) {
  const schema = { ...DEFAULT_SCHEMA, ...schemaInput };

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
    footerTexts,
    mobileNumbers,
    customLinks,
    socialLinks,
  };
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

/** `assetBase` diya ho to social icons ki absolute URL bana deta hai (email me relative URL kaam nahi karta). */
function renderSocialLinks(links, assetBase) {
  const items = links.filter((l) => l?.url);
  if (!items.length) return '';
  const icons = items
    .map((l) => {
      const platform = findSocialPlatform(l.platform);
      const iconSrc = `${assetBase || ''}/social-icons/${platform.id}.png`;
      return `<a href="${escAttr(l.url)}" style="display:inline-block;margin:0 6px;text-decoration:none"><img src="${escAttr(iconSrc)}" width="28" height="28" alt="${escAttr(platform.label)}" style="display:block;border:0;border-radius:6px" /></a>`;
    })
    .join('');
  return `<div style="margin-top:10px">${icons}</div>`;
}

/**
 * Schema se poora, Outlook-safe 600px table-layout HTML banata hai.
 * {{var}} tokens jaise-ke-taise pass through hote hain — substitution send
 * time par (mergeVariables) hoti hai, yahan nahi.
 *
 * `assetBase` (jaise apiBase, `src/api/client.js` se) social icons ki
 * absolute URL banane ke liye — kabhi stored schema me nahi baithta,
 * har baar render karte waqt di jaati hai, taaki app ka domain badalne par
 * bhi purani templates dobara sahi resolve ho jayein.
 */
export function renderTemplateHtml(schemaInput, { assetBase = '' } = {}) {
  const schema = normalizeSchema(schemaInput);
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
    ? `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827;font-family:${EMAIL_SAFE_FONT}">${esc(schema.heading)}</h1>\n`
    : '';

  const footerBits = [
    renderFooterTexts(schema.footerTexts),
    renderMobileNumbers(schema.mobileNumbers),
    renderCustomLinks(schema.customLinks),
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
${headingHtml}${blocksHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f9fafb;padding:18px;font-size:12px;color:#6b7280">
            ${footerBits}
            ${renderSocialLinks(schema.socialLinks, assetBase)}
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

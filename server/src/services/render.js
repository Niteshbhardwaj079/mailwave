// ---------------------------------------------------------------------------
// Bhejne se pehle email ka HTML taiyar karna.
//
// Char kaam hote hain:
//   1. {{name}} jaise variables ko asli value se badalna
//   2. Open tracking ke liye ek chhoti si invisible image jodna
//   3. Click tracking ke liye link badalna
//   4. Unsubscribe link footer me lagana (yeh kanoonan zaroori hai)
// ---------------------------------------------------------------------------
import { env } from '../env.js';

/**
 * HTML me daalne se pehle har value ko safe banao.
 *
 * Agar kisi contact ka naam `Raj <script>` hai, aur hum use seedha HTML me daal
 * dein, to woh email ka design tod sakta hai. Isliye khatarnak characters ko
 * badal dete hain.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * {{name}}, {{company}} waghairah ko asli value se badalta hai.
 * Jo variable nahi milta use khali chhod dete hain — "{{city}}" likha hua
 * email me dikhna sabse bura lagta hai.
 */
export function mergeVariables(html, data = {}) {
  if (!html) return '';

  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    return escapeHtml(value);
  });
}

/** Sirf http/https link hi track karte hain. mailto:, tel: waghairah chhod dete hain. */
function isTrackable(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Har link ko apne server se hokar jaane wala bana deta hai, taki click gina ja
 * sake. Server click note karke turant asli jagah bhej deta hai.
 *
 * `links` me har URL ka id pehle se hona chahiye (database se).
 */
export function rewriteLinks(html, { links, recipientId }) {
  if (!html) return '';

  return html.replace(/href\s*=\s*"([^"]+)"/gi, (match, url) => {
    if (!isTrackable(url)) return match;

    const link = links.get(url);
    if (!link) return match;

    const tracked = `${env.publicUrl}/t/c/${link.id}/${recipientId}`;
    return `href="${tracked}"`;
  });
}

/** Wo chhoti invisible image jisse "open" pata chalta hai. */
export function openPixel(recipientId) {
  const src = `${env.publicUrl}/t/o/${recipientId}.png`;
  return `<img src="${src}" width="1" height="1" alt="" style="display:block;border:0;outline:none" />`;
}

/**
 * Footer — unsubscribe link ke saath.
 *
 * Yeh marzi ki cheez nahi hai. Bulk email me unsubscribe link na ho to Gmail
 * aur Outlook aapko spam me daal dete hain, aur kai deshon me yeh gair-kanooni
 * bhi hai.
 *
 * `skipComplianceBlock: true` — jab template ka apna Design-tab "Footer"
 * (company/address/unsubscribe sab kuch) pehle se hi is recipient ka ASLI
 * unsubscribe link bana chuka ho (buildEmail() yeh khud check karta hai).
 * Tab yahan sirf Subscribe button chahiye to wahi jodte hain — poora company/
 * unsubscribe block dobara NAHI, warna email ke neeche do-do footer aur do-do
 * "Unsubscribe" link dikhte (client ne khud dekha, confusing lagta hai).
 * Jab template ka apna unsubscribe link NA ho (purane/freeform templates),
 * yeh hamesha false rehta hai — poora, compliant footer kabhi nahi chhutta.
 */
export function footer({ recipientId, company, unsubscribeText, subscribeButton, skipComplianceBlock = false }) {
  const unsubUrl = `${env.publicUrl}/t/u/${recipientId}`;
  const subUrl = `${env.publicUrl}/t/s/${recipientId}`;

  const subscribeBlock = subscribeButton
    ? `<p style="margin:0 0 12px">
         <a href="${subUrl}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;
            text-decoration:none;border-radius:6px;font-size:14px">Subscribe</a>
       </p>`
    : '';

  if (skipComplianceBlock) {
    if (!subscribeBlock) return '';
    return `
      <div style="margin-top:16px;text-align:center">
        ${subscribeBlock}
      </div>
    `;
  }

  // Company, pata, support email, website — sab brand.config.js se.
  // Yeh sirf dikhane ke liye nahi hai: bulk email me bhejne wale ki pehchaan
  // aur pata hona kanoonan zaroori hai, aur Gmail/Outlook iske bina spam me
  // daal dete hain.
  const brand = env.brand;
  const line = (text) => (text ? `<p style="margin:0 0 4px">${escapeHtml(text)}</p>` : '');

  const contact = [
    brand.supportEmail
      ? `<a href="mailto:${escapeHtml(brand.supportEmail)}" style="color:#6b7280">${escapeHtml(brand.supportEmail)}</a>`
      : '',
    brand.website
      ? `<a href="${escapeHtml(brand.website)}" style="color:#6b7280">${escapeHtml(
          brand.website.replace(/^https?:\/\//, '')
        )}</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' &middot; ');

  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;
                font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-align:center">
      ${subscribeBlock}
      ${line(company || brand.company)}
      ${line(brand.address)}
      ${contact ? `<p style="margin:0 0 6px">${contact}</p>` : ''}
      <p style="margin:0">
        <a href="${unsubUrl}" style="color:#6b7280;text-decoration:underline">
          ${escapeHtml(unsubscribeText || 'Unsubscribe from these emails')}
        </a>
      </p>
    </div>
  `;
}

/** HTML se saada text banata hai — kuch purane mail apps sirf yahi dikhate hain. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sab kuch jodkar ek recipient ke liye final email banata hai.
 */
export function buildEmail({ campaign, recipient, links, company, unsubscribeText }) {
  const data = {
    name: recipient.name || '',
    email: recipient.email,
    company: recipient.merge_data?.company || '',
    phone: recipient.merge_data?.phone || '',
    city: recipient.merge_data?.city || '',
    subscribe_url: `${env.publicUrl}/t/s/${recipient.id}`,
    // Agar client ne apna khud ka Footer banaya hai (Design tab), to usme
    // {{unsubscribe_url}} pehle se hota hai — yahan asli, per-recipient link
    // resolve hota hai. Neeche footer() ko yeh batane ke liye ki template ka
    // apna unsubscribe link pehle se mojood hai ya nahi, isi value se check
    // karte hain — taaki poora system-wala footer dobara na jud jaye.
    unsubscribe_url: `${env.publicUrl}/t/u/${recipient.id}`,
    // App-wide, not per-recipient — same for every email, sourced from the
    // app's own brand config so a {{app_name}}/{{support_email}} a client
    // inserts (default templates' header/footer use these) always resolves,
    // instead of silently going blank.
    app_name: env.brand.name,
    support_email: env.brand.supportEmail,
    ...(recipient.merge_data || {}),
  };

  let html = mergeVariables(campaign.html, data);

  // Template ka apna Footer (Design tab) is recipient ka ASLI unsubscribe
  // link pehle se jod chuka hai kya — {{unsubscribe_url}} merge hone ke
  // baad, uska raw text yahin dikhega agar template ne kahin bhi istemal
  // kiya tha. Agar haan, to neeche system-wala poora footer (company/pata/
  // ek aur "Unsubscribe" link) dobara nahi jodte — do-do footer/unsubscribe
  // link dikhna client ko ajeeb aur unprofessional lagta hai. Agar nahi
  // (purane ya freeform Code-tab templates jinme kabhi {{unsubscribe_url}}
  // istemal hi nahi hua), poora, compliant footer hamesha jodte hain — yeh
  // kabhi nahi chhutta, warna spam/legal issue ban jata.
  const hasOwnUnsubscribeLink = html.includes(escapeHtml(data.unsubscribe_url));

  if (campaign.click_tracking && links?.size) {
    html = rewriteLinks(html, { links, recipientId: recipient.id });
  }

  html += footer({
    recipientId: recipient.id,
    company,
    unsubscribeText,
    subscribeButton: campaign.subscribe_button,
    skipComplianceBlock: hasOwnUnsubscribeLink,
  });

  if (campaign.open_tracking) {
    html += openPixel(recipient.id);
  }

  return {
    subject: mergeVariables(campaign.subject, data),
    html,
    text: htmlToText(html),
    // Gmail aur Outlook is header ko dekhkar apna "Unsubscribe" button dikhate
    // hain. Isse spam me jaane ka khatra kaafi kam ho jata hai.
    headers: {
      'List-Unsubscribe': `<${env.publicUrl}/t/u/${recipient.id}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

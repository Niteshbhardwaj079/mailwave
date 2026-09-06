import { env } from '../env.js';
import { many, one } from '../db/client.js';
import { sendMail } from './mailer.js';
import { htmlToText, mergeVariables } from './render.js';

/**
 * "System email" wo email hai jo app khud bhejta hai — password reset link,
 * naye user ka invite, campaign poora hone ki khabar waghairah. Yeh campaign
 * wale email se alag hai: ismein tracking pixel, unsubscribe link ya batch
 * kuch nahi hota. Ek insaan ko, ek email.
 *
 * Sabse zaroori niyam: yeh kabhi bhi request ko fail nahi karta. Agar koi
 * email account juda hi nahi hai, ya SMTP ne mana kar diya, to hum server ke
 * console par likh dete hain aur { ok: false } lauta dete hain. Password reset
 * ki request isliye ruk nahi sakti ki mail server neeche hai.
 */

/**
 * Kis account se bhejein.
 *
 * Pehle .env ka SYSTEM_EMAIL_FROM dekhte hain (client apna alag "no-reply"
 * account rakhna chahe to). Wo na ho to jo bhi pehla juda hua account hai.
 */
async function pickAccount() {
  if (env.systemEmailFrom) {
    const chosen = await one('SELECT * FROM email_accounts WHERE lower(email) = lower($1)', [
      env.systemEmailFrom,
    ]);
    if (chosen) return chosen;
    console.warn(
      `[system-mail] SYSTEM_EMAIL_FROM me "${env.systemEmailFrom}" likha hai par yeh account juda nahi hai. Pehla juda hua account istemal kar rahe hain.`
    );
  }

  return one(
    `SELECT * FROM email_accounts
      WHERE status = 'Connected'
      ORDER BY created_at ASC
      LIMIT 1`
  );
}

/**
 * Ek system email key ka content us language me nikalta hai — agar us language
 * ka translation saved hai to wo, warna English (base row) fallback ki tarah.
 * English khud kabhi kisi "translation" row se nahi aati — system_emails hi
 * uska ghar hai, isliye ek language edit karna doosri ko kabhi chhoo nahi sakta.
 *
 * @returns {null | { key, subject, html, enabled, updated_at, language, isFallback }}
 */
export async function resolveSystemEmail(key, language = 'en') {
  const base = await one('SELECT * FROM system_emails WHERE key = $1', [key]);
  if (!base) return null;

  if (!language || language === 'en') {
    return { ...base, language: 'en', isFallback: false };
  }

  const translation = await one(
    'SELECT * FROM system_email_translations WHERE key = $1 AND language = $2',
    [key, language]
  );
  if (translation) {
    return {
      key: base.key,
      subject: translation.subject,
      html: translation.html,
      enabled: base.enabled,
      updated_at: translation.updated_at,
      language,
      isFallback: false,
    };
  }

  // Is language me abhi kuch save nahi hua — English dikhao, par saaf batao
  // ki yeh fallback hai, real content nahi.
  return { ...base, language: 'en', isFallback: true };
}

/**
 * Ek system email bhejta hai.
 *
 * @param {string} key   system_emails table ki key, jaise 'password.reset'
 * @param {object} to    { email, name, language? } — language na ho to English.
 * @param {object} vars  template ke {{variables}} ki value
 * @param {object} [options]
 * @param {boolean} [options.force] "Send test" isse true bhejta hai — Admin
 *   yeh dekhna chahta hai template kaisi dikhti hai, chahe uska automatic
 *   trigger abhi band ho. Asli event (naya user, campaign khatam waghairah)
 *   isse kabhi true nahi bhejta — wahan "band" ka matlab sach me nahi bhejna hai.
 * @param {string} [options.language] Force karta hai kis language me bheje —
 *   "Send test" page par jo language tab khula hai wahi yahan aata hai. Na diya
 *   jaaye to `to.language` (recipient ki preference) use hoti hai.
 * @returns {{ ok: boolean, reason?: string, previewUrl?: string|null }}
 */
export async function sendSystemEmail(key, to, vars = {}, { force = false, language } = {}) {
  if (!to?.email) return { ok: false, reason: 'no-recipient' };

  const template = await resolveSystemEmail(key, language || to.language || 'en');
  if (!template) {
    console.warn(`[system-mail] "${key}" naam ka koi template nahi mila.`);
    return { ok: false, reason: 'no-template' };
  }

  // Admin ne is email ko band kar rakha hai. Yeh galti nahi hai — "Send test"
  // (force:true) ke alawa har jagah isi WAJAH se ruk jaana chahiye.
  if (!template.enabled && !force) return { ok: false, reason: 'disabled' };

  const account = await pickAccount();
  if (!account) {
    console.warn(
      `[system-mail] "${key}" nahi bheja ja saka — abhi tak koi email account juda nahi hai. Settings > Email accounts me ek account jodo.`
    );
    return { ok: false, reason: 'no-account' };
  }

  // Har template me brand ki yeh cheezein milti hain, isliye ek hi jagah se
  // bhar dete hain. Bulane wale ko sirf apne khaas variable dene hote hain.
  const data = {
    app_name: env.brand.name,
    company: env.brand.company,
    support_email: env.brand.supportEmail,
    website: env.brand.website,
    address: env.brand.address,
    name: to.name || '',
    ...vars,
  };

  const html = mergeVariables(template.html, data);
  const subject = mergeVariables(template.subject, data);

  try {
    const sent = await sendMail(account, {
      to: to.email,
      fromName: account.display_name || env.brand.name,
      subject,
      html,
      text: htmlToText(html),
    });
    // Test transport (ethereal) par asli inbox nahi hota — uski jagah ek link
    // milta hai jisse email khol kar dekh sakte hain. Console par chhap dete
    // hain taki setup ke waqt pata chale ki email sach me bana.
    if (sent.previewUrl) console.log(`[system-mail] "${key}" bhej diya. Dekhne ke liye: ${sent.previewUrl}`);

    return { ok: true, previewUrl: sent.previewUrl };
  } catch (error) {
    // Yahan se aage error nahi jaane dete — request apna kaam poora kare.
    console.error(`[system-mail] "${key}" bhejne me dikkat: ${error.message}`);
    return { ok: false, reason: 'send-failed' };
  }
}

/**
 * Kuch system email "copy to every Super Admin" hoti hain — jaise naya user
 * banna ya kisi role ki permissions badalna. Har ACTIVE Super Admin ko
 * ek-ek karke bhejta hai.
 *
 * `excludeEmail`: jise pehle hi alag se ek email ja chuki hai (jaise campaign
 * ka sender, agar wo khud Super Admin nikla) — usse dobara nahi bhejte.
 */
export async function notifySuperAdmins(key, vars = {}, { excludeEmail } = {}) {
  const admins = await many(
    `SELECT name, email, language FROM users WHERE role_key = 'super_admin' AND status = 'Active'`
  );

  for (const admin of admins) {
    if (excludeEmail && admin.email.toLowerCase() === excludeEmail.toLowerCase()) continue;
    await sendSystemEmail(key, { email: admin.email, name: admin.name, language: admin.language }, vars);
  }
}

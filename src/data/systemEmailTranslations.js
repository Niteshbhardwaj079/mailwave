// ---------------------------------------------------------------------------
// Pre-written translations for every system email, in every non-English
// language this app supports.
//
// Why this file exists: the System Emails page lets a Super Admin type a
// translation by hand for any language — but a brand-new workspace should
// not start with every language showing "no version yet, here is English."
// This file is the starting set every fresh database gets seeded with (see
// server/src/db/seed.js's seedSystemEmails()), so every language already
// works out of the box. A Super Admin can still edit or overwrite any of
// these from the System Emails page at any time — this file only supplies
// the STARTING content, exactly like src/data/systemEmails.js does for
// English.
//
// Structure mirrors systemEmails.js on purpose: a shared shell()/button()
// pair, and one HTML "shape" per email key (copied from the English source,
// with only the human-readable text turned into parameters) — so every
// language produces pixel-identical layout/colour/spacing to English, and
// every {{variable}} and link stays exactly where the English version put it.
// ---------------------------------------------------------------------------

/** Same visual shell as systemEmails.js's shell(), with a translatable footer line. */
function shell(bodyHtml, accent, footerNote) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">
        <tr>
          <td align="center" style="background:${accent};padding:20px">
            <span style="color:#ffffff;font-size:18px;font-weight:bold">{{app_name}}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
${bodyHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f9fafb;padding:18px;font-size:12px;color:#6b7280">
            {{company}} · <a href="mailto:{{support_email}}" style="color:#6b7280">{{support_email}}</a><br />
            ${footerNote}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/** Same button as systemEmails.js's button(), with a translatable "copy this link" note. */
function button(label, urlVar, color, note) {
  return `            <p style="margin:24px 0 0">
              <a href="{{${urlVar}}}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:bold">${label}</a>
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#6b7280">
              ${note}<br />
              <span style="color:#4b5563">{{${urlVar}}}</span>
            </p>`;
}

function h1(text) {
  return `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">${text}</h1>`;
}

function p(text, { small = false } = {}) {
  return small
    ? `            <p style="margin:20px 0 0;font-size:13px;color:#6b7280">\n              ${text}\n            </p>`
    : `            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">\n              ${text}\n            </p>`;
}

function pLast(text) {
  return `            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">\n              ${text}\n            </p>`;
}

// Accent colour + button config per key, copied straight from
// src/data/systemEmails.js so every language matches English's look exactly.
const META = {
  'user.invited': { accent: '#4f46e5', button: { urlVar: 'set_password_url', color: '#4f46e5' } },
  'password.reset': { accent: '#4f46e5', button: { urlVar: 'reset_url', color: '#4f46e5' } },
  'password.changed': { accent: '#d97706', button: null },
  'password.setByAdmin': { accent: '#d97706', button: { urlVar: 'sign_in_url', color: '#d97706' } },
  'user.emailChangeConfirm': { accent: '#4f46e5', button: { urlVar: 'confirm_url', color: '#4f46e5' } },
  'login.newDevice': { accent: '#0891b2', button: null },
  'user.roleChanged': { accent: '#0891b2', button: null },
  'user.disabled': { accent: '#dc2626', button: null },
  'admin.userCreated': { accent: '#0891b2', button: { urlVar: 'activity_url', color: '#0891b2' } },
  'admin.permissionChanged': { accent: '#d97706', button: { urlVar: 'activity_url', color: '#d97706' } },
  'campaign.finished': { accent: '#16a34a', button: { urlVar: 'report_url', color: '#16a34a' } },
  'campaign.failed': { accent: '#dc2626', button: { urlVar: 'campaign_url', color: '#dc2626' } },
  'account.connected': { accent: '#4f46e5', button: { urlVar: 'accounts_url', color: '#4f46e5' } },
  'contacts.imported': { accent: '#16a34a', button: { urlVar: 'contacts_url', color: '#16a34a' } },
  'contact.subscribed': { accent: '#16a34a', button: { urlVar: 'subscribers_url', color: '#16a34a' } },
  'report.ready': { accent: '#4f46e5', button: { urlVar: 'download_url', color: '#4f46e5' } },
};

// One HTML "shape" per key — the exact structure of that key's English
// version in systemEmails.js, parameterised only on the translated text.
const SHAPES = {
  'user.invited': (t) => [h1(t.title), p(t.p1), p(t.p2), BTN('user.invited', t), p(t.p3, { small: true })],
  'password.reset': (t) => [h1(t.title), p(t.p1), BTN('password.reset', t), p(t.p2, { small: true })],
  'password.changed': (t) => [h1(t.title), p(t.p1), pLast(t.p2)],
  'password.setByAdmin': (t) => [h1(t.title), p(t.p1), p(t.p2), BTN('password.setByAdmin', t)],
  'user.emailChangeConfirm': (t) => [h1(t.title), p(t.p1), BTN('user.emailChangeConfirm', t), p(t.p2, { small: true })],
  'login.newDevice': (t) => [h1(t.title), p(t.p1), pLast(t.p2), p(t.p3)],
  'user.roleChanged': (t) => [h1(t.title), p(t.p1), pLast(t.p2)],
  'user.disabled': (t) => [h1(t.title), p(t.p1), pLast(t.p2)],
  'admin.userCreated': (t) => [h1(t.title), p(t.p1), BTN('admin.userCreated', t)],
  'admin.permissionChanged': (t) => [h1(t.title), p(t.p1), pLast(t.p2), BTN('admin.permissionChanged', t)],
  'campaign.finished': (t) => [h1(t.title), p(t.p1), pLast(t.p2), BTN('campaign.finished', t)],
  'campaign.failed': (t) => [h1(t.title), pLast(t.p1), pLast(t.p2), BTN('campaign.failed', t)],
  'account.connected': (t) => [h1(t.title), p(t.p1), BTN('account.connected', t)],
  'contacts.imported': (t) => [h1(t.title), p(t.p1), pLast(t.p2), BTN('contacts.imported', t)],
  'contact.subscribed': (t) => [h1(t.title), pLast(t.p1), pLast(t.p2), BTN('contact.subscribed', t)],
  'report.ready': (t) => [h1(t.title), p(t.p1), BTN('report.ready', t), p(t.p2, { small: true })],
};

function BTN(key, t) {
  const meta = META[key];
  return button(t.buttonLabel, meta.button.urlVar, meta.button.color, t.buttonNote);
}

/** Builds the final HTML for one (key, language) pair from its translated pieces. */
function buildHtml(key, t, footerNote) {
  const meta = META[key];
  const parts = SHAPES[key](t);
  return shell(parts.join('\n'), meta.accent, footerNote);
}

// LANG holds, per language: a shared footer note + button note (used on every
// email in that language), and TRANSLATIONS[key] with that key's translated
// subject/title/paragraphs/button label.
export const LANG = {};

LANG['hi-Latn'] = {
  footerNote: 'Yeh aapke account ke baare me ek automatic message hai. Aap isse unsubscribe nahi kar sakte.',
  buttonNote: 'Agar button kaam na kare, to yeh link apne browser me copy karein:',
  translations: {
    'user.invited': {
      subject: 'Aapko {{app_name}} me add kiya gaya hai — apna password set karein',
      title: 'Hello {{name}},',
      p1: '{{invited_by}} ne {{app_name}} par aapke liye <strong>{{role}}</strong> ke roop me ek account banaya hai.',
      p2: 'Aapki sign-in email <strong>{{email}}</strong> hai. Poora karne ke liye apna password choose karein:',
      buttonLabel: 'Mera password set karein',
      p3: 'Yeh link 48 ghante tak kaam karega. {{company}} me koi bhi aapka choose kiya hua password nahi dekh sakta.',
    },
    'password.reset': {
      subject: 'Apna {{app_name}} password reset karein',
      title: 'Apna password reset karein',
      p1: 'Hello {{name}}, humein {{request_time}} ko {{request_ip}} se aapka password reset karne ki request mili.',
      buttonLabel: 'Naya password choose karein',
      p2: 'Yeh link 1 ghante tak kaam karta hai aur ek baar use ho sakta hai. Agar aapne yeh nahi maanga, to is email ko ignore karein — aapka password waisa hi rahega.',
    },
    'password.changed': {
      subject: 'Aapka {{app_name}} password badal gaya',
      title: 'Aapka password badal gaya',
      p1: 'Hello {{name}}, aapka {{app_name}} password {{change_time}} ko {{device}} ({{request_ip}}) se badla gaya.',
      p2: 'Agar yeh aapne kiya hai, to aur kuch karne ki zarurat nahi. Agar aapne nahi kiya, to turant <a href="mailto:{{support_email}}">{{support_email}}</a> par likhein.',
    },
    'password.setByAdmin': {
      subject: 'Aapke {{app_name}} account ke liye naya password set kiya gaya',
      title: 'Aapke liye naya password set kiya gaya',
      p1: 'Hello {{name}}, <strong>{{changed_by}}</strong> ne {{change_time}} ko aapke account ke liye naya password set kiya.',
      p2: 'Password khud aapko alag se diya gaya hai — yeh kabhi bhi email me nahi likha jata. Please sign in karein aur ise kisi aisi cheez me badlein jo sirf aap jaante hon.',
      buttonLabel: 'Sign in karein',
    },
    'user.emailChangeConfirm': {
      subject: 'Apna naya {{app_name}} email address confirm karein',
      title: 'Yeh email address confirm karein',
      p1: 'Hello {{name}}, {{changed_by}} ne aapki {{app_name}} sign-in email ko <strong>{{new_email}}</strong> me badalne ki request ki hai. Abhi tak kuch nahi badla — pehle confirm karein ki aap yahan mail padh sakte hain.',
      buttonLabel: 'Yeh email confirm karein',
      p2: 'Yeh link 1 ghante tak kaam karta hai aur ek baar use ho sakta hai. Agar aapne yeh expect nahi kiya, to ignore karein — aapki purani email kaam karti rahegi.',
    },
    'login.newDevice': {
      subject: 'Aapke {{app_name}} account me naya sign-in',
      title: 'Naya sign-in',
      p1: 'Hello {{name}}, aapka account ek naye device par khola gaya.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'Kya yeh aap nahi the? Abhi apna password badlein aur <a href="mailto:{{support_email}}">{{support_email}}</a> ko batayein.',
    },
    'user.roleChanged': {
      subject: '{{app_name}} me aapka role ab {{new_role}} hai',
      title: 'Aapka role badal gaya hai',
      p1: 'Hello {{name}}, {{changed_by}} ne {{change_time}} ko aapka role <strong>{{old_role}}</strong> se badalkar <strong>{{new_role}}</strong> kar diya.',
      p2: 'Agli baar sign in karne par aap jo dekh aur kar sakte hain wo alag dikh sakta hai.',
    },
    'user.disabled': {
      subject: 'Aapka {{app_name}} account band kar diya gaya hai',
      title: 'Aapka account band hai',
      p1: 'Hello {{name}}, {{changed_by}} ne {{change_time}} ko aapki access band kar di. Aap sign in nahi kar payenge.',
      p2: 'Agar aapko lagta hai yeh galti hai, to <a href="mailto:{{support_email}}">{{support_email}}</a> par likhein.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} ne {{name}} ko {{app_name}} me add kiya',
      title: 'Ek naya person add hua',
      p1: '{{created_by}} ne {{change_time}} ko <strong>{{name}}</strong> ({{email}}) ko <strong>{{role}}</strong> ke roop me add kiya.',
      buttonLabel: 'Activity log kholein',
    },
    'admin.permissionChanged': {
      subject: '{{role}} ke liye permissions badli gayi',
      title: 'Permissions badal di gayi',
      p1: '{{changed_by}} ne {{change_time}} ko badla ki <strong>{{role}}</strong> kya kar sakta hai.',
      p2: '{{change_summary}}',
      buttonLabel: 'Activity log kholein',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” bhejna poora ho gaya',
      title: 'Aapka campaign poora ho gaya',
      p1: 'Hello {{name}}, <strong>{{campaign_name}}</strong> poora ho gaya hai. {{total_sent}} emails gayi aur {{total_failed}} fail hui.',
      p2: 'Opens aur clicks kuch din tak aate rahenge, isliye numbers abhi bhi badlenge.',
      buttonLabel: 'Report dekhein',
    },
    'campaign.failed': {
      subject: 'Sending ruk gayi: {{campaign_name}}',
      title: 'Sending ruk gayi',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}} emails ke baad ruk gayi.',
      p2: 'Provider ne diya gaya reason: {{reason}}',
      buttonLabel: 'Campaign kholein',
    },
    'account.connected': {
      subject: '{{provider}} account {{account_email}} connect ho gaya',
      title: 'Ek sending account connect hua',
      p1: '{{changed_by}} ne {{change_time}} ko <strong>{{account_email}}</strong> ({{provider}}) connect kiya.',
      buttonLabel: 'Email accounts dekhein',
    },
    'contacts.imported': {
      subject: 'Import poora hua — {{valid_count}} contacts add hue',
      title: 'Aapka import poora ho gaya',
      p1: 'Hello {{name}}, <strong>{{file_name}}</strong> import ho gayi hai.',
      p2: 'Add hue: {{valid_count}} · Galat hone se skip hue: {{invalid_count}} · Duplicate hone se skip hue: {{duplicate_count}}',
      buttonLabel: 'Contacts dekhein',
    },
    'contact.subscribed': {
      subject: '{{name}} ne “{{campaign_name}}” se subscribe kiya',
      title: 'Ek naya subscriber',
      p1: '<strong>{{name}}</strong> ({{email}}) ne {{change_time}} ko <strong>{{campaign_name}}</strong> me Subscribe dabaya.',
      p2: 'Ab yeh person aapki subscriber list me hai aur kisi bhi naye campaign me recipient ki tarah choose kiya ja sakta hai.',
      buttonLabel: 'Subscribers dekhein',
    },
    'report.ready': {
      subject: 'Aapka {{report_name}} export ready hai',
      title: 'Aapki file ready hai',
      p1: 'Hello {{name}}, aapka <strong>{{report_name}}</strong> export ready hai — {{row_count}} rows.',
      buttonLabel: 'File download karein',
      p2: 'Yeh link 7 din tak kaam karta hai.',
    },
  },
};

LANG.ta = {
  footerNote: 'இது உங்கள் கணக்கு தொடர்பான தானியங்கு செய்தி. நீங்கள் இதிலிருந்து குழுசேர்வை நிறுத்த முடியாது.',
  buttonNote: 'பொத்தான் வேலை செய்யவில்லை எனில், இந்த இணைப்பை உங்கள் உலாவியில் நகலெடுக்கவும்:',
  translations: {
    'user.invited': {
      subject: 'நீங்கள் {{app_name}} இல் சேர்க்கப்பட்டுள்ளீர்கள் — உங்கள் கடவுச்சொல்லை அமைக்கவும்',
      title: 'வணக்கம் {{name}},',
      p1: '{{invited_by}} {{app_name}} இல் உங்களுக்காக <strong>{{role}}</strong> என ஒரு கணக்கை உருவாக்கியுள்ளார்.',
      p2: 'உங்கள் உள்நுழைவு மின்னஞ்சல் <strong>{{email}}</strong>. முடிக்க உங்கள் சொந்த கடவுச்சொல்லைத் தேர்ந்தெடுக்கவும்:',
      buttonLabel: 'எனது கடவுச்சொல்லை அமைக்கவும்',
      p3: 'இந்த இணைப்பு 48 மணி நேரம் செயல்படும். {{company}} இல் யாரும் நீங்கள் தேர்ந்தெடுத்த கடவுச்சொல்லைப் பார்க்க முடியாது.',
    },
    'password.reset': {
      subject: 'உங்கள் {{app_name}} கடவுச்சொல்லை மீட்டமைக்கவும்',
      title: 'உங்கள் கடவுச்சொல்லை மீட்டமைக்கவும்',
      p1: 'வணக்கம் {{name}}, {{request_time}} அன்று {{request_ip}} இலிருந்து உங்கள் கடவுச்சொல்லை மீட்டமைக்கும் கோரிக்கையைப் பெற்றோம்.',
      buttonLabel: 'புதிய கடவுச்சொல்லைத் தேர்ந்தெடுக்கவும்',
      p2: 'இந்த இணைப்பு 1 மணி நேரம் செயல்படும், ஒரு முறை மட்டுமே பயன்படுத்த முடியும். இதை நீங்கள் கோரவில்லை எனில், இந்த மின்னஞ்சலைப் புறக்கணிக்கவும் — உங்கள் கடவுச்சொல் அப்படியே இருக்கும்.',
    },
    'password.changed': {
      subject: 'உங்கள் {{app_name}} கடவுச்சொல் மாற்றப்பட்டது',
      title: 'உங்கள் கடவுச்சொல் மாற்றப்பட்டது',
      p1: 'வணக்கம் {{name}}, உங்கள் {{app_name}} கடவுச்சொல் {{change_time}} அன்று {{device}} ({{request_ip}}) இலிருந்து மாற்றப்பட்டது.',
      p2: 'இது நீங்களே செய்திருந்தால், வேறு எதுவும் செய்ய தேவையில்லை. இது நீங்கள் இல்லை எனில், உடனடியாக <a href="mailto:{{support_email}}">{{support_email}}</a> க்கு எழுதவும்.',
    },
    'password.setByAdmin': {
      subject: 'உங்கள் {{app_name}} கணக்கிற்கு புதிய கடவுச்சொல் அமைக்கப்பட்டது',
      title: 'உங்களுக்காக புதிய கடவுச்சொல் அமைக்கப்பட்டது',
      p1: 'வணக்கம் {{name}}, <strong>{{changed_by}}</strong> {{change_time}} அன்று உங்கள் கணக்கிற்கு புதிய கடவுச்சொல்லை அமைத்தார்.',
      p2: 'கடவுச்சொல் தனியாக உங்களுக்கு வழங்கப்பட்டுள்ளது — அது ஒருபோதும் மின்னஞ்சலில் எழுதப்படாது. தயவுசெய்து உள்நுழைந்து, உங்களுக்கு மட்டுமே தெரிந்த ஒன்றாக அதை மாற்றவும்.',
      buttonLabel: 'உள்நுழையவும்',
    },
    'user.emailChangeConfirm': {
      subject: 'உங்கள் புதிய {{app_name}} மின்னஞ்சல் முகவரியை உறுதிப்படுத்தவும்',
      title: 'இந்த மின்னஞ்சல் முகவரியை உறுதிப்படுத்தவும்',
      p1: 'வணக்கம் {{name}}, {{changed_by}} உங்கள் {{app_name}} உள்நுழைவு மின்னஞ்சலை <strong>{{new_email}}</strong> ஆக மாற்ற கோரியுள்ளார். இன்னும் எதுவும் மாறவில்லை — முதலில் இங்கு நீங்கள் அஞ்சல் படிக்க முடியும் என்பதை உறுதிப்படுத்தவும்.',
      buttonLabel: 'இந்த மின்னஞ்சலை உறுதிப்படுத்தவும்',
      p2: 'இந்த இணைப்பு 1 மணி நேரம் செயல்படும், ஒரு முறை மட்டுமே பயன்படுத்த முடியும். இதை நீங்கள் எதிர்பார்க்கவில்லை எனில், புறக்கணிக்கவும் — உங்கள் பழைய மின்னஞ்சல் தொடர்ந்து செயல்படும்.',
    },
    'login.newDevice': {
      subject: 'உங்கள் {{app_name}} கணக்கில் புதிய உள்நுழைவு',
      title: 'புதிய உள்நுழைவு',
      p1: 'வணக்கம் {{name}}, உங்கள் கணக்கு ஒரு புதிய சாதனத்தில் திறக்கப்பட்டது.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'இது நீங்கள் இல்லையா? இப்போதே உங்கள் கடவுச்சொல்லை மாற்றி <a href="mailto:{{support_email}}">{{support_email}}</a> க்குத் தெரிவிக்கவும்.',
    },
    'user.roleChanged': {
      subject: '{{app_name}} இல் உங்கள் பங்கு இப்போது {{new_role}}',
      title: 'உங்கள் பங்கு மாறியுள்ளது',
      p1: 'வணக்கம் {{name}}, {{changed_by}} {{change_time}} அன்று உங்கள் பங்கை <strong>{{old_role}}</strong> இலிருந்து <strong>{{new_role}}</strong> ஆக மாற்றினார்.',
      p2: 'அடுத்த முறை நீங்கள் உள்நுழையும்போது நீங்கள் பார்க்கவும் செய்யவும் முடிவது வேறுபட்டதாகத் தோன்றலாம்.',
    },
    'user.disabled': {
      subject: 'உங்கள் {{app_name}} கணக்கு முடக்கப்பட்டுள்ளது',
      title: 'உங்கள் கணக்கு முடக்கப்பட்டுள்ளது',
      p1: 'வணக்கம் {{name}}, {{changed_by}} {{change_time}} அன்று உங்கள் அணுகலை முடக்கினார். நீங்கள் உள்நுழைய முடியாது.',
      p2: 'இது தவறு என்று நீங்கள் நினைத்தால், <a href="mailto:{{support_email}}">{{support_email}}</a> க்கு எழுதவும்.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} {{name}} ஐ {{app_name}} இல் சேர்த்தார்',
      title: 'ஒரு புதிய நபர் சேர்க்கப்பட்டார்',
      p1: '{{created_by}} {{change_time}} அன்று <strong>{{name}}</strong> ({{email}}) ஐ <strong>{{role}}</strong> ஆக சேர்த்தார்.',
      buttonLabel: 'செயல்பாட்டுப் பதிவைத் திறக்கவும்',
    },
    'admin.permissionChanged': {
      subject: '{{role}} க்கான அனுமதிகள் மாற்றப்பட்டன',
      title: 'அனுமதிகள் மாற்றப்பட்டன',
      p1: '{{changed_by}} {{change_time}} அன்று <strong>{{role}}</strong> செய்யக்கூடியதை மாற்றினார்.',
      p2: '{{change_summary}}',
      buttonLabel: 'செயல்பாட்டுப் பதிவைத் திறக்கவும்',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” அனுப்புதல் முடிந்தது',
      title: 'உங்கள் பிரச்சாரம் முடிந்தது',
      p1: 'வணக்கம் {{name}}, <strong>{{campaign_name}}</strong> முடிந்துவிட்டது. {{total_sent}} மின்னஞ்சல்கள் அனுப்பப்பட்டன, {{total_failed}} தோல்வியடைந்தன.',
      p2: 'திறப்புகளும் கிளிக்குகளும் இன்னும் சில நாட்கள் தொடர்ந்து வரும், எனவே எண்கள் இன்னும் மாறும்.',
      buttonLabel: 'அறிக்கையைப் பார்க்கவும்',
    },
    'campaign.failed': {
      subject: 'அனுப்புதல் நிறுத்தப்பட்டது: {{campaign_name}}',
      title: 'அனுப்புதல் நிறுத்தப்பட்டது',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}} மின்னஞ்சல்களுக்குப் பிறகு நிறுத்தப்பட்டது.',
      p2: 'வழங்குநர் கூறிய காரணம்: {{reason}}',
      buttonLabel: 'பிரச்சாரத்தைத் திறக்கவும்',
    },
    'account.connected': {
      subject: '{{provider}} கணக்கு {{account_email}} இணைக்கப்பட்டது',
      title: 'ஒரு அனுப்பும் கணக்கு இணைக்கப்பட்டது',
      p1: '{{changed_by}} {{change_time}} அன்று <strong>{{account_email}}</strong> ({{provider}}) ஐ இணைத்தார்.',
      buttonLabel: 'மின்னஞ்சல் கணக்குகளைப் பார்க்கவும்',
    },
    'contacts.imported': {
      subject: 'இறக்குமதி முடிந்தது — {{valid_count}} தொடர்புகள் சேர்க்கப்பட்டன',
      title: 'உங்கள் இறக்குமதி முடிந்தது',
      p1: 'வணக்கம் {{name}}, <strong>{{file_name}}</strong> இறக்குமதி செய்யப்பட்டுள்ளது.',
      p2: 'சேர்க்கப்பட்டவை: {{valid_count}} · பிழையால் தவிர்க்கப்பட்டவை: {{invalid_count}} · நகலாக தவிர்க்கப்பட்டவை: {{duplicate_count}}',
      buttonLabel: 'தொடர்புகளைப் பார்க்கவும்',
    },
    'contact.subscribed': {
      subject: '{{name}} “{{campaign_name}}” இலிருந்து குழுசேர்ந்தார்',
      title: 'ஒரு புதிய குழுசேர்நர்',
      p1: '<strong>{{name}}</strong> ({{email}}) {{change_time}} அன்று <strong>{{campaign_name}}</strong> இல் குழுசேரு பொத்தானை அழுத்தினார்.',
      p2: 'இந்த நபர் இப்போது உங்கள் குழுசேர்நர் பட்டியலில் உள்ளார், மேலும் எந்த புதிய பிரச்சாரத்திலும் பெறுநராகத் தேர்ந்தெடுக்கப்படலாம்.',
      buttonLabel: 'குழுசேர்நர்களைப் பார்க்கவும்',
    },
    'report.ready': {
      subject: 'உங்கள் {{report_name}} ஏற்றுமதி தயாராக உள்ளது',
      title: 'உங்கள் கோப்பு தயாராக உள்ளது',
      p1: 'வணக்கம் {{name}}, உங்கள் <strong>{{report_name}}</strong> ஏற்றுமதி தயாராக உள்ளது — {{row_count}} வரிசைகள்.',
      buttonLabel: 'கோப்பைப் பதிவிறக்கவும்',
      p2: 'இந்த இணைப்பு 7 நாட்கள் செயல்படும்.',
    },
  },
};

LANG.bn = {
  footerNote: 'এটি আপনার অ্যাকাউন্ট সম্পর্কিত একটি স্বয়ংক্রিয় বার্তা। আপনি এটি থেকে আনসাবস্ক্রাইব করতে পারবেন না।',
  buttonNote: 'বোতামটি কাজ না করলে, এই লিঙ্কটি আপনার ব্রাউজারে কপি করুন:',
  translations: {
    'user.invited': {
      subject: 'আপনাকে {{app_name}} এ যোগ করা হয়েছে — আপনার পাসওয়ার্ড সেট করুন',
      title: 'নমস্কার {{name}},',
      p1: '{{invited_by}} {{app_name}} এ আপনার জন্য <strong>{{role}}</strong> হিসেবে একটি অ্যাকাউন্ট তৈরি করেছেন।',
      p2: 'আপনার সাইন-ইন ইমেইল হলো <strong>{{email}}</strong>। সম্পন্ন করতে আপনার নিজের পাসওয়ার্ড বেছে নিন:',
      buttonLabel: 'আমার পাসওয়ার্ড সেট করুন',
      p3: 'এই লিঙ্কটি ৪৮ ঘণ্টা কাজ করবে। {{company}}-এ কেউই আপনার বেছে নেওয়া পাসওয়ার্ড দেখতে পারবে না।',
    },
    'password.reset': {
      subject: 'আপনার {{app_name}} পাসওয়ার্ড রিসেট করুন',
      title: 'আপনার পাসওয়ার্ড রিসেট করুন',
      p1: 'নমস্কার {{name}}, আমরা {{request_time}} তারিখে {{request_ip}} থেকে আপনার পাসওয়ার্ড রিসেট করার অনুরোধ পেয়েছি।',
      buttonLabel: 'নতুন পাসওয়ার্ড বেছে নিন',
      p2: 'এই লিঙ্কটি ১ ঘণ্টা কাজ করবে এবং একবার ব্যবহার করা যাবে। আপনি যদি এটি অনুরোধ না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন — আপনার পাসওয়ার্ড অপরিবর্তিত থাকবে।',
    },
    'password.changed': {
      subject: 'আপনার {{app_name}} পাসওয়ার্ড পরিবর্তন করা হয়েছে',
      title: 'আপনার পাসওয়ার্ড পরিবর্তন করা হয়েছে',
      p1: 'নমস্কার {{name}}, আপনার {{app_name}} পাসওয়ার্ড {{change_time}} তারিখে {{device}} ({{request_ip}}) থেকে পরিবর্তন করা হয়েছে।',
      p2: 'এটি যদি আপনি করে থাকেন, তাহলে আর কিছু করার প্রয়োজন নেই। এটি যদি আপনি না করে থাকেন, তাহলে অবিলম্বে <a href="mailto:{{support_email}}">{{support_email}}</a>-এ লিখুন।',
    },
    'password.setByAdmin': {
      subject: 'আপনার {{app_name}} অ্যাকাউন্টের জন্য একটি নতুন পাসওয়ার্ড সেট করা হয়েছে',
      title: 'আপনার জন্য একটি নতুন পাসওয়ার্ড সেট করা হয়েছে',
      p1: 'নমস্কার {{name}}, <strong>{{changed_by}}</strong> {{change_time}} তারিখে আপনার অ্যাকাউন্টের জন্য একটি নতুন পাসওয়ার্ড সেট করেছেন।',
      p2: 'পাসওয়ার্ডটি নিজে আলাদাভাবে আপনাকে দেওয়া হয়েছে — এটি কখনো ইমেইলে লেখা হয় না। অনুগ্রহ করে সাইন ইন করুন এবং এটি এমন কিছুতে পরিবর্তন করুন যা শুধু আপনিই জানেন।',
      buttonLabel: 'সাইন ইন করুন',
    },
    'user.emailChangeConfirm': {
      subject: 'আপনার নতুন {{app_name}} ইমেইল ঠিকানা নিশ্চিত করুন',
      title: 'এই ইমেইল ঠিকানাটি নিশ্চিত করুন',
      p1: 'নমস্কার {{name}}, {{changed_by}} আপনার {{app_name}} সাইন-ইন ইমেইল <strong>{{new_email}}</strong>-এ পরিবর্তন করার অনুরোধ করেছেন। এখনো কিছু পরিবর্তন হয়নি — প্রথমে নিশ্চিত করুন যে আপনি এখানে মেইল পড়তে পারছেন।',
      buttonLabel: 'এই ইমেইল নিশ্চিত করুন',
      p2: 'এই লিঙ্কটি ১ ঘণ্টা কাজ করবে এবং একবার ব্যবহার করা যাবে। আপনি যদি এটি আশা না করে থাকেন, তাহলে উপেক্ষা করুন — আপনার পুরোনো ইমেইল কাজ করতে থাকবে।',
    },
    'login.newDevice': {
      subject: 'আপনার {{app_name}} অ্যাকাউন্টে নতুন সাইন-ইন',
      title: 'নতুন সাইন-ইন',
      p1: 'নমস্কার {{name}}, আপনার অ্যাকাউন্ট একটি নতুন ডিভাইসে খোলা হয়েছে।',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'এটি কি আপনি ছিলেন না? এখনই আপনার পাসওয়ার্ড পরিবর্তন করুন এবং <a href="mailto:{{support_email}}">{{support_email}}</a>-কে জানান।',
    },
    'user.roleChanged': {
      subject: '{{app_name}}-এ আপনার ভূমিকা এখন {{new_role}}',
      title: 'আপনার ভূমিকা পরিবর্তন হয়েছে',
      p1: 'নমস্কার {{name}}, {{changed_by}} {{change_time}} তারিখে আপনার ভূমিকা <strong>{{old_role}}</strong> থেকে <strong>{{new_role}}</strong>-এ পরিবর্তন করেছেন।',
      p2: 'পরের বার সাইন ইন করার সময় আপনি যা দেখতে ও করতে পারেন তা ভিন্ন দেখাতে পারে।',
    },
    'user.disabled': {
      subject: 'আপনার {{app_name}} অ্যাকাউন্ট বন্ধ করা হয়েছে',
      title: 'আপনার অ্যাকাউন্ট বন্ধ আছে',
      p1: 'নমস্কার {{name}}, {{changed_by}} {{change_time}} তারিখে আপনার অ্যাক্সেস বন্ধ করেছেন। আপনি সাইন ইন করতে পারবেন না।',
      p2: 'আপনি যদি মনে করেন এটি একটি ভুল, তাহলে <a href="mailto:{{support_email}}">{{support_email}}</a>-এ লিখুন।',
    },
    'admin.userCreated': {
      subject: '{{created_by}} {{name}}-কে {{app_name}}-এ যোগ করেছেন',
      title: 'একজন নতুন ব্যক্তি যোগ করা হয়েছে',
      p1: '{{created_by}} {{change_time}} তারিখে <strong>{{name}}</strong> ({{email}})-কে <strong>{{role}}</strong> হিসেবে যোগ করেছেন।',
      buttonLabel: 'কার্যকলাপ লগ খুলুন',
    },
    'admin.permissionChanged': {
      subject: '{{role}}-এর জন্য অনুমতি পরিবর্তন করা হয়েছে',
      title: 'অনুমতি পরিবর্তন করা হয়েছে',
      p1: '{{changed_by}} {{change_time}} তারিখে <strong>{{role}}</strong> কী করতে পারবে তা পরিবর্তন করেছেন।',
      p2: '{{change_summary}}',
      buttonLabel: 'কার্যকলাপ লগ খুলুন',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” পাঠানো সম্পন্ন হয়েছে',
      title: 'আপনার ক্যাম্পেইন সম্পন্ন হয়েছে',
      p1: 'নমস্কার {{name}}, <strong>{{campaign_name}}</strong> সম্পন্ন হয়েছে। {{total_sent}}টি ইমেইল পাঠানো হয়েছে এবং {{total_failed}}টি ব্যর্থ হয়েছে।',
      p2: 'ওপেন এবং ক্লিক আরও কয়েক দিন আসতে থাকবে, তাই সংখ্যাগুলো এখনো পরিবর্তিত হবে।',
      buttonLabel: 'রিপোর্ট দেখুন',
    },
    'campaign.failed': {
      subject: 'পাঠানো বন্ধ হয়েছে: {{campaign_name}}',
      title: 'পাঠানো বন্ধ হয়েছে',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}}টি ইমেইল পাঠানোর পর বন্ধ হয়ে গেছে।',
      p2: 'প্রদানকারীর দেওয়া কারণ: {{reason}}',
      buttonLabel: 'ক্যাম্পেইন খুলুন',
    },
    'account.connected': {
      subject: '{{provider}} অ্যাকাউন্ট {{account_email}} সংযুক্ত হয়েছে',
      title: 'একটি পাঠানোর অ্যাকাউন্ট সংযুক্ত হয়েছে',
      p1: '{{changed_by}} {{change_time}} তারিখে <strong>{{account_email}}</strong> ({{provider}}) সংযুক্ত করেছেন।',
      buttonLabel: 'ইমেইল অ্যাকাউন্ট দেখুন',
    },
    'contacts.imported': {
      subject: 'ইম্পোর্ট সম্পন্ন হয়েছে — {{valid_count}}টি পরিচিতি যোগ করা হয়েছে',
      title: 'আপনার ইম্পোর্ট সম্পন্ন হয়েছে',
      p1: 'নমস্কার {{name}}, <strong>{{file_name}}</strong> ইম্পোর্ট করা হয়েছে।',
      p2: 'যোগ করা হয়েছে: {{valid_count}} · ত্রুটির কারণে বাদ: {{invalid_count}} · ডুপ্লিকেটের কারণে বাদ: {{duplicate_count}}',
      buttonLabel: 'পরিচিতি দেখুন',
    },
    'contact.subscribed': {
      subject: '{{name}} “{{campaign_name}}” থেকে সাবস্ক্রাইব করেছেন',
      title: 'একজন নতুন সাবস্ক্রাইবার',
      p1: '<strong>{{name}}</strong> ({{email}}) {{change_time}} তারিখে <strong>{{campaign_name}}</strong>-এ সাবস্ক্রাইব চাপেন।',
      p2: 'এখন এই ব্যক্তি আপনার সাবস্ক্রাইবার তালিকায় আছেন এবং যেকোনো নতুন ক্যাম্পেইনে প্রাপক হিসেবে বেছে নেওয়া যেতে পারে।',
      buttonLabel: 'সাবস্ক্রাইবার দেখুন',
    },
    'report.ready': {
      subject: 'আপনার {{report_name}} এক্সপোর্ট প্রস্তুত',
      title: 'আপনার ফাইল প্রস্তুত',
      p1: 'নমস্কার {{name}}, আপনার <strong>{{report_name}}</strong> এক্সপোর্ট প্রস্তুত — {{row_count}} সারি।',
      buttonLabel: 'ফাইল ডাউনলোড করুন',
      p2: 'এই লিঙ্কটি ৭ দিন কাজ করবে।',
    },
  },
};

LANG.mr = {
  footerNote: 'हा तुमच्या खात्याबद्दलचा स्वयंचलित संदेश आहे. तुम्ही यातून सदस्यत्व रद्द करू शकत नाही.',
  buttonNote: 'बटण काम करत नसेल, तर ही लिंक तुमच्या ब्राउझरमध्ये कॉपी करा:',
  translations: {
    'user.invited': {
      subject: 'तुम्हाला {{app_name}} मध्ये जोडण्यात आले आहे — तुमचा पासवर्ड सेट करा',
      title: 'नमस्कार {{name}},',
      p1: '{{invited_by}} यांनी {{app_name}} वर तुमच्यासाठी <strong>{{role}}</strong> म्हणून खाते तयार केले आहे.',
      p2: 'तुमचा साइन-इन ईमेल <strong>{{email}}</strong> आहे. पूर्ण करण्यासाठी तुमचा स्वतःचा पासवर्ड निवडा:',
      buttonLabel: 'माझा पासवर्ड सेट करा',
      p3: 'ही लिंक 48 तास काम करते. {{company}} मध्ये कोणीही तुम्ही निवडलेला पासवर्ड पाहू शकत नाही.',
    },
    'password.reset': {
      subject: 'तुमचा {{app_name}} पासवर्ड रीसेट करा',
      title: 'तुमचा पासवर्ड रीसेट करा',
      p1: 'नमस्कार {{name}}, आम्हाला {{request_time}} रोजी {{request_ip}} वरून पासवर्ड रीसेट करण्याची विनंती मिळाली.',
      buttonLabel: 'नवीन पासवर्ड निवडा',
      p2: 'ही लिंक 1 तास काम करते आणि एकदा वापरता येते. जर तुम्ही हे मागितले नसेल, तर हा ईमेल दुर्लक्षित करा — तुमचा पासवर्ड तसाच राहील.',
    },
    'password.changed': {
      subject: 'तुमचा {{app_name}} पासवर्ड बदलण्यात आला',
      title: 'तुमचा पासवर्ड बदलण्यात आला',
      p1: 'नमस्कार {{name}}, तुमचा {{app_name}} पासवर्ड {{change_time}} रोजी {{device}} ({{request_ip}}) वरून बदलण्यात आला.',
      p2: 'हे तुम्हीच केले असेल, तर आणखी काही करण्याची गरज नाही. हे तुम्ही केले नसेल, तर लगेच <a href="mailto:{{support_email}}">{{support_email}}</a> वर लिहा.',
    },
    'password.setByAdmin': {
      subject: 'तुमच्या {{app_name}} खात्यासाठी नवीन पासवर्ड सेट करण्यात आला',
      title: 'तुमच्यासाठी नवीन पासवर्ड सेट करण्यात आला',
      p1: 'नमस्कार {{name}}, <strong>{{changed_by}}</strong> यांनी {{change_time}} रोजी तुमच्या खात्यासाठी नवीन पासवर्ड सेट केला.',
      p2: 'पासवर्ड स्वतः तुम्हाला वेगळ्या पद्धतीने दिला गेला आहे — तो कधीही ईमेलमध्ये लिहिला जात नाही. कृपया साइन इन करा आणि तो फक्त तुम्हालाच माहीत असलेल्या गोष्टीत बदला.',
      buttonLabel: 'साइन इन करा',
    },
    'user.emailChangeConfirm': {
      subject: 'तुमचा नवीन {{app_name}} ईमेल पत्ता पुष्टी करा',
      title: 'हा ईमेल पत्ता पुष्टी करा',
      p1: 'नमस्कार {{name}}, {{changed_by}} यांनी तुमचा {{app_name}} साइन-इन ईमेल <strong>{{new_email}}</strong> मध्ये बदलण्याची विनंती केली आहे. अजून काहीही बदललेले नाही — आधी पुष्टी करा की तुम्ही येथे मेल वाचू शकता.',
      buttonLabel: 'हा ईमेल पुष्टी करा',
      p2: 'ही लिंक 1 तास काम करते आणि एकदा वापरता येते. जर तुम्हाला याची अपेक्षा नसेल, तर दुर्लक्षित करा — तुमचा जुना ईमेल काम करत राहील.',
    },
    'login.newDevice': {
      subject: 'तुमच्या {{app_name}} खात्यात नवीन साइन-इन',
      title: 'नवीन साइन-इन',
      p1: 'नमस्कार {{name}}, तुमचे खाते नवीन डिव्हाइसवर उघडण्यात आले.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'हे तुम्ही नव्हता का? आत्ताच तुमचा पासवर्ड बदला आणि <a href="mailto:{{support_email}}">{{support_email}}</a> ला कळवा.',
    },
    'user.roleChanged': {
      subject: '{{app_name}} मध्ये तुमची भूमिका आता {{new_role}} आहे',
      title: 'तुमची भूमिका बदलली आहे',
      p1: 'नमस्कार {{name}}, {{changed_by}} यांनी {{change_time}} रोजी तुमची भूमिका <strong>{{old_role}}</strong> वरून <strong>{{new_role}}</strong> अशी बदलली.',
      p2: 'पुढच्या वेळी तुम्ही साइन इन करता तेव्हा तुम्ही जे पाहू आणि करू शकता ते वेगळे दिसू शकते.',
    },
    'user.disabled': {
      subject: 'तुमचे {{app_name}} खाते बंद करण्यात आले आहे',
      title: 'तुमचे खाते बंद आहे',
      p1: 'नमस्कार {{name}}, {{changed_by}} यांनी {{change_time}} रोजी तुमचा प्रवेश बंद केला. तुम्ही साइन इन करू शकणार नाही.',
      p2: 'जर तुम्हाला वाटत असेल की ही चूक आहे, तर <a href="mailto:{{support_email}}">{{support_email}}</a> वर लिहा.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} यांनी {{name}} यांना {{app_name}} मध्ये जोडले',
      title: 'एक नवीन व्यक्ती जोडली गेली',
      p1: '{{created_by}} यांनी {{change_time}} रोजी <strong>{{name}}</strong> ({{email}}) यांना <strong>{{role}}</strong> म्हणून जोडले.',
      buttonLabel: 'क्रियाकलाप लॉग उघडा',
    },
    'admin.permissionChanged': {
      subject: '{{role}} साठी परवानग्या बदलल्या',
      title: 'परवानग्या बदलण्यात आल्या',
      p1: '{{changed_by}} यांनी {{change_time}} रोजी <strong>{{role}}</strong> काय करू शकतो ते बदलले.',
      p2: '{{change_summary}}',
      buttonLabel: 'क्रियाकलाप लॉग उघडा',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” पाठवणे पूर्ण झाले',
      title: 'तुमची मोहीम पूर्ण झाली',
      p1: 'नमस्कार {{name}}, <strong>{{campaign_name}}</strong> पूर्ण झाली आहे. {{total_sent}} ईमेल पाठवले गेले आणि {{total_failed}} अयशस्वी झाले.',
      p2: 'ओपन आणि क्लिक अजून काही दिवस येत राहतील, त्यामुळे आकडे अजूनही बदलतील.',
      buttonLabel: 'अहवाल पहा',
    },
    'campaign.failed': {
      subject: 'पाठवणे थांबले: {{campaign_name}}',
      title: 'पाठवणे थांबले',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}} ईमेल पाठवल्यानंतर थांबली.',
      p2: 'प्रदात्याने दिलेले कारण: {{reason}}',
      buttonLabel: 'मोहीम उघडा',
    },
    'account.connected': {
      subject: '{{provider}} खाते {{account_email}} जोडले गेले',
      title: 'पाठवण्याचे खाते जोडले गेले',
      p1: '{{changed_by}} यांनी {{change_time}} रोजी <strong>{{account_email}}</strong> ({{provider}}) जोडले.',
      buttonLabel: 'ईमेल खाती पहा',
    },
    'contacts.imported': {
      subject: 'इम्पोर्ट पूर्ण झाले — {{valid_count}} संपर्क जोडले गेले',
      title: 'तुमचे इम्पोर्ट पूर्ण झाले',
      p1: 'नमस्कार {{name}}, <strong>{{file_name}}</strong> इम्पोर्ट करण्यात आली आहे.',
      p2: 'जोडले: {{valid_count}} · चुकीचे असल्याने वगळले: {{invalid_count}} · डुप्लिकेट असल्याने वगळले: {{duplicate_count}}',
      buttonLabel: 'संपर्क पहा',
    },
    'contact.subscribed': {
      subject: '{{name}} यांनी “{{campaign_name}}” वरून सबस्क्राइब केले',
      title: 'एक नवीन सबस्क्रायबर',
      p1: '<strong>{{name}}</strong> ({{email}}) यांनी {{change_time}} रोजी <strong>{{campaign_name}}</strong> मध्ये सबस्क्राइब दाबले.',
      p2: 'आता ही व्यक्ती तुमच्या सबस्क्रायबर यादीत आहे आणि कोणत्याही नवीन मोहिमेत प्राप्तकर्ता म्हणून निवडली जाऊ शकते.',
      buttonLabel: 'सबस्क्रायबर पहा',
    },
    'report.ready': {
      subject: 'तुमचे {{report_name}} एक्सपोर्ट तयार आहे',
      title: 'तुमची फाइल तयार आहे',
      p1: 'नमस्कार {{name}}, तुमचे <strong>{{report_name}}</strong> एक्सपोर्ट तयार आहे — {{row_count}} ओळी.',
      buttonLabel: 'फाइल डाउनलोड करा',
      p2: 'ही लिंक 7 दिवस काम करते.',
    },
  },
};

LANG.gu = {
  footerNote: 'આ તમારા ખાતા વિશેનો સ્વયંસંચાલિત સંદેશ છે. તમે તેમાંથી અનસબસ્ક્રાઇબ કરી શકતા નથી.',
  buttonNote: 'જો બટન કામ ન કરે, તો આ લિંક તમારા બ્રાઉઝરમાં કૉપિ કરો:',
  translations: {
    'user.invited': {
      subject: 'તમને {{app_name}} માં ઉમેરવામાં આવ્યા છે — તમારો પાસવર્ડ સેટ કરો',
      title: 'નમસ્તે {{name}},',
      p1: '{{invited_by}} એ {{app_name}} પર તમારા માટે <strong>{{role}}</strong> તરીકે એકાઉન્ટ બનાવ્યું છે.',
      p2: 'તમારો સાઇન-ઇન ઈમેલ <strong>{{email}}</strong> છે. પૂર્ણ કરવા માટે તમારો પોતાનો પાસવર્ડ પસંદ કરો:',
      buttonLabel: 'મારો પાસવર્ડ સેટ કરો',
      p3: 'આ લિંક 48 કલાક માટે કામ કરે છે. {{company}} માં કોઈ પણ તમે પસંદ કરેલો પાસવર્ડ જોઈ શકતું નથી.',
    },
    'password.reset': {
      subject: 'તમારો {{app_name}} પાસવર્ડ રીસેટ કરો',
      title: 'તમારો પાસવર્ડ રીસેટ કરો',
      p1: 'નમસ્તે {{name}}, અમને {{request_time}} ના રોજ {{request_ip}} પરથી પાસવર્ડ રીસેટ કરવાની વિનંતી મળી.',
      buttonLabel: 'નવો પાસવર્ડ પસંદ કરો',
      p2: 'આ લિંક 1 કલાક માટે કામ કરે છે અને એકવાર વાપરી શકાય છે. જો તમે આ માંગ્યું ન હોય, તો આ ઈમેલને અવગણો — તમારો પાસવર્ડ એવો જ રહેશે.',
    },
    'password.changed': {
      subject: 'તમારો {{app_name}} પાસવર્ડ બદલાયો',
      title: 'તમારો પાસવર્ડ બદલાયો',
      p1: 'નમસ્તે {{name}}, તમારો {{app_name}} પાસવર્ડ {{change_time}} ના રોજ {{device}} ({{request_ip}}) પરથી બદલાયો.',
      p2: 'જો આ તમે કર્યું હોય, તો બીજું કંઈ કરવાની જરૂર નથી. જો આ તમે ન કર્યું હોય, તો તરત જ <a href="mailto:{{support_email}}">{{support_email}}</a> પર લખો.',
    },
    'password.setByAdmin': {
      subject: 'તમારા {{app_name}} એકાઉન્ટ માટે નવો પાસવર્ડ સેટ કરવામાં આવ્યો',
      title: 'તમારા માટે નવો પાસવર્ડ સેટ કરવામાં આવ્યો',
      p1: 'નમસ્તે {{name}}, <strong>{{changed_by}}</strong> એ {{change_time}} ના રોજ તમારા એકાઉન્ટ માટે નવો પાસવર્ડ સેટ કર્યો.',
      p2: 'પાસવર્ડ પોતે તમને અલગથી આપવામાં આવ્યો છે — તે ક્યારેય ઈમેલમાં લખવામાં આવતો નથી. કૃપા કરી સાઇન ઇન કરો અને તેને એવી વસ્તુમાં બદલો જે ફક્ત તમે જ જાણો છો.',
      buttonLabel: 'સાઇન ઇન કરો',
    },
    'user.emailChangeConfirm': {
      subject: 'તમારું નવું {{app_name}} ઈમેલ સરનામું પુષ્ટિ કરો',
      title: 'આ ઈમેલ સરનામાની પુષ્ટિ કરો',
      p1: 'નમસ્તે {{name}}, {{changed_by}} એ તમારો {{app_name}} સાઇન-ઇન ઈમેલ <strong>{{new_email}}</strong> માં બદલવાની વિનંતી કરી છે. હજી કંઈ બદલાયું નથી — પહેલા પુષ્ટિ કરો કે તમે અહીં મેલ વાંચી શકો છો.',
      buttonLabel: 'આ ઈમેલની પુષ્ટિ કરો',
      p2: 'આ લિંક 1 કલાક માટે કામ કરે છે અને એકવાર વાપરી શકાય છે. જો તમે આની અપેક્ષા ન રાખી હોય, તો તેને અવગણો — તમારો જૂનો ઈમેલ કામ કરતો રહેશે.',
    },
    'login.newDevice': {
      subject: 'તમારા {{app_name}} એકાઉન્ટમાં નવું સાઇન-ઇન',
      title: 'નવું સાઇન-ઇન',
      p1: 'નમસ્તે {{name}}, તમારું એકાઉન્ટ નવા ડિવાઇસ પર ખોલવામાં આવ્યું.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'શું આ તમે ન હતા? હમણાં જ તમારો પાસવર્ડ બદલો અને <a href="mailto:{{support_email}}">{{support_email}}</a> ને જણાવો.',
    },
    'user.roleChanged': {
      subject: '{{app_name}} માં તમારી ભૂમિકા હવે {{new_role}} છે',
      title: 'તમારી ભૂમિકા બદલાઈ ગઈ છે',
      p1: 'નમસ્તે {{name}}, {{changed_by}} એ {{change_time}} ના રોજ તમારી ભૂમિકા <strong>{{old_role}}</strong> માંથી <strong>{{new_role}}</strong> માં બદલી.',
      p2: 'આગલી વખતે તમે સાઇન ઇન કરો ત્યારે તમે જે જોઈ અને કરી શકો છો તે અલગ દેખાઈ શકે છે.',
    },
    'user.disabled': {
      subject: 'તમારું {{app_name}} એકાઉન્ટ બંધ કરવામાં આવ્યું છે',
      title: 'તમારું એકાઉન્ટ બંધ છે',
      p1: 'નમસ્તે {{name}}, {{changed_by}} એ {{change_time}} ના રોજ તમારો ઍક્સેસ બંધ કર્યો. તમે સાઇન ઇન કરી શકશો નહીં.',
      p2: 'જો તમને લાગે કે આ ભૂલ છે, તો <a href="mailto:{{support_email}}">{{support_email}}</a> પર લખો.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} એ {{name}} ને {{app_name}} માં ઉમેર્યા',
      title: 'એક નવી વ્યક્તિ ઉમેરવામાં આવી',
      p1: '{{created_by}} એ {{change_time}} ના રોજ <strong>{{name}}</strong> ({{email}}) ને <strong>{{role}}</strong> તરીકે ઉમેર્યા.',
      buttonLabel: 'પ્રવૃત્તિ લોગ ખોલો',
    },
    'admin.permissionChanged': {
      subject: '{{role}} માટે પરવાનગીઓ બદલાઈ',
      title: 'પરવાનગીઓ બદલવામાં આવી',
      p1: '{{changed_by}} એ {{change_time}} ના રોજ <strong>{{role}}</strong> શું કરી શકે તે બદલ્યું.',
      p2: '{{change_summary}}',
      buttonLabel: 'પ્રવૃત્તિ લોગ ખોલો',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” મોકલવાનું પૂર્ણ થયું',
      title: 'તમારું કેમ્પેઇન પૂર્ણ થયું',
      p1: 'નમસ્તે {{name}}, <strong>{{campaign_name}}</strong> પૂર્ણ થયું છે. {{total_sent}} ઈમેલ મોકલવામાં આવ્યા અને {{total_failed}} નિષ્ફળ ગયા.',
      p2: 'ઓપન અને ક્લિક હજુ થોડા દિવસો સુધી આવતા રહેશે, તેથી આંકડા હજુ બદલાશે.',
      buttonLabel: 'રિપોર્ટ જુઓ',
    },
    'campaign.failed': {
      subject: 'મોકલવાનું અટક્યું: {{campaign_name}}',
      title: 'મોકલવાનું અટકી ગયું',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}} ઈમેલ મોકલ્યા પછી અટકી ગયું.',
      p2: 'પ્રદાતા દ્વારા આપવામાં આવેલું કારણ: {{reason}}',
      buttonLabel: 'કેમ્પેઇન ખોલો',
    },
    'account.connected': {
      subject: '{{provider}} એકાઉન્ટ {{account_email}} જોડાયું',
      title: 'મોકલવાનું એકાઉન્ટ જોડાયું',
      p1: '{{changed_by}} એ {{change_time}} ના રોજ <strong>{{account_email}}</strong> ({{provider}}) જોડ્યું.',
      buttonLabel: 'ઈમેલ એકાઉન્ટ જુઓ',
    },
    'contacts.imported': {
      subject: 'ઇમ્પોર્ટ પૂર્ણ થયું — {{valid_count}} સંપર્કો ઉમેરાયા',
      title: 'તમારું ઇમ્પોર્ટ પૂર્ણ થયું',
      p1: 'નમસ્તે {{name}}, <strong>{{file_name}}</strong> ઇમ્પોર્ટ કરવામાં આવી છે.',
      p2: 'ઉમેરાયા: {{valid_count}} · ભૂલને કારણે છોડાયા: {{invalid_count}} · ડુપ્લિકેટને કારણે છોડાયા: {{duplicate_count}}',
      buttonLabel: 'સંપર્કો જુઓ',
    },
    'contact.subscribed': {
      subject: '{{name}} એ “{{campaign_name}}” માંથી સબ્સ્ક્રાઇબ કર્યું',
      title: 'એક નવું સબ્સ્ક્રાઇબર',
      p1: '<strong>{{name}}</strong> ({{email}}) એ {{change_time}} ના રોજ <strong>{{campaign_name}}</strong> માં સબ્સ્ક્રાઇબ દબાવ્યું.',
      p2: 'હવે આ વ્યક્તિ તમારી સબ્સ્ક્રાઇબર યાદીમાં છે અને કોઈપણ નવા કેમ્પેઇનમાં પ્રાપ્તકર્તા તરીકે પસંદ કરી શકાય છે.',
      buttonLabel: 'સબ્સ્ક્રાઇબર જુઓ',
    },
    'report.ready': {
      subject: 'તમારું {{report_name}} એક્સપોર્ટ તૈયાર છે',
      title: 'તમારી ફાઇલ તૈયાર છે',
      p1: 'નમસ્તે {{name}}, તમારું <strong>{{report_name}}</strong> એક્સપોર્ટ તૈયાર છે — {{row_count}} પંક્તિઓ.',
      buttonLabel: 'ફાઇલ ડાઉનલોડ કરો',
      p2: 'આ લિંક 7 દિવસ માટે કામ કરે છે.',
    },
  },
};

LANG.hi = {
  footerNote: 'यह आपके खाते से जुड़ा एक स्वचालित संदेश है। आप इसकी सदस्यता समाप्त नहीं कर सकते।',
  buttonNote: 'यदि बटन काम न करे, तो इस लिंक को अपने ब्राउज़र में कॉपी करें:',
  translations: {
    'user.invited': {
      subject: 'आपको {{app_name}} में जोड़ा गया है — अपना पासवर्ड सेट करें',
      title: 'नमस्ते {{name}},',
      p1: '{{invited_by}} ने {{app_name}} पर आपके लिए <strong>{{role}}</strong> के रूप में एक खाता बनाया है।',
      p2: 'आपका साइन-इन ईमेल <strong>{{email}}</strong> है। पूरा करने के लिए अपना पासवर्ड चुनें:',
      buttonLabel: 'मेरा पासवर्ड सेट करें',
      p3: 'यह लिंक 48 घंटे तक काम करेगा। {{company}} में कोई भी आपके द्वारा चुना गया पासवर्ड नहीं देख सकता।',
    },
    'password.reset': {
      subject: 'अपना {{app_name}} पासवर्ड रीसेट करें',
      title: 'अपना पासवर्ड रीसेट करें',
      p1: 'नमस्ते {{name}}, हमें {{request_time}} को {{request_ip}} से आपका पासवर्ड रीसेट करने का अनुरोध मिला।',
      buttonLabel: 'नया पासवर्ड चुनें',
      p2: 'यह लिंक 1 घंटे तक काम करता है और एक बार इस्तेमाल किया जा सकता है। अगर आपने यह नहीं माँगा, तो इस ईमेल को नज़रअंदाज़ करें — आपका पासवर्ड वैसा ही रहेगा।',
    },
    'password.changed': {
      subject: 'आपका {{app_name}} पासवर्ड बदल दिया गया',
      title: 'आपका पासवर्ड बदल दिया गया',
      p1: 'नमस्ते {{name}}, आपका {{app_name}} पासवर्ड {{change_time}} को {{device}} ({{request_ip}}) से बदला गया।',
      p2: 'अगर यह आपने किया है, तो कुछ और करने की ज़रूरत नहीं। अगर यह आपने नहीं किया, तो तुरंत <a href="mailto:{{support_email}}">{{support_email}}</a> पर लिखें।',
    },
    'password.setByAdmin': {
      subject: 'आपके {{app_name}} खाते के लिए एक नया पासवर्ड सेट किया गया',
      title: 'आपके लिए एक नया पासवर्ड सेट किया गया',
      p1: 'नमस्ते {{name}}, <strong>{{changed_by}}</strong> ने {{change_time}} को आपके खाते के लिए एक नया पासवर्ड सेट किया।',
      p2: 'पासवर्ड खुद आपको अलग से दिया गया है — यह कभी भी ईमेल में नहीं लिखा जाता। कृपया साइन इन करें और इसे किसी ऐसी चीज़ में बदलें जो केवल आप जानते हों।',
      buttonLabel: 'साइन इन करें',
    },
    'user.emailChangeConfirm': {
      subject: 'अपना नया {{app_name}} ईमेल पता पुष्ट करें',
      title: 'इस ईमेल पते की पुष्टि करें',
      p1: 'नमस्ते {{name}}, {{changed_by}} ने आपका {{app_name}} साइन-इन ईमेल <strong>{{new_email}}</strong> में बदलने का अनुरोध किया है। अभी तक कुछ नहीं बदला है — पहले पुष्टि करें कि आप यहाँ मेल पढ़ सकते हैं।',
      buttonLabel: 'इस ईमेल की पुष्टि करें',
      p2: 'यह लिंक 1 घंटे तक काम करता है और एक बार इस्तेमाल किया जा सकता है। अगर आपने यह उम्मीद नहीं की थी, तो इसे नज़रअंदाज़ करें — आपका पुराना ईमेल काम करता रहेगा।',
    },
    'login.newDevice': {
      subject: 'आपके {{app_name}} खाते में नया साइन-इन',
      title: 'नया साइन-इन',
      p1: 'नमस्ते {{name}}, आपका खाता एक नए डिवाइस पर खोला गया।',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'क्या यह आप नहीं थे? अभी अपना पासवर्ड बदलें और <a href="mailto:{{support_email}}">{{support_email}}</a> को बताएं।',
    },
    'user.roleChanged': {
      subject: '{{app_name}} में आपकी भूमिका अब {{new_role}} है',
      title: 'आपकी भूमिका बदल गई है',
      p1: 'नमस्ते {{name}}, {{changed_by}} ने {{change_time}} को आपकी भूमिका <strong>{{old_role}}</strong> से बदलकर <strong>{{new_role}}</strong> कर दी।',
      p2: 'अगली बार साइन इन करने पर आप जो देख और कर सकते हैं वह अलग दिख सकता है।',
    },
    'user.disabled': {
      subject: 'आपका {{app_name}} खाता बंद कर दिया गया है',
      title: 'आपका खाता बंद है',
      p1: 'नमस्ते {{name}}, {{changed_by}} ने {{change_time}} को आपकी पहुँच बंद कर दी। आप साइन इन नहीं कर पाएंगे।',
      p2: 'अगर आपको लगता है कि यह गलती है, तो <a href="mailto:{{support_email}}">{{support_email}}</a> पर लिखें।',
    },
    'admin.userCreated': {
      subject: '{{created_by}} ने {{name}} को {{app_name}} में जोड़ा',
      title: 'एक नया व्यक्ति जोड़ा गया',
      p1: '{{created_by}} ने {{change_time}} को <strong>{{name}}</strong> ({{email}}) को <strong>{{role}}</strong> के रूप में जोड़ा।',
      buttonLabel: 'गतिविधि लॉग खोलें',
    },
    'admin.permissionChanged': {
      subject: '{{role}} के लिए अनुमतियाँ बदली गईं',
      title: 'अनुमतियाँ बदल दी गईं',
      p1: '{{changed_by}} ने {{change_time}} को बदला कि <strong>{{role}}</strong> क्या कर सकता है।',
      p2: '{{change_summary}}',
      buttonLabel: 'गतिविधि लॉग खोलें',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” भेजना पूरा हो गया',
      title: 'आपका कैंपेन पूरा हो गया',
      p1: 'नमस्ते {{name}}, <strong>{{campaign_name}}</strong> पूरा हो गया है। {{total_sent}} ईमेल भेजे गए और {{total_failed}} विफल रहे।',
      p2: 'ओपन और क्लिक कुछ दिनों तक आते रहेंगे, इसलिए संख्याएँ अभी भी बदलेंगी।',
      buttonLabel: 'रिपोर्ट देखें',
    },
    'campaign.failed': {
      subject: 'भेजना रुक गया: {{campaign_name}}',
      title: 'भेजना रुक गया',
      p1: '<strong>{{campaign_name}}</strong> {{sent_so_far}} ईमेल भेजने के बाद रुक गया।',
      p2: 'प्रदाता द्वारा दिया गया कारण: {{reason}}',
      buttonLabel: 'कैंपेन खोलें',
    },
    'account.connected': {
      subject: '{{provider}} खाता {{account_email}} जोड़ा गया',
      title: 'एक भेजने वाला खाता जोड़ा गया',
      p1: '{{changed_by}} ने {{change_time}} को <strong>{{account_email}}</strong> ({{provider}}) जोड़ा।',
      buttonLabel: 'ईमेल खाते देखें',
    },
    'contacts.imported': {
      subject: 'इम्पोर्ट पूरा हुआ — {{valid_count}} संपर्क जोड़े गए',
      title: 'आपका इम्पोर्ट पूरा हो गया',
      p1: 'नमस्ते {{name}}, <strong>{{file_name}}</strong> इम्पोर्ट कर दी गई है।',
      p2: 'जोड़े गए: {{valid_count}} · गलत होने के कारण छोड़े गए: {{invalid_count}} · डुप्लीकेट होने के कारण छोड़े गए: {{duplicate_count}}',
      buttonLabel: 'संपर्क देखें',
    },
    'contact.subscribed': {
      subject: '{{name}} ने “{{campaign_name}}” से सब्सक्राइब किया',
      title: 'एक नया सब्सक्राइबर',
      p1: '<strong>{{name}}</strong> ({{email}}) ने {{change_time}} को <strong>{{campaign_name}}</strong> में सब्सक्राइब दबाया।',
      p2: 'अब यह व्यक्ति आपकी सब्सक्राइबर सूची में है और किसी भी नए कैंपेन में प्राप्तकर्ता के रूप में चुना जा सकता है।',
      buttonLabel: 'सब्सक्राइबर देखें',
    },
    'report.ready': {
      subject: 'आपका {{report_name}} एक्सपोर्ट तैयार है',
      title: 'आपकी फ़ाइल तैयार है',
      p1: 'नमस्ते {{name}}, आपका <strong>{{report_name}}</strong> एक्सपोर्ट तैयार है — {{row_count}} पंक्तियाँ।',
      buttonLabel: 'फ़ाइल डाउनलोड करें',
      p2: 'यह लिंक 7 दिनों तक काम करता है।',
    },
  },
};

LANG.ar = {
  footerNote: 'هذه رسالة تلقائية بخصوص حسابك. لا يمكنك إلغاء الاشتراك فيها.',
  buttonNote: 'إذا لم يعمل الزر، انسخ هذا الرابط إلى متصفحك:',
  translations: {
    'user.invited': {
      subject: 'تمت إضافتك إلى {{app_name}} — قم بتعيين كلمة المرور الخاصة بك',
      title: 'مرحبًا {{name}}،',
      p1: 'قام {{invited_by}} بإنشاء حساب لك على {{app_name}} بصفة <strong>{{role}}</strong>.',
      p2: 'بريدك الإلكتروني لتسجيل الدخول هو <strong>{{email}}</strong>. اختر كلمة المرور الخاصة بك لإكمال العملية:',
      buttonLabel: 'تعيين كلمة المرور الخاصة بي',
      p3: 'يعمل هذا الرابط لمدة 48 ساعة. لا يمكن لأحد في {{company}} رؤية كلمة المرور التي تختارها.',
    },
    'password.reset': {
      subject: 'أعد تعيين كلمة مرور {{app_name}} الخاصة بك',
      title: 'أعد تعيين كلمة المرور',
      p1: 'مرحبًا {{name}}، تلقينا طلبًا لإعادة تعيين كلمة المرور الخاصة بك في {{request_time}} من {{request_ip}}.',
      buttonLabel: 'اختر كلمة مرور جديدة',
      p2: 'يعمل هذا الرابط لمدة ساعة واحدة ويمكن استخدامه مرة واحدة. إذا لم تطلب هذا، تجاهل هذه الرسالة — ستبقى كلمة المرور كما هي.',
    },
    'password.changed': {
      subject: 'تم تغيير كلمة مرور {{app_name}} الخاصة بك',
      title: 'تم تغيير كلمة المرور الخاصة بك',
      p1: 'مرحبًا {{name}}، تم تغيير كلمة مرور {{app_name}} الخاصة بك في {{change_time}} من {{device}} ({{request_ip}}).',
      p2: 'إذا كنت أنت من قام بذلك، فلا داعي لفعل أي شيء آخر. إذا لم تكن أنت، فراسل فورًا <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'password.setByAdmin': {
      subject: 'تم تعيين كلمة مرور جديدة لحسابك على {{app_name}}',
      title: 'تم تعيين كلمة مرور جديدة لك',
      p1: 'مرحبًا {{name}}، قام <strong>{{changed_by}}</strong> بتعيين كلمة مرور جديدة لحسابك في {{change_time}}.',
      p2: 'تم إرسال كلمة المرور نفسها إليك بشكل منفصل — فهي لا تُكتب أبدًا في رسالة بريد إلكتروني. يرجى تسجيل الدخول وتغييرها إلى شيء لا يعرفه سواك.',
      buttonLabel: 'تسجيل الدخول',
    },
    'user.emailChangeConfirm': {
      subject: 'أكّد عنوان بريدك الإلكتروني الجديد في {{app_name}}',
      title: 'أكّد عنوان البريد الإلكتروني هذا',
      p1: 'مرحبًا {{name}}، طلب {{changed_by}} تغيير بريد تسجيل الدخول الخاص بك على {{app_name}} إلى <strong>{{new_email}}</strong>. لم يتغير شيء بعد — يرجى التأكيد أولاً بأنه يمكنك قراءة البريد هنا.',
      buttonLabel: 'تأكيد هذا البريد الإلكتروني',
      p2: 'يعمل هذا الرابط لمدة ساعة واحدة ويمكن استخدامه مرة واحدة. إذا لم تكن تتوقع هذا، تجاهله — سيستمر بريدك الإلكتروني القديم في العمل.',
    },
    'login.newDevice': {
      subject: 'تسجيل دخول جديد إلى حسابك على {{app_name}}',
      title: 'تسجيل دخول جديد',
      p1: 'مرحبًا {{name}}، تم فتح حسابك على جهاز جديد.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'ألم تكن أنت؟ غيّر كلمة المرور الآن وأخبر <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'دورك في {{app_name}} أصبح الآن {{new_role}}',
      title: 'تغيّر دورك',
      p1: 'مرحبًا {{name}}، قام {{changed_by}} بتغيير دورك من <strong>{{old_role}}</strong> إلى <strong>{{new_role}}</strong> في {{change_time}}.',
      p2: 'قد يبدو ما يمكنك رؤيته والقيام به مختلفًا في المرة القادمة التي تسجل فيها الدخول.',
    },
    'user.disabled': {
      subject: 'تم إيقاف حسابك على {{app_name}}',
      title: 'حسابك موقوف',
      p1: 'مرحبًا {{name}}، قام {{changed_by}} بإيقاف وصولك في {{change_time}}. لن تتمكن من تسجيل الدخول.',
      p2: 'إذا كنت تعتقد أن هذا خطأ، راسل <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: 'أضاف {{created_by}} {{name}} إلى {{app_name}}',
      title: 'تمت إضافة شخص جديد',
      p1: 'أضاف {{created_by}} <strong>{{name}}</strong> ({{email}}) بصفة <strong>{{role}}</strong> في {{change_time}}.',
      buttonLabel: 'افتح سجل النشاط',
    },
    'admin.permissionChanged': {
      subject: 'تم تغيير الصلاحيات لـ {{role}}',
      title: 'تم تغيير الصلاحيات',
      p1: 'غيّر {{changed_by}} ما يمكن لـ <strong>{{role}}</strong> فعله في {{change_time}}.',
      p2: '{{change_summary}}',
      buttonLabel: 'افتح سجل النشاط',
    },
    'campaign.finished': {
      subject: 'انتهى إرسال "{{campaign_name}}"',
      title: 'اكتملت حملتك',
      p1: 'مرحبًا {{name}}، اكتملت <strong>{{campaign_name}}</strong>. تم إرسال {{total_sent}} رسالة وفشلت {{total_failed}}.',
      p2: 'ستستمر الفتحات والنقرات في الوصول لبضعة أيام، لذا ستظل الأرقام تتغير.',
      buttonLabel: 'عرض التقرير',
    },
    'campaign.failed': {
      subject: 'توقف الإرسال: {{campaign_name}}',
      title: 'توقف الإرسال',
      p1: 'توقفت <strong>{{campaign_name}}</strong> بعد إرسال {{sent_so_far}} رسالة.',
      p2: 'السبب الذي قدمه مزود الخدمة: {{reason}}',
      buttonLabel: 'افتح الحملة',
    },
    'account.connected': {
      subject: 'تم توصيل حساب {{provider}} {{account_email}}',
      title: 'تم توصيل حساب إرسال',
      p1: 'قام {{changed_by}} بتوصيل <strong>{{account_email}}</strong> ({{provider}}) في {{change_time}}.',
      buttonLabel: 'عرض حسابات البريد الإلكتروني',
    },
    'contacts.imported': {
      subject: 'اكتمل الاستيراد — تمت إضافة {{valid_count}} جهة اتصال',
      title: 'اكتمل استيرادك',
      p1: 'مرحبًا {{name}}، تم استيراد <strong>{{file_name}}</strong>.',
      p2: 'تمت الإضافة: {{valid_count}} · تم التخطي بسبب خطأ: {{invalid_count}} · تم التخطي كتكرار: {{duplicate_count}}',
      buttonLabel: 'عرض جهات الاتصال',
    },
    'contact.subscribed': {
      subject: 'اشترك {{name}} من "{{campaign_name}}"',
      title: 'مشترك جديد',
      p1: 'ضغط <strong>{{name}}</strong> ({{email}}) على اشتراك في <strong>{{campaign_name}}</strong> في {{change_time}}.',
      p2: 'هذا الشخص الآن في قائمة المشتركين لديك ويمكن اختياره كمستلم في أي حملة جديدة.',
      buttonLabel: 'عرض المشتركين',
    },
    'report.ready': {
      subject: 'تصدير {{report_name}} الخاص بك جاهز',
      title: 'ملفك جاهز',
      p1: 'مرحبًا {{name}}، تصدير <strong>{{report_name}}</strong> الخاص بك جاهز — {{row_count}} صف.',
      buttonLabel: 'تنزيل الملف',
      p2: 'يعمل هذا الرابط لمدة 7 أيام.',
    },
  },
};

LANG.th = {
  footerNote: 'นี่คือข้อความอัตโนมัติเกี่ยวกับบัญชีของคุณ คุณไม่สามารถยกเลิกการรับข้อความนี้ได้',
  buttonNote: 'หากปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์ของคุณ:',
  translations: {
    'user.invited': {
      subject: 'คุณถูกเพิ่มเข้า {{app_name}} แล้ว — ตั้งรหัสผ่านของคุณ',
      title: 'สวัสดี {{name}},',
      p1: '{{invited_by}} ได้สร้างบัญชีให้คุณใน {{app_name}} ในตำแหน่ง<strong>{{role}}</strong>',
      p2: 'อีเมลเข้าสู่ระบบของคุณคือ <strong>{{email}}</strong> เลือกรหัสผ่านของคุณเองเพื่อดำเนินการให้เสร็จสมบูรณ์:',
      buttonLabel: 'ตั้งรหัสผ่านของฉัน',
      p3: 'ลิงก์นี้ใช้งานได้ 48 ชั่วโมง ไม่มีใครใน {{company}} เห็นรหัสผ่านที่คุณเลือกได้',
    },
    'password.reset': {
      subject: 'รีเซ็ตรหัสผ่าน {{app_name}} ของคุณ',
      title: 'รีเซ็ตรหัสผ่านของคุณ',
      p1: 'สวัสดี {{name}}, เราได้รับคำขอรีเซ็ตรหัสผ่านเมื่อ {{request_time}} จาก {{request_ip}}',
      buttonLabel: 'เลือกรหัสผ่านใหม่',
      p2: 'ลิงก์นี้ใช้งานได้ 1 ชั่วโมงและใช้ได้เพียงครั้งเดียว หากคุณไม่ได้ขอสิ่งนี้ ให้เพิกเฉยต่ออีเมลนี้ — รหัสผ่านของคุณจะไม่เปลี่ยนแปลง',
    },
    'password.changed': {
      subject: 'รหัสผ่าน {{app_name}} ของคุณถูกเปลี่ยนแล้ว',
      title: 'รหัสผ่านของคุณถูกเปลี่ยนแล้ว',
      p1: 'สวัสดี {{name}}, รหัสผ่าน {{app_name}} ของคุณถูกเปลี่ยนเมื่อ {{change_time}} จาก {{device}} ({{request_ip}})',
      p2: 'หากเป็นคุณเอง ไม่ต้องทำอะไรเพิ่มเติม หากไม่ใช่คุณ ให้เขียนถึง <a href="mailto:{{support_email}}">{{support_email}}</a> ทันที',
    },
    'password.setByAdmin': {
      subject: 'มีการตั้งรหัสผ่านใหม่สำหรับบัญชี {{app_name}} ของคุณ',
      title: 'มีการตั้งรหัสผ่านใหม่ให้คุณ',
      p1: 'สวัสดี {{name}}, <strong>{{changed_by}}</strong> ได้ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณเมื่อ {{change_time}}',
      p2: 'รหัสผ่านนั้นถูกส่งให้คุณแยกต่างหาก — จะไม่มีวันเขียนไว้ในอีเมล กรุณาเข้าสู่ระบบและเปลี่ยนเป็นสิ่งที่มีเพียงคุณเท่านั้นที่รู้',
      buttonLabel: 'เข้าสู่ระบบ',
    },
    'user.emailChangeConfirm': {
      subject: 'ยืนยันที่อยู่อีเมล {{app_name}} ใหม่ของคุณ',
      title: 'ยืนยันที่อยู่อีเมลนี้',
      p1: 'สวัสดี {{name}}, {{changed_by}} ขอเปลี่ยนอีเมลเข้าสู่ระบบ {{app_name}} ของคุณเป็น <strong>{{new_email}}</strong> ยังไม่มีอะไรเปลี่ยนแปลง — กรุณายืนยันก่อนว่าคุณสามารถอ่านเมลที่นี่ได้',
      buttonLabel: 'ยืนยันอีเมลนี้',
      p2: 'ลิงก์นี้ใช้งานได้ 1 ชั่วโมงและใช้ได้เพียงครั้งเดียว หากคุณไม่ได้คาดหวังสิ่งนี้ ให้เพิกเฉย — อีเมลเดิมของคุณยังคงใช้งานได้',
    },
    'login.newDevice': {
      subject: 'มีการเข้าสู่ระบบใหม่ในบัญชี {{app_name}} ของคุณ',
      title: 'การเข้าสู่ระบบใหม่',
      p1: 'สวัสดี {{name}}, บัญชีของคุณถูกเปิดบนอุปกรณ์ใหม่',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'ไม่ใช่คุณใช่ไหม? เปลี่ยนรหัสผ่านของคุณตอนนี้และแจ้ง <a href="mailto:{{support_email}}">{{support_email}}</a>',
    },
    'user.roleChanged': {
      subject: 'บทบาทของคุณใน {{app_name}} ตอนนี้คือ {{new_role}}',
      title: 'บทบาทของคุณเปลี่ยนไปแล้ว',
      p1: 'สวัสดี {{name}}, {{changed_by}} เปลี่ยนบทบาทของคุณจาก <strong>{{old_role}}</strong> เป็น <strong>{{new_role}}</strong> เมื่อ {{change_time}}',
      p2: 'สิ่งที่คุณเห็นและทำได้อาจดูแตกต่างออกไปในครั้งถัดไปที่คุณเข้าสู่ระบบ',
    },
    'user.disabled': {
      subject: 'บัญชี {{app_name}} ของคุณถูกปิดใช้งานแล้ว',
      title: 'บัญชีของคุณถูกปิดใช้งาน',
      p1: 'สวัสดี {{name}}, {{changed_by}} ปิดการเข้าถึงของคุณเมื่อ {{change_time}} คุณจะไม่สามารถเข้าสู่ระบบได้',
      p2: 'หากคุณคิดว่านี่เป็นความผิดพลาด ให้เขียนถึง <a href="mailto:{{support_email}}">{{support_email}}</a>',
    },
    'admin.userCreated': {
      subject: '{{created_by}} เพิ่ม {{name}} เข้า {{app_name}} แล้ว',
      title: 'มีคนใหม่ถูกเพิ่มเข้ามา',
      p1: '{{created_by}} เพิ่ม <strong>{{name}}</strong> ({{email}}) ในตำแหน่ง<strong>{{role}}</strong>เมื่อ {{change_time}}',
      buttonLabel: 'เปิดบันทึกกิจกรรม',
    },
    'admin.permissionChanged': {
      subject: 'สิทธิ์ของ {{role}} มีการเปลี่ยนแปลง',
      title: 'สิทธิ์ถูกเปลี่ยนแปลงแล้ว',
      p1: '{{changed_by}} เปลี่ยนสิ่งที่ <strong>{{role}}</strong> ทำได้เมื่อ {{change_time}}',
      p2: '{{change_summary}}',
      buttonLabel: 'เปิดบันทึกกิจกรรม',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” ส่งเสร็จสิ้นแล้ว',
      title: 'แคมเปญของคุณเสร็จสิ้นแล้ว',
      p1: 'สวัสดี {{name}}, <strong>{{campaign_name}}</strong> เสร็จสิ้นแล้ว ส่งไปแล้ว {{total_sent}} ฉบับ และล้มเหลว {{total_failed}} ฉบับ',
      p2: 'การเปิดอ่านและการคลิกจะยังคงเข้ามาอีกสองสามวัน ดังนั้นตัวเลขจะยังคงเปลี่ยนแปลง',
      buttonLabel: 'ดูรายงาน',
    },
    'campaign.failed': {
      subject: 'การส่งหยุดลง: {{campaign_name}}',
      title: 'การส่งหยุดลงแล้ว',
      p1: '<strong>{{campaign_name}}</strong> หยุดลงหลังจากส่งไป {{sent_so_far}} ฉบับ',
      p2: 'เหตุผลที่ผู้ให้บริการแจ้ง: {{reason}}',
      buttonLabel: 'เปิดแคมเปญ',
    },
    'account.connected': {
      subject: 'บัญชี {{provider}} {{account_email}} เชื่อมต่อแล้ว',
      title: 'เชื่อมต่อบัญชีสำหรับส่งแล้ว',
      p1: '{{changed_by}} เชื่อมต่อ <strong>{{account_email}}</strong> ({{provider}}) เมื่อ {{change_time}}',
      buttonLabel: 'ดูบัญชีอีเมล',
    },
    'contacts.imported': {
      subject: 'นำเข้าเสร็จสิ้นแล้ว — เพิ่มรายชื่อติดต่อ {{valid_count}} รายการ',
      title: 'การนำเข้าของคุณเสร็จสิ้นแล้ว',
      p1: 'สวัสดี {{name}}, <strong>{{file_name}}</strong> ถูกนำเข้าแล้ว',
      p2: 'เพิ่มแล้ว: {{valid_count}} · ข้ามเนื่องจากผิดพลาด: {{invalid_count}} · ข้ามเนื่องจากซ้ำ: {{duplicate_count}}',
      buttonLabel: 'ดูรายชื่อติดต่อ',
    },
    'contact.subscribed': {
      subject: '{{name}} สมัครรับข่าวสารจาก “{{campaign_name}}”',
      title: 'ผู้สมัครรับข่าวสารรายใหม่',
      p1: '<strong>{{name}}</strong> ({{email}}) กดสมัครรับข่าวสารใน <strong>{{campaign_name}}</strong> เมื่อ {{change_time}}',
      p2: 'ตอนนี้บุคคลนี้อยู่ในรายชื่อผู้สมัครรับข่าวสารของคุณแล้ว และสามารถเลือกเป็นผู้รับในแคมเปญใหม่ใดก็ได้',
      buttonLabel: 'ดูผู้สมัครรับข่าวสาร',
    },
    'report.ready': {
      subject: 'การส่งออก {{report_name}} ของคุณพร้อมแล้ว',
      title: 'ไฟล์ของคุณพร้อมแล้ว',
      p1: 'สวัสดี {{name}}, การส่งออก <strong>{{report_name}}</strong> ของคุณพร้อมแล้ว — {{row_count}} แถว',
      buttonLabel: 'ดาวน์โหลดไฟล์',
      p2: 'ลิงก์นี้ใช้งานได้ 7 วัน',
    },
  },
};

LANG.ko = {
  footerNote: '이것은 회원님의 계정에 관한 자동 메시지입니다. 수신 거부할 수 없습니다.',
  buttonNote: '버튼이 작동하지 않으면 이 링크를 브라우저에 복사하세요:',
  translations: {
    'user.invited': {
      subject: '{{app_name}}에 추가되셨습니다 — 비밀번호를 설정하세요',
      title: '안녕하세요, {{name}}님,',
      p1: '{{invited_by}}님이 {{app_name}}에서 회원님의 계정을 <strong>{{role}}</strong>(으)로 생성했습니다.',
      p2: '로그인 이메일은 <strong>{{email}}</strong>입니다. 완료하려면 비밀번호를 직접 선택하세요:',
      buttonLabel: '비밀번호 설정하기',
      p3: '이 링크는 48시간 동안 유효합니다. {{company}}의 누구도 회원님이 선택한 비밀번호를 볼 수 없습니다.',
    },
    'password.reset': {
      subject: '{{app_name}} 비밀번호를 재설정하세요',
      title: '비밀번호 재설정',
      p1: '안녕하세요, {{name}}님, {{request_time}}에 {{request_ip}}에서 비밀번호 재설정 요청을 받았습니다.',
      buttonLabel: '새 비밀번호 선택하기',
      p2: '이 링크는 1시간 동안 유효하며 한 번만 사용할 수 있습니다. 요청하지 않으셨다면 이 이메일을 무시하세요 — 비밀번호는 그대로 유지됩니다.',
    },
    'password.changed': {
      subject: '{{app_name}} 비밀번호가 변경되었습니다',
      title: '비밀번호가 변경되었습니다',
      p1: '안녕하세요, {{name}}님, {{app_name}} 비밀번호가 {{change_time}}에 {{device}}({{request_ip}})에서 변경되었습니다.',
      p2: '본인이 변경하셨다면 더 이상 할 일이 없습니다. 본인이 아니라면 즉시 <a href="mailto:{{support_email}}">{{support_email}}</a>로 연락해 주세요.',
    },
    'password.setByAdmin': {
      subject: '{{app_name}} 계정에 새 비밀번호가 설정되었습니다',
      title: '새 비밀번호가 설정되었습니다',
      p1: '안녕하세요, {{name}}님, <strong>{{changed_by}}</strong>님이 {{change_time}}에 회원님의 계정에 새 비밀번호를 설정했습니다.',
      p2: '비밀번호 자체는 별도로 전달되었으며, 이메일에는 절대 포함되지 않습니다. 로그인 후 본인만 아는 것으로 변경해 주세요.',
      buttonLabel: '로그인',
    },
    'user.emailChangeConfirm': {
      subject: '새 {{app_name}} 이메일 주소를 확인하세요',
      title: '이 이메일 주소 확인',
      p1: '안녕하세요, {{name}}님, {{changed_by}}님이 {{app_name}} 로그인 이메일을 <strong>{{new_email}}</strong>(으)로 변경하도록 요청했습니다. 아직 아무것도 변경되지 않았습니다 — 먼저 이 주소로 메일을 받을 수 있는지 확인해 주세요.',
      buttonLabel: '이 이메일 확인하기',
      p2: '이 링크는 1시간 동안 유효하며 한 번만 사용할 수 있습니다. 예상하지 못한 요청이라면 무시하세요 — 기존 이메일은 계속 작동합니다.',
    },
    'login.newDevice': {
      subject: '{{app_name}} 계정에 새 로그인이 있었습니다',
      title: '새 로그인',
      p1: '안녕하세요, {{name}}님, 새 기기에서 계정이 열렸습니다.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: '본인이 아니신가요? 지금 바로 비밀번호를 변경하고 <a href="mailto:{{support_email}}">{{support_email}}</a>로 알려주세요.',
    },
    'user.roleChanged': {
      subject: '{{app_name}}에서의 역할이 {{new_role}}(으)로 변경되었습니다',
      title: '역할이 변경되었습니다',
      p1: '안녕하세요, {{name}}님, {{changed_by}}님이 {{change_time}}에 회원님의 역할을 <strong>{{old_role}}</strong>에서 <strong>{{new_role}}</strong>(으)로 변경했습니다.',
      p2: '다음 로그인 시 보고 할 수 있는 항목이 달라질 수 있습니다.',
    },
    'user.disabled': {
      subject: '{{app_name}} 계정이 비활성화되었습니다',
      title: '계정이 비활성화되었습니다',
      p1: '안녕하세요, {{name}}님, {{changed_by}}님이 {{change_time}}에 접근 권한을 껐습니다. 로그인할 수 없습니다.',
      p2: '이것이 실수라고 생각되시면 <a href="mailto:{{support_email}}">{{support_email}}</a>로 연락해 주세요.',
    },
    'admin.userCreated': {
      subject: '{{created_by}}님이 {{name}}님을 {{app_name}}에 추가했습니다',
      title: '새로운 멤버가 추가되었습니다',
      p1: '{{created_by}}님이 {{change_time}}에 <strong>{{name}}</strong>({{email}})님을 <strong>{{role}}</strong>(으)로 추가했습니다.',
      buttonLabel: '활동 로그 열기',
    },
    'admin.permissionChanged': {
      subject: '{{role}}의 권한이 변경되었습니다',
      title: '권한이 변경되었습니다',
      p1: '{{changed_by}}님이 {{change_time}}에 <strong>{{role}}</strong>이(가) 할 수 있는 작업을 변경했습니다.',
      p2: '{{change_summary}}',
      buttonLabel: '활동 로그 열기',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” 발송이 완료되었습니다',
      title: '캠페인이 완료되었습니다',
      p1: '안녕하세요, {{name}}님, <strong>{{campaign_name}}</strong>이(가) 완료되었습니다. {{total_sent}}건 발송, {{total_failed}}건 실패했습니다.',
      p2: '개봉과 클릭은 며칠간 계속 들어오므로 수치는 아직 변동됩니다.',
      buttonLabel: '리포트 보기',
    },
    'campaign.failed': {
      subject: '발송 중단: {{campaign_name}}',
      title: '발송이 중단되었습니다',
      p1: '<strong>{{campaign_name}}</strong>이(가) {{sent_so_far}}건 발송 후 중단되었습니다.',
      p2: '제공업체가 알린 이유: {{reason}}',
      buttonLabel: '캠페인 열기',
    },
    'account.connected': {
      subject: '{{provider}} 계정 {{account_email}}이(가) 연결되었습니다',
      title: '발송 계정이 연결되었습니다',
      p1: '{{changed_by}}님이 {{change_time}}에 <strong>{{account_email}}</strong>({{provider}})을(를) 연결했습니다.',
      buttonLabel: '이메일 계정 보기',
    },
    'contacts.imported': {
      subject: '가져오기 완료 — 연락처 {{valid_count}}개 추가됨',
      title: '가져오기가 완료되었습니다',
      p1: '안녕하세요, {{name}}님, <strong>{{file_name}}</strong>이(가) 가져와졌습니다.',
      p2: '추가됨: {{valid_count}} · 오류로 건너뜀: {{invalid_count}} · 중복으로 건너뜀: {{duplicate_count}}',
      buttonLabel: '연락처 보기',
    },
    'contact.subscribed': {
      subject: '{{name}}님이 "{{campaign_name}}"에서 구독했습니다',
      title: '새로운 구독자',
      p1: '<strong>{{name}}</strong>({{email}})님이 {{change_time}}에 <strong>{{campaign_name}}</strong>에서 구독 버튼을 눌렀습니다.',
      p2: '이제 이 분은 구독자 목록에 있으며, 모든 새 캠페인의 수신자로 선택할 수 있습니다.',
      buttonLabel: '구독자 보기',
    },
    'report.ready': {
      subject: '{{report_name}} 내보내기가 준비되었습니다',
      title: '파일이 준비되었습니다',
      p1: '안녕하세요, {{name}}님, <strong>{{report_name}}</strong> 내보내기가 준비되었습니다 — {{row_count}}행.',
      buttonLabel: '파일 다운로드',
      p2: '이 링크는 7일 동안 유효합니다.',
    },
  },
};

LANG.ja = {
  footerNote: 'これはお客様のアカウントに関する自動メッセージです。配信停止はできません。',
  buttonNote: 'ボタンが機能しない場合は、このリンクをブラウザにコピーしてください：',
  translations: {
    'user.invited': {
      subject: '{{app_name}} に追加されました — パスワードを設定してください',
      title: '{{name}} 様、',
      p1: '{{invited_by}} が {{app_name}} にあなたのアカウントを<strong>{{role}}</strong>として作成しました。',
      p2: 'サインイン用のメールアドレスは <strong>{{email}}</strong> です。完了するには、ご自身のパスワードを選択してください：',
      buttonLabel: 'パスワードを設定する',
      p3: 'このリンクは48時間有効です。{{company}} の誰も、あなたが選んだパスワードを見ることはできません。',
    },
    'password.reset': {
      subject: '{{app_name}} のパスワードをリセットしてください',
      title: 'パスワードをリセット',
      p1: '{{name}} 様、{{request_time}} に {{request_ip}} からパスワードリセットのリクエストを受け取りました。',
      buttonLabel: '新しいパスワードを選択する',
      p2: 'このリンクは1時間有効で、一度だけ使用できます。心当たりがない場合は、このメールを無視してください — パスワードはそのまま変更されません。',
    },
    'password.changed': {
      subject: '{{app_name}} のパスワードが変更されました',
      title: 'パスワードが変更されました',
      p1: '{{name}} 様、{{app_name}} のパスワードが {{change_time}} に {{device}}（{{request_ip}}）から変更されました。',
      p2: 'これがご本人による操作であれば、それ以上の対応は不要です。心当たりがない場合は、すぐに <a href="mailto:{{support_email}}">{{support_email}}</a> までご連絡ください。',
    },
    'password.setByAdmin': {
      subject: '{{app_name}} アカウントに新しいパスワードが設定されました',
      title: '新しいパスワードが設定されました',
      p1: '{{name}} 様、<strong>{{changed_by}}</strong> が {{change_time}} にあなたのアカウントの新しいパスワードを設定しました。',
      p2: 'パスワード自体は別途お伝えしています — メールに記載されることは決してありません。サインインして、ご自身だけが知る内容に変更してください。',
      buttonLabel: 'サインイン',
    },
    'user.emailChangeConfirm': {
      subject: '新しい {{app_name}} のメールアドレスを確認してください',
      title: 'このメールアドレスを確認',
      p1: '{{name}} 様、{{changed_by}} が {{app_name}} のサインイン用メールアドレスを <strong>{{new_email}}</strong> に変更するよう依頼しました。まだ何も変更されていません — まずこちらでメールを受信できることを確認してください。',
      buttonLabel: 'このメールを確認する',
      p2: 'このリンクは1時間有効で、一度だけ使用できます。心当たりがない場合は無視してください — 以前のメールアドレスは引き続きご利用いただけます。',
    },
    'login.newDevice': {
      subject: '{{app_name}} アカウントへの新しいサインイン',
      title: '新しいサインイン',
      p1: '{{name}} 様、新しいデバイスでアカウントが開かれました。',
      p2: '{{device}} ・ {{location}} ・ {{request_ip}} ・ {{change_time}}',
      p3: '心当たりがない場合は、今すぐパスワードを変更し、<a href="mailto:{{support_email}}">{{support_email}}</a> までお知らせください。',
    },
    'user.roleChanged': {
      subject: '{{app_name}} でのあなたの役割は {{new_role}} になりました',
      title: '役割が変更されました',
      p1: '{{name}} 様、{{changed_by}} が {{change_time}} にあなたの役割を <strong>{{old_role}}</strong> から <strong>{{new_role}}</strong> に変更しました。',
      p2: '次回サインインした際、閲覧・操作できる内容が変わっている場合があります。',
    },
    'user.disabled': {
      subject: '{{app_name}} アカウントが無効になりました',
      title: 'アカウントが無効になっています',
      p1: '{{name}} 様、{{changed_by}} が {{change_time}} にアクセスを無効にしました。サインインできなくなります。',
      p2: 'これが誤りだと思われる場合は、<a href="mailto:{{support_email}}">{{support_email}}</a> までご連絡ください。',
    },
    'admin.userCreated': {
      subject: '{{created_by}} が {{name}} を {{app_name}} に追加しました',
      title: '新しいメンバーが追加されました',
      p1: '{{created_by}} が {{change_time}} に <strong>{{name}}</strong>（{{email}}）を<strong>{{role}}</strong>として追加しました。',
      buttonLabel: 'アクティビティログを開く',
    },
    'admin.permissionChanged': {
      subject: '{{role}} の権限が変更されました',
      title: '権限が変更されました',
      p1: '{{changed_by}} が {{change_time}} に <strong>{{role}}</strong> ができる操作を変更しました。',
      p2: '{{change_summary}}',
      buttonLabel: 'アクティビティログを開く',
    },
    'campaign.finished': {
      subject: 'キャンペーン「{{campaign_name}}」の送信が完了しました',
      title: 'キャンペーンが完了しました',
      p1: '{{name}} 様、<strong>{{campaign_name}}</strong> が完了しました。{{total_sent}} 件送信され、{{total_failed}} 件失敗しました。',
      p2: '開封数とクリック数は数日間にわたって届き続けるため、数字はまだ変動します。',
      buttonLabel: 'レポートを見る',
    },
    'campaign.failed': {
      subject: '送信が停止しました：{{campaign_name}}',
      title: '送信が停止しました',
      p1: '<strong>{{campaign_name}}</strong> は {{sent_so_far}} 件送信後に停止しました。',
      p2: 'プロバイダーからの理由：{{reason}}',
      buttonLabel: 'キャンペーンを開く',
    },
    'account.connected': {
      subject: '{{provider}} アカウント {{account_email}} が接続されました',
      title: '送信用アカウントが接続されました',
      p1: '{{changed_by}} が {{change_time}} に <strong>{{account_email}}</strong>（{{provider}}）を接続しました。',
      buttonLabel: 'メールアカウントを見る',
    },
    'contacts.imported': {
      subject: 'インポートが完了しました — {{valid_count}} 件の連絡先を追加',
      title: 'インポートが完了しました',
      p1: '{{name}} 様、<strong>{{file_name}}</strong> がインポートされました。',
      p2: '追加：{{valid_count}} ・ エラーでスキップ：{{invalid_count}} ・ 重複でスキップ：{{duplicate_count}}',
      buttonLabel: '連絡先を見る',
    },
    'contact.subscribed': {
      subject: '{{name}} さんが「{{campaign_name}}」から登録しました',
      title: '新しい登録者',
      p1: '<strong>{{name}}</strong>（{{email}}）が {{change_time}} に <strong>{{campaign_name}}</strong> で登録ボタンを押しました。',
      p2: 'この方は登録者リストに追加され、新しいキャンペーンの受信者として選択できるようになりました。',
      buttonLabel: '登録者を見る',
    },
    'report.ready': {
      subject: '{{report_name}} のエクスポートが準備できました',
      title: 'ファイルの準備ができました',
      p1: '{{name}} 様、<strong>{{report_name}}</strong> のエクスポートが準備できました — {{row_count}} 行。',
      buttonLabel: 'ファイルをダウンロード',
      p2: 'このリンクは7日間有効です。',
    },
  },
};

LANG.zh = {
  footerNote: '这是一封关于您账户的自动邮件，无法取消订阅。',
  buttonNote: '如果按钮无法点击，请将此链接复制到浏览器中：',
  translations: {
    'user.invited': {
      subject: '您已被添加到 {{app_name}} —— 请设置密码',
      title: '您好，{{name}}，',
      p1: '{{invited_by}} 已在 {{app_name}} 上为您创建了一个账户，角色为<strong>{{role}}</strong>。',
      p2: '您的登录邮箱是 <strong>{{email}}</strong>。请设置您自己的密码以完成设置：',
      buttonLabel: '设置我的密码',
      p3: '此链接 48 小时内有效。{{company}} 的任何人都无法看到您设置的密码。',
    },
    'password.reset': {
      subject: '重置您的 {{app_name}} 密码',
      title: '重置您的密码',
      p1: '您好，{{name}}，我们于 {{request_time}} 收到了来自 {{request_ip}} 的密码重置请求。',
      buttonLabel: '设置新密码',
      p2: '此链接 1 小时内有效，且只能使用一次。如果这不是您本人的请求，请忽略此邮件——您的密码不会改变。',
    },
    'password.changed': {
      subject: '您的 {{app_name}} 密码已更改',
      title: '您的密码已更改',
      p1: '您好，{{name}}，您的 {{app_name}} 密码已于 {{change_time}} 在 {{device}}（{{request_ip}}）上被更改。',
      p2: '如果是您本人操作，无需进一步操作。如果不是，请立即写信至 <a href="mailto:{{support_email}}">{{support_email}}</a>。',
    },
    'password.setByAdmin': {
      subject: '您的 {{app_name}} 账户已设置新密码',
      title: '已为您设置新密码',
      p1: '您好，{{name}}，<strong>{{changed_by}}</strong> 于 {{change_time}} 为您的账户设置了新密码。',
      p2: '密码本身已单独告知您——它从不写在邮件中。请登录并将其更改为只有您知道的内容。',
      buttonLabel: '登录',
    },
    'user.emailChangeConfirm': {
      subject: '确认您的新 {{app_name}} 邮箱地址',
      title: '确认此邮箱地址',
      p1: '您好，{{name}}，{{changed_by}} 请求将您在 {{app_name}} 的登录邮箱更改为 <strong>{{new_email}}</strong>。目前尚未做任何更改——请先确认您能在此收信。',
      buttonLabel: '确认此邮箱',
      p2: '此链接 1 小时内有效，且只能使用一次。如果您未预期此操作，请忽略——您的旧邮箱仍可继续使用。',
    },
    'login.newDevice': {
      subject: '您的 {{app_name}} 账户有新的登录',
      title: '新登录',
      p1: '您好，{{name}}，您的账户在一台新设备上被打开。',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: '不是您本人？请立即更改密码并通知 <a href="mailto:{{support_email}}">{{support_email}}</a>。',
    },
    'user.roleChanged': {
      subject: '您在 {{app_name}} 中的角色现在是 {{new_role}}',
      title: '您的角色已更改',
      p1: '您好，{{name}}，{{changed_by}} 已于 {{change_time}} 将您的角色从 <strong>{{old_role}}</strong> 更改为 <strong>{{new_role}}</strong>。',
      p2: '下次登录时，您能看到和操作的内容可能会有所不同。',
    },
    'user.disabled': {
      subject: '您的 {{app_name}} 账户已被停用',
      title: '您的账户已被停用',
      p1: '您好，{{name}}，{{changed_by}} 已于 {{change_time}} 关闭了您的访问权限，您将无法登录。',
      p2: '如果您认为这是误操作，请写信至 <a href="mailto:{{support_email}}">{{support_email}}</a>。',
    },
    'admin.userCreated': {
      subject: '{{created_by}} 已将 {{name}} 添加到 {{app_name}}',
      title: '新增了一位成员',
      p1: '{{created_by}} 已于 {{change_time}} 添加了 <strong>{{name}}</strong>（{{email}}），角色为<strong>{{role}}</strong>。',
      buttonLabel: '打开活动日志',
    },
    'admin.permissionChanged': {
      subject: '{{role}} 的权限已更改',
      title: '权限已更改',
      p1: '{{changed_by}} 已于 {{change_time}} 更改了 <strong>{{role}}</strong> 可执行的操作。',
      p2: '{{change_summary}}',
      buttonLabel: '打开活动日志',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” 已发送完成',
      title: '您的活动已完成',
      p1: '您好，{{name}}，<strong>{{campaign_name}}</strong> 已完成。共发送 {{total_sent}} 封邮件，{{total_failed}} 封失败。',
      p2: '开信和点击数据未来几天仍会持续到达，因此数字还会变化。',
      buttonLabel: '查看报告',
    },
    'campaign.failed': {
      subject: '发送已停止：{{campaign_name}}',
      title: '发送已停止',
      p1: '<strong>{{campaign_name}}</strong> 在发送 {{sent_so_far}} 封邮件后已停止。',
      p2: '服务商给出的原因：{{reason}}',
      buttonLabel: '打开该活动',
    },
    'account.connected': {
      subject: '{{provider}} 账户 {{account_email}} 已连接',
      title: '已连接一个发送账户',
      p1: '{{changed_by}} 已于 {{change_time}} 连接了 <strong>{{account_email}}</strong>（{{provider}}）。',
      buttonLabel: '查看邮件账户',
    },
    'contacts.imported': {
      subject: '导入完成 —— 已添加 {{valid_count}} 个联系人',
      title: '您的导入已完成',
      p1: '您好，{{name}}，<strong>{{file_name}}</strong> 已导入。',
      p2: '已添加：{{valid_count}} · 因错误跳过：{{invalid_count}} · 因重复跳过：{{duplicate_count}}',
      buttonLabel: '查看联系人',
    },
    'contact.subscribed': {
      subject: '{{name}} 从“{{campaign_name}}”订阅',
      title: '新增一位订阅者',
      p1: '<strong>{{name}}</strong>（{{email}}）已于 {{change_time}} 在 <strong>{{campaign_name}}</strong> 中点击了订阅。',
      p2: '此人现已加入您的订阅者列表，可在任何新活动中被选为收件人。',
      buttonLabel: '查看订阅者',
    },
    'report.ready': {
      subject: '您的 {{report_name}} 导出已就绪',
      title: '您的文件已就绪',
      p1: '您好，{{name}}，您的 <strong>{{report_name}}</strong> 导出已就绪 —— 共 {{row_count}} 行。',
      buttonLabel: '下载文件',
      p2: '此链接 7 天内有效。',
    },
  },
};

LANG.ru = {
  footerNote: 'Это автоматическое сообщение о вашем аккаунте. Отписаться от него нельзя.',
  buttonNote: 'Если кнопка не работает, скопируйте эту ссылку в браузер:',
  translations: {
    'user.invited': {
      subject: 'Вас добавили в {{app_name}} — установите пароль',
      title: 'Здравствуйте, {{name}},',
      p1: '{{invited_by}} создал(а) для вас аккаунт в {{app_name}} с ролью <strong>{{role}}</strong>.',
      p2: 'Ваш email для входа — <strong>{{email}}</strong>. Чтобы завершить, выберите свой пароль:',
      buttonLabel: 'Установить пароль',
      p3: 'Эта ссылка действует 48 часов. Никто в {{company}} не видит пароль, который вы выберете.',
    },
    'password.reset': {
      subject: 'Сброс пароля {{app_name}}',
      title: 'Сброс пароля',
      p1: 'Здравствуйте, {{name}}, мы получили запрос на сброс пароля {{request_time}} с адреса {{request_ip}}.',
      buttonLabel: 'Выбрать новый пароль',
      p2: 'Эта ссылка действует 1 час и может быть использована один раз. Если вы не запрашивали это, просто проигнорируйте письмо — ваш пароль останется прежним.',
    },
    'password.changed': {
      subject: 'Ваш пароль {{app_name}} был изменён',
      title: 'Ваш пароль изменён',
      p1: 'Здравствуйте, {{name}}, ваш пароль {{app_name}} был изменён {{change_time}} с устройства {{device}} ({{request_ip}}).',
      p2: 'Если это были вы — ничего делать не нужно. Если нет — немедленно напишите на <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'password.setByAdmin': {
      subject: 'Для вашего аккаунта {{app_name}} установлен новый пароль',
      title: 'Для вас установлен новый пароль',
      p1: 'Здравствуйте, {{name}}, <strong>{{changed_by}}</strong> установил(а) новый пароль для вашего аккаунта {{change_time}}.',
      p2: 'Сам пароль был передан вам отдельно — он никогда не пишется в письме. Войдите и смените его на то, что знаете только вы.',
      buttonLabel: 'Войти',
    },
    'user.emailChangeConfirm': {
      subject: 'Подтвердите новый email для {{app_name}}',
      title: 'Подтвердите этот email',
      p1: 'Здравствуйте, {{name}}, {{changed_by}} запросил(а) изменить ваш email для входа в {{app_name}} на <strong>{{new_email}}</strong>. Пока ничего не изменилось — сначала подтвердите, что можете читать почту здесь.',
      buttonLabel: 'Подтвердить этот email',
      p2: 'Эта ссылка действует 1 час и может быть использована один раз. Если вы не ожидали этого, просто проигнорируйте — ваш старый email продолжит работать.',
    },
    'login.newDevice': {
      subject: 'Новый вход в ваш аккаунт {{app_name}}',
      title: 'Новый вход',
      p1: 'Здравствуйте, {{name}}, ваш аккаунт был открыт на новом устройстве.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'Это были не вы? Смените пароль прямо сейчас и сообщите на <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'Ваша роль в {{app_name}} теперь {{new_role}}',
      title: 'Ваша роль изменена',
      p1: 'Здравствуйте, {{name}}, {{changed_by}} изменил(а) вашу роль с <strong>{{old_role}}</strong> на <strong>{{new_role}}</strong> {{change_time}}.',
      p2: 'То, что вы можете видеть и делать, может выглядеть иначе при следующем входе.',
    },
    'user.disabled': {
      subject: 'Ваш аккаунт {{app_name}} отключён',
      title: 'Ваш аккаунт отключён',
      p1: 'Здравствуйте, {{name}}, {{changed_by}} отключил(а) ваш доступ {{change_time}}. Вы не сможете войти.',
      p2: 'Если вы считаете, что это ошибка, напишите на <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} добавил(а) {{name}} в {{app_name}}',
      title: 'Добавлен новый человек',
      p1: '{{created_by}} добавил(а) <strong>{{name}}</strong> ({{email}}) с ролью <strong>{{role}}</strong> {{change_time}}.',
      buttonLabel: 'Открыть журнал активности',
    },
    'admin.permissionChanged': {
      subject: 'Права доступа изменены для {{role}}',
      title: 'Права доступа изменены',
      p1: '{{changed_by}} изменил(а), что может делать роль <strong>{{role}}</strong>, {{change_time}}.',
      p2: '{{change_summary}}',
      buttonLabel: 'Открыть журнал активности',
    },
    'campaign.finished': {
      subject: '«{{campaign_name}}» — отправка завершена',
      title: 'Ваша кампания завершена',
      p1: 'Здравствуйте, {{name}}, кампания <strong>{{campaign_name}}</strong> завершена. Отправлено {{total_sent}} писем, {{total_failed}} не удалось.',
      p2: 'Открытия и клики будут поступать ещё несколько дней, так что цифры пока будут меняться.',
      buttonLabel: 'Посмотреть отчёт',
    },
    'campaign.failed': {
      subject: 'Отправка остановлена: {{campaign_name}}',
      title: 'Отправка остановлена',
      p1: '<strong>{{campaign_name}}</strong> остановлена после {{sent_so_far}} писем.',
      p2: 'Причина от провайдера: {{reason}}',
      buttonLabel: 'Открыть кампанию',
    },
    'account.connected': {
      subject: 'Аккаунт {{provider}} {{account_email}} подключён',
      title: 'Подключён аккаунт для отправки',
      p1: '{{changed_by}} подключил(а) <strong>{{account_email}}</strong> ({{provider}}) {{change_time}}.',
      buttonLabel: 'Смотреть почтовые аккаунты',
    },
    'contacts.imported': {
      subject: 'Импорт завершён — добавлено контактов: {{valid_count}}',
      title: 'Ваш импорт завершён',
      p1: 'Здравствуйте, {{name}}, файл <strong>{{file_name}}</strong> импортирован.',
      p2: 'Добавлено: {{valid_count}} · Пропущено (ошибки): {{invalid_count}} · Пропущено (дубликаты): {{duplicate_count}}',
      buttonLabel: 'Смотреть контакты',
    },
    'contact.subscribed': {
      subject: '{{name}} подписался(-лась) из «{{campaign_name}}»',
      title: 'Новый подписчик',
      p1: '<strong>{{name}}</strong> ({{email}}) нажал(а) «Подписаться» в <strong>{{campaign_name}}</strong> {{change_time}}.',
      p2: 'Теперь этот человек в вашем списке подписчиков и может быть выбран получателем в любой новой кампании.',
      buttonLabel: 'Смотреть подписчиков',
    },
    'report.ready': {
      subject: 'Ваш экспорт {{report_name}} готов',
      title: 'Ваш файл готов',
      p1: 'Здравствуйте, {{name}}, ваш экспорт <strong>{{report_name}}</strong> готов — строк: {{row_count}}.',
      buttonLabel: 'Скачать файл',
      p2: 'Ссылка действует 7 дней.',
    },
  },
};

LANG.pt = {
  footerNote: 'Esta é uma mensagem automática sobre sua conta. Você não pode cancelar a inscrição dela.',
  buttonNote: 'Se o botão não funcionar, copie este link no seu navegador:',
  translations: {
    'user.invited': {
      subject: 'Você foi adicionado ao {{app_name}} — defina sua senha',
      title: 'Olá, {{name}},',
      p1: '{{invited_by}} criou uma conta para você no {{app_name}} como <strong>{{role}}</strong>.',
      p2: 'Seu e-mail de acesso é <strong>{{email}}</strong>. Escolha sua própria senha para concluir:',
      buttonLabel: 'Definir minha senha',
      p3: 'Este link funciona por 48 horas. Ninguém na {{company}} pode ver a senha que você escolher.',
    },
    'password.reset': {
      subject: 'Redefina sua senha do {{app_name}}',
      title: 'Redefina sua senha',
      p1: 'Olá, {{name}}, recebemos uma solicitação para redefinir sua senha em {{request_time}} a partir de {{request_ip}}.',
      buttonLabel: 'Escolher uma nova senha',
      p2: 'Este link funciona por 1 hora e pode ser usado uma vez. Se você não solicitou isso, ignore este e-mail — sua senha permanecerá a mesma.',
    },
    'password.changed': {
      subject: 'Sua senha do {{app_name}} foi alterada',
      title: 'Sua senha foi alterada',
      p1: 'Olá, {{name}}, sua senha do {{app_name}} foi alterada em {{change_time}} a partir de {{device}} ({{request_ip}}).',
      p2: 'Se foi você, não há mais nada a fazer. Se não foi você, escreva imediatamente para <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'password.setByAdmin': {
      subject: 'Uma nova senha foi definida para sua conta {{app_name}}',
      title: 'Uma nova senha foi definida para você',
      p1: 'Olá, {{name}}, <strong>{{changed_by}}</strong> definiu uma nova senha para sua conta em {{change_time}}.',
      p2: 'A senha em si foi entregue a você separadamente — ela nunca é escrita em um e-mail. Faça login e altere-a para algo que só você saiba.',
      buttonLabel: 'Entrar',
    },
    'user.emailChangeConfirm': {
      subject: 'Confirme seu novo endereço de e-mail do {{app_name}}',
      title: 'Confirme este endereço de e-mail',
      p1: 'Olá, {{name}}, {{changed_by}} solicitou alterar seu e-mail de acesso do {{app_name}} para <strong>{{new_email}}</strong>. Nada mudou ainda — confirme primeiro que você consegue ler e-mails aqui.',
      buttonLabel: 'Confirmar este e-mail',
      p2: 'Este link funciona por 1 hora e pode ser usado uma vez. Se você não esperava isso, ignore-o — seu e-mail antigo continua funcionando.',
    },
    'login.newDevice': {
      subject: 'Novo login na sua conta {{app_name}}',
      title: 'Novo login',
      p1: 'Olá, {{name}}, sua conta foi acessada em um novo dispositivo.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'Não foi você? Altere sua senha agora e avise <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'Sua função no {{app_name}} agora é {{new_role}}',
      title: 'Sua função mudou',
      p1: 'Olá, {{name}}, {{changed_by}} alterou sua função de <strong>{{old_role}}</strong> para <strong>{{new_role}}</strong> em {{change_time}}.',
      p2: 'O que você pode ver e fazer pode parecer diferente na próxima vez que fizer login.',
    },
    'user.disabled': {
      subject: 'Sua conta {{app_name}} foi desativada',
      title: 'Sua conta está desativada',
      p1: 'Olá, {{name}}, {{changed_by}} desativou seu acesso em {{change_time}}. Você não poderá fazer login.',
      p2: 'Se você acha que isso é um engano, escreva para <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} adicionou {{name}} ao {{app_name}}',
      title: 'Uma nova pessoa foi adicionada',
      p1: '{{created_by}} adicionou <strong>{{name}}</strong> ({{email}}) como <strong>{{role}}</strong> em {{change_time}}.',
      buttonLabel: 'Abrir o registro de atividades',
    },
    'admin.permissionChanged': {
      subject: 'Permissões alteradas para {{role}}',
      title: 'As permissões foram alteradas',
      p1: '{{changed_by}} alterou o que <strong>{{role}}</strong> pode fazer em {{change_time}}.',
      p2: '{{change_summary}}',
      buttonLabel: 'Abrir o registro de atividades',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” terminou de ser enviada',
      title: 'Sua campanha foi concluída',
      p1: 'Olá, {{name}}, <strong>{{campaign_name}}</strong> foi concluída. {{total_sent}} e-mails foram enviados e {{total_failed}} falharam.',
      p2: 'Aberturas e cliques continuarão chegando por alguns dias, então os números ainda vão mudar.',
      buttonLabel: 'Ver o relatório',
    },
    'campaign.failed': {
      subject: 'Envio interrompido: {{campaign_name}}',
      title: 'O envio foi interrompido',
      p1: '<strong>{{campaign_name}}</strong> foi interrompida após {{sent_so_far}} e-mails.',
      p2: 'Motivo informado pelo provedor: {{reason}}',
      buttonLabel: 'Abrir a campanha',
    },
    'account.connected': {
      subject: 'A conta {{provider}} {{account_email}} foi conectada',
      title: 'Uma conta de envio foi conectada',
      p1: '{{changed_by}} conectou <strong>{{account_email}}</strong> ({{provider}}) em {{change_time}}.',
      buttonLabel: 'Ver contas de e-mail',
    },
    'contacts.imported': {
      subject: 'Importação concluída — {{valid_count}} contatos adicionados',
      title: 'Sua importação foi concluída',
      p1: 'Olá, {{name}}, <strong>{{file_name}}</strong> foi importado.',
      p2: 'Adicionados: {{valid_count}} · Ignorados por erro: {{invalid_count}} · Ignorados por duplicidade: {{duplicate_count}}',
      buttonLabel: 'Ver contatos',
    },
    'contact.subscribed': {
      subject: '{{name}} se inscreveu a partir de “{{campaign_name}}”',
      title: 'Um novo assinante',
      p1: '<strong>{{name}}</strong> ({{email}}) clicou em Inscrever-se em <strong>{{campaign_name}}</strong> em {{change_time}}.',
      p2: 'Essa pessoa agora está na sua lista de assinantes e pode ser escolhida como destinatária em qualquer nova campanha.',
      buttonLabel: 'Ver assinantes',
    },
    'report.ready': {
      subject: 'Sua exportação de {{report_name}} está pronta',
      title: 'Seu arquivo está pronto',
      p1: 'Olá, {{name}}, sua exportação <strong>{{report_name}}</strong> está pronta — {{row_count}} linhas.',
      buttonLabel: 'Baixar o arquivo',
      p2: 'O link funciona por 7 dias.',
    },
  },
};

LANG.de = {
  footerNote: 'Dies ist eine automatische Nachricht zu Ihrem Konto. Sie können sich davon nicht abmelden.',
  buttonNote: 'Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
  translations: {
    'user.invited': {
      subject: 'Sie wurden zu {{app_name}} hinzugefügt — legen Sie Ihr Passwort fest',
      title: 'Hallo {{name}},',
      p1: '{{invited_by}} hat für Sie ein Konto bei {{app_name}} als <strong>{{role}}</strong> erstellt.',
      p2: 'Ihre Anmelde-E-Mail lautet <strong>{{email}}</strong>. Wählen Sie zum Abschluss Ihr eigenes Passwort:',
      buttonLabel: 'Mein Passwort festlegen',
      p3: 'Dieser Link ist 48 Stunden gültig. Niemand bei {{company}} kann das von Ihnen gewählte Passwort sehen.',
    },
    'password.reset': {
      subject: 'Setzen Sie Ihr {{app_name}}-Passwort zurück',
      title: 'Passwort zurücksetzen',
      p1: 'Hallo {{name}}, wir haben am {{request_time}} von {{request_ip}} eine Anfrage zum Zurücksetzen Ihres Passworts erhalten.',
      buttonLabel: 'Neues Passwort wählen',
      p2: 'Dieser Link ist 1 Stunde gültig und kann einmal verwendet werden. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.',
    },
    'password.changed': {
      subject: 'Ihr {{app_name}}-Passwort wurde geändert',
      title: 'Ihr Passwort wurde geändert',
      p1: 'Hallo {{name}}, Ihr {{app_name}}-Passwort wurde am {{change_time}} von {{device}} ({{request_ip}}) geändert.',
      p2: 'Wenn Sie das waren, müssen Sie nichts weiter tun. Wenn nicht, schreiben Sie sofort an <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'password.setByAdmin': {
      subject: 'Für Ihr {{app_name}}-Konto wurde ein neues Passwort festgelegt',
      title: 'Ein neues Passwort wurde für Sie festgelegt',
      p1: 'Hallo {{name}}, <strong>{{changed_by}}</strong> hat am {{change_time}} ein neues Passwort für Ihr Konto festgelegt.',
      p2: 'Das Passwort selbst wurde Ihnen separat mitgeteilt — es steht nie in einer E-Mail. Bitte melden Sie sich an und ändern Sie es in etwas, das nur Sie kennen.',
      buttonLabel: 'Anmelden',
    },
    'user.emailChangeConfirm': {
      subject: 'Bestätigen Sie Ihre neue {{app_name}}-E-Mail-Adresse',
      title: 'Diese E-Mail-Adresse bestätigen',
      p1: 'Hallo {{name}}, {{changed_by}} hat beantragt, Ihre {{app_name}}-Anmelde-E-Mail auf <strong>{{new_email}}</strong> zu ändern. Es hat sich noch nichts geändert — bestätigen Sie zunächst, dass Sie hier Post lesen können.',
      buttonLabel: 'Diese E-Mail bestätigen',
      p2: 'Dieser Link ist 1 Stunde gültig und kann einmal verwendet werden. Falls Sie dies nicht erwartet haben, ignorieren Sie es — Ihre alte E-Mail funktioniert weiterhin.',
    },
    'login.newDevice': {
      subject: 'Neue Anmeldung bei Ihrem {{app_name}}-Konto',
      title: 'Neue Anmeldung',
      p1: 'Hallo {{name}}, Ihr Konto wurde auf einem neuen Gerät geöffnet.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'Waren Sie das nicht? Ändern Sie jetzt Ihr Passwort und benachrichtigen Sie <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'Ihre Rolle in {{app_name}} ist jetzt {{new_role}}',
      title: 'Ihre Rolle hat sich geändert',
      p1: 'Hallo {{name}}, {{changed_by}} hat Ihre Rolle am {{change_time}} von <strong>{{old_role}}</strong> zu <strong>{{new_role}}</strong> geändert.',
      p2: 'Was Sie sehen und tun können, sieht beim nächsten Anmelden möglicherweise anders aus.',
    },
    'user.disabled': {
      subject: 'Ihr {{app_name}}-Konto wurde deaktiviert',
      title: 'Ihr Konto ist deaktiviert',
      p1: 'Hallo {{name}}, {{changed_by}} hat Ihren Zugang am {{change_time}} deaktiviert. Sie können sich nicht mehr anmelden.',
      p2: 'Falls Sie glauben, dass dies ein Fehler ist, schreiben Sie an <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} hat {{name}} zu {{app_name}} hinzugefügt',
      title: 'Eine neue Person wurde hinzugefügt',
      p1: '{{created_by}} hat <strong>{{name}}</strong> ({{email}}) am {{change_time}} als <strong>{{role}}</strong> hinzugefügt.',
      buttonLabel: 'Aktivitätsprotokoll öffnen',
    },
    'admin.permissionChanged': {
      subject: 'Berechtigungen für {{role}} geändert',
      title: 'Berechtigungen wurden geändert',
      p1: '{{changed_by}} hat am {{change_time}} geändert, was <strong>{{role}}</strong> darf.',
      p2: '{{change_summary}}',
      buttonLabel: 'Aktivitätsprotokoll öffnen',
    },
    'campaign.finished': {
      subject: '„{{campaign_name}}" wurde vollständig versendet',
      title: 'Ihre Kampagne ist abgeschlossen',
      p1: 'Hallo {{name}}, <strong>{{campaign_name}}</strong> ist abgeschlossen. {{total_sent}} E-Mails wurden versendet, {{total_failed}} sind fehlgeschlagen.',
      p2: 'Öffnungen und Klicks treffen noch einige Tage lang ein, die Zahlen werden sich also noch ändern.',
      buttonLabel: 'Bericht ansehen',
    },
    'campaign.failed': {
      subject: 'Versand gestoppt: {{campaign_name}}',
      title: 'Der Versand wurde gestoppt',
      p1: '<strong>{{campaign_name}}</strong> wurde nach {{sent_so_far}} E-Mails gestoppt.',
      p2: 'Vom Anbieter genannter Grund: {{reason}}',
      buttonLabel: 'Kampagne öffnen',
    },
    'account.connected': {
      subject: 'Konto {{account_email}} bei {{provider}} wurde verbunden',
      title: 'Ein Versandkonto wurde verbunden',
      p1: '{{changed_by}} hat am {{change_time}} <strong>{{account_email}}</strong> ({{provider}}) verbunden.',
      buttonLabel: 'E-Mail-Konten ansehen',
    },
    'contacts.imported': {
      subject: 'Import abgeschlossen — {{valid_count}} Kontakte hinzugefügt',
      title: 'Ihr Import ist abgeschlossen',
      p1: 'Hallo {{name}}, <strong>{{file_name}}</strong> wurde importiert.',
      p2: 'Hinzugefügt: {{valid_count}} · Übersprungen (fehlerhaft): {{invalid_count}} · Übersprungen (Duplikat): {{duplicate_count}}',
      buttonLabel: 'Kontakte ansehen',
    },
    'contact.subscribed': {
      subject: '{{name}} hat sich über „{{campaign_name}}" angemeldet',
      title: 'Ein neuer Abonnent',
      p1: '<strong>{{name}}</strong> ({{email}}) hat am {{change_time}} in <strong>{{campaign_name}}</strong> auf Abonnieren gedrückt.',
      p2: 'Diese Person steht jetzt auf Ihrer Abonnentenliste und kann als Empfänger für jede neue Kampagne ausgewählt werden.',
      buttonLabel: 'Abonnenten ansehen',
    },
    'report.ready': {
      subject: 'Ihr {{report_name}}-Export ist fertig',
      title: 'Ihre Datei ist fertig',
      p1: 'Hallo {{name}}, Ihr Export <strong>{{report_name}}</strong> ist fertig — {{row_count}} Zeilen.',
      buttonLabel: 'Datei herunterladen',
      p2: 'Der Link ist 7 Tage gültig.',
    },
  },
};

LANG.fr = {
  footerNote: 'Ceci est un message automatique concernant votre compte. Vous ne pouvez pas vous en désabonner.',
  buttonNote: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
  translations: {
    'user.invited': {
      subject: 'Vous avez été ajouté à {{app_name}} — choisissez votre mot de passe',
      title: 'Bonjour {{name}},',
      p1: '{{invited_by}} a créé un compte pour vous sur {{app_name}} en tant que <strong>{{role}}</strong>.',
      p2: 'Votre e-mail de connexion est <strong>{{email}}</strong>. Choisissez votre propre mot de passe pour terminer :',
      buttonLabel: 'Choisir mon mot de passe',
      p3: 'Ce lien fonctionne pendant 48 heures. Personne chez {{company}} ne peut voir le mot de passe que vous choisissez.',
    },
    'password.reset': {
      subject: 'Réinitialisez votre mot de passe {{app_name}}',
      title: 'Réinitialisez votre mot de passe',
      p1: 'Bonjour {{name}}, nous avons reçu une demande de réinitialisation de votre mot de passe le {{request_time}} depuis {{request_ip}}.',
      buttonLabel: 'Choisir un nouveau mot de passe',
      p2: 'Ce lien fonctionne pendant 1 heure et ne peut être utilisé qu\'une seule fois. Si vous n\'avez pas fait cette demande, ignorez cet e-mail — votre mot de passe reste inchangé.',
    },
    'password.changed': {
      subject: 'Votre mot de passe {{app_name}} a été modifié',
      title: 'Votre mot de passe a été modifié',
      p1: 'Bonjour {{name}}, votre mot de passe {{app_name}} a été modifié le {{change_time}} depuis {{device}} ({{request_ip}}).',
      p2: 'Si c\'était vous, il n\'y a rien d\'autre à faire. Si ce n\'était pas vous, écrivez immédiatement à <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'password.setByAdmin': {
      subject: 'Un nouveau mot de passe a été défini pour votre compte {{app_name}}',
      title: 'Un nouveau mot de passe a été défini pour vous',
      p1: 'Bonjour {{name}}, <strong>{{changed_by}}</strong> a défini un nouveau mot de passe pour votre compte le {{change_time}}.',
      p2: 'Le mot de passe lui-même vous a été communiqué séparément — il n\'est jamais écrit dans un e-mail. Connectez-vous et changez-le pour quelque chose que vous seul connaissez.',
      buttonLabel: 'Se connecter',
    },
    'user.emailChangeConfirm': {
      subject: 'Confirmez votre nouvelle adresse e-mail {{app_name}}',
      title: 'Confirmez cette adresse e-mail',
      p1: 'Bonjour {{name}}, {{changed_by}} a demandé à changer votre e-mail de connexion {{app_name}} en <strong>{{new_email}}</strong>. Rien n\'a encore changé — confirmez d\'abord que vous pouvez lire le courrier ici.',
      buttonLabel: 'Confirmer cet e-mail',
      p2: 'Ce lien fonctionne pendant 1 heure et ne peut être utilisé qu\'une seule fois. Si vous ne vous attendiez pas à cela, ignorez-le — votre ancien e-mail continue de fonctionner.',
    },
    'login.newDevice': {
      subject: 'Nouvelle connexion à votre compte {{app_name}}',
      title: 'Nouvelle connexion',
      p1: 'Bonjour {{name}}, votre compte a été ouvert sur un nouvel appareil.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: 'Ce n\'était pas vous ? Changez votre mot de passe maintenant et prévenez <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'Votre rôle dans {{app_name}} est désormais {{new_role}}',
      title: 'Votre rôle a changé',
      p1: 'Bonjour {{name}}, {{changed_by}} a changé votre rôle de <strong>{{old_role}}</strong> à <strong>{{new_role}}</strong> le {{change_time}}.',
      p2: 'Ce que vous pouvez voir et faire peut sembler différent la prochaine fois que vous vous connecterez.',
    },
    'user.disabled': {
      subject: 'Votre compte {{app_name}} a été désactivé',
      title: 'Votre compte est désactivé',
      p1: 'Bonjour {{name}}, {{changed_by}} a désactivé votre accès le {{change_time}}. Vous ne pourrez pas vous connecter.',
      p2: 'Si vous pensez qu\'il s\'agit d\'une erreur, écrivez à <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} a ajouté {{name}} à {{app_name}}',
      title: 'Une nouvelle personne a été ajoutée',
      p1: '{{created_by}} a ajouté <strong>{{name}}</strong> ({{email}}) en tant que <strong>{{role}}</strong> le {{change_time}}.',
      buttonLabel: 'Ouvrir le journal d\'activité',
    },
    'admin.permissionChanged': {
      subject: 'Autorisations modifiées pour {{role}}',
      title: 'Les autorisations ont changé',
      p1: '{{changed_by}} a modifié ce que <strong>{{role}}</strong> peut faire le {{change_time}}.',
      p2: '{{change_summary}}',
      buttonLabel: 'Ouvrir le journal d\'activité',
    },
    'campaign.finished': {
      subject: '« {{campaign_name}} » a terminé son envoi',
      title: 'Votre campagne est terminée',
      p1: 'Bonjour {{name}}, <strong>{{campaign_name}}</strong> est terminée. {{total_sent}} e-mails ont été envoyés et {{total_failed}} ont échoué.',
      p2: 'Les ouvertures et les clics continueront d\'arriver pendant quelques jours, les chiffres vont donc encore évoluer.',
      buttonLabel: 'Voir le rapport',
    },
    'campaign.failed': {
      subject: 'Envoi interrompu : {{campaign_name}}',
      title: 'L\'envoi s\'est arrêté',
      p1: '<strong>{{campaign_name}}</strong> s\'est arrêtée après {{sent_so_far}} e-mails.',
      p2: 'Raison indiquée par le fournisseur : {{reason}}',
      buttonLabel: 'Ouvrir la campagne',
    },
    'account.connected': {
      subject: 'Le compte {{provider}} {{account_email}} a été connecté',
      title: 'Un compte d\'envoi a été connecté',
      p1: '{{changed_by}} a connecté <strong>{{account_email}}</strong> ({{provider}}) le {{change_time}}.',
      buttonLabel: 'Voir les comptes e-mail',
    },
    'contacts.imported': {
      subject: 'Importation terminée — {{valid_count}} contacts ajoutés',
      title: 'Votre importation est terminée',
      p1: 'Bonjour {{name}}, <strong>{{file_name}}</strong> a été importé.',
      p2: 'Ajoutés : {{valid_count}} · Ignorés (erreur) : {{invalid_count}} · Ignorés (doublon) : {{duplicate_count}}',
      buttonLabel: 'Voir les contacts',
    },
    'contact.subscribed': {
      subject: '{{name}} s\'est abonné depuis « {{campaign_name}} »',
      title: 'Un nouvel abonné',
      p1: '<strong>{{name}}</strong> ({{email}}) a cliqué sur S\'abonner dans <strong>{{campaign_name}}</strong> le {{change_time}}.',
      p2: 'Cette personne figure maintenant dans votre liste d\'abonnés et peut être choisie comme destinataire dans toute nouvelle campagne.',
      buttonLabel: 'Voir les abonnés',
    },
    'report.ready': {
      subject: 'Votre export {{report_name}} est prêt',
      title: 'Votre fichier est prêt',
      p1: 'Bonjour {{name}}, votre export <strong>{{report_name}}</strong> est prêt — {{row_count}} lignes.',
      buttonLabel: 'Télécharger le fichier',
      p2: 'Le lien fonctionne pendant 7 jours.',
    },
  },
};

LANG.es = {
  footerNote: 'Este es un mensaje automático sobre tu cuenta. No puedes darte de baja de él.',
  buttonNote: 'Si el botón no funciona, copia este enlace en tu navegador:',
  translations: {
    'user.invited': {
      subject: 'Te han añadido a {{app_name}} — configura tu contraseña',
      title: 'Hola {{name}},',
      p1: '{{invited_by}} ha creado una cuenta para ti en {{app_name}} como <strong>{{role}}</strong>.',
      p2: 'Tu correo de acceso es <strong>{{email}}</strong>. Elige tu propia contraseña para terminar:',
      buttonLabel: 'Configurar mi contraseña',
      p3: 'Este enlace funciona durante 48 horas. Nadie en {{company}} puede ver la contraseña que elijas.',
    },
    'password.reset': {
      subject: 'Restablece tu contraseña de {{app_name}}',
      title: 'Restablece tu contraseña',
      p1: 'Hola {{name}}, recibimos una solicitud para restablecer tu contraseña el {{request_time}} desde {{request_ip}}.',
      buttonLabel: 'Elegir una nueva contraseña',
      p2: 'Este enlace funciona durante 1 hora y se puede usar una sola vez. Si no solicitaste esto, ignora este correo — tu contraseña seguirá siendo la misma.',
    },
    'password.changed': {
      subject: 'Tu contraseña de {{app_name}} fue cambiada',
      title: 'Tu contraseña fue cambiada',
      p1: 'Hola {{name}}, tu contraseña de {{app_name}} fue cambiada el {{change_time}} desde {{device}} ({{request_ip}}).',
      p2: 'Si fuiste tú, no hay nada más que hacer. Si no fuiste tú, escribe a <a href="mailto:{{support_email}}">{{support_email}}</a> de inmediato.',
    },
    'password.setByAdmin': {
      subject: 'Se estableció una nueva contraseña para tu cuenta de {{app_name}}',
      title: 'Se estableció una nueva contraseña para ti',
      p1: 'Hola {{name}}, <strong>{{changed_by}}</strong> estableció una nueva contraseña para tu cuenta el {{change_time}}.',
      p2: 'La contraseña en sí te fue entregada por separado — nunca se escribe en un correo. Inicia sesión y cámbiala por algo que solo tú sepas.',
      buttonLabel: 'Iniciar sesión',
    },
    'user.emailChangeConfirm': {
      subject: 'Confirma tu nueva dirección de correo de {{app_name}}',
      title: 'Confirma este correo electrónico',
      p1: 'Hola {{name}}, {{changed_by}} solicitó cambiar tu correo de acceso a {{app_name}} a <strong>{{new_email}}</strong>. Aún no ha cambiado nada — confirma primero que puedes leer el correo aquí.',
      buttonLabel: 'Confirmar este correo',
      p2: 'Este enlace funciona durante 1 hora y se puede usar una sola vez. Si no esperabas esto, ignóralo — tu correo anterior seguirá funcionando.',
    },
    'login.newDevice': {
      subject: 'Nuevo inicio de sesión en tu cuenta de {{app_name}}',
      title: 'Nuevo inicio de sesión',
      p1: 'Hola {{name}}, tu cuenta se abrió en un dispositivo nuevo.',
      p2: '{{device}} · {{location}} · {{request_ip}} · {{change_time}}',
      p3: '¿No fuiste tú? Cambia tu contraseña ahora y avisa a <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'user.roleChanged': {
      subject: 'Tu rol en {{app_name}} ahora es {{new_role}}',
      title: 'Tu rol ha cambiado',
      p1: 'Hola {{name}}, {{changed_by}} cambió tu rol de <strong>{{old_role}}</strong> a <strong>{{new_role}}</strong> el {{change_time}}.',
      p2: 'Lo que puedes ver y hacer puede verse diferente la próxima vez que inicies sesión.',
    },
    'user.disabled': {
      subject: 'Tu cuenta de {{app_name}} ha sido desactivada',
      title: 'Tu cuenta está desactivada',
      p1: 'Hola {{name}}, {{changed_by}} desactivó tu acceso el {{change_time}}. No podrás iniciar sesión.',
      p2: 'Si crees que esto es un error, escribe a <a href="mailto:{{support_email}}">{{support_email}}</a>.',
    },
    'admin.userCreated': {
      subject: '{{created_by}} añadió a {{name}} a {{app_name}}',
      title: 'Se añadió una nueva persona',
      p1: '{{created_by}} añadió a <strong>{{name}}</strong> ({{email}}) como <strong>{{role}}</strong> el {{change_time}}.',
      buttonLabel: 'Abrir el registro de actividad',
    },
    'admin.permissionChanged': {
      subject: 'Permisos cambiados para {{role}}',
      title: 'Los permisos han cambiado',
      p1: '{{changed_by}} cambió lo que <strong>{{role}}</strong> puede hacer el {{change_time}}.',
      p2: '{{change_summary}}',
      buttonLabel: 'Abrir el registro de actividad',
    },
    'campaign.finished': {
      subject: '“{{campaign_name}}” ha terminado de enviarse',
      title: 'Tu campaña ha terminado',
      p1: 'Hola {{name}}, <strong>{{campaign_name}}</strong> ha terminado. Se enviaron {{total_sent}} correos y {{total_failed}} fallaron.',
      p2: 'Las aperturas y los clics seguirán llegando durante algunos días, así que los números aún cambiarán.',
      buttonLabel: 'Ver el informe',
    },
    'campaign.failed': {
      subject: 'Envío detenido: {{campaign_name}}',
      title: 'El envío se detuvo',
      p1: '<strong>{{campaign_name}}</strong> se detuvo después de {{sent_so_far}} correos.',
      p2: 'Motivo indicado por el proveedor: {{reason}}',
      buttonLabel: 'Abrir la campaña',
    },
    'account.connected': {
      subject: 'La cuenta de {{provider}} {{account_email}} fue conectada',
      title: 'Se conectó una cuenta de envío',
      p1: '{{changed_by}} conectó <strong>{{account_email}}</strong> ({{provider}}) el {{change_time}}.',
      buttonLabel: 'Ver cuentas de correo',
    },
    'contacts.imported': {
      subject: 'Importación finalizada — {{valid_count}} contactos añadidos',
      title: 'Tu importación ha terminado',
      p1: 'Hola {{name}}, <strong>{{file_name}}</strong> ha sido importado.',
      p2: 'Añadidos: {{valid_count}} · Omitidos por errores: {{invalid_count}} · Omitidos por duplicados: {{duplicate_count}}',
      buttonLabel: 'Ver contactos',
    },
    'contact.subscribed': {
      subject: '{{name}} se suscribió desde “{{campaign_name}}”',
      title: 'Un nuevo suscriptor',
      p1: '<strong>{{name}}</strong> ({{email}}) pulsó Suscribirse en <strong>{{campaign_name}}</strong> el {{change_time}}.',
      p2: 'Ahora está en tu lista de suscriptores y puede elegirse como destinatario en cualquier campaña nueva.',
      buttonLabel: 'Ver suscriptores',
    },
    'report.ready': {
      subject: 'Tu exportación de {{report_name}} está lista',
      title: 'Tu archivo está listo',
      p1: 'Hola {{name}}, tu exportación <strong>{{report_name}}</strong> está lista — {{row_count}} filas.',
      buttonLabel: 'Descargar el archivo',
      p2: 'El enlace funciona durante 7 días.',
    },
  },
};

export function getSeedTranslation(key, language) {
  const lang = LANG[language];
  const t = lang?.translations?.[key];
  if (!t) return null;
  return {
    subject: t.subject,
    html: buildHtml(key, { ...t, buttonNote: lang.buttonNote }, lang.footerNote),
  };
}

/** Every (key, language) pair this file has content for — used by the seed. */
export function allSeedTranslations() {
  const out = [];
  for (const language of Object.keys(LANG)) {
    for (const key of Object.keys(LANG[language].translations || {})) {
      const built = getSeedTranslation(key, language);
      if (built) out.push({ key, language, ...built });
    }
  }
  return out;
}

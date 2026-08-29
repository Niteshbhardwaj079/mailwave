// ---------------------------------------------------------------------------
// Har email provider ki SMTP setting — pehle se bhari hui.
//
// Matlab client ko host, port, SSL kuch nahi pata hona chahiye. Bas provider
// chuno, email aur password daalo, ho gaya.
//
// Sabse badi dikkat jo har kisi ke saath hoti hai: Gmail aur Outlook aapka
// NORMAL password nahi lete. Unhe "App Password" chahiye hota hai. Isliye har
// provider ke saath saaf-saaf steps likhe hain, jo API se frontend tak jate
// hain aur screen par dikhte hain.
// ---------------------------------------------------------------------------
import brand from '../../../brand.config.js';

// App ka naam yahin se aata hai — App Password banate waqt user ko yahi naam
// likhna hota hai, isliye hardcode nahi kar sakte.
const brandName = brand.name;

export const PROVIDERS = {
  google: {
    key: 'google',
    name: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // 587 par STARTTLS lagta hai
    needsAppPassword: true,
    dailyLimitHint: 500,
    help: {
      title: 'Gmail ke liye App Password chahiye',
      why: 'Google ne normal password se SMTP band kar diya hai. App Password ek alag 16-akshar ka password hota hai jo sirf is app ke liye banta hai — aur jab chaho band kar sakte ho.',
      steps: [
        'myaccount.google.com/security kholo',
        '2-Step Verification chalu karo (bina iske App Password ka option nahi aayega)',
        'Usi page par "App passwords" par jao',
        `App me "Mail" chuno, device me "Other" — naam ${brandName} likh do`,
        'Jo 16 akshar ka password mile, wo yahan paste kar do (space hata do)',
      ],
      link: 'https://myaccount.google.com/apppasswords',
    },
  },

  microsoft: {
    key: 'microsoft',
    name: 'Outlook / Hotmail / Microsoft 365',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    needsAppPassword: true,
    dailyLimitHint: 300,
    help: {
      title: 'Outlook ke liye App Password chahiye',
      why: 'Microsoft ne bhi normal password se SMTP band kar diya hai. Agar aapka account company ka Microsoft 365 hai, to ho sakta hai admin ne SMTP hi band kar rakha ho — us haal me admin se "SMTP AUTH" chalu karne ko kaho.',
      steps: [
        'account.microsoft.com/security kholo',
        'Two-step verification chalu karo',
        '"App passwords" par jao aur naya password banao',
        'Wo password yahan paste karo (apna roz wala password nahi)',
        'Company ka account hai aur phir bhi na chale, to admin se SMTP AUTH chalu karwao',
      ],
      link: 'https://account.microsoft.com/security',
    },
  },

  office365: {
    key: 'office365',
    name: 'Microsoft 365 (company account)',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    needsAppPassword: true,
    dailyLimitHint: 2000,
    help: {
      title: 'Microsoft 365 business account',
      why: 'Company ke Microsoft 365 me SMTP by default band hota hai. Ise sirf aapka IT admin chalu kar sakta hai.',
      steps: [
        'IT admin se kaho: is mailbox ke liye "Authenticated SMTP" chalu kar do',
        'Admin center → Users → user chuno → Mail → Manage email apps → Authenticated SMTP par tick',
        'Uske baad email aur password (ya App Password) yahan daalo',
      ],
      link: 'https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission',
    },
  },

  yahoo: {
    key: 'yahoo',
    name: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 465,
    secure: true,
    needsAppPassword: true,
    dailyLimitHint: 500,
    help: {
      title: 'Yahoo ke liye App Password chahiye',
      why: 'Yahoo bhi normal password se SMTP nahi chalne deta.',
      steps: [
        'login.yahoo.com/account/security kholo',
        '"Generate app password" par jao',
        `Naam ${brandName} likh kar password banao aur yahan paste karo`,
      ],
      link: 'https://login.yahoo.com/account/security',
    },
  },

  zoho: {
    key: 'zoho',
    name: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    needsAppPassword: true,
    dailyLimitHint: 1000,
    help: {
      title: 'Zoho Mail',
      why: 'Zoho me bhi App Password banana padta hai.',
      steps: [
        'accounts.zoho.com → Security → App Passwords',
        'Naya App Password banao aur yahan paste karo',
        'India ka account ho to host smtp.zoho.in bhi ho sakta hai — na chale to wo try karo',
      ],
      link: 'https://accounts.zoho.com',
    },
  },

  sendgrid: {
    key: 'sendgrid',
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    needsAppPassword: false,
    fixedUser: 'apikey', // SendGrid me username hamesha yahi hota hai
    dailyLimitHint: 100000,
    help: {
      title: 'SendGrid',
      why: 'Bahut zyada email bhejne ke liye achha hai. Yahan username hamesha "apikey" hota hai aur password aapki API key.',
      steps: [
        'app.sendgrid.com → Settings → API Keys → Create API Key',
        '"Full Access" ya kam se kam "Mail Send" ka access do',
        'Jo key mile wo password wale box me paste karo (username apne aap "apikey" hai)',
      ],
      link: 'https://app.sendgrid.com/settings/api_keys',
    },
  },

  brevo: {
    key: 'brevo',
    name: 'Brevo (pehle Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    needsAppPassword: false,
    dailyLimitHint: 300,
    help: {
      title: 'Brevo',
      why: 'Free plan me roz 300 email bhej sakte ho — shuruaat ke liye theek hai.',
      steps: [
        'app.brevo.com → SMTP & API → SMTP',
        'Wahan diya gaya login (email) aur SMTP key yahan daalo',
      ],
      link: 'https://app.brevo.com/settings/keys/smtp',
    },
  },

  smtp: {
    key: 'smtp',
    name: 'Koi aur (Custom SMTP)',
    host: '',
    port: 587,
    secure: false,
    needsAppPassword: false,
    dailyLimitHint: 500,
    help: {
      title: 'Apna SMTP server',
      why: 'Aapka hosting ya company ka apna mail server. Details unke help page par ya hosting panel me milti hain.',
      steps: [
        'Apne hosting/email provider se poocho: SMTP host, port, username, password',
        'Port 465 hai to SSL, 587 hai to TLS — hum apne aap samajh lete hain',
        'Neeche "Connection test karo" dabao — galat hua to wahin pata chal jayega',
      ],
      link: null,
    },
  },
};

export function providerList() {
  return Object.values(PROVIDERS).map((p) => ({
    key: p.key,
    name: p.name,
    host: p.host,
    port: p.port,
    secure: p.secure,
    needsAppPassword: p.needsAppPassword,
    fixedUser: p.fixedUser ?? null,
    dailyLimitHint: p.dailyLimitHint,
    help: p.help,
  }));
}

export function providerPreset(key) {
  return PROVIDERS[key] ?? PROVIDERS.smtp;
}

/**
 * SMTP se aane wali ulti-seedhi error ko aam bhasha me badalta hai.
 *
 * "535 5.7.8 Username and Password not accepted" se kisi ko kuch samajh nahi
 * aata. Isse pata chalna chahiye ki AB KARNA KYA HAI.
 */
export function explainSmtpError(error, providerKey) {
  const raw = String(error?.message || error || '');
  const code = error?.responseCode || error?.code;
  const preset = providerPreset(providerKey);

  if (code === 'EAUTH' || /535|Username and Password not accepted|authentication failed/i.test(raw)) {
    return preset.needsAppPassword
      ? `Email ya password galat hai. ${preset.name} ke liye aapka normal password kaam nahi karta — App Password banana padta hai. Upar diye gaye steps follow karo.`
      : 'Email ya password galat hai. Dobara check karo.';
  }

  if (code === 'ENOTFOUND' || /getaddrinfo|ENOTFOUND/i.test(raw)) {
    return 'Server ka naam (host) galat lag raha hai. Spelling check karo.';
  }

  if (code === 'ECONNREFUSED') {
    return 'Server ne connection lene se mana kar diya. Port galat ho sakta hai — 587 ya 465 try karo.';
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /timeout/i.test(raw)) {
    return 'Server tak pahunch nahi paye. Internet check karo, ya ho sakta hai aapka firewall/hosting SMTP block kar raha ho.';
  }

  if (/self.signed|certificate/i.test(raw)) {
    return 'Server ka security certificate theek nahi hai. Apne hosting wale se poocho.';
  }

  if (/550|relay|not allowed/i.test(raw)) {
    return 'Server ne bhejne se mana kiya. Ho sakta hai "from" address wahi hona chahiye jo login me hai.';
  }

  return `Connect nahi ho paya: ${raw.slice(0, 200)}`;
}

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
      title: 'Gmail needs an App Password',
      why: 'Google has disabled SMTP with your normal password. An App Password is a separate 16-character password generated just for this app — you can revoke it any time.',
      steps: [
        'Open myaccount.google.com/security',
        'Turn on 2-Step Verification (the App Password option will not appear without this)',
        'On that same page, go to "App passwords"',
        `Choose "Mail" as the app and "Other" as the device — enter ${brandName} as the name`,
        'Paste the 16-character password you get here (remove the spaces)',
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
      title: 'Outlook needs an App Password',
      why: 'Microsoft has also disabled SMTP with your normal password. If this is a company Microsoft 365 account, the admin may have disabled SMTP entirely — in that case, ask them to turn on "SMTP AUTH".',
      steps: [
        'Open account.microsoft.com/security',
        'Turn on two-step verification',
        'Go to "App passwords" and create a new one',
        'Paste that password here (not your everyday password)',
        'If this is a company account and it still does not work, ask your admin to enable SMTP AUTH',
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
      why: 'SMTP is disabled by default on company Microsoft 365 accounts. Only your IT admin can turn it on.',
      steps: [
        'Ask your IT admin to enable "Authenticated SMTP" for this mailbox',
        'Admin center → Users → select the user → Mail → Manage email apps → tick Authenticated SMTP',
        'Then enter the email and password (or App Password) here',
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
      title: 'Yahoo needs an App Password',
      why: 'Yahoo also does not allow SMTP with your normal password.',
      steps: [
        'Open login.yahoo.com/account/security',
        'Go to "Generate app password"',
        `Enter ${brandName} as the name, generate the password, and paste it here`,
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
      why: 'Zoho also requires an App Password.',
      steps: [
        'accounts.zoho.com → Security → App Passwords',
        'Create a new App Password and paste it here',
        'On an India account the host may instead be smtp.zoho.in — try that if this one does not work',
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
      why: 'Good for sending high volumes. The username here is always "apikey", and the password is your API key.',
      steps: [
        'app.sendgrid.com → Settings → API Keys → Create API Key',
        'Give it "Full Access", or at least "Mail Send" access',
        'Paste the key you get into the password field (the username is automatically "apikey")',
      ],
      link: 'https://app.sendgrid.com/settings/api_keys',
    },
  },

  brevo: {
    key: 'brevo',
    name: 'Brevo (formerly Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    needsAppPassword: false,
    dailyLimitHint: 300,
    help: {
      title: 'Brevo',
      why: 'The free plan allows 300 emails a day — fine for getting started.',
      steps: [
        'app.brevo.com → SMTP & API → SMTP',
        'Enter the login (email) and SMTP key shown there',
      ],
      link: 'https://app.brevo.com/settings/keys/smtp',
    },
  },

  ses: {
    key: 'ses',
    name: 'Amazon SES',
    host: 'email-smtp.ap-south-1.amazonaws.com',
    port: 587,
    secure: false,
    needsAppPassword: false,
    // AWS ka region alag-alag ho sakta hai, isliye host yahan bhi badla ja
    // sakta hai — baaki providers me nahi (unka host hamesha fixed hota hai).
    editableHost: true,
    dailyLimitHint: 50000,
    help: {
      title: 'Amazon SES',
      why: 'Best for very high volume, but setup is a bit different — the username/password here are not your AWS login, you need to create a separate "SMTP credential".',
      steps: [
        'Open SES in the AWS Console and choose your region (e.g. Asia Pacific — Mumbai for India)',
        'Verify your sending domain or email address under "Verified identities" — SES will not send anything without this',
        'A new account starts in "Sandbox" mode — you can only send to a verified address. Ask AWS Support for "production access" to send to everyone',
        'In SES, go to "SMTP settings" → "Create SMTP credentials" — this creates a NEW username/password, do not enter your AWS login here',
        'Enter the "SMTP endpoint" shown there (e.g. email-smtp.ap-south-1.amazonaws.com) as the Host below, and paste the username/password here',
      ],
      link: 'https://console.aws.amazon.com/ses/home',
    },
  },

  smtp: {
    key: 'smtp',
    name: 'Other (Custom SMTP)',
    host: '',
    port: 587,
    secure: false,
    needsAppPassword: false,
    dailyLimitHint: 500,
    help: {
      title: 'Your own SMTP server',
      why: 'Your hosting provider or company’s own mail server. The details are usually on their help page or in the hosting panel.',
      steps: [
        'Ask your hosting/email provider for: SMTP host, port, username, password',
        'Port 465 means SSL, 587 means TLS — this is detected automatically',
        'Press "Test connection" below — if something is wrong, it will show up right there',
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
    editableHost: p.editableHost ?? false,
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
      ? `The email or password is wrong. ${preset.name} does not accept your normal password — you need to create an App Password. Follow the steps above.`
      : 'The email or password is wrong. Please check again.';
  }

  if (code === 'ENOTFOUND' || /getaddrinfo|ENOTFOUND/i.test(raw)) {
    return 'The server name (host) looks wrong. Check the spelling.';
  }

  if (code === 'ECONNREFUSED') {
    return 'The server refused the connection. The port may be wrong — try 587 or 465.';
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || /timeout/i.test(raw)) {
    return 'Could not reach the server. Check your internet connection, or your firewall/hosting may be blocking SMTP.';
  }

  if (/self.signed|certificate/i.test(raw)) {
    return 'The server’s security certificate is not valid. Ask your hosting provider about it.';
  }

  if (/550|relay|not allowed/i.test(raw)) {
    return 'The server refused to send. The "from" address may need to match the login address.';
  }

  return `Could not connect: ${raw.slice(0, 200)}`;
}

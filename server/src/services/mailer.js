// ---------------------------------------------------------------------------
// Email bhejne wala hissa.
//
// Teen tarike se chal sakta hai — server/.env me MAIL_TRANSPORT se decide hota hai:
//
//   smtp     (default) Har email account ki apni SMTP setting use hoti hai.
//                      Asli email jate hain.
//   ethereal           Test inbox. Email sach me SMTP se jata hai, par kisi
//                      asli inbox me nahi — ek preview link milta hai jispar
//                      email khol kar dekh sakte ho. Testing ke liye best.
//   json               Kuch nahi bhejta, sirf bana kar dikhata hai (dry run).
//
// Zaroori baat: agar account me SMTP details nahi hain to hum CHUP-CHAP
// "bhej diya" nahi bolte — saaf error dete hain. Warna aapko lagega mail chali
// gayi aur asal me kahin nahi gayi.
// ---------------------------------------------------------------------------
import nodemailer from 'nodemailer';

import { badRequest } from '../lib/http.js';
import { openSecrets } from '../lib/secretbox.js';

const mode = (process.env.MAIL_TRANSPORT || 'smtp').toLowerCase();

// Ek account ke liye transport ek hi baar banta hai, phir dobara istemal hota
// hai. Har email par naya SMTP connection banana slow aur bekaar hai.
const cache = new Map();

let etherealPromise = null;

/** Test inbox banata hai (sirf pehli baar), aur uska transport lautata hai. */
async function getEtherealTransport() {
  if (!etherealPromise) {
    etherealPromise = (async () => {
      const account = await nodemailer.createTestAccount();
      const transport = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
      console.log(`[mail] Test inbox: ${account.user}`);
      return { transport, account };
    })();
  }
  return etherealPromise;
}

/**
 * Account ki row se transport banata hai.
 * `secrets` column kabhi API se bahar nahi jata — sirf yahan padha jata hai.
 */
function buildSmtpTransport(account) {
  // Password database me encrypt hokar pada hai. Use yahin kholte hain, bhejne
  // se theek pehle — baaki poore app me wo band hi rehta hai.
  const secrets = openSecrets(account.secrets || {});

  if (!secrets.host || !secrets.user || !secrets.pass) {
    throw badRequest(
      `"${account.email}" ki SMTP details nahi bhari hain. ` +
        'Email Accounts page par jakar host, port, username aur password daalo.'
    );
  }

  return nodemailer.createTransport({
    host: secrets.host,
    port: Number(secrets.port) || 587,
    // 465 hamesha SSL hota hai; baaki port par STARTTLS lagta hai.
    secure: Number(secrets.port) === 465 || secrets.secure === true,
    auth: { user: secrets.user, pass: secrets.pass },
  });
}

export async function getTransport(account) {
  if (mode === 'json') {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  if (mode === 'ethereal') {
    const { transport } = await getEtherealTransport();
    return transport;
  }

  const key = account?.id || 'default';
  if (!cache.has(key)) cache.set(key, buildSmtpTransport(account));
  return cache.get(key);
}

/**
 * Ek email bhejta hai.
 * Lautata hai: { ok, messageId, previewUrl, response }
 */
export async function sendMail(account, message) {
  const envelope = {
    from: { name: message.fromName || account?.display_name || '', address: account?.email || message.from },
    to: message.to,
    replyTo: message.replyTo || undefined,
    subject: message.subject,
    html: message.html,
    text: message.text,
    headers: message.headers || undefined,
  };

  let transport = await getTransport(account);
  let info;

  try {
    info = await transport.sendMail(envelope);
  } catch (error) {
    // Test wala inbox (ethereal) kuch der baad khud hi kaam karna band kar
    // deta hai — wo asthayi hota hai. Aisa hone par ek naya inbox banakar
    // dobara bhejte hain, warna local par testing beech me hi ruk jati hai
    // aur lagta hai ki email bhejna toot gaya.
    //
    // Asli SMTP account par yeh nahi hota, isliye wahan dobara koshish nahi
    // karte — galat password 10 baar bhejne se account block ho sakta hai.
    const isEtherealAuth = mode === 'ethereal' && /535|Invalid login|authentication/i.test(error.message);
    if (!isEtherealAuth) throw error;

    console.warn('[mail] Test inbox ne kaam karna band kar diya. Naya banakar dobara bhej rahe hain.');
    etherealPromise = null;
    transport = await getTransport(account);
    info = await transport.sendMail(envelope);
  }

  return {
    ok: true,
    messageId: info.messageId,
    // Ethereal par yeh link milta hai — isi se check karte hain ki email
    // sach me bana aur gaya.
    previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) || null : null,
    response: info.response || null,
  };
}

/** Account ki SMTP setting sahi hai ya nahi — bina email bheje check karta hai. */
export async function verifyAccount(account) {
  const transport = await getTransport(account);
  await transport.verify();
  return true;
}

export function transportMode() {
  return mode;
}

/** Test inbox ka user/pass, taki aap khud bhi wahan login kar ke dekh sako. */
export async function etherealInfo() {
  if (mode !== 'ethereal') return null;
  const { account } = await getEtherealTransport();
  return { user: account.user, pass: account.pass, web: 'https://ethereal.email' };
}

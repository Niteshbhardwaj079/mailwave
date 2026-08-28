// ---------------------------------------------------------------------------
// SMTP password ko database me LOCK karke rakhna.
//
// Kyun zaroori hai: agar aap ya client ka database kabhi leak ho jaye, to usme
// Gmail/Outlook ke password saaf-saaf nahi dikhne chahiye. Warna hamla karne
// wala unke poore email account me ghus jayega.
//
// Isliye password ko encrypt karke rakhte hain. Chaabi (key) .env me rehti hai,
// database me nahi — dono alag jagah, tabhi surakshit hai.
//
// AES-256-GCM use kar rahe hain: yeh sirf chhupata nahi, yeh bhi pakadta hai
// ki kisi ne data se chhedchhad to nahi ki.
// ---------------------------------------------------------------------------
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../env.js';

// JWT_SECRET se hi ek alag chaabi bana lete hain. Alag isliye ki ek kaam ki
// chaabi doosre kaam me na lage — yeh basic security niyam hai.
const key = createHash('sha256').update(`mailwave:secretbox:${env.jwtSecret}`).digest();

const PREFIX = 'enc:v1:';

/**
 * Text ko encrypt karta hai.
 * Result aisa dikhta hai: enc:v1:<iv>:<tag>:<data>
 */
export function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null;

  // IV har baar naya. Same password do baar encrypt karo to result alag aayega —
  // isse koi andaza nahi laga sakta ki do account ka password same hai.
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX + [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

/**
 * Wapas asli text nikalta hai.
 * Kuch bhi gadbad ho to null lautata hai, crash nahi karta.
 */
export function decrypt(stored) {
  if (!stored) return null;
  if (!String(stored).startsWith(PREFIX)) return String(stored); // purana plain data

  try {
    const [ivPart, tagPart, dataPart] = String(stored).slice(PREFIX.length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    // Yahan aane ka matlab: ya to data bigad gaya, ya JWT_SECRET badal gaya.
    console.error('[secretbox] decrypt nahi hua — kya JWT_SECRET badal diya?');
    return null;
  }
}

/** Account ke secrets object me se password encrypt karke lautata hai. */
export function sealSecrets(secrets = {}) {
  return { ...secrets, pass: encrypt(secrets.pass) };
}

/** Bhejne se thoda pehle password kholta hai. */
export function openSecrets(secrets = {}) {
  return { ...secrets, pass: decrypt(secrets.pass) };
}

/**
 * Screen par dikhane ke liye — password kabhi bahar nahi jata.
 * Sirf itna batate hain ki bhara hua hai ya nahi.
 */
export function maskSecrets(secrets = {}) {
  return {
    host: secrets.host ?? null,
    port: secrets.port ?? null,
    user: secrets.user ?? null,
    secure: secrets.secure ?? null,
    hasPassword: Boolean(secrets.pass),
  };
}

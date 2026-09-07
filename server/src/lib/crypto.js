// ---------------------------------------------------------------------------
// Object Storage ki Secret Access Key ko database me plain text me kabhi nahi
// rakhte — yahan encrypt/decrypt hoti hai (AES-256-GCM).
//
// Key kahan se aati hai
// ----------------------
// Ek naya JWT_SECRET jaisa alag env variable maangne ki jagah, JWT_SECRET
// (jo har install me pehle se hai — env.js dekho) se hi ek dusri key nikaal
// lete hain (sha256 hash, ek fixed "namespace" text ke saath). Isse:
//   - Client ko koi naya setup step nahi karna padta.
//   - JWT_SECRET aur is encryption ki key alag hain (hash alag namespace se
//     ban rahi hai), isliye ek leak dusre ko seedha expose nahi karta.
// ---------------------------------------------------------------------------
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { env } from '../env.js';

function deriveKey() {
  return createHash('sha256').update(`${env.jwtSecret}:storage-credentials`).digest();
}

/** `iv:authTag:ciphertext`, sab base64 me — ek hi text field me store hone layak. */
export function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;

  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decrypt(stored) {
  if (!stored) return null;

  const parts = String(stored).split(':');
  if (parts.length !== 3) return null;

  try {
    const [ivB64, authTagB64, dataB64] = parts;
    const key = deriveKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    // JWT_SECRET badal gaya ho ya data kharab ho — chup-chap null, taaki
    // caller "storage configured nahi hai" jaisa treat kar sake.
    return null;
  }
}

/** Settings screen par dikhane ke liye — kabhi asli value nahi, sirf aakhri 4 akshar. */
export function maskSecret(value, visible = 4) {
  if (!value) return '';
  const tail = String(value).slice(-visible);
  return `${'•'.repeat(8)}${tail}`;
}

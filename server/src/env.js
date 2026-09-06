import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

// Naam aur company project ki ek hi brand.config.js se aate hain — backend aur
// frontend dono wahi padhte hain, isliye do jagah badalna nahi padta.
import brand from '../../brand.config.js';

const here = dirname(fileURLToPath(import.meta.url));
export const serverRoot = resolve(here, '..');

dotenv.config({ path: resolve(serverRoot, '.env') });

/**
 * A signing secret has to survive restarts, otherwise every deploy logs
 * everyone out. If none is configured we generate one once and write it to
 * .env, so a fresh clone just works without a setup step — but a real
 * deployment should set JWT_SECRET itself.
 */
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const generated = randomBytes(48).toString('base64url');
  const envPath = resolve(serverRoot, '.env');
  const line = `JWT_SECRET=${generated}\n`;

  try {
    const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    writeFileSync(envPath, existing.endsWith('\n') || !existing ? existing + line : `${existing}\n${line}`);
    console.warn('[env] No JWT_SECRET found — generated one and saved it to server/.env');
  } catch (error) {
    console.warn('[env] No JWT_SECRET and .env is not writable — tokens will not survive a restart');
  }

  return generated;
}

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  /** App ka naam, company, support email — sab brand.config.js se. */
  brand,

  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),

  // Asli Postgres ka pata. Bhara hua hai to wahi use hota hai.
  // Client ke server par YEH BHARNA ZAROORI HAI — warna data ja sakta hai.
  // Jaise: postgres://user:password@host:5432/mailwave
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: String(process.env.DATABASE_SSL || '').toLowerCase() === 'true',

  /** PGlite ka folder — sirf tab kaam aata hai jab DATABASE_URL khali ho. */
  dataDir: process.env.DATA_DIR || resolve(serverRoot, 'data/pgdata'),

  jwtSecret: resolveSecret(),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: int(process.env.REFRESH_TOKEN_DAYS, 30),

  /** Browsers allowed to call the API. The Vite dev server by default. */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  /** Used to build tracking and unsubscribe links inside sent email. */
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${int(process.env.PORT, 4000)}`,
  appUrl: process.env.APP_URL || 'http://localhost:5173',

  /**
   * App khud jo email bhejta hai (password reset, invite) wo kis account se
   * jaaye. Khali chhod do to jo pehla email account juda hai wahi istemal hoga.
   * Client alag "no-reply@..." rakhna chahe to yahan uska email likh do.
   */
  systemEmailFrom: process.env.SYSTEM_EMAIL_FROM || '',

  /** Seed account, only used the first time the database is created. */
  seedEmail: process.env.SEED_EMAIL || 'rohit@gowebkart.com',
  seedPassword: process.env.SEED_PASSWORD || 'mailwave',

  /**
   * Backup file kahan rakhi jaaye.
   *
   * 'local'  — server ke apne disk par. Render jaisi hosting par yeh disk
   *            deploy/restart ke saath mit sakta hai — isliye sirf
   *            "abhi ke liye kaam chalane" wala tareeka hai, permanent nahi.
   * 's3'     — kisi bhi S3-compatible storage par (AWS S3, Cloudflare R2,
   *            Backblaze B2, DigitalOcean Spaces, MinIO...). `endpoint` badal
   *            kar koi bhi provider lag sakta hai — code kisी ek company ka
   *            nahi hai.
   */
  backupStorage: {
    driver: (process.env.BACKUP_STORAGE || 'local').toLowerCase(),
    s3: {
      endpoint: process.env.BACKUP_S3_ENDPOINT || '',
      region: process.env.BACKUP_S3_REGION || 'auto',
      bucket: process.env.BACKUP_S3_BUCKET || '',
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY || '',
      // Zyadatar S3-compatible providers (R2, Spaces, MinIO) ko yeh "true"
      // chahiye hota hai. Asli AWS S3 dono tarike se chalta hai.
      forcePathStyle: String(process.env.BACKUP_S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true',
      prefix: process.env.BACKUP_S3_PREFIX || 'mailwave-backups/',
    },
  },
};

export const isProduction = env.nodeEnv === 'production';

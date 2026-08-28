import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

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
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),

  /** Where PGlite keeps its data directory. */
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

  /** Seed account, only used the first time the database is created. */
  seedEmail: process.env.SEED_EMAIL || 'rohit@gowebkart.com',
  seedPassword: process.env.SEED_PASSWORD || 'mailwave',
};

export const isProduction = env.nodeEnv === 'production';

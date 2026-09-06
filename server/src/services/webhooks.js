// ---------------------------------------------------------------------------
// Webhooks — client ke apne URL par real-time events POST karna.
//
// Do hisse hain, jaan-boojh kar alag:
//   1. enqueueWebhookEvent() — event ko turant ek queue table me daal deta
//      hai. Isse sending/tracking kabhi kisi dheeme ya toote hue client URL
//      ke intezaar me nahi rukti — daalna turant hai.
//   2. Background worker (yahin niche) — har thodi der me queue se uthakar
//      asal me bhejta hai, fail hone par khud-ba-khud dobara koshish karta
//      hai (badhta hua wait), aur ek limit ke baad haar maan leta hai.
//
// Har bheji hui request par ek signature (HMAC-SHA256) lagti hai, taki
// client apne server par jaanch sake ki request sach me MailWave se aayi
// hai, kisi aur ne bhej kar spoof nahi kiya.
// ---------------------------------------------------------------------------
import { createHmac, randomBytes } from 'node:crypto';

import { many, one, query } from '../db/client.js';
import { newId } from '../lib/ids.js';

/** Kitne events ek baar me bhejne ki koshish. Bahut zyada ek saath bhejna client ke server ko dubo sakta hai. */
const BATCH_SIZE = 20;

/** Fail hone par kitni der ruk kar dobara try karein — har baar zyada. */
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120];

let timer = null;

/** Client ka webhook config — settings table ke 'webhooks' key se. */
export async function getWebhookConfig() {
  const row = await one(`SELECT value FROM settings WHERE key = 'webhooks'`);
  return row?.value ?? null;
}

async function saveWebhookConfig(value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('webhooks', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(value)]
  );
}

/** Naya, random secret — sirf banते hi poora dikhta hai, uske baad sirf uska pehla hissa. */
export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

export async function setWebhookUrl({ url, enabled }) {
  const current = (await getWebhookConfig()) ?? {};
  const next = { ...current, url, enabled };
  await saveWebhookConfig(next);
  return next;
}

export async function rotateWebhookSecret() {
  const current = (await getWebhookConfig()) ?? {};
  const secret = generateWebhookSecret();
  await saveWebhookConfig({ ...current, secret });
  return secret;
}

/** Payload par HMAC-SHA256 lagata hai — client isi se apni taraf jaanch karta hai. */
export function signPayload(rawBody, secret) {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/**
 * Event ko queue me daal deta hai — turant, kuch bhejta nahi.
 *
 * Agar koi URL hi configure nahi hai, ya webhook band hai, to kuch nahi
 * karta — ek row bhi nahi banti, taaki bina wajah database na bhare.
 */
export async function enqueueWebhookEvent(event, data) {
  const config = await getWebhookConfig();
  if (!config?.enabled || !config?.url) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  await query(
    `INSERT INTO webhook_deliveries (id, event, payload) VALUES ($1,$2,$3)`,
    [newId('wh'), event, JSON.stringify(payload)]
  );
}

/** fetch ko hamesha ke liye latakne nahi dete — ek time ke baad khud rok dete hain. */
async function postWithTimeout(url, body, headers, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer2 = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } finally {
    clearTimeout(timer2);
  }
}

async function scheduleRetry(row, statusCode, error) {
  const attempts = row.attempts + 1;
  const giveUp = attempts >= RETRY_DELAYS_MINUTES.length;

  if (giveUp) {
    await query(
      `UPDATE webhook_deliveries
          SET status = 'failed', attempts = $1, last_status_code = $2, last_error = $3
        WHERE id = $4`,
      [attempts, statusCode, error?.slice(0, 500) ?? null, row.id]
    );
    return;
  }

  const delayMinutes = RETRY_DELAYS_MINUTES[attempts - 1];
  await query(
    `UPDATE webhook_deliveries
        SET attempts = $1, next_attempt_at = now() + ($2 || ' minutes')::interval,
            last_status_code = $3, last_error = $4
      WHERE id = $5`,
    [attempts, String(delayMinutes), statusCode, error?.slice(0, 500) ?? null, row.id]
  );
}

async function deliverOne(row, config) {
  const body = JSON.stringify(row.payload);
  const signature = signPayload(body, config.secret ?? '');

  try {
    const res = await postWithTimeout(config.url, body, {
      'Content-Type': 'application/json',
      'X-MailWave-Event': row.event,
      'X-MailWave-Signature': signature,
      'User-Agent': 'MailWave-Webhooks/1.0',
    });

    if (res.ok) {
      await query(
        `UPDATE webhook_deliveries
            SET status = 'delivered', delivered_at = now(), attempts = attempts + 1, last_status_code = $1
          WHERE id = $2`,
        [res.status, row.id]
      );
      return;
    }

    await scheduleRetry(row, res.status, `HTTP ${res.status}`);
  } catch (error) {
    await scheduleRetry(row, null, String(error?.message || error));
  }
}

/**
 * Due events uthakar bhejta hai. Webhook is waqt band ho ya URL hi na ho,
 * to jo pending pade hain unhe 'failed' kar dete hain (chup-chap chhod nahi
 * dete) — warna hafton baad chalu karne par ek dher sara purana event ek
 * saath chala jata, jo client ko ulta confuse karta.
 */
async function processDueDeliveries() {
  const config = await getWebhookConfig();

  if (!config?.enabled || !config?.url) {
    await query(
      `UPDATE webhook_deliveries
          SET status = 'failed', last_error = 'Webhook band tha jab yeh bhejna tha'
        WHERE status = 'pending'`
    );
    return;
  }

  const due = await many(
    `SELECT * FROM webhook_deliveries
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT $1`,
    [BATCH_SIZE]
  );

  for (const row of due) {
    // eslint-disable-next-line no-await-in-loop
    await deliverOne(row, config);
  }
}

export function startWebhookWorker() {
  if (timer) return;
  timer = setInterval(() => {
    processDueDeliveries().catch((error) => console.error('[webhooks] delivery loop fail hui:', error));
  }, 30_000);
  if (timer.unref) timer.unref();
}

export function stopWebhookWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Settings page ke "Send test" button ke liye — turant, queue ke bina, seedha bhejta hai. */
export async function sendTestWebhook() {
  const config = await getWebhookConfig();
  if (!config?.url) return { ok: false, reason: 'no-url' };

  const payload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'Yeh ek test event hai — asal me kuch hua nahi hai.' },
  };
  const body = JSON.stringify(payload);
  const signature = signPayload(body, config.secret ?? '');

  try {
    const res = await postWithTimeout(config.url, body, {
      'Content-Type': 'application/json',
      'X-MailWave-Event': 'webhook.test',
      'X-MailWave-Signature': signature,
      'User-Agent': 'MailWave-Webhooks/1.0',
    });
    return { ok: res.ok, statusCode: res.status };
  } catch (error) {
    return { ok: false, reason: 'send-failed', error: String(error?.message || error) };
  }
}

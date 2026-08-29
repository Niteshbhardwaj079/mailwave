// ---------------------------------------------------------------------------
// Campaign bhejne wala engine.
//
// Ek-ek karke nahi, BATCH me bhejta hai — jaise 100 email, phir 2 minute ruko,
// phir agle 100. Kyun? Kyunki Gmail/Outlook ek saath hazaron email dekhkar
// account block kar dete hain. Dheere bhejna hi surakshit hai.
//
// Bhejne se pehle har address par teen check lagte hain:
//   1. Suppression list me to nahi? (unsubscribe/bounce ho chuka)
//   2. Account ki aaj ki limit to khatam nahi hui?
//   3. Campaign abhi bhi "Sending" hai? (beech me Pause ho sakta hai)
// ---------------------------------------------------------------------------
import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { newId } from '../lib/ids.js';
import { buildEmail } from './render.js';
import { sendMail } from './mailer.js';

// Kaun se campaign abhi chal rahe hain. Server restart hone par khali ho jata
// hai — isliye status database me bhi likha jata hai, sirf yahan nahi.
const running = new Map();

export function isRunning(campaignId) {
  return running.has(campaignId);
}

export function runningCampaigns() {
  return Array.from(running.keys());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aaj ka counter reset karta hai agar din badal gaya ho. */
async function resetQuotaIfNewDay(accountId) {
  await query(
    `UPDATE email_accounts
        SET sent_today = 0, quota_date = current_date
      WHERE id = $1 AND (quota_date IS NULL OR quota_date < current_date)`,
    [accountId]
  );
}

/**
 * Campaign ke HTML me jitne link hain, sabko database me daal deta hai — taki
 * har link ka apna id ho aur click gina ja sake.
 */
async function collectLinks(campaign) {
  const links = new Map();
  if (!campaign.click_tracking) return links;

  const found = new Set();
  const pattern = /href\s*=\s*"(https?:\/\/[^"]+)"/gi;
  let match = pattern.exec(campaign.html);
  while (match) {
    found.add(match[1]);
    match = pattern.exec(campaign.html);
  }

  for (const url of found) {
    const existing = await one(
      'SELECT id, url FROM campaign_links WHERE campaign_id = $1 AND url = $2',
      [campaign.id, url]
    );

    if (existing) {
      links.set(url, existing);
    } else {
      const id = newId('lnk');
      await query('INSERT INTO campaign_links (id, campaign_id, url) VALUES ($1,$2,$3)', [
        id,
        campaign.id,
        url,
      ]);
      links.set(url, { id, url });
    }
  }

  return links;
}

async function workspaceSetting(key, fallback) {
  const row = await one('SELECT value FROM settings WHERE key = $1', [key]);
  return row?.value ?? fallback;
}

/**
 * Ek campaign bhejta hai. Background me chalta hai — HTTP request iska
 * intezaar nahi karti, warna browser timeout ho jayega.
 */
export async function startCampaign(campaignId, { company = env.brand.company } = {}) {
  if (running.has(campaignId)) return { started: false, reason: 'already_running' };

  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!campaign) return { started: false, reason: 'not_found' };
  if (!campaign.account_id) return { started: false, reason: 'no_account' };

  const account = await one('SELECT * FROM email_accounts WHERE id = $1', [campaign.account_id]);
  if (!account) return { started: false, reason: 'no_account' };

  await query(
    `UPDATE campaigns SET status = 'Sending', started_at = COALESCE(started_at, now()), updated_at = now()
      WHERE id = $1`,
    [campaignId]
  );

  const controller = { stop: false };
  running.set(campaignId, controller);

  // Jaan-boojh kar await nahi kar rahe: yeh background me chalta rahega.
  run(campaign, account, controller, company).catch(async (error) => {
    console.error('[sender] campaign fail hui', campaignId, error);
    await query(`UPDATE campaigns SET status = 'Failed', updated_at = now() WHERE id = $1`, [campaignId]);
    running.delete(campaignId);
  });

  return { started: true };
}

export async function pauseCampaign(campaignId) {
  const controller = running.get(campaignId);
  if (controller) controller.stop = true;

  await query(`UPDATE campaigns SET status = 'Paused', updated_at = now() WHERE id = $1`, [campaignId]);
  running.delete(campaignId);
  return { ok: true };
}

async function run(campaign, account, controller, company) {
  const links = await collectLinks(campaign);

  const unsubSettings = await workspaceSetting('unsubscribe', {});
  const unsubscribeText = unsubSettings.linkText || 'Unsubscribe from these emails';

  const batchSize = campaign.batch_size > 0 ? campaign.batch_size : 100000;
  const delayMs = Math.max(0, (campaign.batch_delay ?? 0) * 60 * 1000);

  for (;;) {
    if (controller.stop) return;

    // Har batch se pehle status dobara padho — kisi ne Pause dabaya ho sakta hai.
    const current = await one('SELECT status FROM campaigns WHERE id = $1', [campaign.id]);
    if (!current || current.status !== 'Sending') {
      running.delete(campaign.id);
      return;
    }

    await resetQuotaIfNewDay(account.id);
    const fresh = await one('SELECT daily_limit, sent_today FROM email_accounts WHERE id = $1', [account.id]);
    const remainingToday = Math.max(0, (fresh?.daily_limit ?? 0) - (fresh?.sent_today ?? 0));

    if (remainingToday <= 0) {
      // Limit khatam. Campaign ko Paused chhod dete hain — kal insaan ya
      // scheduler dobara chalu kar dega.
      await query(
        `UPDATE campaigns SET status = 'Paused', updated_at = now() WHERE id = $1`,
        [campaign.id]
      );
      running.delete(campaign.id);
      console.log(`[sender] ${campaign.id}: aaj ki limit khatam, rok diya`);
      return;
    }

    const take = Math.min(batchSize, remainingToday);

    // Sirf wahi log jinhe abhi tak nahi bheja, aur jo suppression list me nahi hain.
    const batch = await many(
      `SELECT r.id, r.email, r.name, r.merge_data
         FROM campaign_recipients r
    LEFT JOIN suppression s ON lower(s.email) = lower(r.email)
        WHERE r.campaign_id = $1
          AND r.status = 'Pending'
          AND s.email IS NULL
        ORDER BY r.id
        LIMIT $2`,
      [campaign.id, take]
    );

    if (batch.length === 0) {
      await query(
        `UPDATE campaigns SET status = 'Sent', finished_at = now(), updated_at = now() WHERE id = $1`,
        [campaign.id]
      );
      running.delete(campaign.id);
      console.log(`[sender] ${campaign.id}: poora ho gaya`);
      return;
    }

    for (const recipient of batch) {
      if (controller.stop) return;

      const message = buildEmail({ campaign, recipient, links, company, unsubscribeText });

      try {
        const result = await sendMail(account, {
          to: recipient.email,
          fromName: campaign.sender_name,
          replyTo: campaign.reply_to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        });

        await query(
          `UPDATE campaign_recipients SET status = 'Sent', sent_at = now(), error = NULL WHERE id = $1`,
          [recipient.id]
        );
        await query(
          'UPDATE email_accounts SET sent_today = sent_today + 1, quota_date = current_date WHERE id = $1',
          [account.id]
        );

        if (result.previewUrl) console.log(`[sender] preview: ${result.previewUrl}`);
      } catch (error) {
        // Ek address fail hone se poori campaign nahi rukni chahiye.
        await query(
          `UPDATE campaign_recipients SET status = 'Failed', error = $2 WHERE id = $1`,
          [recipient.id, String(error?.message || error).slice(0, 300)]
        );
        console.error(`[sender] ${recipient.email} fail:`, error?.message || error);
      }
    }

    // Sab bhej diya to aur intezaar mat karo.
    const left = await one(
      `SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1 AND status = 'Pending'`,
      [campaign.id]
    );
    if ((left?.n ?? 0) === 0) continue;

    if (delayMs > 0) await sleep(delayMs);
  }
}

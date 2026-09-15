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
import { notifySuperAdmins, sendSystemEmail } from './systemMail.js';
import { enqueueWebhookEvent } from './webhooks.js';

// Kaun se campaign abhi chal rahe hain. Server restart hone par khali ho jata
// hai — isliye status database me bhi likha jata hai, sirf yahan nahi.
const running = new Map();

// A/B test wali campaign ke teen "actively sending" status — normal campaign
// sirf 'Sending' hi kabhi dekhti hai, A/B campaign apni zindagi me teenon se
// guzarti hai (pehle test-sample, phir winner blast). Jahan bhi neeche
// "abhi kya chal raha hai" poochna hai, ismese koi bhi ek ho sakta hai.
const ACTIVE_SEND_STATUSES = ['Sending', 'Testing', 'Sending Winner'];

export function isRunning(campaignId) {
  return running.has(campaignId);
}

export function runningCampaigns() {
  return Array.from(running.keys());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sirf tabhi HARD BOUNCE maante hain jab receiving mail server ne is
 * recipient ko RCPT TO command par hi seedha permanent (5xx) reject kiya ho
 * — yehi standard SMTP signal hai (RFC 5321) ki mailbox exist nahi karta ya
 * hamesha ke liye band hai. `nodemailer` real SMTP rejection par error par
 * `.command` ('RCPT TO', 'DATA', 'MAIL FROM', ya connection/auth ke liye
 * 'CONN'/'API'/'AUTH ...') aur `.responseCode` (server ka SMTP code) daalta
 * hai — yeh humne khud test karke (fake SMTP server se) confirm kiya hai,
 * guess nahi kiya.
 *
 * Jaan-boojh kar NARROW rakha hai: connection/timeout/auth errors, 4xx
 * (transient — dobara koshish se ho sakta hai chal jaaye), aur DATA-stage
 * rejections (message content/policy reject hua, "mailbox exist nahi"
 * nahi) — in sab par 'Bounced' nahi maante, 'Failed' hi rehta hai (jo
 * already retry ke liye eligible hai). Asthayi failure ko bounce maan kar
 * suppression list me daal dena galat hoga — us insaan ko hamesha ke liye
 * mail band ho jaati, jabki asli wajah sirf ek doosre din ka network glitch
 * ho sakta tha.
 */
function isHardBounce(error) {
  const code = Number(error?.responseCode);
  return error?.command === 'RCPT TO' && Number.isInteger(code) && code >= 500 && code < 600;
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

/** Campaign poori ho gayi — jisne bheji thi usko bata dete hain. */
async function notifyCampaignFinished(campaignId) {
  const row = await one(
    `SELECT c.name,
            u.email AS creator_email, u.name AS creator_name, u.language AS creator_language,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Failed') AS failed
       FROM campaigns c
       LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1`,
    [campaignId]
  );
  // created_by khaali ho sakta hai (jisne banayi thi wo user delete ho chuka) —
  // tab kise bhejein pata nahi, isliye chup-chap chhod dete hain.
  if (!row?.creator_email) return;

  await sendSystemEmail(
    'campaign.finished',
    { email: row.creator_email, name: row.creator_name, language: row.creator_language },
    {
      campaign_name: row.name,
      total_sent: String(row.sent ?? 0),
      total_failed: String(row.failed ?? 0),
      report_url: `${env.appUrl}/campaigns/${campaignId}`,
    }
  );
}

/** Campaign beech me atak gayi (crash) — bhejne wale aur Super Admins ko batao. */
async function notifyCampaignFailed(campaignId, error) {
  const row = await one(
    `SELECT c.name,
            u.email AS creator_email, u.name AS creator_name, u.language AS creator_language,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent
       FROM campaigns c
       LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1`,
    [campaignId]
  );
  if (!row) return;

  const vars = {
    campaign_name: row.name,
    reason: String(error?.message || error || '').slice(0, 200),
    sent_so_far: String(row.sent ?? 0),
    campaign_url: `${env.appUrl}/campaigns/${campaignId}`,
  };

  if (row.creator_email) {
    await sendSystemEmail(
      'campaign.failed',
      { email: row.creator_email, name: row.creator_name, language: row.creator_language },
      vars
    );
  }
  // creator khud Super Admin ho sakta hai — usse dobara na bheje, warna
  // usi ek hadse ke liye do email mil jatin.
  await notifySuperAdmins('campaign.failed', vars, { excludeEmail: row.creator_email });
}

/**
 * Ek campaign bhejta hai. Background me chalta hai — HTTP request iska
 * intezaar nahi karti, warna browser timeout ho jayega.
 *
 * `reclaim: true` sirf recoverStuckCampaigns() se aata hai (dekho neeche) —
 * normal callers (Send button, resend, scheduler) kabhi ise true nahi
 * bhejte. Farak sirf claim query me hai: normal path ek campaign ko SIRF
 * tab claim karta hai jab wo abhi `targetStatus` NAHI hai (naya start/resume);
 * reclaim path ULTA hai — sirf tab claim karta hai jab wo PEHLE SE
 * `targetStatus` hai (server restart ke baad orphan mili hui campaign).
 *
 * `targetStatus` — normal campaign ke liye hamesha 'Sending' hi rehta hai
 * (default), isliye koi bhi purana caller kuch pass kiye bina bilkul waisa hi
 * chalta rehta hai. A/B campaign apne test-sample ko 'Testing' me, aur
 * winner-blast ko 'Sending Winner' me claim karti hai — routes/campaigns.js
 * ke A/B routes hi yeh batate hain, baaki poora `run()` loop dono jagah
 * bilkul EK hi tarah kaam karta hai.
 */
export async function startCampaign(
  campaignId,
  { company = env.brand.company, reclaim = false, targetStatus = 'Sending' } = {}
) {
  if (running.has(campaignId)) return { started: false, reason: 'already_running' };

  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!campaign) return { started: false, reason: 'not_found' };
  if (!campaign.account_id) return { started: false, reason: 'no_account' };

  const account = await one('SELECT * FROM email_accounts WHERE id = $1', [campaign.account_id]);
  if (!account) return { started: false, reason: 'no_account' };

  // Atomic claim — the `running` check above only protects against this same
  // process calling startCampaign twice; it says nothing if this app is ever
  // run as more than one instance. A single UPDATE is always atomic in
  // Postgres regardless of connection/session details, so whichever caller's
  // UPDATE actually matches wins; everyone else affects zero rows and backs
  // off instead of both spawning a send loop.
  const claimed = reclaim
    ? await one(
        `UPDATE campaigns
            SET pause_reason = NULL, started_at = COALESCE(started_at, now()), updated_at = now()
          WHERE id = $1 AND status = $2
          RETURNING id`,
        [campaignId, targetStatus]
      )
    : await one(
        `UPDATE campaigns
            SET status = $2, pause_reason = NULL, started_at = COALESCE(started_at, now()), updated_at = now()
          WHERE id = $1 AND status != $2
          RETURNING id`,
        [campaignId, targetStatus]
      );
  if (!claimed) return { started: false, reason: 'already_running' };

  const controller = { stop: false };
  running.set(campaignId, controller);

  // Jaan-boojh kar await nahi kar rahe: yeh background me chalta rahega.
  // (run() apna pehla kaam hi status ko dobara DB se padhna karta hai, isliye
  // yahan `campaign` ka claim-se-pehle wala `status` maayne nahi rakhta.)
  run(campaign, account, controller, company).catch(async (error) => {
    console.error('[sender] campaign fail hui', campaignId, error);
    await query(`UPDATE campaigns SET status = 'Failed', updated_at = now() WHERE id = $1`, [campaignId]);
    running.delete(campaignId);
    await notifyCampaignFailed(campaignId, error);
  });

  return { started: true };
}

/**
 * Server (re)start hote hi EK BAAR chalta hai (scheduler.js se). Agar koi
 * campaign database me 'Sending' padi hai lekin is (naye, taaza) process ki
 * `running` Map me nahi hai, to iska matlab pichla process bhejte-bhejte hi
 * crash/restart ho gaya tha — us campaign ko yahin se dobara chalu karte
 * hain, taaki client ko khud "Resume" na dabana pade.
 *
 * Duplicate-send ka koi khatra nahi: run() ka batch-query hamesha sirf
 * status='Pending' wale uthata hai (neeche dekho) — jo pehle se 'Sent' hain
 * unhe yeh kabhi dobara nahi chhoota.
 *
 * SIRF startup par hi safe hai: ek taaza process me `running` guaranteed
 * khaali hoti hai, isliye har 'Sending' row provably orphaned hai. Isko
 * baar-baar (jaise har minute) chalana galat hoga — beech me genuinely chal
 * rahi campaign ko bhi "orphan" samajh sakta.
 */
export async function recoverStuckCampaigns() {
  const stuck = await many(
    `SELECT id, name, account_id, status FROM campaigns WHERE status = ANY($1)`,
    [ACTIVE_SEND_STATUSES]
  );
  const recovered = [];

  for (const row of stuck) {
    if (running.has(row.id)) continue; // paranoia — startup par aisा hona hi nahi chahiye

    if (!row.account_id) {
      // Bina account ke resume nahi ho sakti — hamesha atki hui dikhne se
      // behtar hai saaf 'Failed' maar dena.
      await query(`UPDATE campaigns SET status = 'Failed', updated_at = now() WHERE id = $1`, [row.id]);
      console.error(`[sender] "${row.name}" restart ke baad atki thi (koi account nahi) — Failed kar diya.`);
      continue;
    }

    // targetStatus = row.status khud — reclaim status BADALTA nahi, sirf
    // confirm karta hai ki abhi bhi wahi hai jahan orphan mili thi (matlab
    // 'Sending' campaign 'Sending' hi rahegi, 'Testing' wali 'Testing' hi).
    const result = await startCampaign(row.id, { company: env.brand.company, reclaim: true, targetStatus: row.status });
    if (result.started) {
      console.log(`[sender] "${row.name}" — server restart se pehle '${row.status}' me atki thi, khud-ba-khud dobara chalu ki.`);
      recovered.push(row.id);
    } else {
      console.error(`[sender] "${row.name}" ko restart ke baad dobara chalu nahi kar paye (${result.reason}).`);
    }
  }

  return recovered;
}

export async function pauseCampaign(campaignId) {
  const controller = running.get(campaignId);
  if (controller) controller.stop = true;

  // 'manual' — insaan ne roka, isliye scheduler ise kal khud chalu nahi
  // karega. Sirf quota khatam hone wala pause apne aap resume hota hai.
  //
  // resume_target_status = status (RHS `status` update se PEHLE wali value
  // hai) — normal campaign ke liye hamesha 'Sending' hoga, par A/B campaign
  // 'Testing' ya 'Sending Winner' me se bhi paused ho sakti hai. Isi column
  // se baad me "Resume" dabane par bilkul WAHI phase wapas milta hai, kabhi
  // galti se 'Sending' me flip nahi hota.
  await query(
    `UPDATE campaigns
        SET status = 'Paused', pause_reason = 'manual', resume_target_status = status, updated_at = now()
      WHERE id = $1`,
    [campaignId]
  );
  running.delete(campaignId);
  return { ok: true };
}

async function run(campaign, account, controller, company) {
  // A/B campaign ke variants ek hi baar load kar lete hain (id -> row) —
  // batch-loop ke andar har recipient ke liye dobara DB nahi poochni padti.
  const variants = new Map();
  if (campaign.ab_enabled) {
    const variantRows = await many('SELECT * FROM campaign_variants WHERE campaign_id = $1', [campaign.id]);
    for (const row of variantRows) variants.set(row.id, row);
  }

  // Click-tracking links campaign ke apne html SE, aur (content A/B ho to)
  // har variant ke apne-apne html se bhi chahiye — warna variant B ke ek
  // link par click track hi nahi hoga. Same URL do jagah mile to ek hi
  // campaign_links row reuse hoti hai (jaisa collectLinks() vaise bhi karta
  // hai), per-recipient click_count phir bhi sahi recipient ko hi jaata hai.
  const links = await collectLinks(campaign);
  for (const variant of variants.values()) {
    if (!variant.html) continue;
    const variantLinks = await collectLinks({ ...campaign, html: variant.html });
    for (const [url, link] of variantLinks) links.set(url, link);
  }

  const unsubSettings = await workspaceSetting('unsubscribe', {});
  const unsubscribeText = unsubSettings.linkText || 'Unsubscribe from these emails';

  const batchSize = campaign.batch_size > 0 ? campaign.batch_size : 100000;
  const delayMs = Math.max(0, (campaign.batch_delay ?? 0) * 60 * 1000);

  for (;;) {
    if (controller.stop) return;

    // Har batch se pehle status dobara padho — kisi ne Pause dabaya ho sakta hai.
    const current = await one('SELECT status FROM campaigns WHERE id = $1', [campaign.id]);
    if (!current || !ACTIVE_SEND_STATUSES.includes(current.status)) {
      running.delete(campaign.id);
      return;
    }
    campaign.status = current.status;

    await resetQuotaIfNewDay(account.id);
    const fresh = await one('SELECT daily_limit, sent_today FROM email_accounts WHERE id = $1', [account.id]);
    const remainingToday = Math.max(0, (fresh?.daily_limit ?? 0) - (fresh?.sent_today ?? 0));

    if (remainingToday <= 0) {
      // Limit khatam. 'quota' se maarka lagate hain, taaki scheduler kal
      // subah quota reset hote hi ise khud chalu kar de — insaan ko roz
      // yaad rakhkar dobara "Resume" dabana na pade.
      await query(
        `UPDATE campaigns
            SET status = 'Paused', pause_reason = 'quota', resume_target_status = status, updated_at = now()
          WHERE id = $1`,
        [campaign.id]
      );
      running.delete(campaign.id);
      console.log(`[sender] ${campaign.id}: aaj ki limit khatam, rok diya`);
      return;
    }

    const take = Math.min(batchSize, remainingToday);

    // Sirf wahi log jinhe abhi tak nahi bheja, aur jo IS ACCOUNT ke liye
    // suppression list me nahi hain — '' wala row har account par lagu hota
    // hai (purana global record, ya "Apply globally" chalu hone par naya).
    // NOT EXISTS istemal karte hain, LEFT JOIN nahi — ek email ke liye ab EK
    // se zyada suppression row ho sakti hai (account-specific + global dono
    // saath), aur JOIN se wahi recipient DO baar aa jata — matlab EK hi
    // insaan ko galti se do baar mail chali jaati.
    const batch = await many(
      `SELECT r.id, r.email, r.name, r.merge_data, r.variant_id
         FROM campaign_recipients r
        WHERE r.campaign_id = $1
          AND r.status = 'Pending'
          AND NOT EXISTS (
                SELECT 1 FROM suppression s
                 WHERE lower(s.email) = lower(r.email) AND s.account_id IN ($3, '')
              )
        ORDER BY r.id
        LIMIT $2`,
      [campaign.id, take, campaign.account_id]
    );

    if (batch.length === 0) {
      // Automatic retry — Settings > Sending ka "Retry failed emails once".
      // Sirf EK baar, sirf 'Failed' par (kabhi 'Bounced' par nahi — wo hard
      // bounce maana jata hai, dobara koshish karne se koi fayda nahi).
      if (!campaign.auto_retried) {
        const sending = await workspaceSetting('sending', {});
        if (sending.retryOnce) {
          const failedCount = await one(
            `SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1 AND status = 'Failed'`,
            [campaign.id]
          );
          if ((failedCount?.n ?? 0) > 0) {
            // Turant flag lagate hain — chahe aage kuch bhi ho, dobara kabhi
            // is campaign ke liye automatic retry na chale.
            await query(`UPDATE campaigns SET auto_retried = true, updated_at = now() WHERE id = $1`, [campaign.id]);
            campaign.auto_retried = true;
            console.log(
              `[sender] ${campaign.id}: ${failedCount.n} fail hue the — ${env.retryDelayMinutes} minute baad ek baar dobara koshish`
            );
            if (env.retryDelayMinutes > 0) await sleep(env.retryDelayMinutes * 60 * 1000);

            // Itni der me kisi ne Pause ya Delete kiya ho sakta hai.
            const stillSending = await one('SELECT status FROM campaigns WHERE id = $1', [campaign.id]);
            if (!stillSending || !ACTIVE_SEND_STATUSES.includes(stillSending.status)) {
              running.delete(campaign.id);
              return;
            }

            await query(
              `UPDATE campaign_recipients SET status = 'Pending', error = NULL, sent_at = NULL
                WHERE campaign_id = $1 AND status = 'Failed'`,
              [campaign.id]
            );
            continue;
          }
        }
      }

      if (campaign.ab_enabled && campaign.status === 'Testing') {
        // Test-sample poora bhej diya — ab bas result timer khatam hone
        // (ya insaan khud winner chuने) ka intezaar hai. "Reserve" wale
        // recipients abhi bhi status='Reserved' par hain, isliye yeh upar
        // wala WHERE status='Pending' unhe kabhi chhoo hi nahi sakta —
        // campaign 'Testing' me hi ruki rehti hai, 'Sent' kabhi nahi banti.
        running.delete(campaign.id);
        console.log(`[sender] ${campaign.id}: A/B test-sample bhej di gayi, result ka intezaar hai`);
        return;
      }

      // Normal campaign hamesha 'Sent' par khatam hoti hai (jaisa pehle se
      // hota tha). A/B campaign ka winner-blast phase ('Sending Winner')
      // apna alag naam paata hai — user ko saaf dikhe ki yeh ek A/B test ka
      // conclusion tha, kisi normal single-variant send ka nahi.
      const finishedStatus = campaign.status === 'Sending Winner' ? 'Completed' : 'Sent';
      await query(
        `UPDATE campaigns SET status = $2, finished_at = now(), updated_at = now() WHERE id = $1`,
        [campaign.id, finishedStatus]
      );
      running.delete(campaign.id);
      console.log(`[sender] ${campaign.id}: poora ho gaya (${finishedStatus})`);
      await notifyCampaignFinished(campaign.id);
      await enqueueWebhookEvent('campaign.finished', { campaignId: campaign.id, campaignName: campaign.name });
      return;
    }

    for (const recipient of batch) {
      if (controller.stop) return;

      // A/B campaign ke recipient ke paas variant ho sakta hai — uske
      // subject/html/sender fields campaign ke apne fields ko OVERRIDE
      // karte hain (jo field variant me khaali/null hai wahi campaign se
      // aati hai). Normal campaign (ab_enabled=false ya variant hi nahi) ke
      // liye `effectiveCampaign === campaign` — bilkul pehle jaisa hi.
      const variant = campaign.ab_enabled && recipient.variant_id ? variants.get(recipient.variant_id) : null;
      const effectiveCampaign = variant
        ? {
            ...campaign,
            subject: variant.subject ?? campaign.subject,
            html: variant.html ?? campaign.html,
            sender_name: variant.sender_name ?? campaign.sender_name,
            reply_to: variant.reply_to ?? campaign.reply_to,
          }
        : campaign;

      const message = buildEmail({ campaign: effectiveCampaign, recipient, links, company, unsubscribeText });

      try {
        const result = await sendMail(account, {
          to: recipient.email,
          fromName: effectiveCampaign.sender_name,
          replyTo: effectiveCampaign.reply_to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        });

        await query(
          `UPDATE campaign_recipients
              SET status = 'Sent', sent_at = now(), error = NULL,
                  send_count = send_count + 1, last_attempted_at = now()
            WHERE id = $1`,
          [recipient.id]
        );
        await query(
          'UPDATE email_accounts SET sent_today = sent_today + 1, quota_date = current_date WHERE id = $1',
          [account.id]
        );

        if (result.previewUrl) console.log(`[sender] preview: ${result.previewUrl}`);

        await enqueueWebhookEvent('email.sent', {
          campaignId: campaign.id,
          campaignName: campaign.name,
          recipientId: recipient.id,
          email: recipient.email,
          name: recipient.name,
        });
      } catch (error) {
        // Ek address fail hone se poori campaign nahi rukni chahiye.
        const message = String(error?.message || error).slice(0, 300);
        const hardBounce = isHardBounce(error);

        await query(
          `UPDATE campaign_recipients
              SET status = $3, error = $2,
                  send_count = send_count + 1, last_attempted_at = now()
            WHERE id = $1`,
          [recipient.id, message, hardBounce ? 'Bounced' : 'Failed']
        );

        if (hardBounce) {
          // Permanent rejection — dobara koshish se koi fayda nahi, isliye
          // suppression list me daal dete hain taaki is account se ise ab
          // kabhi na bheja jaaye (track.js ke unsubscribe() jaisa hi pattern).
          await query(
            `INSERT INTO suppression (account_id, email, reason, detail) VALUES ($1,$2,'bounced',$3)
             ON CONFLICT (account_id, email) DO NOTHING`,
            [campaign.account_id ?? '', recipient.email, message]
          );
          await query(
            `UPDATE contacts SET status = 'Bounced', updated_at = now() WHERE lower(email) = lower($1)`,
            [recipient.email]
          );
        }

        console.error(`[sender] ${recipient.email} ${hardBounce ? 'bounced' : 'fail'}:`, error?.message || error);

        await enqueueWebhookEvent(hardBounce ? 'email.bounced' : 'email.failed', {
          campaignId: campaign.id,
          campaignName: campaign.name,
          recipientId: recipient.id,
          email: recipient.email,
          name: recipient.name,
          reason: message,
        });
      }
    }

    // Sab bhej diya to aur intezaar mat karo. Is account ke liye suppressed
    // rows ko yahan bhi chhod dete hain — warna wo hamesha 'Pending' hi
    // rehti hain (kabhi bheji hi nahi jatin, upar wali batch-query bhi unhe
    // kabhi nahi uthati), aur sirf unki wajah se campaign poori tarah bhej
    // chuke hone par bhi ek poora batch-delay ruk jati — bina kisi fayde ke.
    const left = await one(
      `SELECT count(*)::int AS n
         FROM campaign_recipients r
        WHERE r.campaign_id = $1 AND r.status = 'Pending'
          AND NOT EXISTS (
                SELECT 1 FROM suppression s
                 WHERE lower(s.email) = lower(r.email) AND s.account_id IN ($2, '')
              )`,
      [campaign.id, campaign.account_id]
    );
    if ((left?.n ?? 0) === 0) continue;

    if (delayMs > 0) await sleep(delayMs);
  }
}

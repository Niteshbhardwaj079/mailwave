// ---------------------------------------------------------------------------
// A/B testing — variant assignment, live per-variant stats, aur winner
// nikaalne ka poora ganit (statistical significance ke saath).
//
// Jaan-boojh kar services/sender.js ka replacement NAHI hai — wahi engine
// dono (test-sample bhejna, phir winner blast) chalata hai. Yeh file sirf
// teen kaam karti hai: (1) kisko konsa variant mila yeh EK baar, random,
// fixed taur par tay karna, (2) live numbers ginna, (3) un numbers se
// "kya sach me koi jeeta?" ka faisla — sirf 1-2 zyada opens ki wajah se
// galat winner na chun liya jaaye, isliye har faisla ek confidence % ke
// saath aata hai (two-proportion z-test — koi bhi external stats library
// istemal nahi ki, poora hisaab yahin chhota sa likha hua hai).
// ---------------------------------------------------------------------------
import { many, one, query } from '../db/client.js';
import { startCampaign } from './sender.js';

/** Kisi bhi variant ka faisla lene se pehle itne "bheje gaye" chahiye — warna 2-4 logon ke random farq ko "winner" maan lena galat hoga. */
const MIN_SAMPLE_PER_VARIANT = 20;

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Standard normal CDF — Abramowitz & Stegun ka jaana-mana approximation
 * (error < 7.5e-8). Node me koi built-in stats function nahi hai, aur ek
 * poori library laana ek chhote se z-test ke liye zyada hai.
 */
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2); // 1/sqrt(2*pi)
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const tail = d * poly;
  return z >= 0 ? 1 - tail : tail;
}

/**
 * Do proportions (jaise do variants ki open rate) ke beech two-proportion
 * z-test. `confidence` 0-100 me — jitni zyada, utna kam chance hai ki
 * dikhne wala farq sirf random uतार-chadhaav se aaya ho.
 */
export function twoProportionSignificance(successesA, trialsA, successesB, trialsB) {
  if (!trialsA || !trialsB) return { z: 0, confidence: 0 };
  const pooled = (successesA + successesB) / (trialsA + trialsB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / trialsA + 1 / trialsB));
  if (!se) return { z: 0, confidence: 0 };
  const z = (successesA / trialsA - successesB / trialsB) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z))); // two-tailed
  return { z, confidence: Math.max(0, Math.min(100, (1 - pValue) * 100)) };
}

/**
 * Ek variant ke asli, live numbers — kabhi kahin save nahi hote, hamesha
 * seedhe campaign_recipients se taaza gine jate hain (poore app ka established
 * pattern — koi bhi number jo khud dobara gina ja sake, wahi bharosemand hai).
 *
 * "Delivered" jaan-boojh kar "Sent" ke barabar hai, usse kam nahi — plain
 * SMTP (koi ESP webhook nahi) me "bheja gaya" (250 OK) se aage "inbox tak
 * pahuncha" ka koi asli signal available nahi hai (isi session me pehle bhi
 * yahi paya gaya tha). Yahan ek chhota, jhootha "Delivered < Sent" number
 * dikhana galat hoga — isliye dono ek hi cheez ko naam dete hain.
 *
 * "Spam complaints" bhi isi wajah se `null` — koi provider webhook nahi hai
 * jo yeh bata sake, isliye 0 dikhana bhi utna hi galat hoga jitna koi bada
 * number. UI ise "N/A" ki tarah dikhaye, kabhi "0" ki tarah nahi.
 */
export async function variantStats(variantId) {
  const row = await one(
    `SELECT
        count(*) FILTER (WHERE status = 'Sent')::int AS sent,
        count(*) FILTER (WHERE status = 'Bounced')::int AS bounced,
        count(*) FILTER (WHERE status = 'Sent' AND open_count > 0)::int AS unique_opens,
        count(*) FILTER (WHERE status = 'Sent' AND click_count > 0)::int AS unique_clicks,
        coalesce(sum(open_count), 0)::int AS total_opens,
        coalesce(sum(click_count), 0)::int AS total_clicks,
        count(*) FILTER (WHERE unsubscribed)::int AS unsubscribes
       FROM campaign_recipients
      WHERE variant_id = $1`,
    [variantId]
  );

  const sent = row?.sent ?? 0;
  const uniqueOpens = row?.unique_opens ?? 0;
  const uniqueClicks = row?.unique_clicks ?? 0;

  return {
    sent,
    delivered: sent,
    bounced: row?.bounced ?? 0,
    opens: row?.total_opens ?? 0,
    uniqueOpens,
    openRate: sent > 0 ? uniqueOpens / sent : 0,
    clicks: row?.total_clicks ?? 0,
    uniqueClicks,
    clickRate: sent > 0 ? uniqueClicks / sent : 0,
    ctor: uniqueOpens > 0 ? uniqueClicks / uniqueOpens : 0,
    unsubscribes: row?.unsubscribes ?? 0,
    spamComplaints: null,
  };
}

/** Campaign ke saare variants, har ek ke live stats ke saath — analytics dashboard aur winner-calc dono isi ek function se guzarte hain. */
export async function variantsWithStats(campaignId) {
  const variants = await many(
    'SELECT * FROM campaign_variants WHERE campaign_id = $1 ORDER BY sort_order, created_at',
    [campaignId]
  );
  const withStats = [];
  for (const variant of variants) {
    withStats.push({ ...variant, stats: await variantStats(variant.id) });
  }
  return withStats;
}

function metricFor(stats, metric) {
  if (metric === 'click_rate') return { successes: stats.uniqueClicks, trials: stats.sent };
  if (metric === 'ctor') return { successes: stats.uniqueClicks, trials: stats.uniqueOpens };
  return { successes: stats.uniqueOpens, trials: stats.sent }; // open_rate — default
}

/**
 * Test-phase ke recipients ko RANDOM, FIXED taur par variants me baantta
 * hai. Sirf ek baar chalta hai — "Keep recipient assignment fixed after
 * test starts" (startTest() neeche isse double-call se bachata hai).
 * Baaki (test-percent se bachi hui) recipients 'Reserved' par ruk jaate
 * hain — services/sender.js ka WHERE status='Pending' unhe khud hi chhod
 * deta hai, koi alag "skip" logic kahin nahi likhni padi.
 */
export async function assignTestAudience(campaignId) {
  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  const variants = await many(
    'SELECT id FROM campaign_variants WHERE campaign_id = $1 ORDER BY sort_order, created_at',
    [campaignId]
  );
  if (variants.length < 2) {
    const error = new Error('At least 2 variants are needed to start an A/B test');
    error.code = 'ab_needs_2_variants';
    throw error;
  }

  const recipientRows = await many(
    `SELECT id FROM campaign_recipients WHERE campaign_id = $1 AND status = 'Pending'`,
    [campaignId]
  );
  if (recipientRows.length === 0) {
    const error = new Error('This campaign has no recipients yet');
    error.code = 'ab_no_recipients';
    throw error;
  }

  const ids = shuffleInPlace(recipientRows.map((r) => r.id));
  const percent = Math.min(100, Math.max(1, campaign.ab_test_percent ?? 20));
  // Kam se kam har variant ko ek recipient — warna 2% jaisa chhota test
  // percent, bahut chhoti list par, kisi variant ko khaali chhod sakta hai.
  const testCount = Math.min(ids.length, Math.max(variants.length, Math.round((ids.length * percent) / 100)));

  const testIds = ids.slice(0, testCount);
  const reserveIds = ids.slice(testCount);

  const perVariant = variants.map(() => []);
  testIds.forEach((id, index) => perVariant[index % variants.length].push(id));

  for (let i = 0; i < variants.length; i++) {
    if (perVariant[i].length === 0) continue;
    await query('UPDATE campaign_recipients SET variant_id = $1 WHERE id = ANY($2)', [variants[i].id, perVariant[i]]);
  }
  if (reserveIds.length > 0) {
    await query(`UPDATE campaign_recipients SET status = 'Reserved' WHERE id = ANY($1)`, [reserveIds]);
  }

  return { testCount: testIds.length, reserveCount: reserveIds.length, total: ids.length };
}

/**
 * Winner nikaalne ki koshish — DECIDE nahi karta, sirf "ab tak ke numbers
 * se kya kehna chahiye" bata deta hai. `decideWinner()` isi ke result se
 * asli faisla likhta hai (auto) ya insaan ke chune hue ko sidha maanta hai
 * (manual, iska istemal hi nahi hota).
 */
export async function computeWinner(campaignId) {
  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  const variants = await variantsWithStats(campaignId);

  const tooSmall = variants.some((v) => v.stats.sent < MIN_SAMPLE_PER_VARIANT);
  if (tooSmall) return { decided: false, reason: 'insufficient_sample', variants };

  const ranked = variants
    .map((v) => {
      const { successes, trials } = metricFor(v.stats, campaign.ab_winner_metric);
      return { variant: v, successes, trials, rate: trials > 0 ? successes / trials : 0 };
    })
    .sort((a, b) => b.rate - a.rate);

  const [top, second] = ranked;
  if (!second || top.trials === 0) {
    return { decided: false, reason: 'insufficient_sample', variants };
  }

  const { confidence } = twoProportionSignificance(top.successes, top.trials, second.successes, second.trials);
  if (confidence < (campaign.ab_confidence_threshold ?? 95)) {
    return { decided: false, reason: 'not_significant', confidence, variants };
  }

  return {
    decided: true,
    winnerVariantId: top.variant.id,
    confidence,
    metric: campaign.ab_winner_metric,
    topRate: top.rate,
    secondRate: second.rate,
    variants,
  };
}

/**
 * A/B test shuru karta hai — Draft/Scheduled se pehli baar, ya Paused se
 * resume. Assignment sirf tab hoti hai jab `ab_test_started_at` abhi khaali
 * hai, aur wo bhi ek atomic claim ke peeche — do overlapping requests kabhi
 * dono assignment na kar den.
 */
export async function startTest(campaignId) {
  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!campaign) return { started: false, reason: 'not_found' };
  if (!campaign.ab_enabled) return { started: false, reason: 'ab_not_enabled' };
  if (campaign.ab_winner_variant_id) return { started: false, reason: 'already_decided' };

  if (!campaign.ab_test_started_at) {
    if (!['Draft', 'Scheduled'].includes(campaign.status)) {
      return { started: false, reason: 'invalid_status' };
    }

    const endsAt = new Date(Date.now() + (campaign.ab_test_duration_minutes ?? 240) * 60 * 1000);
    const claimed = await one(
      `UPDATE campaigns SET ab_test_started_at = now(), ab_test_ends_at = $2, updated_at = now()
        WHERE id = $1 AND ab_test_started_at IS NULL
        RETURNING id`,
      [campaignId, endsAt]
    );

    // claimed === null: koi doosri request pehle hi jeet chuki — us request
    // ne assignment kar diya hoga, yahan dobara mat karo.
    if (claimed) {
      try {
        await assignTestAudience(campaignId);
      } catch (error) {
        // Assignment fail hui (jaise <2 variants) — jo timer set kiya tha
        // use wapas khaali karte hain, taaki dobara koshish sahi se ho sake.
        await query(
          `UPDATE campaigns SET ab_test_started_at = NULL, ab_test_ends_at = NULL, updated_at = now() WHERE id = $1`,
          [campaignId]
        );
        throw error;
      }
    }
  }

  return startCampaign(campaignId, { targetStatus: 'Testing' });
}

/**
 * Winner tay karta hai — `chosenVariantId` diya ho to manual (insaan ne
 * chuna), na diya ho to automatic (metric + confidence se). Atomic claim
 * (`status='Testing' AND ab_winner_variant_id IS NULL`) ki wajah se yeh
 * kabhi ek campaign ke liye do baar successfully nahi chalega, chahe kitni
 * baar retry ho.
 */
export async function decideWinner(campaignId, { chosenVariantId = null, decidedBy = null } = {}) {
  const claimed = await one(
    `UPDATE campaigns SET status = 'Winner Selected', updated_at = now()
      WHERE id = $1 AND status = 'Testing' AND ab_winner_variant_id IS NULL
      RETURNING id`,
    [campaignId]
  );
  if (!claimed) return { decided: false, reason: 'not_ready' };

  let winnerVariantId = chosenVariantId;
  let confidence = null;
  let metric = null;
  let topRate = null;
  let secondRate = null;

  if (!winnerVariantId) {
    const result = await computeWinner(campaignId);
    if (!result.decided) {
      // Wapas 'Testing' me — insaan khud manual se chun sake, permanently
      // atka na rahe.
      await query(`UPDATE campaigns SET status = 'Testing', updated_at = now() WHERE id = $1`, [campaignId]);
      return { decided: false, reason: result.reason, confidence: result.confidence ?? null };
    }
    ({ winnerVariantId, confidence, metric, topRate, secondRate } = result);
  }

  const winnerVariant = await one('SELECT label FROM campaign_variants WHERE id = $1', [winnerVariantId]);

  // Wajah — activity_log.detail_key/detail_params jaisa hi pattern: asli
  // text nahi, key + params. Winner card dekhne wala HAR admin ise apni
  // language me padhega (routes/campaigns.js GET wale route me translate
  // hoti hai), kisi ek fixed bhasha me freeze nahi hoti. Metric ke liye
  // TEEN alag keys hain (ek param ki jagah) — taaki "open rate"/"click
  // rate"/"click-to-open rate" bhi poori tarah translate ho sake, sirf ek
  // untranslated code-word (jaise "open_rate") param me na dikhe.
  const AUTO_REASON_KEY = {
    open_rate: 'act.abWinnerAutoOpenRate',
    click_rate: 'act.abWinnerAutoClickRate',
    ctor: 'act.abWinnerAutoCtor',
  };
  const reasonKey = decidedBy ? 'act.abWinnerManual' : AUTO_REASON_KEY[metric] ?? AUTO_REASON_KEY.open_rate;
  const reasonParams = decidedBy
    ? { variant: winnerVariant?.label ?? '?' }
    : { variant: winnerVariant?.label ?? '?', confidence: Math.round(confidence ?? 0) };

  await query('UPDATE campaign_variants SET is_winner = true WHERE id = $1', [winnerVariantId]);
  await query(
    `UPDATE campaigns
        SET ab_winner_variant_id = $2, ab_winner_decided_at = now(), ab_winner_decided_by = $3,
            ab_winner_reason_key = $4, ab_winner_reason_params = $5, updated_at = now()
      WHERE id = $1`,
    [campaignId, winnerVariantId, decidedBy, reasonKey, JSON.stringify(reasonParams)]
  );

  return {
    decided: true,
    winnerVariantId,
    manual: Boolean(decidedBy),
    confidence,
    metric,
    topRate,
    secondRate,
  };
}

/**
 * "Reserved" recipients ko jeetne wale variant par bhej deta hai. Recipient
 * flip (Reserved -> Pending + variant_id) sirf tab hoti hai jab YEH hi call
 * status ko 'Winner Selected' se 'Sending Winner' me le jaati hai — agle
 * kisi bhi retry/resume call ko status pehle se badla hua milega, isliye
 * flip dobara kabhi nahi hoti (spec: "Do not start winner send twice").
 */
export async function sendWinnerToRemainder(campaignId) {
  const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!campaign) return { started: false, reason: 'not_found' };
  if (!campaign.ab_winner_variant_id) return { started: false, reason: 'no_winner' };

  const claimed = await one(
    `UPDATE campaigns SET status = 'Sending Winner', updated_at = now()
      WHERE id = $1 AND status = 'Winner Selected'
      RETURNING id`,
    [campaignId]
  );

  if (claimed) {
    await query(
      `UPDATE campaign_recipients SET variant_id = $2, status = 'Pending'
        WHERE campaign_id = $1 AND status = 'Reserved'`,
      [campaignId, campaign.ab_winner_variant_id]
    );
  } else {
    const current = await one('SELECT status FROM campaigns WHERE id = $1', [campaignId]);
    if (current?.status !== 'Sending Winner') return { started: false, reason: 'not_ready' };
    // Pehle se 'Sending Winner' hai (retry/resume) — flip pehle ho chuki
    // hogi, seedha sending loop hi (dobara) shuru karte hain.
  }

  return startCampaign(campaignId, { targetStatus: 'Sending Winner', reclaim: true });
}

// ---------------------------------------------------------------------------
// Schedule ki hui campaigns ko sahi waqt par chalu karta hai.
//
// Kaam bahut simple hai: har minute database se poochho "koi aisi campaign hai
// jiska time aa gaya?" — aur jo mile use chalu kar do.
//
// Har minute kyun, har second kyun nahi?
// -------------------------------------
// Email bhejne me waise bhi minute lagte hain, isliye ek minute ki der se koi
// farq nahi padta. Aur har second database se poochna bekaar ka bojh hai.
//
// Server band tha to kya hoga?
// ----------------------------
// Kuch nahi bigadta. Campaign 'Scheduled' hi padi rehti hai, aur server wapas
// chalu hote hi uska time "nikal chuka" mil jata hai — to wo turant chalu ho
// jati hai. Isliye bijli jaane par campaign gum nahi hoti, bas thodi der se
// jati hai.
// ---------------------------------------------------------------------------
import { many, query } from '../db/client.js';
import { env } from '../env.js';
import { recoverStuckCampaigns, startCampaign } from './sender.js';
import { decideWinner, sendWinnerToRemainder } from './abTesting.js';

/** Har kitni der me dekhna hai. */
const EVERY_MS = 60 * 1000;

let timer = null;

/**
 * Jin campaigns ka time aa chuka hai, unhe chalu karta hai.
 *
 * Exported isliye hai ki test ise seedha bula sake — 60 second ka intezaar
 * kiye bina.
 */
export async function runDueCampaigns() {
  let due = [];

  try {
    due = await many(
      `SELECT id, name FROM campaigns
        WHERE status = 'Scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= now()
        ORDER BY scheduled_at`
    );
  } catch (error) {
    // Database ek pal ke liye jawab na de to poora server nahi girana. Agli
    // baar dobara koshish ho jayegi.
    console.error('[scheduler] Scheduled campaigns padhi nahi ja saki:', error.message);
    return [];
  }

  const started = [];

  for (const campaign of due) {
    const result = await startCampaign(campaign.id, { company: env.brand.company });

    if (result.started) {
      console.log(`[scheduler] "${campaign.name}" ka time aa gaya — bhejna shuru.`);
      started.push(campaign.id);
      continue;
    }

    // Chal hi rahi hai to koi baat nahi, chhod do.
    if (result.reason === 'already_running') continue;

    // Asli dikkat: account hat gaya, ya campaign hi nahi mila. Ise 'Scheduled'
    // me chhodna sabse bura hota — har minute koshish hoti rehti aur kisi ko
    // pata na chalta. Isliye rok kar saaf nishaan laga dete hain.
    console.error(`[scheduler] "${campaign.name}" chalu nahi ho payi (${result.reason}). Draft me daal rahe hain.`);

    await query(
      `UPDATE campaigns SET status = 'Draft', scheduled_at = NULL, updated_at = now() WHERE id = $1`,
      [campaign.id]
    );
  }

  // --- kal ki limit khatam hone se ruki hui campaigns ---------------------
  //
  // Insaan ne khud "Pause" nahi dabaya tha — aaj ki bhejne ki limit khatam ho
  // gayi thi. Aisi campaign ko yahan dobara try karte hain; agar quota sach
  // me abhi bhi khatam hai (raat abhi nahi badli) to startCampaign khud hi
  // usko turant wapas 'quota' pause me daal dega — koi nuksaan nahi.
  //
  // Jo campaign insaan ne khud roki thi (pause_reason = 'manual'), use haath
  // nahi lagate — wo jab tak khud "Resume" na dabaye, ruki hi rahegi.
  let quotaPaused = [];
  try {
    quotaPaused = await many(
      `SELECT id, name, resume_target_status FROM campaigns WHERE status = 'Paused' AND pause_reason = 'quota'`
    );
  } catch (error) {
    console.error('[scheduler] Quota se ruki campaigns padhi nahi ja saki:', error.message);
    return started;
  }

  for (const campaign of quotaPaused) {
    // A/B campaign ke liye resume_target_status 'Testing'/'Sending Winner'
    // ho sakta hai — na diya ho (purani, normal campaign) to 'Sending' hi.
    const targetStatus = campaign.resume_target_status || 'Sending';
    const result = await startCampaign(campaign.id, { company: env.brand.company, targetStatus });
    if (result.started) {
      console.log(`[scheduler] "${campaign.name}" — aaj ki limit dobara mil gayi, wapas bhejna shuru.`);
      started.push(campaign.id);
    }
  }

  // --- A/B test ka time khatam ---------------------------------------------
  //
  // Test-sample ko kab ka bheja ja chuka hai (services/sender.js khud rok
  // deta hai jab sab bhej diya) — yahan sirf "duration timer khatam hua kya"
  // dekhte hain. Khatam ho gaya aur automatic winner chalu hai to faisla
  // (aur, ab_auto_send_winner chalu ho to bhejna) yahin se shuru hota hai.
  let dueTests = [];
  try {
    dueTests = await many(
      `SELECT id, name, ab_auto_send_winner FROM campaigns
        WHERE status = 'Testing' AND ab_enabled = true AND ab_auto_winner = true
          AND ab_winner_variant_id IS NULL
          AND ab_test_ends_at IS NOT NULL AND ab_test_ends_at <= now()`
    );
  } catch (error) {
    console.error('[scheduler] A/B test-khatam wali campaigns padhi nahi ja saki:', error.message);
    return started;
  }

  for (const campaign of dueTests) {
    try {
      const decision = await decideWinner(campaign.id);
      if (!decision.decided) {
        // Insufficient sample / not significant — insaan khud manual se
        // chunega, campaign 'Testing' me hi rukti hai (decideWinner() ne
        // khud wapas daal diya). Yahan sirf log kar dete hain.
        console.log(`[scheduler] "${campaign.name}" — A/B test ka time khatam, par auto-winner nahi mila (${decision.reason}). Manual selection ka intezaar.`);
        continue;
      }

      console.log(`[scheduler] "${campaign.name}" — A/B test ka time khatam, winner auto-decide hua.`);

      if (campaign.ab_auto_send_winner) {
        const sendResult = await sendWinnerToRemainder(campaign.id);
        if (sendResult.started) {
          console.log(`[scheduler] "${campaign.name}" — winner baaki sabko bheja ja raha hai.`);
        }
      }
    } catch (error) {
      console.error(`[scheduler] "${campaign.name}" ka A/B winner decide nahi ho paya:`, error.message);
    }
  }

  return started;
}

/** Server chalu hote hi shuru ho jata hai. */
export function startScheduler() {
  if (timer) return;

  console.log('[scheduler] Schedule ki hui campaigns har minute dekhi jayengi.');

  // Server crash/restart/deploy hote waqt agar koi campaign 'Sending' beech
  // me chhoot gayi thi, use yahin khud-ba-khud dobara chalu karte hain —
  // client ko "Resume" dabana na pade. Sirf EK baar, isi startup par (dekho
  // recoverStuckCampaigns() ka comment — baar-baar chalana galat hoga).
  recoverStuckCampaigns().catch((error) =>
    console.error('[scheduler] Atki hui campaigns dobara chalu nahi ho sakin:', error.message)
  );

  // Pehli baar turant — server band rehne ke dauraan jo time nikal gaya, wo
  // wahin ka wahin chalu ho jaye.
  runDueCampaigns();

  timer = setInterval(runDueCampaigns, EVERY_MS);

  // Yeh timer server ko band hone se na roke.
  timer.unref?.();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

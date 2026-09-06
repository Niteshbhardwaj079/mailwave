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
import { startCampaign } from './sender.js';

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
      `SELECT id, name FROM campaigns WHERE status = 'Paused' AND pause_reason = 'quota'`
    );
  } catch (error) {
    console.error('[scheduler] Quota se ruki campaigns padhi nahi ja saki:', error.message);
    return started;
  }

  for (const campaign of quotaPaused) {
    const result = await startCampaign(campaign.id, { company: env.brand.company });
    if (result.started) {
      console.log(`[scheduler] "${campaign.name}" — aaj ki limit dobara mil gayi, wapas bhejna shuru.`);
      started.push(campaign.id);
    }
  }

  return started;
}

/** Server chalu hote hi shuru ho jata hai. */
export function startScheduler() {
  if (timer) return;

  console.log('[scheduler] Schedule ki hui campaigns har minute dekhi jayengi.');

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

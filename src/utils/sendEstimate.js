// ---------------------------------------------------------------------------
// Campaign send-time estimate — kitni der lagegi agar itne recipients, is
// batch size/delay, aur (pata ho to) is account ki daily limit se bheja jaaye.
//
// Batch size 0 = "send all at once" — ek hi list, delay is case me matter
// nahi karta (koi batch boundary hi nahi hoti).
//
// `dailyLimit` na diya (account abhi pata nahi, jaise Settings page par jahan
// koi specific campaign/account nahi hota) to sirf simple batch*delay wala
// andaza deta hai — ek hi din assume karte hain.
//
// `dailyLimit` diya to asli quota-pause wali reality bhi jodte hain: jab us
// din ki limit khatam ho jaati hai, agle CALENDAR din tak ruk jaata hai —
// bilkul jaisa server/src/services/sender.js ka run() khud karta hai (isi
// wajah se yeh function kabhi ek fixed "500/day" assume nahi karta, hamesha
// jo bhi dailyLimit/sentToday diya jaaye wahi, fresh, use karta hai).
// ---------------------------------------------------------------------------

/**
 * Lautata hai: { totalBatches, totalDays, totalMinutes, quotaLimited } ya
 * `recipientCount` khaali/0 ho to `null`.
 *
 * `totalMinutes` = sirf batches ke BEECH ka wait time (active sending time
 * khud usually seconds ka hota hai, isliye ignore karte hain — yeh estimate
 * "kab tak wait karna padega" batata hai, stopwatch-level precision nahi).
 */
export function estimateSendTime({ recipientCount, batchSize, batchDelayMinutes, dailyLimit, sentToday = 0 }) {
  if (!recipientCount || recipientCount <= 0) return null;

  const perBatch = batchSize > 0 ? batchSize : recipientCount;
  const totalBatches = Math.ceil(recipientCount / perBatch);
  const delay = Math.max(0, batchDelayMinutes || 0);

  if (!dailyLimit || dailyLimit <= 0) {
    return { totalBatches, totalDays: 1, totalMinutes: (totalBatches - 1) * delay, quotaLimited: false };
  }

  // sentToday >= dailyLimit ho sakta hai (limit abhi-abhi ghati ho, ya edit
  // hui ho) — Math.max(0, ...) isse kabhi negative "remainingToday" nahi
  // banne deta; us case me aaj 0 hi jaate hain, kal se poori limit milti hai.
  const remainingToday = Math.max(0, dailyLimit - sentToday);

  let remaining = recipientCount;
  let day = 0;
  let totalMinutes = 0;
  // 3650 = 10 saal ka safety cap — kabhi infinite loop na ho (dailyLimit
  // kabhi bhi 0 se bada hi hota hai is branch me, isliye normally yeh
  // zaroorat nahi padta, par ek buggy input bhi kabhi hang na kare).
  while (remaining > 0 && day < 3650) {
    const capToday = day === 0 ? remainingToday : dailyLimit;
    const sendToday = Math.min(remaining, capToday);
    if (sendToday > 0) {
      totalMinutes += (Math.ceil(sendToday / perBatch) - 1) * delay;
    }
    remaining -= sendToday;
    day += 1;
  }

  return { totalBatches, totalDays: day, totalMinutes, quotaLimited: day > 1 };
}

/** "45 minutes" / "2 hr 15 min" / "3 min" — chhota, readable, plural-safe (abbreviated units se singular/plural ka jhanjhat nahi). */
export function formatDuration(t, totalMinutes) {
  if (totalMinutes < 1) return t('send.estimateUnderMinute');
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return t('send.estimateMinutes', { minutes });
  if (minutes === 0) return t('send.estimateHours', { hours });
  return t('send.estimateHoursMinutes', { hours, minutes });
}

/**
 * `estimateSendTime()` ka result leke, screen par dikhane wali ek line
 * banata hai. `accountLabel` sirf quota-limited case me use hota hai (kis
 * account ki limit ki wajah se multi-day laga, wahi naam batane ke liye).
 */
export function formatEstimate(t, result, { accountLabel, dailyLimit } = {}) {
  if (!result) return '';
  const duration = formatDuration(t, result.totalMinutes);
  if (!result.quotaLimited) {
    return t('send.estimateSameDay', { duration, batches: result.totalBatches });
  }
  return t('send.estimateQuotaLimited', {
    days: result.totalDays,
    account: accountLabel || '',
    limit: dailyLimit ?? '',
    duration,
  });
}

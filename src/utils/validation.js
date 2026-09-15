// Chhoti si email shakal jaanch — sirf "kuch@kuch.kuch" jaisa dikhta hai ya
// nahi. Poori RFC jaanch server hi karta hai; yahan bas turant feedback dena
// hai taaki user ko network round-trip ka intezaar na karna pade.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

/**
 * ContactFilterFields ke "Limit to" field (text input) ko backend ke liye
 * number|undefined banata hai — khaali/0/galat kuch bhi ho to "koi limit
 * nahi" (poori list). Wizard aur "Add more recipients" dono submit-points
 * isi ek function se guzarte hain, taaki jo dikh raha hai wahi asal me
 * bheja jaaye.
 */
export function parseContactFilterLimit(rawLimit) {
  const parsed = Number(rawLimit);
  return rawLimit !== '' && rawLimit != null && Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : undefined;
}

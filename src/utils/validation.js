// Chhoti si email shakal jaanch — sirf "kuch@kuch.kuch" jaisa dikhta hai ya
// nahi. Poori RFC jaanch server hi karta hai; yahan bas turant feedback dena
// hai taaki user ko network round-trip ka intezaar na karna pade.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

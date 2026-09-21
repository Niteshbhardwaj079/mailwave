// ---------------------------------------------------------------------------
// "Is server ki apni files" ke URL ko hamesha CHALU domain par rakhna.
//
// Template ka HTML / design-schema image ka poora URL text me store karta
// hai, jaise `https://api.purana.com/files/img/img_ab12`. Agar poora database
// (backup restore) kisi doosre client ke subdomain par chala jaye, to wo
// text purana ka purana rehta — images purane server se load hoti, aur us
// server ke band hote hi tut jaati.
//
// Isliye jab bhi template/campaign HTML bahar jata hai (API response ya
// email ban kar), yahan se guzarte hain: sirf HOST badal kar chalu
// `PUBLIC_URL` kar dete hain. Database me kuch nahi badalta, kisi script ya
// migration ki zarurat nahi — backup restore karo, PUBLIC_URL set karo, bas.
//
// Sirf wahi URL badalte hain jinka path is server ka apna hai
// (`/files/img/...` = uploaded images, `/template-placeholders/...` = default
// templates ki tasveerein). Kisi doosri website ki image ko haath nahi lagate.
// ---------------------------------------------------------------------------
import { env } from '../env.js';

const OWN_ORIGIN = /https?:\/\/[^\s"'()<>\\/]+(?=\/(?:files\/img|template-placeholders)\/)/g;

/** Ek string me purane domain wale apne-server URL chalu domain se badalta hai. */
export function rehostUrls(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(OWN_ORIGIN, env.publicUrl);
}

/** Wahi kaam poore object/array ke andar har string par (design-schema ke liye). */
export function rehostDeep(value) {
  if (typeof value === 'string') return rehostUrls(value);
  if (Array.isArray(value)) return value.map(rehostDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rehostDeep(item)]));
  }
  return value;
}

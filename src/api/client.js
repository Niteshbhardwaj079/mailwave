// ---------------------------------------------------------------------------
// Backend se baat karne wali EK jagah.
//
// Har page yahin se guzarta hai, isliye ye cheezein ek hi baar likhni padti hain:
//
//   - Token har request me apne aap lag jata hai
//   - Token purana ho jaye to apne aap naya le aata hai (user ko pata bhi nahi chalta)
//   - Error ka message hamesha ek jaisa milta hai
//   - Request beech me rok sakte hain (page badal jaye to purani request bekaar)
//
// Backend ka pata badalna ho to .env me VITE_API_URL likh do.
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * API se aayi hui galti.
 *
 * `message` hamesha aisi bhasha me hota hai jo screen par dikhaya ja sake —
 * server yahi bhejta hai. `details` me field-wise galtiyan hoti hain.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Access token sirf memory me rakhte hain, localStorage me nahi.
// Kyun? localStorage me rakha token koi bhi script padh sakti hai. Memory me
// rakha token page refresh hone par chala jata hai — aur wo theek hai, kyunki
// refresh token (httpOnly cookie) se turant naya mil jata hai.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Ek hi waqt me kai request fail ho sakti hain. Sab milkar ek hi refresh ka
// intezaar karti hain, warna 10 request = 10 refresh call.
let refreshing = null;

/**
 * Naya access token maangta hai — refresh token wali cookie se.
 *
 * YEH FUNCTION HAR JAGAH SE ISTEMAL HONA CHAHIYE. Seedha
 * `/api/auth/refresh` mat call karo.
 *
 * Wajah: har refresh par server purana refresh token radd karke naya deta hai
 * (isse chori hua token kaam nahi aata). Agar do refresh call ek saath chali
 * jayein, to pehli jeet jayegi aur doosri ke paas ab-bekar purana token hoga —
 * server use "chori" samajh kar session hi kaat dega. User bina wajah bahar.
 *
 * Isliye ek hi promise sab me baanta jata hai: chahe 10 request ek saath 401
 * hon ya app khulte hi session check chale, refresh call sirf EK jaati hai.
 */
export function refreshSession() {
  return refreshAccessToken();
}

/**
 * Pichhli refresh koshish me kya hua.
 *
 * Do haalat me farq karna bahut zaroori hai:
 *   401 — session sach me khatam hai. Ab login dikhana sahi hai.
 *   baaki — server vyast hai (429), internet gaya, ya server band hai. Yeh
 *           thodi der ki baat hai; iske liye user ko bahar karna galat hai.
 *
 * Pehle dono ek jaise the, isliye ek chhoti si dikkat par bhi user login
 * screen par pahunch jata tha aur uska kaam beech me chhoot jata.
 */
let lastRefreshStatus = 0;

export function lastRefreshWasExpired() {
  return lastRefreshStatus === 401;
}

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // refresh token cookie me hai
    })
      .then(async (response) => {
        lastRefreshStatus = response.status;
        if (!response.ok) return null;
        const data = await response.json();
        accessToken = data.accessToken ?? null;
        return data;
      })
      .catch(() => {
        // Internet hi nahi pahuncha — yeh "session khatam" nahi hai.
        lastRefreshStatus = 0;
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function toError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    // Server ne JSON nahi bheja (jaise 502 page) — niche generic message.
  }

  const info = payload?.error;
  return new ApiError(
    response.status,
    info?.code || 'error',
    info?.message || `Kuch galat hua (${response.status})`,
    info?.details
  );
}

/**
 * Asli request.
 *
 * @param {string} path    jaise '/api/contacts'
 * @param {object} options fetch wale options + { retry }
 */
export async function request(path, options = {}) {
  const { body, headers, retry = true, ...rest } = options;

  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // 401 = token purana ho gaya. Ek baar naya lekar dobara koshish karte hain.
  // `retry` isliye hai ki agar dobara bhi 401 aaye to loop na bane.
  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed?.accessToken) {
      return request(path, { ...options, retry: false });
    }
  }

  if (!response.ok) throw await toError(response);

  // 204 (No Content) me body hoti hi nahi.
  if (response.status === 204) return null;
  return response.json();
}

/** Chhote raste — har jagah `request` likhne se behtar. */
export const api = {
  get: (path, options) => request(path, { method: 'GET', ...options }),
  post: (path, body, options) => request(path, { method: 'POST', body, ...options }),
  put: (path, body, options) => request(path, { method: 'PUT', body, ...options }),
  patch: (path, body, options) => request(path, { method: 'PATCH', body, ...options }),
  delete: (path, options) => request(path, { method: 'DELETE', ...options }),
};

/**
 * Query string banata hai, khali cheezein chhod kar.
 *
 *   qs({ page: 2, search: '', status: null }) -> '?page=2'
 */
export function qs(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all' || value === 'All') return;
    search.set(key, String(value));
  });

  const text = search.toString();
  return text ? `?${text}` : '';
}

export { BASE as apiBase };

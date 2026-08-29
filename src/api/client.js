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

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // refresh token cookie me hai
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        accessToken = data.accessToken ?? null;
        return data;
      })
      .catch(() => null)
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

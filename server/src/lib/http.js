/**
 * An error the API is willing to describe to the caller. Anything else that
 * escapes a route is a bug and becomes a generic 500 — we never leak stack
 * traces or driver messages to a browser.
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

export const badRequest = (message, details) => new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Sign in to continue') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'Your role cannot do that') => new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);
export const conflict = (message, details) => new ApiError(409, 'conflict', message, details);

/**
 * Express 4 does not catch rejected promises, so every async handler is
 * wrapped. Without this a failed await becomes a silently hanging request.
 */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/**
 * ?page= aur ?limit= padhta hai, surakshit hadd ke andar.
 *
 * maxLimit isliye hai ki koi ?limit=999999 bhej kar poora database ek saath na
 * maang le — usse server ki memory bhar jayegi aur sab ke liye slow ho jayega.
 */
export function pagination(req, { defaultLimit = 50, maxLimit = 500 } = {}) {
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const requested = Number.parseInt(req.query.limit ?? '', 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(requested) ? requested : defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * List wale har jawab ka ek hi shape — taki frontend har jagah ek jaisa code
 * likhe, aur kabhi pata na chale ki "aur bhi data hai" wali baat chhoot gayi.
 */
export function paginated(items, { page, limit }, total) {
  const count = Number(total) || 0;
  return {
    items,
    page,
    limit,
    total: count,
    pages: Math.max(1, Math.ceil(count / limit)),
    hasMore: page * limit < count,
  };
}

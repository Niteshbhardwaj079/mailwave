import { ApiError } from '../lib/http.js';
import { isProduction } from '../env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

// Express identifies an error handler by its four arguments, so `next` stays
// even though it is unused.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  // Anything else is a bug. Log it in full, tell the caller nothing.
  console.error('[error]', req.method, req.originalUrl, error);

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our side',
      ...(isProduction ? {} : { detail: String(error?.message || error) }),
    },
  });
}

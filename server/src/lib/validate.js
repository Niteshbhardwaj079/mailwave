import { badRequest } from './http.js';

/**
 * Validates and REPLACES the request part with the parsed result, so handlers
 * work with coerced, trimmed, known-shaped data instead of raw strings.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      next(badRequest('Some fields need attention', details));
      return;
    }

    // req.query is a getter on newer Express; assigning to a local copy keeps
    // this working on both.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;

    next();
  };
}

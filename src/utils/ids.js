/**
 * One id generator for the whole app.
 *
 * Ids must never be derived from a list's length: the moment something is
 * deleted, the next id collides with one that already exists and React starts
 * reusing the wrong row. crypto.randomUUID() is available in every browser
 * this app supports; the counter below is only a fallback for insecure
 * origins (plain http on a LAN), where crypto.randomUUID is not exposed.
 */
let counter = 0;

export function newId(prefix) {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${(counter += 1).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  return prefix ? `${prefix}_${uuid}` : uuid;
}

export default newId;

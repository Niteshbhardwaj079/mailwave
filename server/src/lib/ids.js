import { randomUUID } from 'node:crypto';

/**
 * Readable, collision-free ids: `cmp_9f2a…` says what it is the moment it
 * turns up in a log line or a URL. Never derive an id from a list length.
 */
export function newId(prefix) {
  const uuid = randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${uuid}` : uuid;
}

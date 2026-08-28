/**
 * Escaping for HTML we build by hand.
 *
 * The template editor writes real markup that later goes out as an email, so a
 * file called `my "best" photo.png` must not be able to close an attribute and
 * change the tag around it.
 */
const ATTR_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Safe to drop between the quotes of an HTML attribute. */
export function escapeAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (character) => ATTR_ESCAPES[character]);
}

/** Safe to drop between two tags as text. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>]/g, (character) => ATTR_ESCAPES[character]);
}

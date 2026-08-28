/**
 * A role can be one of the starter roles (which carry a translation key) or a
 * role the Super Admin typed themselves (which carries plain text). These two
 * helpers hide that difference from every screen.
 */
export function roleLabel(role, t) {
  if (!role) return '';
  if (role.label) return role.label;
  if (role.labelKey) return t(role.labelKey);
  return role.key;
}

export function roleDesc(role, t) {
  if (!role) return '';
  if (role.desc) return role.desc;
  if (role.descKey) return t(role.descKey);
  return '';
}

// Users, roles, permissions and the activity trail.

export const PERMISSION_ACTIONS = [
  { key: 'view', labelKey: 'users.view' },
  { key: 'create', labelKey: 'users.create' },
  { key: 'edit', labelKey: 'users.edit' },
  { key: 'delete', labelKey: 'users.delete' },
  { key: 'send', labelKey: 'users.send' },
  { key: 'export', labelKey: 'users.exportPerm' },
];

// Which actions actually make sense for each section of the app.
export const PERMISSION_MODULES = [
  { key: 'dashboard', labelKey: 'nav.dashboard', icon: 'bi-grid-1x2', actions: ['view', 'export'] },
  { key: 'campaigns', labelKey: 'nav.campaigns', icon: 'bi-megaphone', actions: ['view', 'create', 'edit', 'delete', 'send', 'export'] },
  { key: 'contacts', labelKey: 'nav.contacts', icon: 'bi-people', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { key: 'templates', labelKey: 'nav.templates', icon: 'bi-layout-wtf', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'segments', labelKey: 'nav.segments', icon: 'bi-diagram-3', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'reports', labelKey: 'nav.reports', icon: 'bi-file-earmark-bar-graph', actions: ['view', 'export'] },
  { key: 'accounts', labelKey: 'nav.accounts', icon: 'bi-envelope-at', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings', labelKey: 'nav.settings', icon: 'bi-gear', actions: ['view', 'edit'] },
  { key: 'users', labelKey: 'nav.users', icon: 'bi-person-badge', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'activity', labelKey: 'nav.activity', icon: 'bi-clock-history', actions: ['view', 'export', 'delete'] },
];

// Colours and icons a Super Admin can pick when creating a role.
export const ROLE_TONES = ['danger', 'primary', 'info', 'success', 'warning', 'muted'];

export const ROLE_ICONS = [
  'bi-shield-fill-check',
  'bi-person-fill-gear',
  'bi-people-fill',
  'bi-person',
  'bi-briefcase',
  'bi-headset',
  'bi-graph-up',
  'bi-pencil-square',
  'bi-eye',
  'bi-star',
];

export const ACTION_TYPES = [
  { key: 'created', labelKey: 'action.created', icon: 'bi-plus-circle', tone: 'success' },
  { key: 'updated', labelKey: 'action.updated', icon: 'bi-pencil', tone: 'info' },
  { key: 'deleted', labelKey: 'action.deleted', icon: 'bi-trash3', tone: 'danger' },
  { key: 'sent', labelKey: 'action.sent', icon: 'bi-send', tone: 'primary' },
  { key: 'exported', labelKey: 'action.exported', icon: 'bi-download', tone: 'muted' },
  { key: 'imported', labelKey: 'action.imported', icon: 'bi-upload', tone: 'info' },
  { key: 'signedIn', labelKey: 'action.signedIn', icon: 'bi-box-arrow-in-right', tone: 'muted' },
  { key: 'permissionChanged', labelKey: 'action.permissionChanged', icon: 'bi-shield-lock', tone: 'warning' },
  { key: 'connected', labelKey: 'action.connected', icon: 'bi-plug', tone: 'success' },
];


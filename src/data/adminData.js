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

function fullAccess() {
  return PERMISSION_MODULES.reduce((acc, module) => {
    acc[module.key] = [...module.actions];
    return acc;
  }, {});
}

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

// These four are only a STARTING POINT. A Super Admin can rename them, change
// their permissions, delete them, or build completely different roles.
// Only "Super Admin" itself is locked, so nobody can lock themselves out.
export const ROLES = [
  {
    key: 'super_admin',
    labelKey: 'role.superAdmin',
    descKey: 'role.superAdminDesc',
    tone: 'danger',
    icon: 'bi-shield-fill-check',
    locked: true, // cannot be reduced or deleted
    permissions: fullAccess(),
  },
  {
    key: 'admin',
    labelKey: 'role.admin',
    descKey: 'role.adminDesc',
    tone: 'primary',
    icon: 'bi-person-fill-gear',
    locked: false,
    permissions: {
      dashboard: ['view', 'export'],
      campaigns: ['view', 'create', 'edit', 'delete', 'send', 'export'],
      contacts: ['view', 'create', 'edit', 'delete', 'export'],
      templates: ['view', 'create', 'edit', 'delete'],
      segments: ['view', 'create', 'edit', 'delete'],
      reports: ['view', 'export'],
      accounts: ['view', 'create', 'edit', 'delete'],
      settings: ['view', 'edit'],
      users: ['view'],
      activity: ['view'],
    },
  },
  {
    key: 'hod',
    labelKey: 'role.hod',
    descKey: 'role.hodDesc',
    tone: 'info',
    icon: 'bi-people-fill',
    locked: false,
    permissions: {
      dashboard: ['view', 'export'],
      campaigns: ['view', 'create', 'edit', 'send', 'export'],
      contacts: ['view', 'create', 'edit', 'export'],
      templates: ['view', 'create', 'edit'],
      segments: ['view', 'create', 'edit'],
      reports: ['view', 'export'],
      accounts: ['view'],
      settings: [],
      users: [],
      activity: [],
    },
  },
  {
    key: 'member',
    labelKey: 'role.member',
    descKey: 'role.memberDesc',
    tone: 'muted',
    icon: 'bi-person',
    locked: false,
    permissions: {
      dashboard: ['view'],
      campaigns: ['view', 'create', 'edit'],
      contacts: ['view', 'create'],
      templates: ['view', 'create', 'edit'],
      segments: ['view'],
      reports: ['view'],
      accounts: [],
      settings: [],
      users: [],
      activity: [],
    },
  },
];

export const teamUsers = [
  {
    id: 'u1',
    name: 'Rohit Sharma',
    email: 'rohit@gowebkart.com',
    role: 'super_admin',
    department: 'Management',
    status: 'Active',
    lastActive: '2026-08-26 11:42',
    initials: 'RS',
  },
  {
    id: 'u2',
    name: 'Neha Kulkarni',
    email: 'neha@gowebkart.com',
    role: 'admin',
    department: 'Marketing',
    status: 'Active',
    lastActive: '2026-08-26 10:15',
    initials: 'NK',
  },
  {
    id: 'u3',
    name: 'Imran Shaikh',
    email: 'imran@gowebkart.com',
    role: 'hod',
    department: 'Sales',
    status: 'Active',
    lastActive: '2026-08-25 18:30',
    initials: 'IS',
  },
  {
    id: 'u4',
    name: 'Kavita Menon',
    email: 'kavita@gowebkart.com',
    role: 'hod',
    department: 'Academy',
    status: 'Active',
    lastActive: '2026-08-24 09:05',
    initials: 'KM',
  },
  {
    id: 'u5',
    name: 'Arjun Bhosale',
    email: 'arjun@gowebkart.com',
    role: 'member',
    department: 'Marketing',
    status: 'Active',
    lastActive: '2026-08-26 09:58',
    initials: 'AB',
  },
  {
    id: 'u6',
    name: 'Fatima Ansari',
    email: 'fatima@gowebkart.com',
    role: 'member',
    department: 'Support',
    status: 'Invited',
    lastActive: '—',
    initials: 'FA',
  },
  {
    id: 'u7',
    name: 'Deepak Rane',
    email: 'deepak@gowebkart.com',
    role: 'member',
    department: 'Sales',
    status: 'Disabled',
    lastActive: '2026-06-30 16:20',
    initials: 'DR',
  },
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


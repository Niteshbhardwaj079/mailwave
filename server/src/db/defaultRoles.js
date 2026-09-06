// The four roles every fresh database starts with, and exactly what each one
// may do. Used by seedRoles() on every install — clean or demo — so this is
// core seed data, not sample content. A Super Admin can rename, reshape or
// delete any of these later except Super Admin itself, which stays locked so
// nobody can lock themselves out.
//
// This lives on the backend (not in the frontend's src/data/) so seeding
// works from a standalone copy of server/ alone — it used to reach across
// into the frontend source tree with a relative import, which only worked
// because both currently ship from the same repo checkout.

export const DEFAULT_ROLES = [
  {
    key: 'super_admin',
    labelKey: 'role.superAdmin',
    descKey: 'role.superAdminDesc',
    tone: 'danger',
    icon: 'bi-shield-fill-check',
    locked: true, // cannot be reduced or deleted
    permissions: {
      dashboard: ['view', 'export'],
      campaigns: ['view', 'create', 'edit', 'delete', 'send', 'export'],
      contacts: ['view', 'create', 'edit', 'delete', 'export'],
      templates: ['view', 'create', 'edit', 'delete'],
      segments: ['view', 'create', 'edit', 'delete'],
      reports: ['view', 'export'],
      accounts: ['view', 'create', 'edit', 'delete'],
      settings: ['view', 'edit'],
      users: ['view', 'create', 'edit', 'delete'],
      activity: ['view', 'export', 'delete'],
    },
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

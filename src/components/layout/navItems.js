// Counts are NOT written here — they come from the real data at render time
// (see countFor() in Sidebar.jsx). A nav item only says WHICH number it wants.
export const navSections = [
  {
    titleKey: 'nav.main',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: 'bi-grid-1x2', end: true, module: 'dashboard' },
      { to: '/campaigns', labelKey: 'nav.campaigns', icon: 'bi-megaphone', countKey: 'campaigns', module: 'campaigns' },
      { to: '/contacts', labelKey: 'nav.contacts', icon: 'bi-people', countKey: 'contacts', module: 'contacts' },
      { to: '/subscribers', labelKey: 'nav.subscribers', icon: 'bi-hand-thumbs-up', countKey: 'subscribers', module: 'contacts' },
      { to: '/templates', labelKey: 'nav.templates', icon: 'bi-layout-wtf', countKey: 'templates', module: 'templates' },
      { to: '/media', labelKey: 'nav.media', icon: 'bi-images', module: 'templates' },
    ],
  },
  {
    titleKey: 'nav.insights',
    items: [
      { to: '/reports', labelKey: 'nav.reports', icon: 'bi-file-earmark-bar-graph', module: 'reports' },
      { to: '/segments', labelKey: 'nav.segments', icon: 'bi-diagram-3', countKey: 'segments', module: 'segments' },
    ],
  },
  {
    titleKey: 'nav.setup',
    items: [
      { to: '/accounts', labelKey: 'nav.accounts', icon: 'bi-envelope-at', countKey: 'accounts', module: 'accounts' },
      { to: '/settings', labelKey: 'nav.settings', icon: 'bi-gear', module: 'settings' },
      { to: '/guide', labelKey: 'nav.guide', icon: 'bi-book' },
    ],
  },
  {
    titleKey: 'nav.administration',
    items: [
      { to: '/users', labelKey: 'nav.users', icon: 'bi-person-badge', countKey: 'users', module: 'users' },
      { to: '/activity', labelKey: 'nav.activity', icon: 'bi-clock-history', module: 'activity' },
      { to: '/system-emails', labelKey: 'nav.systemEmails', icon: 'bi-envelope-paper', module: 'settings' },
      { to: '/backups', labelKey: 'nav.backups', icon: 'bi-shield-check', module: 'settings' },
    ],
  },
];

// Same `module` field as the sidebar so the phone tab bar hides what the
// current role cannot open. The guide has no module — everyone may read it.
export const tabBarItems = [
  { to: '/', labelKey: 'nav.home', icon: 'bi-house', end: true, module: 'dashboard' },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: 'bi-megaphone', module: 'campaigns' },
  { to: '/contacts', labelKey: 'nav.contacts', icon: 'bi-people', module: 'contacts' },
  { to: '/guide', labelKey: 'nav.guide', icon: 'bi-book' },
];

export const pageTitleKeys = {
  '/': 'nav.dashboard',
  '/campaigns': 'nav.campaigns',
  '/campaigns/new': 'dash.createCampaign',
  '/contacts': 'nav.contacts',
  '/contacts/import': 'con.importExcel',
  '/templates': 'nav.templates',
  '/templates/new': 'tpl.newTemplate',
  '/media': 'nav.media',
  '/reports': 'nav.reports',
  '/segments': 'nav.segments',
  '/subscribers': 'nav.subscribers',
  '/accounts': 'nav.accounts',
  '/accounts/connect': 'acc.connect',
  '/settings': 'nav.settings',
  '/guide': 'nav.guide',
  '/users': 'nav.users',
  '/activity': 'nav.activity',
  '/system-emails': 'nav.systemEmails',
  '/backups': 'nav.backups',
  '/onboarding': 'ob.title',
  '/404': 'nf.title',
};

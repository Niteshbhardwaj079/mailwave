// Static UI constants shared across pages — dropdown options, wizard steps,
// report types and the rest. Every value here carries an i18n key, not raw
// English text, so the wizard/pages render through t() in every language.
//
// This file used to be called mockData.js and also held a large amount of
// hardcoded sample data (fake campaigns, contacts, analytics) from before the
// backend existed. That data has since been replaced everywhere by real API
// calls, so it was deleted rather than carried forward — every export below
// is still actually imported somewhere.

export const templateCategories = ['All', 'Welcome', 'Promotional', 'Announcement', 'Offer', 'Festival', 'Reminder', 'Follow-up', 'Custom'];

export const mergeVariables = ['name', 'email', 'company', 'phone', 'city', 'subscribe_url'];

export const appFields = [
  { value: 'name', labelKey: 'imp.field.name' },
  { value: 'email', labelKey: 'imp.field.email' },
  { value: 'phone', labelKey: 'imp.field.phone' },
  { value: 'company', labelKey: 'imp.field.company' },
  { value: 'city', labelKey: 'imp.field.city' },
  { value: 'skip', labelKey: 'imp.field.skip' },
];

export const reportTypes = [
  { id: 'rp1', nameKey: 'rep.type.campaign', descKey: 'rep.type.campaignDesc', icon: 'bi-file-earmark-bar-graph' },
  { id: 'rp2', nameKey: 'rep.type.activity', descKey: 'rep.type.activityDesc', icon: 'bi-people' },
  { id: 'rp3', nameKey: 'rep.type.opened', descKey: 'rep.type.openedDesc', icon: 'bi-envelope-open' },
  { id: 'rp4', nameKey: 'rep.type.unopened', descKey: 'rep.type.unopenedDesc', icon: 'bi-envelope' },
  { id: 'rp5', nameKey: 'rep.type.clicked', descKey: 'rep.type.clickedDesc', icon: 'bi-cursor' },
  { id: 'rp6', nameKey: 'rep.type.failed', descKey: 'rep.type.failedDesc', icon: 'bi-exclamation-octagon' },
];

export const batchOptions = [
  { value: 0, labelKey: 'send.batchAll' },
  { value: 100, labelKey: 'send.batchPer' },
  { value: 200, labelKey: 'send.batchPer' },
  { value: 500, labelKey: 'send.batchPer' },
];

// Steps carry a translation key, not English text — the wizard renders them
// through t() so every language gets its own labels.
export const wizardSteps = [
  { key: 'info', labelKey: 'wiz.step.info' },
  { key: 'recipients', labelKey: 'wiz.step.recipients' },
  { key: 'template', labelKey: 'wiz.step.template' },
  { key: 'content', labelKey: 'wiz.step.content' },
  { key: 'settings', labelKey: 'wiz.step.settings' },
  { key: 'review', labelKey: 'wiz.step.review' },
];

export const onboardingSteps = [
  { key: 'welcome', titleKey: 'ob.s.welcome', descKey: 'ob.s.welcomeDesc', icon: 'bi-stars' },
  { key: 'connect', titleKey: 'ob.s.connect', descKey: 'ob.s.connectDesc', icon: 'bi-plug' },
  { key: 'contacts', titleKey: 'ob.s.contacts', descKey: 'ob.s.contactsDesc', icon: 'bi-people' },
  { key: 'template', titleKey: 'ob.s.template', descKey: 'ob.s.templateDesc', icon: 'bi-layout-wtf' },
  { key: 'test', titleKey: 'ob.s.test', descKey: 'ob.s.testDesc', icon: 'bi-envelope-check' },
  { key: 'campaign', titleKey: 'ob.s.campaign', descKey: 'ob.s.campaignDesc', icon: 'bi-rocket-takeoff' },
];

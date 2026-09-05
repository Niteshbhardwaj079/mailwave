// ---------------------------------------------------------------------------
// Front-end mock data.
// This file is the ONLY place the UI gets data from, so swapping it for real
// API calls later means changing one module, not every page.
// ---------------------------------------------------------------------------

export const currentUser = {
  name: 'Rohit Sharma',
  email: 'rohit@gowebkart.com',
  role: 'Workspace Owner',
  initials: 'RS',
  company: 'Gowebkart',
};

export const dashboardKpis = [
  { id: 'campaigns', label: 'Total Campaigns', value: 48, icon: 'bi-megaphone', tone: 'primary', delta: '+6', trend: 'up', hint: 'vs last month' },
  { id: 'sent', label: 'Emails Sent', value: 128450, icon: 'bi-send', tone: 'info', delta: '+12.4%', trend: 'up', hint: 'vs last month' },
  { id: 'opened', label: 'Emails Opened', value: 71920, icon: 'bi-envelope-open', tone: 'success', delta: '+3.1%', trend: 'up', hint: 'vs last month' },
  { id: 'openRate', label: 'Open Rate', value: '56.0%', icon: 'bi-graph-up-arrow', tone: 'success', delta: '+1.8 pts', trend: 'up', hint: 'estimated' },
  { id: 'clicked', label: 'Links Clicked', value: 19340, icon: 'bi-cursor', tone: 'primary', delta: '+8.7%', trend: 'up', hint: 'vs last month' },
  { id: 'clickRate', label: 'Click Rate', value: '15.1%', icon: 'bi-bar-chart', tone: 'info', delta: '-0.4 pts', trend: 'down', hint: 'vs last month' },
  { id: 'failed', label: 'Failed Emails', value: 1245, icon: 'bi-exclamation-octagon', tone: 'danger', delta: '-18%', trend: 'up', hint: 'fewer failures' },
  { id: 'pending', label: 'Pending Emails', value: 320, icon: 'bi-hourglass-split', tone: 'warning', delta: '2 queues', trend: 'flat', hint: 'in queue now' },
  { id: 'scheduled', label: 'Scheduled Campaigns', value: 4, icon: 'bi-calendar-event', tone: 'muted', delta: 'next: Fri', trend: 'flat', hint: 'upcoming' },
];

// Sent / Opened / Clicked trend --------------------------------------------
function buildTrend(days) {
  const out = [];
  const today = new Date('2026-08-26T00:00:00');
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const base = 1400 + Math.round(Math.sin(i / 3) * 380) + (i % 7 === 0 ? -520 : 0);
    const sent = Math.max(280, base + ((i * 37) % 420));
    const opened = Math.round(sent * (0.48 + ((i * 13) % 17) / 100));
    const clicked = Math.round(opened * (0.2 + ((i * 7) % 13) / 100));
    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      sent,
      opened,
      clicked,
    });
  }
  return out;
}

export const trendByRange = {
  '7d': buildTrend(7),
  '30d': buildTrend(30),
  '90d': buildTrend(90),
};

export const deliveryBreakdown = [
  { key: 'delivered', name: 'Delivered', value: 124860, color: '#4f46e5' },
  { key: 'failed', name: 'Failed', value: 1245, color: '#dc2626' },
  { key: 'bounced', name: 'Bounced', value: 1860, color: '#d97706' },
  { key: 'unsubscribed', name: 'Unsubscribed', value: 485, color: '#9ca3af' },
];

export const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const heatmapData = heatmapDays.map((day, dayIndex) =>
  Array.from({ length: 24 }, (_, hour) => {
    const peakMorning = Math.max(0, 5 - Math.abs(hour - 10));
    const peakEvening = Math.max(0, 4 - Math.abs(hour - 19));
    const weekendPenalty = dayIndex >= 5 ? 2 : 0;
    const level = Math.max(0, Math.min(5, peakMorning + peakEvening - weekendPenalty - (hour < 6 ? 3 : 0)));
    return { day, hour, level, opens: level * 137 + ((hour * 17 + dayIndex * 9) % 60) };
  })
);

export const campaignStatusTones = {
  Sent: 'success',
  Sending: 'primary',
  Scheduled: 'info',
  Draft: 'muted',
  Paused: 'warning',
  Failed: 'danger',
};

export const campaigns = [
  {
    id: 'cmp_1041',
    name: 'Independence Day Offer 2026',
    sender: 'offers@gowebkart.com',
    senderName: 'Gowebkart Offers',
    recipients: 5200,
    sent: 5200,
    delivered: 5104,
    opened: 3121,
    clicked: 894,
    failed: 96,
    bounced: 61,
    unsubscribed: 18,
    status: 'Sent',
    date: '2026-08-15',
    time: '09:30',
    template: 'Festival Offer',
    batchSize: 500,
    openTracking: true,
    clickTracking: true,
  },
  {
    id: 'cmp_1040',
    name: 'August Product Update',
    sender: 'hello@gowebkart.com',
    senderName: 'Gowebkart Team',
    recipients: 3120,
    sent: 2380,
    delivered: 2341,
    opened: 1102,
    clicked: 268,
    failed: 39,
    bounced: 22,
    unsubscribed: 7,
    status: 'Sending',
    date: '2026-08-26',
    time: '11:05',
    template: 'Announcement Clean',
    batchSize: 200,
    openTracking: true,
    clickTracking: true,
  },
  {
    id: 'cmp_1039',
    name: 'Web Design Course — Batch 12',
    sender: 'courses@gowebkart.com',
    senderName: 'Gowebkart Academy',
    recipients: 1480,
    sent: 1480,
    delivered: 1449,
    opened: 812,
    clicked: 341,
    failed: 31,
    bounced: 19,
    unsubscribed: 4,
    status: 'Sent',
    date: '2026-08-12',
    time: '18:00',
    template: 'Course Promo',
    batchSize: 100,
    openTracking: true,
    clickTracking: true,
  },
  {
    id: 'cmp_1038',
    name: 'Cart Abandon Reminder',
    sender: 'shop@gowebkart.com',
    senderName: 'Gowebkart Shop',
    recipients: 940,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0,
    unsubscribed: 0,
    status: 'Scheduled',
    date: '2026-08-28',
    time: '10:00',
    template: 'Reminder Simple',
    batchSize: 100,
    openTracking: true,
    clickTracking: false,
  },
  {
    id: 'cmp_1037',
    name: 'Welcome Series — Step 1',
    sender: 'hello@gowebkart.com',
    senderName: 'Gowebkart Team',
    recipients: 2600,
    sent: 2600,
    delivered: 2571,
    opened: 1690,
    clicked: 512,
    failed: 29,
    bounced: 17,
    unsubscribed: 9,
    status: 'Sent',
    date: '2026-08-05',
    time: '08:15',
    template: 'Welcome Warm',
    batchSize: 500,
    openTracking: true,
    clickTracking: true,
  },
  {
    id: 'cmp_1036',
    name: 'Feedback Survey (Q3)',
    sender: 'hello@gowebkart.com',
    senderName: 'Gowebkart Team',
    recipients: 780,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0,
    unsubscribed: 0,
    status: 'Draft',
    date: '2026-08-24',
    time: '—',
    template: 'Blank',
    batchSize: 100,
    openTracking: true,
    clickTracking: true,
  },
  {
    id: 'cmp_1035',
    name: 'Diwali Early Bird (Paused)',
    sender: 'offers@gowebkart.com',
    senderName: 'Gowebkart Offers',
    recipients: 4100,
    sent: 1200,
    delivered: 1178,
    opened: 604,
    clicked: 141,
    failed: 22,
    bounced: 14,
    unsubscribed: 3,
    status: 'Paused',
    date: '2026-08-20',
    time: '16:40',
    template: 'Festival Offer',
    batchSize: 200,
    openTracking: true,
    clickTracking: true,
  },
];

export const recipientActivity = [
  { id: 'r1', name: 'Rahul Verma', email: 'rahul@example.com', status: 'Opened', sent: true, opened: true, openCount: 3, firstOpen: '26 Aug, 10:12', lastOpen: '26 Aug, 12:40', clicked: true, clickCount: 2, lastActivity: 'Today 12:40', company: 'Verma Traders' },
  { id: 'r2', name: 'Amit Kumar', email: 'amit@example.com', status: 'Opened', sent: true, opened: true, openCount: 1, firstOpen: '26 Aug, 11:20', lastOpen: '26 Aug, 11:20', clicked: false, clickCount: 0, lastActivity: 'Today 11:20', company: 'Kumar Infotech' },
  { id: 'r3', name: 'Priya Nair', email: 'priya@example.com', status: 'Sent', sent: true, opened: false, openCount: 0, firstOpen: '—', lastOpen: '—', clicked: false, clickCount: 0, lastActivity: '—', company: 'Nair Studio' },
  { id: 'r4', name: 'Sneha Patel', email: 'sneha@example.com', status: 'Clicked', sent: true, opened: true, openCount: 5, firstOpen: '25 Aug, 19:02', lastOpen: '26 Aug, 09:11', clicked: true, clickCount: 4, lastActivity: 'Today 09:11', company: 'Patel Exports' },
  { id: 'r5', name: 'Vikram Singh', email: 'vikram@example.com', status: 'Bounced', sent: true, opened: false, openCount: 0, firstOpen: '—', lastOpen: '—', clicked: false, clickCount: 0, lastActivity: '25 Aug 14:02', company: 'Singh Motors' },
  { id: 'r6', name: 'Anjali Rao', email: 'anjali@example.com', status: 'Opened', sent: true, opened: true, openCount: 2, firstOpen: '25 Aug, 20:30', lastOpen: '26 Aug, 08:05', clicked: false, clickCount: 0, lastActivity: 'Today 08:05', company: 'Rao Digital' },
  { id: 'r7', name: 'Karan Mehta', email: 'karan@example.com', status: 'Failed', sent: false, opened: false, openCount: 0, firstOpen: '—', lastOpen: '—', clicked: false, clickCount: 0, lastActivity: '25 Aug 13:58', company: 'Mehta & Sons' },
  { id: 'r8', name: 'Divya Sharma', email: 'divya@example.com', status: 'Clicked', sent: true, opened: true, openCount: 4, firstOpen: '25 Aug, 18:44', lastOpen: '26 Aug, 10:55', clicked: true, clickCount: 1, lastActivity: 'Today 10:55', company: 'Sharma Realty' },
  { id: 'r9', name: 'Mohit Gupta', email: 'mohit@example.com', status: 'Unsubscribed', sent: true, opened: true, openCount: 1, firstOpen: '25 Aug, 21:10', lastOpen: '25 Aug, 21:10', clicked: false, clickCount: 0, lastActivity: '25 Aug 21:12', company: 'Gupta Foods' },
  { id: 'r10', name: 'Neha Joshi', email: 'neha@example.com', status: 'Sent', sent: true, opened: false, openCount: 0, firstOpen: '—', lastOpen: '—', clicked: false, clickCount: 0, lastActivity: '—', company: 'Joshi Interiors' },
];

// ---------------------------------------------------------------------------
// Top clicked links.
//
// In the real product this list is NOT written by hand. The backend rewrites
// every <a href> in the template into a tracking URL, records each click, then
// groups them: link name = the anchor text from the template HTML, url = the
// original destination, clicks = how many were counted. So each campaign shows
// its OWN links, in its own order, with its own numbers.
//
// Until that backend exists we build the same shape from the campaign object,
// so the panel already behaves per-campaign instead of showing one fixed list.
// ---------------------------------------------------------------------------

// One link set per template. `share` = portion of that campaign's total clicks.
const linkSetsByTemplate = {
  'Festival Offer': [
    { name: 'Offer Page', url: 'https://gowebkart.com/offers/independence-day', share: 0.36 },
    { name: 'Product Page', url: 'https://gowebkart.com/products/starter-plan', share: 0.27 },
    { name: 'Pricing', url: 'https://gowebkart.com/pricing', share: 0.14 },
    { name: 'Contact Us', url: 'https://gowebkart.com/contact', share: 0.09 },
  ],
  'Announcement Clean': [
    { name: "What's new", url: 'https://gowebkart.com/changelog', share: 0.41 },
    { name: 'Read the guide', url: 'https://gowebkart.com/docs/getting-started', share: 0.22 },
    { name: 'Book a demo', url: 'https://gowebkart.com/demo', share: 0.16 },
  ],
  'Course Promo': [
    { name: 'Course details', url: 'https://gowebkart.com/courses/web-design', share: 0.44 },
    { name: 'Book your seat', url: 'https://gowebkart.com/courses/web-design/enroll', share: 0.25 },
    { name: 'Fees and batches', url: 'https://gowebkart.com/courses/fees', share: 0.12 },
  ],
  'Welcome Warm': [
    { name: 'Open your dashboard', url: 'https://gowebkart.com/app', share: 0.48 },
    { name: 'Help centre', url: 'https://gowebkart.com/help', share: 0.18 },
  ],
  'Reminder Simple': [
    { name: 'Confirm your seat', url: 'https://gowebkart.com/courses/confirm', share: 0.52 },
    { name: 'Change the date', url: 'https://gowebkart.com/courses/reschedule', share: 0.15 },
  ],
};

const defaultLinkSet = [
  { name: 'Visit website', url: 'https://gowebkart.com', share: 0.38 },
  { name: 'Product Page', url: 'https://gowebkart.com/products/starter-plan', share: 0.24 },
  { name: 'Contact Us', url: 'https://gowebkart.com/contact', share: 0.13 },
];

export function getTopLinks(campaign) {
  if (!campaign || !campaign.clickTracking) return [];
  const set = linkSetsByTemplate[campaign.template] || defaultLinkSet;
  const totalClicks = campaign.clicked || 0;
  return set
    .map((link, index) => ({
      id: `${campaign.id}-l${index + 1}`,
      name: link.name,
      url: link.url,
      clicks: Math.round(totalClicks * link.share),
    }))
    .filter((link) => link.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks);
}

// ---------------------------------------------------------------------------
// Per-campaign derived data.
//
// These three functions exist so that every panel on the campaign analytics
// page belongs to THAT campaign. Before, the page imported one global array and
// showed the same chart, the same 10 recipients and the same log for every
// campaign — a draft that had never been sent still showed opens and clicks.
//
// A real backend returns exactly these shapes from
//   GET /campaigns/:id/trend, /campaigns/:id/recipients, /recipients/:id/log
// so later only these functions are replaced, not the page.
// ---------------------------------------------------------------------------

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso, addDays = 0) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + addDays);
  return `${String(d.getDate()).padStart(2, '0')} ${SHORT_MONTHS[d.getMonth()]}`;
}

// Small deterministic hash so each campaign gets its own, but stable, variation.
function seedOf(text) {
  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) % 9973;
  return seed;
}

/**
 * Activity for ONE campaign, day by day, starting on its send date.
 * Empty while nothing has been sent — the chart then shows an empty state
 * instead of pretending a draft has results.
 */
export function getCampaignTrend(campaign) {
  if (!campaign || !campaign.sent) return [];

  // Most of a campaign lands on day 1 and tails off. These weights sum to 1.
  const weights = [0.52, 0.21, 0.11, 0.07, 0.045, 0.025, 0.02];
  const days = campaign.status === 'Sending' ? 4 : 7;
  const used = weights.slice(0, days);
  const total = used.reduce((sum, w) => sum + w, 0);

  return used.map((weight, index) => {
    const share = weight / total;
    return {
      date: shortDate(campaign.date, index),
      label: shortDate(campaign.date, index),
      sent: Math.round(campaign.sent * share),
      opened: campaign.openTracking ? Math.round(campaign.opened * share) : 0,
      clicked: campaign.clickTracking ? Math.round(campaign.clicked * share) : 0,
    };
  });
}

/**
 * The recipient rows for ONE campaign. Rows that cannot exist for this campaign
 * are dropped: no bounces if it bounced nobody, no clicks if click tracking was
 * off, and nothing at all before the first send.
 */
export function getRecipientActivity(campaign) {
  if (!campaign || !campaign.sent) return [];

  const seed = seedOf(campaign.id);
  const rotated = recipientActivity
    .slice(seed % recipientActivity.length)
    .concat(recipientActivity.slice(0, seed % recipientActivity.length));

  return rotated
    .filter((row) => {
      if (row.status === 'Bounced') return campaign.bounced > 0;
      if (row.status === 'Failed') return campaign.failed > 0;
      if (row.status === 'Unsubscribed') return campaign.unsubscribed > 0;
      return true;
    })
    .map((row) => {
      const opened = campaign.openTracking ? row.opened : false;
      const clicked = campaign.clickTracking ? row.clicked : false;
      let status = row.status;
      if (!clicked && status === 'Clicked') status = opened ? 'Opened' : 'Sent';
      if (!opened && status === 'Opened') status = 'Sent';

      return {
        ...row,
        id: `${campaign.id}-${row.id}`,
        status,
        opened,
        clicked,
        openCount: opened ? row.openCount : 0,
        clickCount: clicked ? row.clickCount : 0,
        firstOpen: opened ? row.firstOpen : '—',
        lastOpen: opened ? row.lastOpen : '—',
        lastActivity: opened || clicked ? row.lastActivity : row.status === 'Sent' ? '—' : row.lastActivity,
      };
    });
}

/**
 * The log for ONE recipient, built from what actually happened to them.
 */
export function getEmailLog(campaign, row) {
  if (!row) return [];

  const events = [];
  const add = (time, text, tone) => events.push({ id: `${row.id}-e${events.length + 1}`, time, text, tone });

  if (row.status === 'Failed') {
    add('10:21 AM', 'Sending attempted', 'primary');
    add('10:21 AM', 'Provider refused the message — not delivered', 'danger');
    return events;
  }

  add('10:21 AM', 'Email sent', 'primary');

  if (row.status === 'Bounced') {
    add('10:22 AM', 'Bounced — the address does not exist', 'warning');
    add('10:22 AM', 'Address blocked from future sends', 'muted');
    return events;
  }

  add('10:22 AM', 'Delivery confirmed by provider', 'success');

  if (row.opened) {
    add(row.firstOpen, 'Open detected (estimate)', 'info');
  }

  if (row.clicked) {
    const link = getTopLinks(campaign)[0];
    add(row.lastOpen, `Link clicked — ${link ? link.name : 'a link in this email'}`, 'success');
  }

  if (row.opened && row.openCount > 1) {
    add(row.lastOpen, `Opened again (${row.openCount} times in total)`, 'info');
  }

  if (row.status === 'Unsubscribed') {
    add(row.lastActivity, 'Unsubscribed — added to the suppression list', 'muted');
  }

  return events;
}

export const emailAccounts = [
  { id: 'acc_1', email: 'hello@gowebkart.com', provider: 'Gmail', providerKey: 'google', senderName: 'Gowebkart Team', replyTo: 'hello@gowebkart.com', status: 'Connected', dailyLimit: 2000, usedToday: 640 },
  { id: 'acc_2', email: 'offers@gowebkart.com', provider: 'Microsoft 365', providerKey: 'microsoft', senderName: 'Gowebkart Offers', replyTo: 'support@gowebkart.com', status: 'Connected', dailyLimit: 5000, usedToday: 1820 },
  { id: 'acc_3', email: 'courses@gowebkart.com', provider: 'Custom SMTP', providerKey: 'smtp', senderName: 'Gowebkart Academy', replyTo: 'courses@gowebkart.com', status: 'Needs attention', dailyLimit: 1000, usedToday: 0 },
];

export const providerOptions = [
  { key: 'google', name: 'Gmail / Google Workspace', descKey: 'acc.provider.google', icon: 'bi-google', logoClass: 'mw-provider__logo--google', recommended: true },
  { key: 'microsoft', name: 'Outlook / Microsoft 365', descKey: 'acc.provider.microsoft', icon: 'bi-microsoft', logoClass: 'mw-provider__logo--microsoft', recommended: true },
  { key: 'sendgrid', name: 'SendGrid', descKey: 'acc.provider.sendgrid', icon: 'bi-send-check', logoClass: 'mw-provider__logo--sendgrid', recommended: false },
  { key: 'mailgun', name: 'Mailgun', descKey: 'acc.provider.mailgun', icon: 'bi-rocket-takeoff', logoClass: 'mw-provider__logo--mailgun', recommended: false },
  { key: 'ses', name: 'Amazon SES', descKey: 'acc.provider.ses', icon: 'bi-cloud', logoClass: 'mw-provider__logo--ses', recommended: false },
  { key: 'smtp', name: 'Custom SMTP', descKey: 'acc.provider.smtp', icon: 'bi-hdd-network', logoClass: 'mw-provider__logo--smtp', recommended: false },
];

export const contacts = [
  { id: 'c1', name: 'Rahul Verma', email: 'rahul@example.com', phone: '+91 98200 11223', company: 'Verma Traders', tags: ['Lead', 'Mumbai'], group: 'Website Leads', status: 'Subscribed', addedOn: '2026-07-11' },
  { id: 'c2', name: 'Amit Kumar', email: 'amit@example.com', phone: '+91 98111 44556', company: 'Kumar Infotech', tags: ['Customer'], group: 'Customers', status: 'Subscribed', addedOn: '2026-06-02' },
  { id: 'c3', name: 'Priya Nair', email: 'priya@example.com', phone: '+91 90000 77881', company: 'Nair Studio', tags: ['Lead'], group: 'Website Leads', status: 'Subscribed', addedOn: '2026-07-29' },
  { id: 'c4', name: 'Sneha Patel', email: 'sneha@example.com', phone: '+91 97600 33445', company: 'Patel Exports', tags: ['VIP', 'Customer'], group: 'Customers', status: 'Subscribed', addedOn: '2026-05-18' },
  { id: 'c5', name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 99887 22110', company: 'Singh Motors', tags: ['Cold'], group: 'Imported Aug', status: 'Bounced', addedOn: '2026-08-01' },
  { id: 'c6', name: 'Anjali Rao', email: 'anjali@example.com', phone: '+91 98450 66778', company: 'Rao Digital', tags: ['Lead', 'Bengaluru'], group: 'Website Leads', status: 'Subscribed', addedOn: '2026-08-09' },
  { id: 'c7', name: 'Karan Mehta', email: 'karan@example.com', phone: '+91 93000 55443', company: 'Mehta & Sons', tags: ['Cold'], group: 'Imported Aug', status: 'Subscribed', addedOn: '2026-08-03' },
  { id: 'c8', name: 'Mohit Gupta', email: 'mohit@example.com', phone: '+91 90909 12345', company: 'Gupta Foods', tags: ['Customer'], group: 'Customers', status: 'Unsubscribed', addedOn: '2026-04-22' },
  { id: 'c9', name: 'Divya Sharma', email: 'divya@example.com', phone: '+91 98999 00112', company: 'Sharma Realty', tags: ['VIP'], group: 'Customers', status: 'Subscribed', addedOn: '2026-03-14' },
  { id: 'c10', name: 'Neha Joshi', email: 'neha@example.com', phone: '+91 96000 88997', company: 'Joshi Interiors', tags: ['Lead'], group: 'Website Leads', status: 'Subscribed', addedOn: '2026-08-18' },
];

export const contactGroups = [
  { id: 'g1', name: 'Website Leads', count: 4820, tone: 'primary' },
  { id: 'g2', name: 'Customers', count: 3140, tone: 'success' },
  { id: 'g3', name: 'Imported Aug', count: 1260, tone: 'info' },
  { id: 'g4', name: 'Course Enquiries', count: 980, tone: 'warning' },
];

// `conditions` se hi ginti nikalti hai — server har baar taazi ginta hai.
// `rule` sirf screen par ek line me dikhane ke liye hai.
export const segments = [
  {
    id: 's1',
    name: 'Interested Leads',
    rule: 'Opened campaign AND Clicked link',
    join: 'and',
    conditions: [{ kind: 'opened' }, { kind: 'clicked' }],
    tone: 'success',
  },
  {
    id: 's2',
    name: 'Opened but did not click',
    rule: 'Opened AND NOT Clicked',
    join: 'and',
    conditions: [{ kind: 'opened' }, { kind: 'not_clicked' }],
    tone: 'info',
  },
  {
    id: 's3',
    name: 'Never opened',
    rule: 'Sent AND NOT Opened',
    join: 'and',
    conditions: [{ kind: 'not_opened' }],
    tone: 'muted',
  },
  {
    id: 's4',
    name: 'Unsubscribed',
    rule: 'Unsubscribed from any campaign',
    join: 'and',
    conditions: [{ kind: 'unsubscribed' }],
    tone: 'primary',
  },
  {
    id: 's5',
    name: 'Failed emails',
    rule: 'Status = Failed OR Bounced',
    join: 'and',
    conditions: [{ kind: 'failed' }],
    tone: 'danger',
  },
];

export const templateCategories = ['All', 'Welcome', 'Promotional', 'Announcement', 'Offer', 'Festival', 'Reminder', 'Follow-up', 'Custom'];

export const mergeVariables = ['name', 'email', 'company', 'phone', 'city', 'subscribe_url'];

export const excelPreviewRows = [
  { row: 2, name: 'Rahul Verma', email: 'rahul@example.com', company: 'Verma Traders', flag: 'valid' },
  { row: 3, name: 'Amit Kumar', email: 'amit@example.com', company: 'Kumar Infotech', flag: 'valid' },
  { row: 4, name: 'Priya Nair', email: 'priya[at]example.com', company: 'Nair Studio', flag: 'invalid' },
  { row: 5, name: 'Sneha Patel', email: 'sneha@example.com', company: 'Patel Exports', flag: 'duplicate' },
  { row: 6, name: 'Vikram Singh', email: '', company: 'Singh Motors', flag: 'missing' },
  { row: 7, name: 'Anjali Rao', email: 'anjali@example.com', company: 'Rao Digital', flag: 'valid' },
];

export const importSummary = { total: 1284, valid: 1201, invalid: 41, duplicates: 42 };

export const excelColumns = [
  { source: 'Full Name', target: 'name' },
  { source: 'Email Address', target: 'email' },
  { source: 'Company Name', target: 'company' },
  { source: 'Mobile', target: 'phone' },
  { source: 'City', target: 'city' },
];

export const appFields = [
  { value: 'name', labelKey: 'imp.field.name' },
  { value: 'email', labelKey: 'imp.field.email' },
  { value: 'phone', labelKey: 'imp.field.phone' },
  { value: 'company', labelKey: 'imp.field.company' },
  { value: 'city', labelKey: 'imp.field.city' },
  { value: 'skip', labelKey: 'imp.field.skip' },
];

export const emailLogTimeline = [
  { id: 'e1', time: '10:21 AM', text: 'Email sent', tone: 'primary' },
  { id: 'e2', time: '10:22 AM', text: 'Delivery confirmed by provider', tone: 'success' },
  { id: 'e3', time: '10:45 AM', text: 'Open detected (estimate)', tone: 'info' },
  { id: 'e4', time: '10:46 AM', text: 'Link clicked — Product Page', tone: 'success' },
  { id: 'e5', time: '11:03 AM', text: 'Open detected (estimate)', tone: 'info' },
];

export const notifications = [
  { id: 'n1', title: 'Campaign finished', text: 'Independence Day Offer 2026 sent to 5,200 recipients.', time: '2h ago', icon: 'bi-check-circle', tone: 'success' },
  { id: 'n2', title: 'Sending in progress', text: 'August Product Update — 2,380 of 3,120 sent.', time: '10m ago', icon: 'bi-send', tone: 'primary' },
  { id: 'n3', title: 'Account needs attention', text: 'courses@gowebkart.com SMTP test failed.', time: 'Yesterday', icon: 'bi-exclamation-triangle', tone: 'warning' },
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

// ---------------------------------------------------------------------------
// People who pressed the "Subscribe" button inside a campaign email.
// A subscriber is stronger than an imported contact: they asked to hear more.
// ---------------------------------------------------------------------------
export const subscribers = [
  { id: 'sub1', name: 'Rahul Verma', email: 'rahul@example.com', company: 'Verma Traders', city: 'Mumbai', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-26 12:41', status: 'Subscribed' },
  { id: 'sub2', name: 'Sneha Patel', email: 'sneha@example.com', company: 'Patel Exports', city: 'Surat', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-26 09:12', status: 'Subscribed' },
  { id: 'sub3', name: 'Divya Sharma', email: 'divya@example.com', company: 'Sharma Realty', city: 'Mumbai', campaignId: 'cmp_1039', campaign: 'Web Design Course — Batch 12', subscribedAt: '2026-08-25 18:50', status: 'Subscribed' },
  { id: 'sub4', name: 'Anjali Rao', email: 'anjali@example.com', company: 'Rao Digital', city: 'Bengaluru', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-25 20:35', status: 'Subscribed' },
  { id: 'sub5', name: 'Neha Joshi', email: 'neha@example.com', company: 'Joshi Interiors', city: 'Nashik', campaignId: 'cmp_1037', campaign: 'Welcome Series — Step 1', subscribedAt: '2026-08-06 11:02', status: 'Subscribed' },
  { id: 'sub6', name: 'Amit Kumar', email: 'amit@example.com', company: 'Kumar Infotech', city: 'Delhi', campaignId: 'cmp_1039', campaign: 'Web Design Course — Batch 12', subscribedAt: '2026-08-13 15:20', status: 'Subscribed' },
  { id: 'sub7', name: 'Mohit Gupta', email: 'mohit@example.com', company: 'Gupta Foods', city: 'Jaipur', campaignId: 'cmp_1037', campaign: 'Welcome Series — Step 1', subscribedAt: '2026-08-06 09:44', status: 'Left later' },
];

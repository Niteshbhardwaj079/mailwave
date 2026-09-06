// Sample content for the DEMO seed only (`npm run seed`, the default —
// NOT `npm run seed:clean`). This is what start-mailwave.bat uses for a local,
// non-technical first run, so someone double-clicking it sees a populated app
// instead of an empty one. It is never touched by the running server and is
// never used for a real client's install — that path is seedCleanAdmin() in
// seed.js, which creates one real Super Admin and nothing else.
//
// This used to live in the frontend's src/data/ and was reached via a
// relative import across directories, which only worked because both halves
// of the app ship from the same repo checkout. It lives here now so the
// backend can be seeded from a standalone copy of server/ alone.

export const teamUsers = [
  { id: 'u1', name: 'Rohit Sharma', email: 'rohit@gowebkart.com', role: 'super_admin', department: 'Management', status: 'Active', lastActive: '2026-08-26 11:42', initials: 'RS' },
  { id: 'u2', name: 'Neha Kulkarni', email: 'neha@gowebkart.com', role: 'admin', department: 'Marketing', status: 'Active', lastActive: '2026-08-26 10:15', initials: 'NK' },
  { id: 'u3', name: 'Imran Shaikh', email: 'imran@gowebkart.com', role: 'hod', department: 'Sales', status: 'Active', lastActive: '2026-08-25 18:30', initials: 'IS' },
  { id: 'u4', name: 'Kavita Menon', email: 'kavita@gowebkart.com', role: 'hod', department: 'Academy', status: 'Active', lastActive: '2026-08-24 09:05', initials: 'KM' },
  { id: 'u5', name: 'Arjun Bhosale', email: 'arjun@gowebkart.com', role: 'member', department: 'Marketing', status: 'Active', lastActive: '2026-08-26 09:58', initials: 'AB' },
  { id: 'u6', name: 'Fatima Ansari', email: 'fatima@gowebkart.com', role: 'member', department: 'Support', status: 'Invited', lastActive: '—', initials: 'FA' },
  { id: 'u7', name: 'Deepak Rane', email: 'deepak@gowebkart.com', role: 'member', department: 'Sales', status: 'Disabled', lastActive: '2026-06-30 16:20', initials: 'DR' },
];

export const emailAccounts = [
  { id: 'acc_1', email: 'offers@gowebkart.com', senderName: 'Gowebkart Offers', providerKey: 'smtp', status: 'Connected', dailyLimit: 500, usedToday: 0 },
  { id: 'acc_2', email: 'hello@gowebkart.com', senderName: 'Gowebkart Team', providerKey: 'smtp', status: 'Connected', dailyLimit: 500, usedToday: 0 },
  { id: 'acc_3', email: 'courses@gowebkart.com', senderName: 'Gowebkart Academy', providerKey: 'smtp', status: 'Connected', dailyLimit: 500, usedToday: 0 },
  { id: 'acc_4', email: 'shop@gowebkart.com', senderName: 'Gowebkart Shop', providerKey: 'smtp', status: 'Connected', dailyLimit: 500, usedToday: 0 },
];

export const campaigns = [
  { id: 'cmp_1041', name: 'Independence Day Offer 2026', sender: 'offers@gowebkart.com', senderName: 'Gowebkart Offers', recipients: 5200, sent: 5200, delivered: 5104, opened: 3121, clicked: 894, failed: 96, bounced: 61, unsubscribed: 18, status: 'Sent', date: '2026-08-15', time: '09:30', template: 'Festival Offer', batchSize: 500, openTracking: true, clickTracking: true },
  { id: 'cmp_1040', name: 'August Product Update', sender: 'hello@gowebkart.com', senderName: 'Gowebkart Team', recipients: 3120, sent: 2380, delivered: 2341, opened: 1102, clicked: 268, failed: 39, bounced: 22, unsubscribed: 7, status: 'Sending', date: '2026-08-26', time: '11:05', template: 'Announcement Clean', batchSize: 200, openTracking: true, clickTracking: true },
  { id: 'cmp_1039', name: 'Web Design Course — Batch 12', sender: 'courses@gowebkart.com', senderName: 'Gowebkart Academy', recipients: 1480, sent: 1480, delivered: 1449, opened: 812, clicked: 341, failed: 31, bounced: 19, unsubscribed: 4, status: 'Sent', date: '2026-08-12', time: '18:00', template: 'Course Promo', batchSize: 100, openTracking: true, clickTracking: true },
  { id: 'cmp_1038', name: 'Cart Abandon Reminder', sender: 'shop@gowebkart.com', senderName: 'Gowebkart Shop', recipients: 940, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, unsubscribed: 0, status: 'Scheduled', date: '2026-08-28', time: '10:00', template: 'Reminder Simple', batchSize: 100, openTracking: true, clickTracking: false },
  { id: 'cmp_1037', name: 'Welcome Series — Step 1', sender: 'hello@gowebkart.com', senderName: 'Gowebkart Team', recipients: 2600, sent: 2600, delivered: 2571, opened: 1690, clicked: 512, failed: 29, bounced: 17, unsubscribed: 9, status: 'Sent', date: '2026-08-05', time: '08:15', template: 'Welcome Warm', batchSize: 500, openTracking: true, clickTracking: true },
  { id: 'cmp_1036', name: 'Feedback Survey (Q3)', sender: 'hello@gowebkart.com', senderName: 'Gowebkart Team', recipients: 780, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, unsubscribed: 0, status: 'Draft', date: '2026-08-24', time: '—', template: 'Blank', batchSize: 100, openTracking: true, clickTracking: true },
  { id: 'cmp_1035', name: 'Diwali Early Bird (Paused)', sender: 'offers@gowebkart.com', senderName: 'Gowebkart Offers', recipients: 4100, sent: 1200, delivered: 1178, opened: 604, clicked: 141, failed: 22, bounced: 14, unsubscribed: 3, status: 'Paused', date: '2026-08-20', time: '16:40', template: 'Festival Offer', batchSize: 200, openTracking: true, clickTracking: true },
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

// `conditions` drives the live count — the server recounts it fresh every
// time. `rule` is only the one-line label shown on screen.
export const segments = [
  { id: 's1', name: 'Interested Leads', rule: 'Opened campaign AND Clicked link', join: 'and', conditions: [{ kind: 'opened' }, { kind: 'clicked' }], tone: 'success' },
  { id: 's2', name: 'Opened but did not click', rule: 'Opened AND NOT Clicked', join: 'and', conditions: [{ kind: 'opened' }, { kind: 'not_clicked' }], tone: 'info' },
  { id: 's3', name: 'Never opened', rule: 'Sent AND NOT Opened', join: 'and', conditions: [{ kind: 'not_opened' }], tone: 'muted' },
  { id: 's4', name: 'Unsubscribed', rule: 'Unsubscribed from any campaign', join: 'and', conditions: [{ kind: 'unsubscribed' }], tone: 'primary' },
  { id: 's5', name: 'Failed emails', rule: 'Status = Failed OR Bounced', join: 'and', conditions: [{ kind: 'failed' }], tone: 'danger' },
];

export const subscribers = [
  { id: 'sub1', name: 'Rahul Verma', email: 'rahul@example.com', company: 'Verma Traders', city: 'Mumbai', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-26 12:41', status: 'Subscribed' },
  { id: 'sub2', name: 'Sneha Patel', email: 'sneha@example.com', company: 'Patel Exports', city: 'Surat', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-26 09:12', status: 'Subscribed' },
  { id: 'sub3', name: 'Divya Sharma', email: 'divya@example.com', company: 'Sharma Realty', city: 'Mumbai', campaignId: 'cmp_1039', campaign: 'Web Design Course — Batch 12', subscribedAt: '2026-08-25 18:50', status: 'Subscribed' },
  { id: 'sub4', name: 'Anjali Rao', email: 'anjali@example.com', company: 'Rao Digital', city: 'Bengaluru', campaignId: 'cmp_1041', campaign: 'Independence Day Offer 2026', subscribedAt: '2026-08-25 20:35', status: 'Subscribed' },
  { id: 'sub5', name: 'Neha Joshi', email: 'neha@example.com', company: 'Joshi Interiors', city: 'Nashik', campaignId: 'cmp_1037', campaign: 'Welcome Series — Step 1', subscribedAt: '2026-08-06 11:02', status: 'Subscribed' },
  { id: 'sub6', name: 'Amit Kumar', email: 'amit@example.com', company: 'Kumar Infotech', city: 'Delhi', campaignId: 'cmp_1039', campaign: 'Web Design Course — Batch 12', subscribedAt: '2026-08-13 15:20', status: 'Subscribed' },
  { id: 'sub7', name: 'Mohit Gupta', email: 'mohit@example.com', company: 'Gupta Foods', city: 'Jaipur', campaignId: 'cmp_1037', campaign: 'Welcome Series — Step 1', subscribedAt: '2026-08-06 09:44', status: 'Left later' },
];

export const activityLog = [
  { id: 'act1', userId: 'u1', userName: 'Rohit Sharma', initials: 'RS', action: 'signedIn', module: 'dashboard', item: null, detail: 'Signed in', at: '2026-08-26 11:42' },
  { id: 'act2', userId: 'u1', userName: 'Rohit Sharma', initials: 'RS', action: 'created', module: 'campaigns', item: 'Independence Day Offer 2026', detail: 'Campaign created', at: '2026-08-14 17:20' },
  { id: 'act3', userId: 'u1', userName: 'Rohit Sharma', initials: 'RS', action: 'sent', module: 'campaigns', item: 'Independence Day Offer 2026', detail: 'Sent to 5,200 recipients', at: '2026-08-15 09:30' },
  { id: 'act4', userId: 'u2', userName: 'Neha Kulkarni', initials: 'NK', action: 'imported', module: 'contacts', item: 'Imported Aug', detail: '1,260 contacts imported', at: '2026-08-09 14:05' },
  { id: 'act5', userId: 'u2', userName: 'Neha Kulkarni', initials: 'NK', action: 'created', module: 'templates', item: 'Festival Offer', detail: 'Template created', at: '2026-08-10 10:40' },
  { id: 'act6', userId: 'u1', userName: 'Rohit Sharma', initials: 'RS', action: 'permissionChanged', module: 'users', item: 'Imran Shaikh', detail: 'Role set to HOD', before: 'Member', after: 'HOD', at: '2026-08-11 09:15' },
  { id: 'act7', userId: 'u3', userName: 'Imran Shaikh', initials: 'IS', action: 'connected', module: 'accounts', item: 'courses@gowebkart.com', detail: 'Email account connected', at: '2026-08-12 08:00' },
  { id: 'act8', userId: 'u3', userName: 'Imran Shaikh', initials: 'IS', action: 'sent', module: 'campaigns', item: 'Web Design Course — Batch 12', detail: 'Sent to 1,480 recipients', at: '2026-08-12 18:00' },
  { id: 'act9', userId: 'u2', userName: 'Neha Kulkarni', initials: 'NK', action: 'exported', module: 'reports', item: 'Campaign Report', detail: 'Downloaded as CSV', at: '2026-08-20 16:50' },
  { id: 'act10', userId: 'u1', userName: 'Rohit Sharma', initials: 'RS', action: 'updated', module: 'settings', item: 'Sending defaults', detail: 'Batch size changed', before: '100', after: '200', at: '2026-08-21 12:10' },
];

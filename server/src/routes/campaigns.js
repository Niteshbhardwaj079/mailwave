// ---------------------------------------------------------------------------
// Campaigns — banana, recipients jodna, bhejna, rokna, aur result dekhna.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { asyncHandler, badRequest, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { pauseCampaign, startCampaign } from '../services/sender.js';
import { runDueCampaigns } from '../services/scheduler.js';
import { sendMail } from '../services/mailer.js';
import { buildEmail } from '../services/render.js';

const router = Router();

const campaignInput = z.object({
  name: z.string().trim().min(1, 'Campaign ko naam do').max(150),
  accountId: z.string().trim().min(1, 'Kis account se bhejna hai, wo chuno'),
  senderName: z.string().trim().max(120).optional().nullable(),
  replyTo: z.string().trim().email('Reply-to me sahi email daalo').optional().nullable(),
  subject: z.string().trim().max(300).default(''),
  preheader: z.string().trim().max(300).optional().nullable(),
  templateId: z.string().trim().optional().nullable(),
  html: z.string().max(500_000).default(''),
  batchSize: z.number().int().min(0).max(10000).default(100),
  batchDelay: z.number().int().min(0).max(180).default(2),
  openTracking: z.boolean().default(true),
  clickTracking: z.boolean().default(false),
  subscribeButton: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional().nullable(),
});

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    accountId: row.account_id,
    sender: row.account_email ?? null,
    senderName: row.sender_name,
    replyTo: row.reply_to,
    subject: row.subject,
    preheader: row.preheader,
    templateId: row.template_id,
    template: row.template_name ?? null,
    html: row.html,
    batchSize: row.batch_size,
    batchDelay: row.batch_delay,
    openTracking: row.open_tracking,
    clickTracking: row.click_tracking,
    subscribeButton: row.subscribe_button,
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    // Screen par dikhane wali ek date: bheji ja chuki hai to bhejne ki,
    // schedule hai to schedule ki, warna banne ki.
    date: row.finished_at ?? row.started_at ?? row.scheduled_at ?? row.created_at,
    // Ye numbers list screen par dikhte hain.
    recipients: row.recipients ?? 0,
    sent: row.sent ?? 0,
    failed: row.failed ?? 0,
    opened: row.opened ?? 0,
    clicked: row.clicked ?? 0,
    delivered: row.delivered ?? 0,
    bounced: row.bounced ?? 0,
    unsubscribed: row.unsubscribed ?? 0,
  };
}

// Har campaign ke saath uske counts bhi le aate hain, taki frontend ko har row
// ke liye alag request na karni pade.
const SELECT = `
  SELECT c.*, a.email AS account_email, t.name AS template_name,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS recipients,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Failed') AS failed,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.open_count > 0) AS opened,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.click_count > 0) AS clicked,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status IN ('Sent','Delivered')) AS delivered,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Bounced') AS bounced,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.unsubscribed) AS unsubscribed
    FROM campaigns c
    LEFT JOIN email_accounts a ON a.id = c.account_id
    LEFT JOIN templates t ON t.id = c.template_id
`;

// --- list -------------------------------------------------------------------
router.get(
  '/',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? '').trim();
    const search = String(req.query.search ?? '').trim();

    const where = [];
    const params = [];

    if (status && status !== 'all' && status !== 'All') {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }

    if (search) {
      // Campaign ke naam se bhi, aur jis account se bheja gaya us email se bhi.
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(c.name) LIKE $${params.length} OR lower(a.email) LIKE $${params.length})`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Sort ka naam kabhi seedha SQL me nahi jodte — sirf inhi teen me se ek
    // chunte hain. Warna koi bhi apni marzi ka SQL yahan ghusa sakta hai.
    const ORDER = {
      date: 'c.created_at DESC',
      name: 'c.name ASC',
      recipients: 'recipients DESC',
    };
    const order = ORDER[String(req.query.sort ?? 'date')] ?? ORDER.date;

    const totalRow = await one(
      `SELECT count(*)::int AS n FROM campaigns c
         LEFT JOIN email_accounts a ON a.id = c.account_id ${clause}`,
      params
    );

    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `${SELECT} ${clause} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Filter ke dropdown me har status ke aage ginti dikhti hai. Yeh ginti
    // POORI list ki hoti hai, sirf is page ki nahi — warna filter chunte hi
    // number badalta rehta aur bharosa nahi rehta.
    const statusRows = await many(
      'SELECT status, count(*)::int AS n FROM campaigns GROUP BY status'
    );
    const counts = statusRows.reduce((acc, row) => ({ ...acc, [row.status]: row.n }), {});
    const allRow = await one('SELECT count(*)::int AS n FROM campaigns');

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      campaigns: rows.map(toApi),
      counts: { All: allRow?.n ?? 0, ...counts },
    });
  })
);

/**
 * "Kitne logon tak jayega" — campaign banane se PEHLE.
 *
 * Wizard me yeh number dikhta hai. Bahut zaroori hai ki yeh wahi ho jo asli
 * me judega, isliye bilkul wahi shart lagti hai jo recipients jodte waqt
 * lagti hai — suppression wale yahan bhi chhoot jate hain.
 *
 * Yeh route `/:id/...` se PEHLE likha hai, warna Express "recipient-count" ko
 * campaign ki id samajh leta.
 */
router.get(
  '/recipient-count',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const source = String(req.query.source ?? 'all');
    const groupId = String(req.query.groupId ?? '');

    if (source === 'subscribers') {
      const row = await one(`
        SELECT count(*)::int AS n
          FROM subscribers sb
     LEFT JOIN suppression s ON lower(s.email) = lower(sb.email)
         WHERE sb.status = 'Subscribed' AND s.email IS NULL
      `);
      res.json({ count: row?.n ?? 0 });
      return;
    }

    const params = [];
    let where = `WHERE c.status = 'Subscribed' AND s.email IS NULL`;

    if (source === 'group') {
      if (!groupId) {
        res.json({ count: 0 });
        return;
      }
      params.push(groupId);
      where += ` AND c.group_id = $1`;
    }

    const row = await one(
      `SELECT count(*)::int AS n
         FROM contacts c
    LEFT JOIN suppression s ON lower(s.email) = lower(c.email)
        ${where}`,
      params
    );

    res.json({ count: row?.n ?? 0 });
  })
);

// --- ek campaign ------------------------------------------------------------
router.get(
  '/:id',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    if (!row) throw notFound('Yeh campaign nahi mila');
    res.json({ campaign: toApi(row) });
  })
);

// --- recipients ki list (analytics screen ke liye) --------------------------
router.get(
  '/:id/recipients',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    // Ek campaign me lakhon log ho sakte hain, isliye yahan pagination sabse
    // zyada zaroori hai. Status se filter bhi kar sakte ho (?status=Failed).
    const status = String(req.query.status ?? '').trim();
    const params = [req.params.id];
    let clause = 'WHERE campaign_id = $1';

    if (status && status !== 'all') {
      params.push(status);
      clause += ` AND status = $${params.length}`;
    }

    const totalRow = await one(
      `SELECT count(*)::int AS n FROM campaign_recipients ${clause}`,
      params
    );
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `SELECT id, email, name, status, error, sent_at, open_count, first_open_at,
              last_open_at, click_count, last_click_at, unsubscribed
         FROM campaign_recipients
        ${clause}
        ORDER BY sent_at DESC NULLS LAST, email
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const items = rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      status: r.status,
      error: r.error,
      sentAt: r.sent_at,
      openCount: r.open_count,
      firstOpen: r.first_open_at,
      lastOpen: r.last_open_at,
      clickCount: r.click_count,
      lastClick: r.last_click_at,
      unsubscribed: r.unsubscribed,
      // Screen ko haan/na chahiye, ginti nahi — isliye yahin bana kar bhej
      // dete hain. Warna har screen apne hisaab se nikalti aur kahin galti
      // ho jati.
      sent: Boolean(r.sent_at),
      opened: r.open_count > 0,
      clicked: r.click_count > 0,
      lastActivity: r.last_click_at ?? r.last_open_at ?? r.sent_at,
    }));

    res.json({ ...paginated(items, { page, limit }, totalRow?.n ?? 0), recipients: items });
  })
);

// --- banao ------------------------------------------------------------------
router.post(
  '/',
  requireModule('campaigns', 'create'),
  validate(campaignInput),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = newId('cmp');

    await query(
      `INSERT INTO campaigns
         (id, name, account_id, sender_name, reply_to, subject, preheader, template_id, html,
          batch_size, batch_delay, open_tracking, click_tracking, subscribe_button,
          status, scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, b.name, b.accountId, b.senderName ?? null, b.replyTo ?? null, b.subject,
       b.preheader ?? null, b.templateId || null, b.html, b.batchSize, b.batchDelay,
       b.openTracking, b.clickTracking, b.subscribeButton,
       b.scheduledAt ? 'Scheduled' : 'Draft', b.scheduledAt ?? null, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'campaigns',
      item: b.name,
      detail: 'Naya campaign bana',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [id]);
    res.status(201).json({ campaign: toApi(row) });
  })
);

// --- badlo (sirf Draft) -------------------------------------------------------
// Bheji ja chuki campaign ka matter badalna galat hai — log ne jo email
// paayi wo waisi hi rehni chahiye. Isliye sirf Draft yahan se badal sakti hai;
// Scheduled/Sending/Sent ke apne alag raaste hain (schedule, pause).
router.put(
  '/:id',
  requireModule('campaigns', 'edit'),
  validate(campaignInput),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh campaign nahi mila');
    if (existing.status !== 'Draft') {
      throw badRequest('Sirf Draft campaign ko edit kar sakte ho.');
    }

    const b = req.body;

    await query(
      `UPDATE campaigns
          SET name = $1, account_id = $2, sender_name = $3, reply_to = $4, subject = $5,
              preheader = $6, template_id = $7, html = $8, batch_size = $9, batch_delay = $10,
              open_tracking = $11, click_tracking = $12, subscribe_button = $13,
              status = $14, scheduled_at = $15, updated_at = now()
        WHERE id = $16`,
      [b.name, b.accountId, b.senderName ?? null, b.replyTo ?? null, b.subject,
       b.preheader ?? null, b.templateId || null, b.html, b.batchSize, b.batchDelay,
       b.openTracking, b.clickTracking, b.subscribeButton,
       b.scheduledAt ? 'Scheduled' : 'Draft', b.scheduledAt ?? null, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: b.name,
      detail: 'Draft campaign badla gaya',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json({ campaign: toApi(row) });
  })
);

// --- recipients jodo --------------------------------------------------------
// Teen tarike: seedhi list, ek group, ya subscribers.
router.post(
  '/:id/recipients',
  requireModule('campaigns', 'edit'),
  validate(z.object({
    source: z.enum(['list', 'group', 'subscribers', 'all']).default('list'),
    groupId: z.string().trim().optional(),
    people: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional().nullable(),
      data: z.record(z.any()).optional(),
    })).optional(),
  })),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');
    if (campaign.status === 'Sending') throw badRequest('Campaign chal raha hai — abhi log nahi jod sakte');

    const { source, groupId, people } = req.body;
    let rows = [];

    if (source === 'list') {
      rows = (people ?? []).map((p) => ({ email: p.email, name: p.name ?? null, data: p.data ?? {} }));
    } else {
      // Database se contacts uthao. Suppression wale apne aap chhoot jate hain.
      const params = [];
      let where = `WHERE c.status = 'Subscribed' AND s.email IS NULL`;

      if (source === 'group') {
        if (!groupId) throw badRequest('Kaun sa group, wo batao');
        params.push(groupId);
        where += ` AND c.group_id = $1`;
      }

      const contacts = await many(
        `SELECT c.id, c.email, c.name, c.company, c.city, c.phone
           FROM contacts c
      LEFT JOIN suppression s ON lower(s.email) = lower(c.email)
           ${where}`,
        params
      );

      rows = contacts.map((c) => ({
        email: c.email,
        name: c.name,
        contactId: c.id,
        data: { company: c.company, city: c.city, phone: c.phone },
      }));
    }

    if (source === 'subscribers') {
      const subs = await many(
        `SELECT sb.email, sb.name, sb.company, sb.city
           FROM subscribers sb
      LEFT JOIN suppression s ON lower(s.email) = lower(sb.email)
          WHERE sb.status = 'Subscribed' AND s.email IS NULL`
      );
      rows = subs.map((s) => ({ email: s.email, name: s.name, data: { company: s.company, city: s.city } }));
    }

    let added = 0;
    for (const row of rows) {
      // ON CONFLICT: ek hi address do baar nahi judega.
      const result = await query(
        `INSERT INTO campaign_recipients (id, campaign_id, contact_id, email, name, merge_data)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (campaign_id, lower(email)) DO NOTHING`,
        [newId('rcp'), campaign.id, row.contactId ?? null, row.email, row.name ?? null, JSON.stringify(row.data ?? {})]
      );
      if (result.affectedRows ?? result.rowCount) added += 1;
    }

    const total = await one(
      'SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1',
      [campaign.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: `${added} log campaign me jode gaye`,
    });

    res.json({ added, total: total?.n ?? 0 });
  })
);

// --- test email (khud ko bhej kar dekho) ------------------------------------
router.post(
  '/:id/test',
  requireModule('campaigns', 'send'),
  validate(z.object({ to: z.string().trim().email('Sahi email daalo') })),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');

    const account = await one('SELECT * FROM email_accounts WHERE id = $1', [campaign.account_id]);
    if (!account) throw badRequest('Is campaign ka koi email account nahi chuna gaya');

    // Test ke liye ek nakli recipient — database me kuch nahi likhte.
    const fake = {
      id: 'test',
      email: req.body.to,
      name: req.user.name,
      merge_data: { company: 'Test Company', city: 'Test City' },
    };

    const message = buildEmail({
      campaign,
      recipient: fake,
      links: new Map(),
      company: account.display_name || '',
      unsubscribeText: 'Unsubscribe',
    });

    const result = await sendMail(account, {
      to: req.body.to,
      fromName: campaign.sender_name,
      replyTo: campaign.reply_to,
      subject: `[TEST] ${message.subject}`,
      html: message.html,
      text: message.text,
    });

    await logActivity(req, {
      action: 'sent',
      module: 'campaigns',
      item: campaign.name,
      detail: `Test email ${req.body.to} par bheja`,
    });

    res.json({ ok: true, messageId: result.messageId, previewUrl: result.previewUrl });
  })
);

// --- bhejo ------------------------------------------------------------------
router.post(
  '/:id/send',
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');

    const count = await one(
      `SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1 AND status = 'Pending'`,
      [campaign.id]
    );
    if ((count?.n ?? 0) === 0) throw badRequest('Bhejne ke liye koi bacha hi nahi — pehle log jodo');

    const result = await startCampaign(campaign.id, { company: env.brand.company });
    if (!result.started) {
      const reasons = {
        already_running: 'Yeh campaign pehle se chal raha hai',
        no_account: 'Is campaign ka email account nahi mila',
        not_found: 'Yeh campaign nahi mila',
      };
      throw badRequest(reasons[result.reason] ?? 'Campaign chalu nahi ho paya');
    }

    await logActivity(req, {
      action: 'sent',
      module: 'campaigns',
      item: campaign.name,
      detail: `Bhejna shuru — ${count.n} log`,
    });

    res.json({ ok: true, queued: count.n });
  })
);

// --- roko -------------------------------------------------------------------
router.post(
  '/:id/pause',
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');

    await pauseCampaign(campaign.id);
    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: 'Campaign rok diya gaya',
    });

    res.json({ ok: true });
  })
);

// --- ek campaign ka din-ba-din graph ----------------------------------------
/**
 * Campaign bhejne ke baad kab-kab log khol rahe hain.
 *
 * Aam taur par aadha kaam pehle hi din ho jata hai aur phir dheere-dheere
 * kam hota jata hai. Yeh graph wahi dikhata hai — asli tracking events se,
 * kisi andaze se nahi.
 */
router.get(
  '/:id/trend',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, started_at, created_at FROM campaigns WHERE id = $1', [
      req.params.id,
    ]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');

    // Graph campaign shuru hone ke din se 7 din tak.
    const rows = await many(
      `WITH span AS (
         SELECT generate_series($2::date, $2::date + 6, '1 day')::date AS day
       )
       SELECT span.day,
              (SELECT count(*)::int FROM campaign_recipients r
                WHERE r.campaign_id = $1 AND r.sent_at::date = span.day) AS sent,
              (SELECT count(DISTINCT e.recipient_id)::int FROM tracking_events e
                WHERE e.campaign_id = $1 AND e.kind = 'open' AND e.at::date = span.day) AS opened,
              (SELECT count(DISTINCT e.recipient_id)::int FROM tracking_events e
                WHERE e.campaign_id = $1 AND e.kind = 'click' AND e.at::date = span.day) AS clicked
         FROM span
        ORDER BY span.day`,
      [campaign.id, campaign.started_at ?? campaign.created_at]
    );

    res.json({
      trend: rows.map((row) => ({
        date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
      })),
    });
  })
);

// --- kaun se link par sabse zyada click hue ---------------------------------
router.get(
  '/:id/links',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT id, url, label, click_count
         FROM campaign_links
        WHERE campaign_id = $1 AND click_count > 0
        ORDER BY click_count DESC`,
      [req.params.id]
    );

    res.json({
      links: rows.map((row) => ({
        id: row.id,
        name: row.label || row.url,
        url: row.url,
        clicks: row.click_count,
      })),
    });
  })
);

// --- ek aadmi ke saath kya-kya hua ------------------------------------------
/**
 * Ek recipient ka poora hisaab: kab bheja, kab khola, kab click kiya.
 *
 * Yeh sabse kaam ki cheez tab hoti hai jab koi kahe "mujhe mail mila hi
 * nahi" — yahan se saaf pata chal jata hai ki kya hua tha.
 */
router.get(
  '/:id/recipients/:recipientId/events',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const recipient = await one(
      'SELECT id, email, status, error, sent_at FROM campaign_recipients WHERE id = $1 AND campaign_id = $2',
      [req.params.recipientId, req.params.id]
    );
    if (!recipient) throw notFound('Yeh recipient nahi mila');

    const rows = await many(
      `SELECT e.kind, e.at, e.user_agent, l.url
         FROM tracking_events e
         LEFT JOIN campaign_links l ON l.id = e.link_id
        WHERE e.recipient_id = $1
        ORDER BY e.at`,
      [recipient.id]
    );

    // Bhejne wali entry tracking_events me nahi hoti (wo track karne se pehle
    // hoti hai), isliye use yahan sabse upar jod dete hain.
    const events = [];

    if (recipient.sent_at) {
      events.push({ kind: 'sent', at: recipient.sent_at, detail: null });
    }

    if (recipient.error) {
      events.push({ kind: 'failed', at: recipient.sent_at, detail: recipient.error });
    }

    for (const row of rows) {
      events.push({ kind: row.kind, at: row.at, detail: row.url ?? row.user_agent ?? null });
    }

    res.json({ recipient, events });
  })
);

// --- "abhi dekho" ------------------------------------------------------------
/**
 * Schedule ki hui campaigns ko abhi check karta hai, agle minute ka intezaar
 * kiye bina.
 *
 * Do jagah kaam aata hai:
 *   - Testing me, taki 60 second na rukna pade.
 *   - Kabhi shaq ho ki "time to nikal gaya, gayi kyun nahi" — to ek dabane se
 *     turant pata chal jata hai.
 *
 * Ye kuch naya nahi karta — wahi kaam hai jo har minute apne aap hota hai.
 */
router.post(
  '/scheduler/run',
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const started = await runDueCampaigns();
    res.json({ ok: true, started: started.length, ids: started });
  })
);

// --- schedule badlo ya hatao ------------------------------------------------
/**
 * Campaign ka time set karta hai, badalta hai, ya schedule hata deta hai.
 *
 * `at` khali bhejo to schedule hat jata hai aur campaign wapas Draft ho jati
 * hai — yani "abhi mat bhejo".
 *
 * Chalti hui campaign ka time nahi badla ja sakta: email ja hi chuke hain,
 * unhe wapas nahi bulaya ja sakta.
 */
router.post(
  '/:id/schedule',
  requireModule('campaigns', 'send'),
  validate(
    z.object({
      at: z.string().datetime('Sahi tareekh aur time chuno').nullable().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');

    if (campaign.status === 'Sending') {
      throw badRequest('Yeh campaign abhi ja rahi hai — ab time nahi badla ja sakta');
    }
    if (campaign.status === 'Sent') {
      throw badRequest('Yeh campaign ja chuki hai');
    }

    const at = req.body.at ?? null;

    // Beeta hua time chunna kisi kaam ka nahi — wo turant chal padegi aur user
    // ko lagega ki uska chuna hua time maana hi nahi gaya.
    if (at && new Date(at) <= new Date()) {
      throw badRequest('Yeh time nikal chuka hai. Aage ka koi time chuno.');
    }

    await query(
      `UPDATE campaigns
          SET scheduled_at = $1, status = $2, updated_at = now()
        WHERE id = $3`,
      [at, at ? 'Scheduled' : 'Draft', campaign.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: at ? `Bhejne ka time set: ${new Date(at).toUTCString()}` : 'Schedule hata diya',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [campaign.id]);
    res.json({ campaign: toApi(row) });
  })
);

// --- recipients par ek saath kaam -------------------------------------------
/**
 * Campaign ke report par chune hue logon par ek saath kaam.
 *
 * Chaar kaam hote hain:
 *   resend   — jinke paas nahi pahuncha, unhe dobara bhejo
 *   remove   — is campaign se hata do
 *   suppress — inhe aage kabhi mail mat bhejo
 *   export   — sirf download hua, kuch badla nahi (bas log rakhte hain)
 *
 * Ek saath isliye ki report par checkbox se 200 log chune ja sakte hain. Ek-ek
 * karke bhejte to 200 request jatin aur screen atak jati.
 */
router.post(
  '/recipients/bulk',
  requireModule('campaigns', 'edit'),
  validate(
    z.object({
      kind: z.enum(['resend', 'remove', 'suppress', 'export']),
      ids: z.array(z.string()).min(1, 'Kam se kam ek chuno').max(2000),
      campaignName: z.string().trim().max(150).default(''),
    })
  ),
  asyncHandler(async (req, res) => {
    const { kind, ids, campaignName } = req.body;

    const rows = await many(
      'SELECT id, email, campaign_id FROM campaign_recipients WHERE id = ANY($1)',
      [ids]
    );
    if (rows.length === 0) throw badRequest('Inme se koi recipient nahi mila');

    if (kind === 'resend') {
      // 'Pending' kar dene se sender inhe agli baar wapas utha lega.
      await query(
        `UPDATE campaign_recipients
            SET status = 'Pending', error = NULL, sent_at = NULL
          WHERE id = ANY($1)`,
        [ids]
      );
    }

    if (kind === 'remove') {
      await query('DELETE FROM campaign_recipients WHERE id = ANY($1)', [ids]);
    }

    if (kind === 'suppress') {
      // Suppression list ka matlab: in par aage koi bhi campaign nahi jayega.
      for (const row of rows) {
        await query(
          `INSERT INTO suppression (email, reason, detail) VALUES ($1,'manual',$2)
           ON CONFLICT (email) DO NOTHING`,
          [row.email, `Campaign report se haath se joda gaya: ${campaignName}`]
        );
      }
    }

    const detail = {
      resend: 'Dobara bhejne ke liye lagaya',
      remove: 'Is campaign se hataye gaye',
      suppress: 'Suppression list me daale gaye',
      export: 'Download kiye gaye',
    }[kind];

    await logActivity(req, {
      action: kind === 'export' ? 'exported' : kind === 'remove' ? 'deleted' : 'updated',
      module: 'campaigns',
      item: campaignName || rows[0]?.campaign_id || '—',
      detail: `${detail} (${rows.length})`,
    });

    res.json({ ok: true, affected: rows.length });
  })
);

// --- hatao ------------------------------------------------------------------
router.delete(
  '/:id',
  requireModule('campaigns', 'delete'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('Yeh campaign nahi mila');
    if (campaign.status === 'Sending') throw badRequest('Chalte hue campaign ko hata nahi sakte — pehle roko');

    await query('DELETE FROM campaigns WHERE id = $1', [campaign.id]);
    await logActivity(req, {
      action: 'deleted',
      module: 'campaigns',
      item: campaign.name,
      detail: 'Campaign hata diya gaya',
    });

    res.json({ ok: true });
  })
);

export default router;

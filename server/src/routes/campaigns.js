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
    // Ye numbers list screen par dikhte hain.
    recipients: row.recipients ?? 0,
    sent: row.sent ?? 0,
    failed: row.failed ?? 0,
    opened: row.opened ?? 0,
    clicked: row.clicked ?? 0,
  };
}

// Har campaign ke saath uske counts bhi le aate hain, taki frontend ko har row
// ke liye alag request na karni pade.
const SELECT = `
  SELECT c.*, a.email AS account_email,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS recipients,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Failed') AS failed,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.open_count > 0) AS opened,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.click_count > 0) AS clicked
    FROM campaigns c
    LEFT JOIN email_accounts a ON a.id = c.account_id
`;

// --- list -------------------------------------------------------------------
router.get(
  '/',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status ?? '').trim();
    const params = [];
    let clause = '';

    if (status && status !== 'all') {
      params.push(status);
      clause = `WHERE c.status = $1`;
    }

    const totalRow = await one(`SELECT count(*)::int AS n FROM campaigns c ${clause}`, params);
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `${SELECT} ${clause} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      ...paginated(rows.map(toApi), { page, limit }, totalRow?.n ?? 0),
      campaigns: rows.map(toApi),
    });
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
      if (result.affectedRows) added += 1;
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

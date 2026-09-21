// ---------------------------------------------------------------------------
// Campaigns — banana, recipients jodna, bhejna, rokna, aur result dekhna.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';

import { many, one, query } from '../db/client.js';
import { env } from '../env.js';
import { asyncHandler, badRequest, forbidden, notFound, paginated, pagination } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireAccountAccess, requireModule, roleCanUseAccount } from '../middleware/permissions.js';
import { campaignActionLimiter } from '../middleware/actionLimiter.js';
import { pauseCampaign, startCampaign } from '../services/sender.js';
import {
  computeWinner,
  decideWinner,
  sendWinnerToRemainder,
  startTest,
  variantsWithStats,
} from '../services/abTesting.js';
import { runDueCampaigns } from '../services/scheduler.js';
import { reqLanguage, stFor } from '../lib/serverI18n.js';
import { sendMail } from '../services/mailer.js';
import { buildEmail } from '../services/render.js';
import { LANGUAGE_CODES, DEFAULT_LANGUAGE } from '../lib/languages.js';
import { providerPreset } from '../services/providers.js';
import { buildCampaignReportWorkbook, reportFileName } from '../services/campaignReport.js';

const router = Router();

/**
 * "All Contacts" recipient source — filter se (shehar, tag, group, search)
 * chuno, aur chaho to jinhe pehle kabhi email ja chuki hai unhe apne aap
 * chhod do. Ek hi jagah se banaya hai taki count-preview aur asli add,
 * dono EK JAISA result dein — warna wizard me jo number dikhta wo asli me
 * judne wali ginti se alag ho sakta tha.
 */
function buildContactFilterWhere(filter = {}, excludeCampaignId = null) {
  const where = [`c.status = 'Subscribed'`, `s.email IS NULL`];
  const params = [];

  const search = String(filter.search ?? '').trim();
  const city = String(filter.city ?? '').trim();
  const tag = String(filter.tag ?? '').trim();
  const groupId = String(filter.groupId ?? '').trim();

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(c.name) LIKE $${params.length}
              OR lower(c.email) LIKE $${params.length}
              OR lower(c.company) LIKE $${params.length})`);
  }

  if (city) {
    params.push(city);
    where.push(`c.city = $${params.length}`);
  }

  if (tag) {
    params.push(tag);
    where.push(`$${params.length} = ANY(c.tags)`);
  }

  if (groupId) {
    params.push(groupId);
    where.push(`c.group_id = $${params.length}`);
  }

  // "Jo pehle kabhi email ja chuki hai, dubara mat dikhao" — kisi bhi campaign
  // me agar successfully bheja ja chuka hai, to yahan se hata dete hain.
  if (filter.excludeAlreadyEmailed) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM campaign_recipients r
       WHERE lower(r.email) = lower(c.email) AND r.status = 'Sent'
    )`);
  }

  // Isi campaign me pehle se joda hua ho to dubara mat gino — warna "kitne
  // jayenge" ka number jhootha lagega (asal me to wo already jud chuka hai).
  if (excludeCampaignId) {
    params.push(excludeCampaignId);
    where.push(`NOT EXISTS (
      SELECT 1 FROM campaign_recipients r2
       WHERE r2.campaign_id = $${params.length} AND lower(r2.email) = lower(c.email)
    )`);
  }

  return { clause: `WHERE ${where.join(' AND ')}`, params };
}

const campaignInput = z.object({
  name: z.string().trim().min(1, 'Give this campaign a name').max(150),
  accountId: z.string().trim().min(1, 'Choose which account to send from'),
  senderName: z.string().trim().max(120).optional().nullable(),
  replyTo: z.string().trim().email('Enter a valid reply-to email address').optional().nullable(),
  subject: z.string().trim().max(300).default(''),
  preheader: z.string().trim().max(300).optional().nullable(),
  templateId: z.string().trim().optional().nullable(),
  html: z.string().max(500_000).default(''),
  // Content-selection step par chuni gayi template se aata hai — sirf record/
  // badge ke liye, sending "html" already-frozen use karti hai.
  language: z.enum(LANGUAGE_CODES).default(DEFAULT_LANGUAGE),
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
    senderProvider: row.account_provider ? providerPreset(row.account_provider).name : null,
    senderName: row.sender_name,
    replyTo: row.reply_to,
    subject: row.subject,
    preheader: row.preheader,
    templateId: row.template_id,
    template: row.template_name ?? null,
    html: row.html,
    language: row.language,
    batchSize: row.batch_size,
    batchDelay: row.batch_delay,
    openTracking: row.open_tracking,
    clickTracking: row.click_tracking,
    subscribeButton: row.subscribe_button,
    status: row.status,
    pauseReason: row.pause_reason,
    autoRetried: row.auto_retried,
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
    pending: row.pending ?? 0,
    failed: row.failed ?? 0,
    opened: row.opened ?? 0,
    clicked: row.clicked ?? 0,
    bounced: row.bounced ?? 0,
    unsubscribed: row.unsubscribed ?? 0,
    ab: {
      enabled: row.ab_enabled ?? false,
      testType: row.ab_test_type,
      testPercent: row.ab_test_percent,
      winnerMetric: row.ab_winner_metric,
      durationMinutes: row.ab_test_duration_minutes,
      autoWinner: row.ab_auto_winner,
      autoSendWinner: row.ab_auto_send_winner,
      confidenceThreshold: row.ab_confidence_threshold,
      testStartedAt: row.ab_test_started_at,
      testEndsAt: row.ab_test_ends_at,
      winnerVariantId: row.ab_winner_variant_id,
      winnerDecidedAt: row.ab_winner_decided_at,
      winnerDecidedBy: row.ab_winner_decided_by,
      winnerReason: row.ab_winner_reason,
    },
  };
}

// Har campaign ke saath uske counts bhi le aate hain, taki frontend ko har row
// ke liye alag request na karni pade.
const SELECT = `
  SELECT c.*, a.email AS account_email, a.provider AS account_provider, t.name AS template_name,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS recipients,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent,
         -- 'Pending' yahan sirf wahi ginta hai jo SACH me abhi bhejne ka
         -- intezaar kar rahe hain. Jo IS CAMPAIGN KE ACCOUNT ke liye
         -- suppression list me hain (usi account se pehle unsubscribe, ya
         -- "Apply globally" wala '' record) unhe kabhi bheja hi nahi jayega
         -- — unhe neeche 'unsubscribed' me gina jata hai, warna "Pending"
         -- hamesha ke liye ek jhoothi ginti dikhata rehta.
         -- NOT EXISTS/EXISTS istemal karte hain, LEFT JOIN nahi — ek email
         -- ke liye ab EK se zyada suppression row ho sakti hai (account-
         -- specific + global dono saath), aur JOIN se ginti galti se
         -- doubled ho jaati.
         (SELECT count(*)::int FROM campaign_recipients r
           WHERE r.campaign_id = c.id AND r.status = 'Pending'
             AND NOT EXISTS (
                   SELECT 1 FROM suppression s
                    WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
                 )) AS pending,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Failed') AS failed,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.open_count > 0) AS opened,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.click_count > 0) AS clicked,
         (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Bounced') AS bounced,
         (SELECT count(*)::int FROM campaign_recipients r
           WHERE r.campaign_id = c.id
             AND (r.unsubscribed OR (r.status = 'Pending' AND EXISTS (
                   SELECT 1 FROM suppression s
                    WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
                 )))) AS unsubscribed
    FROM campaigns c
    LEFT JOIN email_accounts a ON a.id = c.account_id
    LEFT JOIN templates t ON t.id = c.template_id
`;

/**
 * List aur "Select all" (neeche /ids) dono ka filter ek hi jagah — taaki jo
 * rows screen par filter se dikhti hain, "Select all" bilkul wahi chune.
 */
function buildCampaignListFilter(queryParams) {
  const status = String(queryParams.status ?? '').trim();
  const search = String(queryParams.search ?? '').trim();

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

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// --- list -------------------------------------------------------------------
router.get(
  '/',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const { clause, params } = buildCampaignListFilter(req.query);

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
 * Filter se match hone wali SAARI campaigns ke sirf id — "Select all" ke liye.
 * Screen par sirf ek page dikhta hai, isliye baaki pages ke id browser ke
 * paas nahi hote (bilkul contacts ke /ids jaisa). `/:id` se PEHLE likha hai.
 */
const MAX_SELECT_ALL = 5_000;

router.get(
  '/ids',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const { clause, params } = buildCampaignListFilter(req.query);

    const rows = await many(
      `SELECT c.id FROM campaigns c
         LEFT JOIN email_accounts a ON a.id = c.account_id
         ${clause}
        ORDER BY c.created_at DESC
        LIMIT $${params.length + 1}`,
      [...params, MAX_SELECT_ALL]
    );
    const totalRow = await one(
      `SELECT count(*)::int AS n FROM campaigns c
         LEFT JOIN email_accounts a ON a.id = c.account_id ${clause}`,
      params
    );
    const total = totalRow?.n ?? 0;

    res.json({ ids: rows.map((row) => row.id), total, capped: total > MAX_SELECT_ALL, max: MAX_SELECT_ALL });
  })
);

/**
 * Ek saath kai campaigns hatao (list ke tick-box wala bulk action).
 *
 * Ek-ek campaign ki tarah hi: chalti hui (Sending/Testing/Sending Winner)
 * campaign kabhi nahi hatti. Baaki hat jati hain, aur chalti hui ginti me
 * `skipped` ke roop me wapas aati hain — screen ko saaf bata sakein ki kitni
 * hati aur kitni nahi. Status ki jaanch DELETE ke andar hi hai (alag SELECT
 * nahi), taaki jaanch aur hatane ke beech koi campaign chalu ho jaye to bhi
 * wo nahi hatti.
 */
router.post(
  '/bulk-delete',
  requireModule('campaigns', 'delete'),
  validate(z.object({ ids: z.array(z.string()).min(1, 'Choose at least one campaign').max(MAX_SELECT_ALL) })),
  asyncHandler(async (req, res) => {
    const removed = await many(
      `DELETE FROM campaigns
        WHERE id = ANY($1)
          AND status NOT IN ('Sending', 'Testing', 'Sending Winner')
      RETURNING id`,
      [req.body.ids]
    );
    const deleted = removed.length;
    const skipped = req.body.ids.length - deleted;

    if (deleted > 0) {
      await logActivity(req, {
        action: 'deleted',
        module: 'campaigns',
        item: `${deleted} campaigns`,
        detail: 'Multiple campaigns deleted in bulk',
        detailKey: 'act.campaignsBulkDeleted',
        detailParams: { count: deleted },
      });
    }

    res.json({ ok: true, deleted, skipped });
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

    if (source === 'filter') {
      const filter = {
        search: req.query.search,
        city: req.query.city,
        tag: req.query.tag,
        groupId: req.query.filterGroupId,
        excludeAlreadyEmailed: req.query.excludeAlreadyEmailed === 'true',
      };
      const excludeCampaignId = req.query.excludeCampaignId ? String(req.query.excludeCampaignId) : null;
      const { clause, params: fParams } = buildContactFilterWhere(filter, excludeCampaignId);
      const row = await one(
        `SELECT count(*)::int AS n FROM contacts c LEFT JOIN suppression s ON lower(s.email) = lower(c.email) ${clause}`,
        fParams
      );
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
    if (!row) throw notFound('This campaign was not found');
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
    let plainClause = 'WHERE campaign_id = $1';
    let joinedClause = 'WHERE r.campaign_id = $1';

    if (status && status !== 'all') {
      params.push(status);
      plainClause += ` AND status = $${params.length}`;
      joinedClause += ` AND r.status = $${params.length}`;
    }

    const totalRow = await one(
      `SELECT count(*)::int AS n FROM campaign_recipients ${plainClause}`,
      params
    );
    const { page, limit, offset } = pagination(req, { defaultLimit: 50, maxLimit: 500 });

    const rows = await many(
      `SELECT r.id, r.email, r.name, r.status, r.error, r.sent_at, r.open_count, r.first_open_at,
              r.last_open_at, r.click_count, r.last_click_at, r.unsubscribed,
              r.send_count, r.last_attempted_at, sup.reason AS suppression_reason,
              sup.is_global AS suppression_is_global
         FROM campaign_recipients r
         JOIN campaigns c ON c.id = r.campaign_id
         -- Ek email ke liye ab EK se zyada suppression row ho sakti hai
         -- (account-specific + global dono saath) — LATERAL + LIMIT 1 se
         -- sirf ek hi (account-specific ko pehle) uthate hain, warna plain
         -- LEFT JOIN se yeh recipient row DO baar aa jaati.
         LEFT JOIN LATERAL (
           SELECT s.reason, (s.account_id = '') AS is_global
             FROM suppression s
            WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
            ORDER BY (s.account_id = c.account_id) DESC
            LIMIT 1
         ) sup ON true
        ${joinedClause}
        ORDER BY r.sent_at DESC NULLS LAST, r.email
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const items = rows.map((r) => ({
      id: r.id,
      email: r.email,
      // Kuch contacts bina naam ke import hue the — email hi dikha dete hain,
      // taaki screen par khaali jagah ya crash na ho.
      name: r.name || r.email,
      status: r.status,
      error: r.error,
      sentAt: r.sent_at,
      openCount: r.open_count,
      firstOpen: r.first_open_at,
      lastOpen: r.last_open_at,
      clickCount: r.click_count,
      lastClick: r.last_click_at,
      unsubscribed: r.unsubscribed,
      // Suppression list me hai kya — is CAMPAIGN KE ACCOUNT ke liye, chahe
      // unsubscribe isi campaign se na hui ho, usi account ki kisi PURANI
      // campaign ya manual block se ho sakti hai. `unsubscribed` (upar)
      // sirf ISI campaign ke link-click ko batata hai; yeh batata hai ki
      // asal me bheja hi nahi jayega, waja chahe kuch ho.
      suppressed: Boolean(r.suppression_reason),
      suppressionReason: r.suppression_reason,
      // true = "Apply globally" se ya purane (account-scope se pehle wale)
      // record se — har account par lagu. false = sirf isi account se.
      suppressionIsGlobal: Boolean(r.suppression_is_global),
      // Kitni baar bhejne ki koshish hui — pehla bhejna + har resend/retry.
      sendCount: r.send_count,
      lastAttemptAt: r.last_attempted_at,
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

// --- report (Excel, on-demand) -----------------------------------------------
/**
 * Poori campaign ka client-ready Excel report — button dabate hi taaza
 * generate hota hai, existing data se. Kahin database me save nahi hota.
 *
 * Ek temp file me likha jata hai (kabhi memory me poora HTTP response ke
 * saath nahi rehta), res.download() se bheja jata hai, aur bhejne ke turant
 * baad — chahe safal ho ya na ho — mita diya jata hai.
 */
router.get(
  '/:id/report',
  requireModule('campaigns', 'export'),
  asyncHandler(async (req, res) => {
    const built = await buildCampaignReportWorkbook(req.params.id);
    if (!built) throw notFound('This campaign was not found');

    const filename = reportFileName(built.campaignName);
    const tempPath = join(tmpdir(), `mw-report-${randomUUID()}.xlsx`);

    await writeFile(tempPath, built.buffer);

    res.download(tempPath, filename, async (error) => {
      // res.download khud hi headers/streaming sambhalta hai — hume sirf
      // temp file saaf karni hai, chahe download safal hua ho ya beech me
      // ruk gaya ho (jaise browser ne connection band kar diya).
      await unlink(tempPath).catch(() => {});
      if (error && !res.headersSent) {
        console.error('[campaigns] report download fail hui', error);
      }
    });

    await logActivity(req, {
      action: 'exported',
      module: 'campaigns',
      item: built.campaignName,
      detail: 'Campaign report downloaded',
      detailKey: 'act.reportDownloaded',
    });
  })
);

// --- banao ------------------------------------------------------------------
router.post(
  '/',
  campaignActionLimiter,
  requireModule('campaigns', 'create'),
  validate(campaignInput),
  requireAccountAccess((req) => req.body.accountId),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = newId('cmp');

    await query(
      `INSERT INTO campaigns
         (id, name, account_id, sender_name, reply_to, subject, preheader, template_id, html, language,
          batch_size, batch_delay, open_tracking, click_tracking, subscribe_button,
          status, scheduled_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, b.name, b.accountId, b.senderName ?? null, b.replyTo ?? null, b.subject,
       b.preheader ?? null, b.templateId || null, b.html, b.language, b.batchSize, b.batchDelay,
       b.openTracking, b.clickTracking, b.subscribeButton,
       b.scheduledAt ? 'Scheduled' : 'Draft', b.scheduledAt ?? null, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'campaigns',
      item: b.name,
      detail: 'New campaign created',
      detailKey: 'act.campaignCreated',
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
  requireAccountAccess((req) => req.body.accountId),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('This campaign was not found');
    if (existing.status !== 'Draft') {
      throw badRequest('Only a Draft campaign can be edited.');
    }

    const b = req.body;

    await query(
      `UPDATE campaigns
          SET name = $1, account_id = $2, sender_name = $3, reply_to = $4, subject = $5,
              preheader = $6, template_id = $7, html = $8, language = $9, batch_size = $10, batch_delay = $11,
              open_tracking = $12, click_tracking = $13, subscribe_button = $14,
              status = $15, scheduled_at = $16, updated_at = now()
        WHERE id = $17`,
      [b.name, b.accountId, b.senderName ?? null, b.replyTo ?? null, b.subject,
       b.preheader ?? null, b.templateId || null, b.html, b.language, b.batchSize, b.batchDelay,
       b.openTracking, b.clickTracking, b.subscribeButton,
       b.scheduledAt ? 'Scheduled' : 'Draft', b.scheduledAt ?? null, req.params.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: b.name,
      detail: 'Draft campaign updated',
      detailKey: 'act.draftUpdated',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json({ campaign: toApi(row) });
  })
);

/**
 * Seedhi list (type ki hui, ya segment se) aur subscribers me aksar sirf email
 * (aur kabhi naam) hota hai. Agar wahi address Contacts me pehle se hai, to
 * uska naam/company/phone/city yahin se bhar dete hain — warna email me
 * {{name}}, {{company}}, {{phone}}, {{city}} khaali chale jate.
 *
 * Jo value pehle se di hui hai (jaise type karte waqt naam likha) wo hamesha
 * jeetti hai; Contact sirf khaali jagah bharta hai.
 */
async function fillFromContacts(rows) {
  const emails = [...new Set(rows.map((row) => String(row.email).toLowerCase()))];
  if (emails.length === 0) return rows;

  const byEmail = new Map();
  const LOOKUP_CHUNK = 5000;
  for (let i = 0; i < emails.length; i += LOOKUP_CHUNK) {
    const found = await many(
      `SELECT lower(email) AS email_key, name, company, city, phone
         FROM contacts WHERE lower(email) = ANY($1)`,
      [emails.slice(i, i + LOOKUP_CHUNK)]
    );
    for (const contact of found) {
      if (!byEmail.has(contact.email_key)) byEmail.set(contact.email_key, contact);
    }
  }

  return rows.map((row) => {
    const contact = byEmail.get(String(row.email).toLowerCase());
    if (!contact) return row;

    const data = { ...(row.data ?? {}) };
    for (const key of ['company', 'city', 'phone']) {
      if (!data[key] && contact[key]) data[key] = contact[key];
    }
    return { ...row, name: row.name || contact.name || null, data };
  });
}

// --- recipients jodo --------------------------------------------------------
// Paanch tarike: seedhi list, ek group, subscribers, saare (all), ya
// "All Contacts" filter (shehar/tag/group/search + already-emailed hatao).
router.post(
  '/:id/recipients',
  campaignActionLimiter,
  requireModule('campaigns', 'edit'),
  validate(z.object({
    source: z.enum(['list', 'group', 'subscribers', 'all', 'filter']).default('list'),
    groupId: z.string().trim().optional(),
    filter: z.object({
      search: z.string().trim().optional(),
      city: z.string().trim().optional(),
      tag: z.string().trim().optional(),
      groupId: z.string().trim().optional(),
      excludeAlreadyEmailed: z.boolean().optional(),
      // Diya ho to "match karne wale sabse pehle N" hi jodo — na diya ho
      // (undefined) to jitne bhi match karein sab jodo, jaisa pehle hota tha.
      limit: z.number().int().positive().max(50_000).optional(),
    }).optional(),
    people: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional().nullable(),
      data: z.record(z.any()).optional(),
    })).optional(),
    // subscribers source: khaali/undefined ho to sab "Subscribed" log jate
    // hain; diya ho to sirf yeh chune hue.
    subscriberIds: z.array(z.string()).optional(),
  })),
  asyncHandler(async (req, res) => {
    const campaign = await one(
      'SELECT id, name, status, pause_reason, account_id, ab_enabled FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (!campaign) throw notFound('This campaign was not found');
    if (['Sending', 'Testing', 'Sending Winner'].includes(campaign.status)) {
      throw badRequest('The campaign is sending — recipients cannot be added right now');
    }

    // Naye log jodne se yeh campaign khud-ba-khud phir chalu ho sakti hai
    // (neeche dekho) — agar aisa hoga, to pehle hi check kar lete hain ki is
    // role ko iske account se bhejne ki ijazat hai, warna recipients jodkar
    // bhi asal me kisi restricted account se bhej dena galat hoga.
    //
    // A/B campaign kabhi is generic raaste se auto-start nahi hoti — usko
    // test-sample assign karne (services/abTesting.js ka startTest()) ka
    // apna alag route hai, yahan seedha 'Sending' me daalna variants ko
    // bypass kar deta.
    const manuallyPaused = campaign.status === 'Paused' && campaign.pause_reason === 'manual';
    const willAutoStart =
      !campaign.ab_enabled &&
      !manuallyPaused &&
      !['Draft', 'Scheduled', 'Sending', 'Testing', 'Winner Selected', 'Sending Winner'].includes(campaign.status);
    if (willAutoStart && !(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    const { source, groupId, filter, people, subscriberIds } = req.body;
    let rows = [];

    if (source === 'list') {
      rows = await fillFromContacts(
        (people ?? []).map((p) => ({ email: p.email, name: p.name ?? null, data: p.data ?? {} }))
      );
    } else if (source === 'subscribers') {
      // subscriberIds bheja hi nahi gaya (undefined) to sab "Subscribed" log
      // jate hain. Bheja gaya hai — chahe khaali array hi ho — to sirf wahi
      // log jate hain jo usme hain; khaali array ka matlab jaan-boojh kar
      // koi na chuna, isliye ANY(khaali array) sahi tarike se kisi se nahi
      // milta.
      const params = [];
      let where = `WHERE sb.status = 'Subscribed' AND s.email IS NULL`;
      if (subscriberIds !== undefined) {
        params.push(subscriberIds);
        where += ` AND sb.id = ANY($1)`;
      }
      const subs = await many(
        `SELECT sb.email, sb.name, sb.company, sb.city
           FROM subscribers sb
      LEFT JOIN suppression s ON lower(s.email) = lower(sb.email)
           ${where}`,
        params
      );
      // Subscribers ke paas phone hota hi nahi (aur company/city bhi khaali
      // ho sakte hain) — Contacts me wahi email ho to wahin se bhar do.
      rows = await fillFromContacts(
        subs.map((s) => ({ email: s.email, name: s.name, data: { company: s.company, city: s.city } }))
      );
    } else if (source === 'filter') {
      const { clause, params: fParams } = buildContactFilterWhere(filter ?? {}, campaign.id);
      // "Limit to N" — diya ho to sirf pehle N matching contacts jodo. LIMIT
      // yahin, SQL me lagate hain (poori list la kar JS me kaatne ki jagah),
      // taaki bade match count (jaise lakhon contacts) par bhi utna hi kaam
      // ho jitna asal me chahiye.
      const limitClause = filter?.limit ? ` LIMIT $${fParams.length + 1}` : '';
      const queryParams = filter?.limit ? [...fParams, filter.limit] : fParams;
      const contacts = await many(
        `SELECT c.id, c.email, c.name, c.company, c.city, c.phone
           FROM contacts c
      LEFT JOIN suppression s ON lower(s.email) = lower(c.email)
           ${clause}${limitClause}`,
        queryParams
      );
      rows = contacts.map((c) => ({
        email: c.email,
        name: c.name,
        contactId: c.id,
        data: { company: c.company, city: c.city, phone: c.phone },
      }));
    } else {
      // Database se contacts uthao. Suppression wale apne aap chhoot jate hain.
      const params = [];
      let where = `WHERE c.status = 'Subscribed' AND s.email IS NULL`;

      if (source === 'group') {
        if (!groupId) throw badRequest('Specify which group');
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

    // Ek hi call me bahut zyada log jodne se koi bhi request bahut bhaari ho
    // sakti hai (memory/DB load) — contacts.js ka MAX_SELECT_ALL jaisa hi cap,
    // taaki koi galti se (ya jaan-boojh kar) poore workspace ke lakhon
    // contacts ek jhatke me ek campaign se na jud jayein.
    const MAX_RECIPIENTS_PER_ADD = 50_000;
    if (rows.length > MAX_RECIPIENTS_PER_ADD) {
      throw badRequest(
        `Too many recipients at once (${rows.length}) — add up to ${MAX_RECIPIENTS_PER_ADD} at a time.`
      );
    }

    // Batched, not one INSERT per row — "All Contacts" can mean tens of
    // thousands of rows, and a round trip per row is by far the slowest part
    // of adding recipients at that size. Chunked so one campaign can't build
    // a single statement with an unbounded number of placeholders.
    const RECIPIENT_CHUNK = 500;
    let added = 0;
    for (let i = 0; i < rows.length; i += RECIPIENT_CHUNK) {
      const chunk = rows.slice(i, i + RECIPIENT_CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((row, index) => {
        const base = index * 6;
        values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
        params.push(newId('rcp'), campaign.id, row.contactId ?? null, row.email, row.name ?? null, JSON.stringify(row.data ?? {}));
      });

      // ON CONFLICT: ek hi address do baar nahi judega. RETURNING sirf unhi
      // rows ke liye aata hai jo sach me insert hui — conflict wali nahi, isliye
      // `added` seedha result.rows.length se milta hai, alag count ki zarurat nahi.
      const result = await query(
        `INSERT INTO campaign_recipients (id, campaign_id, contact_id, email, name, merge_data)
         VALUES ${values.join(',')}
         ON CONFLICT (campaign_id, lower(email)) DO NOTHING
         RETURNING id`,
        params
      );
      added += result.rows.length;
    }

    const total = await one(
      'SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1',
      [campaign.id]
    );

    // Campaign ka pehla safar khatam ho chuka tha (Sent/Failed, ya quota
    // khatam hone se Paused) aur ab naye log jode hain — unhe Pending chhod
    // kar baithe rehna galat hai, turant bhejna shuru kar dete hain.
    // Draft/Scheduled ko haath nahi lagate (apna waqt hai), aur jise insaan ne
    // KHUD roka tha (pause_reason 'manual') use bhi chhed nahi te — warna
    // unka jaan-boojh kar roka hua kaam apne aap phir chalu ho jayega.
    // (Account-access already checked above, before any of this ran.)
    if (added > 0 && willAutoStart) {
      await startCampaign(campaign.id, { company: env.brand.company });
    }

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: `${added} recipients added to the campaign`,
      detailKey: 'act.recipientsAdded',
      detailParams: { count: added },
    });

    res.json({ added, total: total?.n ?? 0 });
  })
);

// -----------------------------------------------------------------------------
// A/B testing — variant setup, live stats, winner decide/send.
//
// Sending ka poora kaam services/sender.js aur abTesting.js karte hain; yahan
// sirf HTTP validation, permission checks, aur Activity Log likhna hai —
// bilkul waisa hi jaisa campaign ke baaki routes karte hain.
// -----------------------------------------------------------------------------
function variantToApi(row) {
  return {
    id: row.id,
    label: row.label,
    subject: row.subject,
    senderName: row.sender_name,
    replyTo: row.reply_to,
    templateId: row.template_id,
    html: row.html,
    isWinner: row.is_winner,
  };
}

// --- A/B settings (enable/disable, test type, split %, winner rule) ---------
router.put(
  '/:id/ab',
  requireModule('campaigns', 'edit'),
  validate(
    z.object({
      enabled: z.boolean(),
      testType: z.enum(['subject', 'content', 'subject_content', 'sender_name', 'sender_email']).optional().nullable(),
      testPercent: z.number().int().min(1).max(100).default(20),
      winnerMetric: z.enum(['open_rate', 'click_rate', 'ctor']).default('open_rate'),
      durationMinutes: z.number().int().min(5).max(43_200).default(240),
      autoWinner: z.boolean().default(true),
      autoSendWinner: z.boolean().default(true),
      confidenceThreshold: z.number().int().min(50).max(99).default(95),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await one(
      'SELECT id, name, ab_test_started_at FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (!campaign) throw notFound('This campaign was not found');
    if (campaign.ab_test_started_at) {
      throw badRequest('This A/B test has already started — settings cannot be changed now');
    }
    if (req.body.enabled && !req.body.testType) throw badRequest('Choose what this test compares');

    await query(
      `UPDATE campaigns
          SET ab_enabled = $2, ab_test_type = $3, ab_test_percent = $4, ab_winner_metric = $5,
              ab_test_duration_minutes = $6, ab_auto_winner = $7, ab_auto_send_winner = $8,
              ab_confidence_threshold = $9, updated_at = now()
        WHERE id = $1`,
      [
        req.params.id,
        req.body.enabled,
        req.body.enabled ? req.body.testType : null,
        req.body.testPercent,
        req.body.winnerMetric,
        req.body.durationMinutes,
        req.body.autoWinner,
        req.body.autoSendWinner,
        req.body.confidenceThreshold,
      ]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: req.body.enabled ? 'A/B testing enabled' : 'A/B testing disabled',
      detailKey: req.body.enabled ? 'act.abEnabled' : 'act.abDisabled',
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [req.params.id]);
    res.json({ campaign: toApi(row) });
  })
);

// --- variants (2-4: A/B[/C/D]) ------------------------------------------------
router.put(
  '/:id/ab/variants',
  requireModule('campaigns', 'edit'),
  validate(
    z.object({
      variants: z
        .array(
          z.object({
            label: z.enum(['A', 'B', 'C', 'D']),
            subject: z.string().trim().max(300).optional().nullable(),
            senderName: z.string().trim().max(120).optional().nullable(),
            replyTo: z.string().trim().email('Enter a valid reply-to email address').optional().nullable(),
            templateId: z.string().trim().optional().nullable(),
            html: z.string().max(500_000).optional().nullable(),
          })
        )
        .min(2, 'At least 2 variants are needed')
        .max(4, 'Up to 4 variants are supported'),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await one(
      'SELECT id, name, ab_test_started_at FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (!campaign) throw notFound('This campaign was not found');
    if (campaign.ab_test_started_at) {
      throw badRequest('This A/B test has already started — variants cannot be changed now');
    }

    // Poori list ek hi PUT se replace hoti hai — frontend ko diff nikaalne
    // ki zarurat nahi, aur "delete karke phir se banao" hamesha consistent
    // rehta hai chahe kitni baar save dabaya jaaye.
    await query('DELETE FROM campaign_variants WHERE campaign_id = $1', [req.params.id]);
    for (let i = 0; i < req.body.variants.length; i++) {
      const v = req.body.variants[i];
      await query(
        `INSERT INTO campaign_variants (id, campaign_id, label, subject, sender_name, reply_to, template_id, html, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          newId('var'),
          req.params.id,
          v.label,
          v.subject || null,
          v.senderName || null,
          v.replyTo || null,
          v.templateId || null,
          v.html || null,
          i,
        ]
      );
    }

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: `A/B variants updated (${req.body.variants.length})`,
      detailKey: 'act.abVariantsUpdated',
      detailParams: { count: req.body.variants.length },
    });

    const variants = await many(
      'SELECT * FROM campaign_variants WHERE campaign_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ variants: variants.map(variantToApi) });
  })
);

// --- live stats + (agar abhi test chal rahi hai) winner-preview --------------
router.get(
  '/:id/ab/stats',
  requireModule('campaigns', 'view'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!campaign.ab_enabled) throw badRequest('This campaign is not an A/B test');

    const variants = await variantsWithStats(req.params.id);

    // Sirf DEKHNE ke liye — yahan se kuch commit nahi hota, koi status nahi
    // badalta. Insaan ko "abhi tak ke numbers ke hisaab se kya lag raha
    // hai" dikhane ke liye, "Decide winner" dabane se PEHLE hi.
    let preview = null;
    if (!campaign.ab_winner_variant_id && campaign.status === 'Testing') {
      const result = await computeWinner(req.params.id);
      preview = {
        decided: result.decided,
        reason: result.reason ?? null,
        confidence: result.confidence ?? null,
        winnerVariantId: result.winnerVariantId ?? null,
      };
    }

    res.json({
      variants: variants.map((v) => ({ ...variantToApi(v), stats: v.stats })),
      preview,
      testStartedAt: campaign.ab_test_started_at,
      testEndsAt: campaign.ab_test_ends_at,
      winnerVariantId: campaign.ab_winner_variant_id,
      winnerReason: campaign.ab_winner_reason_key
        ? await stFor(reqLanguage(req), campaign.ab_winner_reason_key, campaign.ab_winner_reason_params)
        : null,
    });
  })
);

// --- test shuru karo (ya Paused se resume) -----------------------------------
router.post(
  '/:id/ab/start',
  campaignActionLimiter,
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, account_id FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    let result;
    try {
      result = await startTest(req.params.id);
    } catch (error) {
      throw badRequest(error.message);
    }

    if (!result.started) {
      const reasons = {
        already_running: 'This test is already running',
        ab_not_enabled: 'A/B testing is not enabled for this campaign',
        already_decided: 'A winner has already been chosen for this test',
        invalid_status: 'This campaign cannot start its A/B test right now',
        no_account: 'This campaign has no email account attached',
        not_found: 'This campaign was not found',
      };
      throw badRequest(reasons[result.reason] ?? 'The A/B test could not be started');
    }

    await logActivity(req, {
      action: 'sent',
      module: 'campaigns',
      item: campaign.name,
      detail: 'A/B test started',
      detailKey: 'act.abTestStarted',
    });

    res.json({ ok: true });
  })
);

// --- winner tay karo (auto agar variantId na diya ho, warna manual) ---------
router.post(
  '/:id/ab/decide-winner',
  requireModule('campaigns', 'send'),
  validate(z.object({ variantId: z.string().trim().optional() })),
  asyncHandler(async (req, res) => {
    const campaign = await one(
      'SELECT id, name, account_id, ab_auto_send_winner FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    if (req.body.variantId) {
      const variant = await one(
        'SELECT id FROM campaign_variants WHERE id = $1 AND campaign_id = $2',
        [req.body.variantId, req.params.id]
      );
      if (!variant) throw badRequest('That variant does not belong to this campaign');
    }

    const result = await decideWinner(req.params.id, {
      chosenVariantId: req.body.variantId ?? null,
      decidedBy: req.body.variantId ? req.user.id : null,
    });

    if (!result.decided) {
      res.json({ decided: false, reason: result.reason, confidence: result.confidence ?? null });
      return;
    }

    const variant = await one('SELECT label FROM campaign_variants WHERE id = $1', [result.winnerVariantId]);

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: result.manual
        ? `A/B winner manually chosen: Variant ${variant?.label}`
        : `A/B winner auto-decided: Variant ${variant?.label} (${Math.round(result.confidence ?? 0)}% confidence)`,
      detailKey: result.manual ? 'act.abWinnerManualLog' : 'act.abWinnerAutoLog',
      detailParams: result.manual
        ? { variant: variant?.label }
        : { variant: variant?.label, confidence: Math.round(result.confidence ?? 0) },
    });

    // "Automatically send the winning variant" — agar campaign is tarah
    // configure hai, faisla hote hi turant blast bhi shuru kar dete hain.
    // Manual "Send Winner" button isi function ko dobara bulata hai —
    // sendWinnerToRemainder() apne aap khud hi safe hai chahe kitni baar
    // bhi bulaya jaaye (dekho uska apna comment).
    let sendResult = null;
    if (campaign.ab_auto_send_winner) {
      sendResult = await sendWinnerToRemainder(req.params.id);
      if (sendResult.started) {
        await logActivity(req, {
          action: 'sent',
          module: 'campaigns',
          item: campaign.name,
          detail: 'A/B winner sent to the remaining recipients',
          detailKey: 'act.abWinnerSent',
        });
      }
    }

    res.json({
      decided: true,
      winnerVariantId: result.winnerVariantId,
      confidence: result.confidence ?? null,
      sendingStarted: Boolean(sendResult?.started),
    });
  })
);

// --- jeetne wale variant ko baaki sabko bhejo --------------------------------
router.post(
  '/:id/ab/send-winner',
  campaignActionLimiter,
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, account_id FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    const result = await sendWinnerToRemainder(req.params.id);
    if (!result.started) {
      const reasons = {
        no_winner: 'No winner has been chosen for this test yet',
        not_ready: 'This test is not ready to send the winner yet',
        already_running: 'The winner is already being sent',
        no_account: 'This campaign has no email account attached',
        not_found: 'This campaign was not found',
      };
      throw badRequest(reasons[result.reason] ?? 'Could not send the winning variant');
    }

    await logActivity(req, {
      action: 'sent',
      module: 'campaigns',
      item: campaign.name,
      detail: 'A/B winner sent to the remaining recipients',
      detailKey: 'act.abWinnerSent',
    });

    res.json({ ok: true });
  })
);

// --- A/B test radd karo (test-sample bhej chuke ho to wahi rok dete hain) ---
router.post(
  '/:id/ab/cancel',
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status, ab_enabled FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!campaign.ab_enabled) throw badRequest('This campaign is not an A/B test');
    if (['Sent', 'Completed', 'Cancelled'].includes(campaign.status)) {
      throw badRequest('This test has already finished');
    }

    await pauseCampaign(campaign.id); // running loop (agar koi hai) ko rok deta hai
    await query(`UPDATE campaigns SET status = 'Cancelled', pause_reason = NULL, updated_at = now() WHERE id = $1`, [
      campaign.id,
    ]);
    // Jo recipients winner ke liye "Reserved" rakhe the unhe wapas 'Pending'
    // kar dete hain (variant_id hata kar) — warna wo hamesha ke liye na
    // 'Sent', na 'Pending', na kuch aur dikhte, aur campaign ke apne hi
    // numbers (sent+pending+failed+...) kabhi total recipients ke barabar na
    // aate. Status 'Cancelled' hone se sender loop (ACTIVE_SEND_STATUSES) ko
    // yeh kisi bhi tarah dobara chalu nahi karega — sirf ginti sahi rehti hai.
    await query(
      `UPDATE campaign_recipients SET status = 'Pending', variant_id = NULL WHERE campaign_id = $1 AND status = 'Reserved'`,
      [campaign.id]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: 'A/B test cancelled',
      detailKey: 'act.abTestCancelled',
    });

    res.json({ ok: true });
  })
);

// --- test email (khud ko bhej kar dekho) ------------------------------------
router.post(
  '/:id/test',
  requireModule('campaigns', 'send'),
  validate(z.object({ to: z.string().trim().email('Enter a valid email address') })),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    const account = await one('SELECT * FROM email_accounts WHERE id = $1', [campaign.account_id]);
    if (!account) throw badRequest('No email account has been chosen for this campaign');

    // Test ke liye ek nakli recipient — database me kuch nahi likhte.
    const fake = {
      id: 'test',
      email: req.body.to,
      name: req.user.name,
      merge_data: { company: 'Test Company', city: 'Test City', phone: 'Test Phone' },
    };

    // Asli bhejne jaisa hi link text (Settings > Unsubscribe), taaki test email
    // me bhi wahi line dikhe jo recipients ko jayegi.
    const unsubSettings = await one(`SELECT value FROM settings WHERE key = 'unsubscribe'`);
    const message = buildEmail({
      campaign,
      recipient: fake,
      links: new Map(),
      unsubscribeText: unsubSettings?.value?.linkText || 'Unsubscribe from these emails',
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
      detail: `Test email sent to ${req.body.to}`,
      detailKey: 'act.testEmailSentTo',
      detailParams: { email: req.body.to },
    });

    res.json({ ok: true, messageId: result.messageId, previewUrl: result.previewUrl });
  })
);

// --- bhejo ------------------------------------------------------------------
router.post(
  '/:id/send',
  campaignActionLimiter,
  requireModule('campaigns', 'send'),
  asyncHandler(async (req, res) => {
    const campaign = await one(
      'SELECT id, name, status, account_id, ab_enabled, resume_target_status FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    // A/B campaign is generic button se sirf RESUME ho sakti hai (Paused se
    // wapas), fresh shuru karne ka apna route hai (POST /:id/ab/start) —
    // wahi variant assignment karta hai, yeh route uske baare me kuch nahi
    // jaanta.
    if (campaign.ab_enabled && campaign.status !== 'Paused') {
      throw badRequest('This is an A/B test campaign — use the A/B test controls to start it');
    }

    const count = await one(
      `SELECT count(*)::int AS n FROM campaign_recipients WHERE campaign_id = $1 AND status = 'Pending'`,
      [campaign.id]
    );
    if ((count?.n ?? 0) === 0) throw badRequest('There is nothing left to send — add recipients first');

    // Paused campaign resume ho rahi hai to bilkul WAHI phase (Sending/
    // Testing/Sending Winner) me wapas jaati hai jahan se ruki thi — kabhi
    // A/B campaign galti se normal 'Sending' me flip nahi hoti.
    const targetStatus = campaign.status === 'Paused' && campaign.resume_target_status ? campaign.resume_target_status : 'Sending';
    const result = await startCampaign(campaign.id, { company: env.brand.company, targetStatus });
    if (!result.started) {
      const reasons = {
        already_running: 'This campaign is already sending',
        no_account: 'This campaign has no email account attached',
        not_found: 'This campaign was not found',
      };
      throw badRequest(reasons[result.reason] ?? 'The campaign could not be started');
    }

    await logActivity(req, {
      action: 'sent',
      module: 'campaigns',
      item: campaign.name,
      detail: `Sending started — ${count.n} recipients`,
      detailKey: 'act.sendingStarted',
      detailParams: { count: count.n },
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
    if (!campaign) throw notFound('This campaign was not found');

    await pauseCampaign(campaign.id);
    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail: 'Campaign paused',
      detailKey: 'act.campaignPaused',
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
    if (!campaign) throw notFound('This campaign was not found');

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
    if (!recipient) throw notFound('This recipient was not found');

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
      events.push({ kind: recipient.status === 'Bounced' ? 'bounce' : 'failed', at: recipient.sent_at, detail: recipient.error });
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
  campaignActionLimiter,
  requireModule('campaigns', 'send'),
  validate(
    z.object({
      at: z.string().datetime('Choose a valid date and time').nullable().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');

    if (['Sending', 'Testing', 'Sending Winner'].includes(campaign.status)) {
      throw badRequest('This campaign is currently sending — the time can no longer be changed');
    }
    if (['Sent', 'Completed'].includes(campaign.status)) {
      throw badRequest('This campaign has already been sent');
    }

    const at = req.body.at ?? null;

    // Beeta hua time chunna kisi kaam ka nahi — wo turant chal padegi aur user
    // ko lagega ki uska chuna hua time maana hi nahi gaya.
    if (at && new Date(at) <= new Date()) {
      throw badRequest('That time has already passed. Choose a time in the future.');
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
      detail: at ? `Send time set: ${new Date(at).toUTCString()}` : 'Schedule removed',
      detailKey: at ? 'act.scheduleSet' : 'act.scheduleRemoved',
      detailParams: at ? { at: new Date(at).toUTCString() } : undefined,
    });

    const row = await one(`${SELECT} WHERE c.id = $1`, [campaign.id]);
    res.json({ campaign: toApi(row) });
  })
);

/**
 * Poori campaign ke liye "unopened ko dobara bhejo" ya "failed ko dobara
 * bhejo" — Campaigns list ke "..." menu se aata hai, jahan par recipient ki
 * id list nahi hoti (wo sirf analytics screen par load hoti hai). Isliye
 * yahan seedha campaign_id + criteria se match karte hain.
 */
router.post(
  '/:id/resend',
  campaignActionLimiter,
  requireModule('campaigns', 'edit'),
  validate(z.object({ target: z.enum(['unopened', 'failed']) })),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, account_id FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (!(await roleCanUseAccount(req.user.role_key, campaign.account_id))) {
      throw forbidden('Your role cannot use this campaign\'s email account');
    }

    // Jo unsubscribe kar chuka hai (isi campaign se, YA is CAMPAIGN KE
    // ACCOUNT se pehle kisi aur campaign/manual block se — dusre accounts
    // se ab bhi ja sakti hai) use dobara bhejne ki koshish bhi nahi karte —
    // sender khud bhi use suppression list se rok deta, lekin isse pehle hi
    // uska asli "Sent" record (kab bheja tha) mit jaata, jo galat hai.
    const notSuppressed = `NOT EXISTS (
      SELECT 1 FROM suppression s
       WHERE lower(s.email) = lower(campaign_recipients.email) AND s.account_id IN ($2, '')
    )`;
    const clause =
      req.body.target === 'failed'
        ? `campaign_id = $1 AND status = 'Failed' AND unsubscribed = false AND ${notSuppressed}`
        : `campaign_id = $1 AND status IN ('Sent','Delivered') AND open_count = 0 AND unsubscribed = false AND ${notSuppressed}`;

    const result = await query(
      `UPDATE campaign_recipients SET status = 'Pending', error = NULL, sent_at = NULL WHERE ${clause}`,
      [campaign.id, campaign.account_id]
    );
    const affected = result.affectedRows ?? result.rowCount ?? 0;

    // Hamesha jaga dete hain, sirf abhi affected hue logon ke liye nahi —
    // agar is campaign me pehle se hi koi aur 'Pending' fasa pada ho (jaise
    // kisi purani resend ka adhoora kaam), wo bhi isi mauke par nikal jaye.
    await startCampaign(campaign.id, { company: env.brand.company });

    await logActivity(req, {
      action: 'updated',
      module: 'campaigns',
      item: campaign.name,
      detail:
        req.body.target === 'failed'
          ? `Resending to ${affected} failed recipients`
          : `Resending to ${affected} recipients who hadn't opened it`,
      detailKey: req.body.target === 'failed' ? 'act.resendFailed' : 'act.resendUnopened',
      detailParams: { count: affected },
    });

    res.json({ ok: true, affected });
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
  campaignActionLimiter,
  requireModule('campaigns', 'edit'),
  validate(
    z.object({
      kind: z.enum(['resend', 'remove', 'suppress', 'export']),
      ids: z.array(z.string()).min(1, 'Choose at least one').max(2000),
      campaignName: z.string().trim().max(150).default(''),
    })
  ),
  asyncHandler(async (req, res) => {
    const { kind, ids, campaignName } = req.body;

    // EXISTS istemal karte hain, LEFT JOIN nahi — ek email ke liye ab EK se
    // zyada suppression row ho sakti hai (account-specific + global dono
    // saath), aur JOIN se yeh recipient row DO baar aa jaati (matlab bulk
    // action usi par do baar chal jata).
    const rows = await many(
      `SELECT r.id, r.email, r.campaign_id, r.unsubscribed, c.account_id,
              EXISTS (
                SELECT 1 FROM suppression s
                 WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
              ) AS suppressed
         FROM campaign_recipients r
         JOIN campaigns c ON c.id = r.campaign_id
        WHERE r.id = ANY($1)`,
      [ids]
    );
    if (rows.length === 0) throw badRequest('None of these recipients were found');

    let skipped = 0;

    if (kind === 'resend') {
      // Jo unsubscribe kar chuka hai — isi campaign se (unsubscribed) YA
      // kisi bhi purani campaign/manual block se (global suppression list)
      // — use dobara bhejne ki koshish nahi karte. Warna uska asli "kab
      // bheja tha" record mit jaata, aur sender khud bhi use suppression
      // list se rok dega (yahan na rokna sirf status ko wapas 'Pending' me
      // hamesha ke liye fasa deta, bina kabhi bheje).
      // In rows me alag-alag campaign/account ho sakte hain (checkbox se
      // chune gaye) — jis account ko yeh role use hi nahi kar sakta, uske
      // liye resend bilkul nahi karte, chahe baaki sab sahi ho.
      const usableAccountIds = new Set();
      for (const accountId of new Set(rows.map((row) => row.account_id))) {
        if (await roleCanUseAccount(req.user.role_key, accountId)) usableAccountIds.add(accountId);
      }
      const eligible = rows.filter((row) => !row.unsubscribed && !row.suppressed && usableAccountIds.has(row.account_id));
      const resendIds = eligible.map((row) => row.id);
      skipped = rows.length - resendIds.length;

      // 'Pending' kar dene se sender inhe agli baar wapas utha lega — LEKIN
      // agar campaign pehle hi poori ho chuki hai (status 'Sent'/'Failed'),
      // to bhejne wala loop khud se dobara chalu nahi hota. Isliye har
      // asar wali campaign ko yahin se dobara shuru bhi kar dete hain.
      if (resendIds.length > 0) {
        await query(
          `UPDATE campaign_recipients
              SET status = 'Pending', error = NULL, sent_at = NULL
            WHERE id = ANY($1)`,
          [resendIds]
        );
      }

      const campaignIds = [...new Set(eligible.map((row) => row.campaign_id))];
      for (const cid of campaignIds) {
        await startCampaign(cid, { company: env.brand.company });
      }
    }

    if (kind === 'remove') {
      await query('DELETE FROM campaign_recipients WHERE id = ANY($1)', [ids]);
    }

    if (kind === 'suppress') {
      // Suppression ka matlab: is CAMPAIGN KE ACCOUNT se in par aage koi
      // mail nahi jayega (dusre accounts se abhi bhi ja sakti hai) — jab tak
      // Settings > Unsubscribe me "Apply globally" chalu na ho, tab '' (sab
      // accounts) use karte hain. Ek hi statement — `ids` already capped at
      // 2000 by the schema above, so this never risks an unbounded number
      // of placeholders.
      const unsubSettings = await one("SELECT value FROM settings WHERE key = 'unsubscribe'");
      const applyGlobally = Boolean(unsubSettings?.value?.applyGlobally);

      const detailText = `Manually added from campaign report: ${campaignName}`;
      const values = [];
      const params = [];
      rows.forEach((row, index) => {
        const base = index * 3;
        values.push(`($${base + 1},$${base + 2},'manual',$${base + 3})`);
        params.push(applyGlobally ? '' : row.account_id, row.email, detailText);
      });
      await query(
        `INSERT INTO suppression (account_id, email, reason, detail) VALUES ${values.join(',')}
         ON CONFLICT (account_id, email) DO NOTHING`,
        params
      );
    }

    const affected = kind === 'resend' ? rows.length - skipped : rows.length;

    const detail = {
      resend: 'Queued for resend',
      remove: 'Removed from this campaign',
      suppress: 'Added to the suppression list',
      export: 'Downloaded',
    }[kind];
    const detailKey = {
      resend: 'act.bulkResend',
      remove: 'act.bulkRemove',
      suppress: 'act.bulkSuppress',
      export: 'act.bulkExport',
    }[kind];

    await logActivity(req, {
      action: kind === 'export' ? 'exported' : kind === 'remove' ? 'deleted' : 'updated',
      module: 'campaigns',
      item: campaignName || rows[0]?.campaign_id || '—',
      detail:
        kind === 'resend' && skipped > 0
          ? `${detail} (${affected}), ${skipped} skipped (already unsubscribed/suppressed)`
          : `${detail} (${affected})`,
      detailKey: kind === 'resend' && skipped > 0 ? 'act.bulkResendSkipped' : detailKey,
      detailParams: kind === 'resend' && skipped > 0 ? { count: affected, skipped } : { count: affected },
    });

    res.json({ ok: true, affected, skipped });
  })
);

// --- hatao ------------------------------------------------------------------
router.delete(
  '/:id',
  requireModule('campaigns', 'delete'),
  asyncHandler(async (req, res) => {
    const campaign = await one('SELECT id, name, status FROM campaigns WHERE id = $1', [req.params.id]);
    if (!campaign) throw notFound('This campaign was not found');
    if (['Sending', 'Testing', 'Sending Winner'].includes(campaign.status)) {
      throw badRequest('A running campaign cannot be deleted — pause it first');
    }

    await query('DELETE FROM campaigns WHERE id = $1', [campaign.id]);
    await logActivity(req, {
      action: 'deleted',
      module: 'campaigns',
      item: campaign.name,
      detail: 'Campaign deleted',
      detailKey: 'act.campaignDeleted',
    });

    res.json({ ok: true });
  })
);

export default router;

// ---------------------------------------------------------------------------
// Dashboard aur Reports ke numbers.
//
// Yahan kuch bhi "save" nahi hota — sab kuch har baar taaza gina jata hai.
// Isliye screen par jo dikhta hai, wahi asli haal hota hai; koi purana number
// chipka nahi reh sakta.
//
// Sab kuch campaign_recipients se aata hai — wahi ek table batata hai ki
// kiske paas kya pahuncha, kisne khola, kisne click kiya.
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { many, one } from '../db/client.js';
import { asyncHandler } from '../lib/http.js';
import { requireModule } from '../middleware/permissions.js';

const router = Router();

/** URL se din nikalta hai. Sirf yehi teen chalte hain. */
function daysFrom(req) {
  const range = String(req.query.range ?? '30d');
  return { '7d': 7, '30d': 30, '90d': 90 }[range] ?? 30;
}

/**
 * Do number ka farq percent me — "pichhle mahine se kitna badla".
 *
 * Pehle zero ho to percent ka matlab hi nahi banta (kisi bhi cheez ka zero se
 * badhna "anant %" hota hai). Aise me sirf naya number dikhate hain.
 */
function change(now, before) {
  if (!before) return now > 0 ? { delta: `+${now}`, trend: 'up' } : { delta: '—', trend: 'flat' };

  const pct = ((now - before) / before) * 100;
  const rounded = Math.round(pct * 10) / 10;

  return {
    delta: `${rounded >= 0 ? '+' : ''}${rounded}%`,
    trend: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat',
  };
}

function rate(part, whole) {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

/**
 * Sidebar ke badge ke number — sab ek hi request me.
 *
 * Pehle sidebar har ginti ke liye alag request bhejta tha. Har page khulne par
 * chaar bekaar request jaati thin, aur bahut saare page jaldi-jaldi kholne par
 * server ki rate-limit lag jati thi — jisse user bina wajah bahar ho jata tha.
 *
 * Ek hi sawaal me sab kuch aa jata hai, isliye yeh sasta hai.
 *
 * Yahan permission ki jaanch nahi lagti: yeh sirf ginti hai, koi asli data
 * nahi. Aur sidebar khud wahi link dikhata hai jinki ijaazat hai.
 */
router.get(
  '/counts',
  asyncHandler(async (req, res) => {
    const row = await one(`
      SELECT
        (SELECT count(*)::int FROM campaigns) AS campaigns,
        (SELECT count(*)::int FROM contacts) AS contacts,
        (SELECT count(*)::int FROM subscribers) AS subscribers,
        (SELECT count(*)::int FROM templates) AS templates,
        (SELECT count(*)::int FROM segments) AS segments,
        (SELECT count(*)::int FROM email_accounts) AS accounts,
        (SELECT count(*)::int FROM users) AS users
    `);

    res.json({ counts: row ?? {} });
  })
);

/**
 * Sidebar ke neeche wala "aaj kitna bheja" — sabhi connected accounts ka
 * sent_today aur daily_limit jod kar. Jis account ka din badal chuka hai
 * (quota_date purana hai) uska sent_today ab 0 maana jata hai — sender.js
 * bhi yahi hisaab lagata hai jab bhejna shuru karta hai.
 *
 * Permission ki jaanch nahi lagti — jaise /counts, yeh bhi sirf ginti hai.
 */
router.get(
  '/quota',
  asyncHandler(async (req, res) => {
    const row = await one(`
      SELECT
        coalesce(sum(CASE WHEN quota_date = current_date THEN sent_today ELSE 0 END), 0)::int AS sent_today,
        coalesce(sum(daily_limit), 0)::int AS daily_limit
      FROM email_accounts
    `);

    res.json({ sentToday: row?.sent_today ?? 0, dailyLimit: row?.daily_limit ?? 0 });
  })
);

/**
 * Topbar ki ghanti — asli events se banti hai, koi kahani nahi:
 *   1. Jo campaign abhi bhej rahi hai
 *   2. Jo campaign pichhle 7 din me poori hui
 *   3. Jo email account "Connected" nahi hai
 */
router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const items = [];

    const sending = await many(`
      SELECT c.id, c.name, c.started_at,
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS total,
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status IN ('Sent','Failed')) AS done
        FROM campaigns c
       WHERE c.status = 'Sending'
       ORDER BY c.started_at DESC
       LIMIT 5
    `);
    sending.forEach((row) => {
      items.push({
        id: `sending-${row.id}`,
        kind: 'sending',
        campaignId: row.id,
        name: row.name,
        done: row.done,
        total: row.total,
        at: row.started_at,
        icon: 'bi-send',
        tone: 'primary',
      });
    });

    const finished = await many(`
      SELECT c.id, c.name, c.finished_at,
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent
        FROM campaigns c
       WHERE c.status = 'Sent' AND c.finished_at >= now() - interval '7 days'
       ORDER BY c.finished_at DESC
       LIMIT 5
    `);
    finished.forEach((row) => {
      items.push({
        id: `finished-${row.id}`,
        kind: 'finished',
        campaignId: row.id,
        name: row.name,
        sent: row.sent,
        at: row.finished_at,
        icon: 'bi-check-circle',
        tone: 'success',
      });
    });

    const accounts = await many(`
      SELECT id, email, status, updated_at FROM email_accounts
       WHERE status != 'Connected'
       ORDER BY updated_at DESC
       LIMIT 5
    `);
    accounts.forEach((row) => {
      items.push({
        id: `account-${row.id}`,
        kind: 'account',
        email: row.email,
        status: row.status,
        at: row.updated_at,
        icon: 'bi-exclamation-triangle',
        tone: 'warning',
      });
    });

    items.sort((a, b) => new Date(b.at) - new Date(a.at));

    res.json({ notifications: items.slice(0, 10) });
  })
);

// --- dashboard ke upar wale cards -------------------------------------------
router.get(
  '/dashboard',
  requireModule('dashboard', 'view'),
  asyncHandler(async (req, res) => {
    const days = daysFrom(req);

    // Ek hi sawaal me is dauraan ke aur usse pehle ke, dono ke number — taki
    // "pichhle se kitna badla" bataya ja sake.
    const totals = await one(
      `SELECT
         count(*) FILTER (WHERE r.sent_at >= now() - ($1 || ' days')::interval)::int AS sent,
         count(*) FILTER (WHERE r.sent_at >= now() - ($2 || ' days')::interval
                            AND r.sent_at <  now() - ($1 || ' days')::interval)::int AS sent_before,
         count(*) FILTER (WHERE r.open_count > 0
                            AND r.sent_at >= now() - ($1 || ' days')::interval)::int AS opened,
         count(*) FILTER (WHERE r.open_count > 0
                            AND r.sent_at >= now() - ($2 || ' days')::interval
                            AND r.sent_at <  now() - ($1 || ' days')::interval)::int AS opened_before,
         count(*) FILTER (WHERE r.click_count > 0
                            AND r.sent_at >= now() - ($1 || ' days')::interval)::int AS clicked,
         count(*) FILTER (WHERE r.click_count > 0
                            AND r.sent_at >= now() - ($2 || ' days')::interval
                            AND r.sent_at <  now() - ($1 || ' days')::interval)::int AS clicked_before,
         count(*) FILTER (WHERE r.status IN ('Failed','Bounced'))::int AS failed,
         count(*) FILTER (WHERE r.status = 'Pending')::int AS pending
       FROM campaign_recipients r`,
      [String(days), String(days * 2)]
    );

    const campaignRow = await one(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'Scheduled')::int AS scheduled
        FROM campaigns
    `);

    // Unsubscribe ka pakka record suppression table hai, campaign_recipients
    // nahi — kyunki campaign delete hote hi uske recipient rows CASCADE se
    // mit jate hain, aur unsubscribed=true flag bhi unke saath chala jata,
    // jaise ek insaan ki ginti chupke se 0 ho jaati thi.
    const unsubRow = await one(`SELECT count(*)::int AS n FROM suppression WHERE reason = 'unsubscribed'`);

    const t = totals ?? {};
    const sentChange = change(t.sent ?? 0, t.sent_before ?? 0);
    const openedChange = change(t.opened ?? 0, t.opened_before ?? 0);
    const clickedChange = change(t.clicked ?? 0, t.clicked_before ?? 0);

    res.json({
      range: `${days}d`,
      // Naam aur icon screen ke paas pehle se hain; yahan se sirf number aate
      // hain. Isse har bhasha me label sahi rehta hai.
      kpis: [
        { id: 'campaigns', value: campaignRow?.total ?? 0, delta: '', trend: 'flat' },
        { id: 'sent', value: t.sent ?? 0, ...sentChange },
        { id: 'opened', value: t.opened ?? 0, ...openedChange },
        { id: 'openRate', value: rate(t.opened ?? 0, t.sent ?? 0), delta: '', trend: 'flat' },
        { id: 'clicked', value: t.clicked ?? 0, ...clickedChange },
        { id: 'clickRate', value: rate(t.clicked ?? 0, t.sent ?? 0), delta: '', trend: 'flat' },
        { id: 'failed', value: t.failed ?? 0, delta: '', trend: 'flat' },
        { id: 'pending', value: t.pending ?? 0, delta: '', trend: 'flat' },
        { id: 'unsubscribed', value: unsubRow?.n ?? 0, delta: '', trend: 'flat' },
        { id: 'scheduled', value: campaignRow?.scheduled ?? 0, delta: '', trend: 'flat' },
      ],
    });
  })
);

// --- din-ba-din ka graph ----------------------------------------------------
router.get(
  '/trend',
  requireModule('dashboard', 'view'),
  asyncHandler(async (req, res) => {
    const days = daysFrom(req);

    // generate_series se har din ki row banti hai — jis din kuch nahi hua us
    // din bhi. Warna graph me beech ke din gayab ho jate aur line jhooth
    // bolti.
    const rows = await many(
      `WITH span AS (
         SELECT generate_series(
           (now() - ($1 || ' days')::interval)::date,
           now()::date,
           '1 day'
         )::date AS day
       )
       SELECT span.day,
              count(r.id) FILTER (WHERE r.id IS NOT NULL)::int AS sent,
              count(r.id) FILTER (WHERE r.open_count > 0)::int AS opened,
              count(r.id) FILTER (WHERE r.click_count > 0)::int AS clicked
         FROM span
         LEFT JOIN campaign_recipients r ON r.sent_at::date = span.day
        GROUP BY span.day
        ORDER BY span.day`,
      [String(days - 1)]
    );

    res.json({
      range: `${days}d`,
      trend: rows.map((row) => ({
        date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
        sent: row.sent,
        opened: row.opened,
        clicked: row.clicked,
      })),
    });
  })
);

// --- kya hua: pahuncha, fail, bounce, unsubscribe ---------------------------
router.get(
  '/delivery',
  requireModule('dashboard', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one(`
      SELECT
        (SELECT count(*)::int FROM campaign_recipients WHERE status = 'Sent') AS sent,
        (SELECT count(*)::int FROM campaign_recipients WHERE status = 'Failed') AS failed,
        (SELECT count(*)::int FROM campaign_recipients WHERE status = 'Bounced') AS bounced,
        -- Suppression = pakka, permanent record. campaign_recipients.unsubscribed
        -- campaign delete hone par CASCADE se mit jata hai (dekho /dashboard ka comment).
        (SELECT count(*)::int FROM suppression WHERE reason = 'unsubscribed') AS unsubscribed
    `);

    // "Sent" hi bolte hain, "Delivered" nahi — hume kabhi pata nahi chalta ki
    // asal me inbox tak pahuncha ya nahi, sirf itna pata hai ki server ne
    // le liya. Rang yahin se aate hain taki graph aur report dono me ek jaise
    // rahein.
    res.json({
      delivery: [
        { key: 'sent', name: 'Sent', value: row?.sent ?? 0, color: '#4f46e5' },
        { key: 'failed', name: 'Failed', value: row?.failed ?? 0, color: '#dc2626' },
        { key: 'bounced', name: 'Bounced', value: row?.bounced ?? 0, color: '#d97706' },
        { key: 'unsubscribed', name: 'Unsubscribed', value: row?.unsubscribed ?? 0, color: '#9ca3af' },
      ],
    });
  })
);

/**
 * Kis din, kis ghante par log email kholte hain.
 *
 * Isse pata chalta hai ki agli campaign kab bhejni chahiye. 7 din x 24 ghante
 * ka grid banta hai.
 */
router.get(
  '/heatmap',
  requireModule('dashboard', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(`
      SELECT extract(dow FROM first_open_at)::int AS dow,
             extract(hour FROM first_open_at)::int AS hour,
             count(*)::int AS n
        FROM campaign_recipients
       WHERE first_open_at IS NOT NULL
       GROUP BY dow, hour
    `);

    // Postgres me hafta Sunday=0 se shuru hota hai, par screen Monday se
    // dikhati hai — isliye yahan badal dete hain.
    const toMonday = (dow) => (dow + 6) % 7;

    res.json({
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      heatmap: rows.map((row) => ({ day: toMonday(row.dow), hour: row.hour, value: row.n })),
    });
  })
);

// --- report export ----------------------------------------------------------
/**
 * Report ki rows — screen inhe CSV/Excel bana kar download karati hai.
 *
 * Har report ka apna sawaal hai. Naam ({{type}}) seedha SQL me nahi jaata —
 * sirf is list me se ek chunte hain, warna koi bhi apni marzi ka sawaal
 * chala sakta hai.
 */
const REPORTS = {
  // Har campaign ka ek line ka hisaab.
  campaign: {
    columns: ['Campaign', 'Status', 'Recipients', 'Sent', 'Opened', 'Clicked', 'Failed', 'Date'],
    sql: `
      SELECT c.name AS "Campaign", c.status AS "Status",
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS "Recipients",
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS "Sent",
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.open_count > 0) AS "Opened",
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.click_count > 0) AS "Clicked",
             (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status IN ('Failed','Bounced')) AS "Failed",
             coalesce(c.finished_at, c.started_at, c.created_at) AS "Date"
        FROM campaigns c
       WHERE ($1 = '' OR c.id = $1)
         AND ($2 = '' OR coalesce(c.finished_at, c.started_at, c.created_at) >= $2::timestamptz)
         AND ($3 = '' OR coalesce(c.finished_at, c.started_at, c.created_at) <= $3::timestamptz)
       ORDER BY "Date" DESC`,
  },

  // Kis aadmi ne kya kiya.
  activity: {
    columns: ['When', 'User', 'Action', 'Module', 'Item', 'Detail'],
    sql: `
      SELECT at AS "When", user_name AS "User", action AS "Action",
             module AS "Module", item AS "Item", detail AS "Detail"
        FROM activity_log
       WHERE ($1 = '' OR $1 = $1)
         AND ($2 = '' OR at >= $2::timestamptz)
         AND ($3 = '' OR at <= $3::timestamptz)
       ORDER BY at DESC`,
  },
};

/** Recipient wali reports ka dhaancha ek hi hai, sirf shart badalti hai. */
function recipientReport(condition) {
  return {
    columns: ['Campaign', 'Name', 'Email', 'Status', 'Opens', 'Clicks', 'Sent at'],
    sql: `
      SELECT c.name AS "Campaign", r.name AS "Name", r.email AS "Email",
             r.status AS "Status", r.open_count AS "Opens", r.click_count AS "Clicks",
             r.sent_at AS "Sent at"
        FROM campaign_recipients r
        JOIN campaigns c ON c.id = r.campaign_id
       WHERE ${condition}
         AND ($1 = '' OR r.campaign_id = $1)
         AND ($2 = '' OR r.sent_at >= $2::timestamptz)
         AND ($3 = '' OR r.sent_at <= $3::timestamptz)
       ORDER BY r.sent_at DESC NULLS LAST`,
  };
}

REPORTS.opened = recipientReport('r.open_count > 0');
REPORTS.unopened = recipientReport("r.open_count = 0 AND r.status IN ('Sent','Delivered')");
REPORTS.clicked = recipientReport('r.click_count > 0');
REPORTS.failed = recipientReport("r.status IN ('Failed','Bounced')");

router.get(
  '/report',
  requireModule('reports', 'export'),
  asyncHandler(async (req, res) => {
    const type = String(req.query.type ?? 'campaign');
    const report = REPORTS[type];

    if (!report) {
      res.status(400).json({ error: { code: 'bad_request', message: 'Aisi koi report nahi hai' } });
      return;
    }

    // "all" ya khali ka matlab "sab" — SQL me khali string se yehi hota hai.
    const campaignId = String(req.query.campaignId ?? '');
    const from = String(req.query.from ?? '');
    const to = String(req.query.to ?? '');

    const rows = await many(report.sql, [
      campaignId === 'all' ? '' : campaignId,
      from,
      // "To" wali tareekh us poore din ko shaamil karti hai, warna us din ka
      // data chhoot jata hai aur ginti kam dikhti hai.
      to ? `${to}T23:59:59.999Z` : '',
    ]);

    res.json({ type, columns: report.columns, rows, total: rows.length });
  })
);

export default router;

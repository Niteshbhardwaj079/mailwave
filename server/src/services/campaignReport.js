// ---------------------------------------------------------------------------
// Campaign report — ek client-ready Excel banata hai, poori tarah ON-DEMAND.
//
// Kuch bhi database me alag se save NAHI hota. Har baar "Download Report"
// dabane par yahi file dobara, taazi banti hai — existing campaign,
// campaign_recipients aur tracking_events data se. Isliye report kabhi
// purana (stale) nahi ho sakta, aur koi naya table/column bhi nahi chahiye.
// ---------------------------------------------------------------------------
import ExcelJS from 'exceljs';

import { many, one } from '../db/client.js';
import { env } from '../env.js';
import { providerPreset } from './providers.js';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

function percentText(numerator, denominator) {
  if (!denominator) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Campaign name se ek safe filename-stem banata hai — sirf letters/digits/space/hyphen/underscore bachte hain. */
function safeFileStem(name) {
  const cleaned = String(name || 'Campaign')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || 'Campaign';
}

/** `CampaignName_Report_2026-09-08.xlsx` jaisa ek saaf, samajh aane wala filename. */
export function reportFileName(campaignName, when = new Date()) {
  const date = when.toISOString().slice(0, 10);
  return `${safeFileStem(campaignName)}_Report_${date}.xlsx`;
}

/** Suppression ko dhyan me rakh kar asli display status nikaalta hai — jaise screen par dikhta hai, waisa hi. */
function displayStatus(row) {
  if (row.unsubscribed) return 'Unsubscribed';
  if (row.suppression_reason) {
    return row.suppression_reason === 'bounced' || row.suppression_reason === 'complaint' ? 'Bounced' : 'Unsubscribed';
  }
  return row.status;
}

/**
 * Poori campaign ka data ek jagah jama karta hai — summary counts, har
 * recipient ki poori history, aur har link-click. Sab EXISTING tables se;
 * kuch naya nahi likha jata.
 */
export async function loadCampaignReportData(campaignId) {
  const campaign = await one(
    `SELECT c.*, a.email AS account_email, a.provider AS account_provider,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS recipients,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Sent') AS sent,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Failed') AS failed,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.status = 'Bounced') AS bounced,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.open_count > 0) AS opened,
            (SELECT count(*)::int FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.click_count > 0) AS clicked,
            (SELECT coalesce(sum(r.send_count), 0)::int FROM campaign_recipients r WHERE r.campaign_id = c.id) AS total_attempts,
            -- Pending/Unsubscribed dono suppression-aware hain — bilkul waisa
            -- hi jaisa Campaign Analytics screen par dikhta hai, taaki report
            -- aur screen kabhi ek-doosre se alag na dikhein.
            (SELECT count(*)::int FROM campaign_recipients r
               WHERE r.campaign_id = c.id AND r.status = 'Pending'
                 AND NOT EXISTS (
                       SELECT 1 FROM suppression s
                        WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
                     )) AS pending,
            (SELECT count(*)::int FROM campaign_recipients r
               WHERE r.campaign_id = c.id
                 AND (r.unsubscribed OR (r.status = 'Pending' AND EXISTS (
                       SELECT 1 FROM suppression s
                        WHERE lower(s.email) = lower(r.email) AND s.account_id IN (c.account_id, '')
                     )))) AS unsubscribed
       FROM campaigns c
       LEFT JOIN email_accounts a ON a.id = c.account_id
      WHERE c.id = $1`,
    [campaignId]
  );
  if (!campaign) return null;

  const recipients = await many(
    `SELECT r.id, r.email, r.name, r.status, r.error, r.sent_at, r.open_count, r.first_open_at,
            r.last_open_at, r.click_count, r.last_click_at, r.unsubscribed,
            r.send_count, r.last_attempted_at, sup.reason AS suppression_reason
       FROM campaign_recipients r
       LEFT JOIN LATERAL (
         SELECT s.reason
           FROM suppression s
          WHERE lower(s.email) = lower(r.email) AND s.account_id IN ($2, '')
          ORDER BY (s.account_id = $2) DESC
          LIMIT 1
       ) sup ON true
      WHERE r.campaign_id = $1
      ORDER BY r.email`,
    [campaignId, campaign.account_id ?? '']
  );

  // Kis recipient ne kis link par click kiya — ek row har (recipient, URL)
  // jode ke liye, kitni baar aur pehli/aakhri baar kab.
  const clicks = await many(
    `SELECT r.email AS recipient_email, r.name AS recipient_name, l.url AS url,
            count(*)::int AS click_count, min(e.at) AS first_click_at, max(e.at) AS last_click_at
       FROM tracking_events e
       JOIN campaign_recipients r ON r.id = e.recipient_id
       LEFT JOIN campaign_links l ON l.id = e.link_id
      WHERE e.campaign_id = $1 AND e.kind = 'click'
      GROUP BY r.email, r.name, l.url
      ORDER BY r.email, click_count DESC`,
    [campaignId]
  );

  return { campaign, recipients, clicks };
}

function addSummarySheet(workbook, campaign) {
  const sheet = workbook.addWorksheet('Summary');
  sheet.columns = [
    { key: 'label', width: 28 },
    { key: 'value', width: 46 },
  ];

  const title = sheet.addRow([campaign.name]);
  title.font = { bold: true, size: 16 };
  sheet.mergeCells(1, 1, 1, 2);
  sheet.addRow([]);

  const providerName = campaign.account_provider ? providerPreset(campaign.account_provider).name : '—';
  const when = campaign.finished_at ?? campaign.started_at ?? campaign.scheduled_at ?? campaign.created_at;

  const rows = [
    ['Campaign Name', campaign.name],
    ['Subject', campaign.subject || '—'],
    ['Sending Account', campaign.account_email ?? '—'],
    ['Provider', providerName],
    ['Campaign Date/Time', when ? new Date(when).toLocaleString() : '—'],
    ['Status', campaign.status],
    [],
    ['Total Recipients', campaign.recipients],
    ['Sent', campaign.sent],
    ['Resend / Send Attempts (total)', campaign.total_attempts],
    ['Pending', campaign.pending],
    ['Failed', campaign.failed],
    ['Bounced', campaign.bounced],
    ['Unsubscribed', campaign.unsubscribed],
    ['Opened', campaign.opened],
    ['Clicked', campaign.clicked],
    ['Open Rate', percentText(campaign.opened, campaign.sent)],
    ['Click Rate', percentText(campaign.clicked, campaign.sent)],
  ];

  for (const row of rows) {
    if (row.length === 0) {
      sheet.addRow([]);
      continue;
    }
    const added = sheet.addRow(row);
    added.getCell(1).font = { bold: true };
  }

  sheet.getColumn(1).alignment = { vertical: 'middle' };
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  row.height = 20;
}

function addRecipientsSheet(workbook, recipients) {
  const sheet = workbook.addWorksheet('Recipients');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Send Attempts', key: 'sendCount', width: 15 },
    { header: 'Last Attempt At', key: 'lastAttemptAt', width: 20 },
    { header: 'Sent At', key: 'sentAt', width: 20 },
    { header: 'Opens', key: 'openCount', width: 10 },
    { header: 'First Open', key: 'firstOpen', width: 20 },
    { header: 'Last Open', key: 'lastOpen', width: 20 },
    { header: 'Clicks', key: 'clickCount', width: 10 },
    { header: 'Last Click', key: 'lastClick', width: 20 },
    { header: 'Error', key: 'error', width: 30 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'L1' };

  for (const r of recipients) {
    sheet.addRow({
      name: r.name || r.email,
      email: r.email,
      status: displayStatus(r),
      sendCount: r.send_count,
      lastAttemptAt: r.last_attempted_at ? new Date(r.last_attempted_at).toLocaleString() : '—',
      sentAt: r.sent_at ? new Date(r.sent_at).toLocaleString() : '—',
      openCount: r.open_count,
      firstOpen: r.first_open_at ? new Date(r.first_open_at).toLocaleString() : '—',
      lastOpen: r.last_open_at ? new Date(r.last_open_at).toLocaleString() : '—',
      clickCount: r.click_count,
      lastClick: r.last_click_at ? new Date(r.last_click_at).toLocaleString() : '—',
      error: r.error || '',
    });
  }
}

function addLinkClicksSheet(workbook, clicks) {
  const sheet = workbook.addWorksheet('Link Clicks');
  sheet.columns = [
    { header: 'Recipient Name', key: 'name', width: 22 },
    { header: 'Recipient Email', key: 'email', width: 30 },
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Click Count', key: 'clicks', width: 13 },
    { header: 'First Click At', key: 'firstClick', width: 20 },
    { header: 'Last Click At', key: 'lastClick', width: 20 },
  ];
  styleHeaderRow(sheet.getRow(1));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: 'F1' };

  if (clicks.length === 0) {
    const row = sheet.addRow(['No link clicks recorded for this campaign yet.']);
    sheet.mergeCells(row.number, 1, row.number, 6);
    row.font = { italic: true, color: { argb: 'FF6B7280' } };
    return;
  }

  for (const c of clicks) {
    sheet.addRow({
      name: c.recipient_name || c.recipient_email,
      email: c.recipient_email,
      url: c.url || '—',
      clicks: c.click_count,
      firstClick: c.first_click_at ? new Date(c.first_click_at).toLocaleString() : '—',
      lastClick: c.last_click_at ? new Date(c.last_click_at).toLocaleString() : '—',
    });
  }
}

/**
 * Poora workbook banata hai (Summary + Recipients + Link Clicks) aur ek
 * Buffer laut ata hai — caller decide karta hai isse temp file me likhna
 * hai ya seedha response me bhejna. Yahan kuch bhi disk par nahi likha jata.
 */
export async function buildCampaignReportWorkbook(campaignId) {
  const data = await loadCampaignReportData(campaignId);
  if (!data) return null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = env.brand.name;
  workbook.created = new Date();

  addSummarySheet(workbook, data.campaign);
  addRecipientsSheet(workbook, data.recipients);
  addLinkClicksSheet(workbook, data.clicks);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, campaignName: data.campaign.name };
}

import { pathToFileURL } from 'node:url';

import { DEFAULT_ROLES } from './defaultRoles.js';
import {
  activityLog,
  campaigns,
  contactGroups,
  contacts,
  emailAccounts,
  recipientActivity,
  segments,
  subscribers,
  teamUsers,
} from './demoData.js';
import { starterTemplates } from '../../../src/data/starterHtml.js';
import { systemEmailTemplates } from '../../../src/data/systemEmails.js';

import { closeDb, many, one, query, transaction } from './client.js';
import { env } from '../env.js';
import { hashPassword } from '../lib/password.js';
import { newId } from '../lib/ids.js';
import { migrate } from './migrate.js';

// The seed imports the very same data files the mockups render from, so a
// freshly seeded database looks exactly like the prototype did — no second
// copy of the sample data to drift out of sync.

function isoOrNull(value) {
  if (!value || value === '—') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Maps a mock campaign status onto the statuses the schema knows. */
function campaignStatus(status) {
  const allowed = ['Draft', 'Scheduled', 'Sending', 'Paused', 'Sent', 'Failed'];
  return allowed.includes(status) ? status : 'Draft';
}

async function seedRoles() {
  for (const [index, role] of DEFAULT_ROLES.entries()) {
    await query(
      `INSERT INTO roles (key, label, label_key, descr, descr_key, tone, icon, locked, custom, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (key) DO NOTHING`,
      [
        role.key,
        role.label ?? null,
        role.labelKey ?? null,
        role.desc ?? null,
        role.descKey ?? null,
        role.tone ?? 'primary',
        role.icon ?? 'bi-person',
        Boolean(role.locked),
        Boolean(role.custom),
        index,
      ]
    );

    for (const [module, actions] of Object.entries(role.permissions || {})) {
      for (const action of actions) {
        await query(
          `INSERT INTO role_permissions (role_key, module, action) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [role.key, module, action]
        );
      }
    }
  }
}

/**
 * Naye client ke liye: koi fake company data nahi, sirf ek Super Admin jisse
 * wo khud login karke aage sab kuch (contacts, templates, email account) apna
 * bana sake.
 */
async function seedCleanAdmin() {
  const passwordHash = await hashPassword(env.seedPassword);
  const name = process.env.ADMIN_NAME || 'Admin';
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  await query(
    `INSERT INTO users (id, name, email, password_hash, role_key, status, initials)
     VALUES ($1,$2,$3,$4,'super_admin','Active',$5)
     ON CONFLICT (email) DO NOTHING`,
    [newId('u'), name, env.seedEmail, passwordHash, initials]
  );
}

async function seedUsers() {
  // Only the seed account gets a usable password; everyone else is "Invited"
  // until a Super Admin sets one or they follow an invite link.
  const passwordHash = await hashPassword(env.seedPassword);

  for (const user of teamUsers) {
    const isSeedAccount = user.email.toLowerCase() === env.seedEmail.toLowerCase();

    await query(
      `INSERT INTO users (id, name, email, password_hash, role_key, status, department, initials, last_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (email) DO NOTHING`,
      [
        user.id,
        user.name,
        user.email,
        isSeedAccount ? passwordHash : null,
        user.role,
        isSeedAccount ? 'Active' : user.status || 'Invited',
        user.department ?? null,
        user.initials ?? null,
        isoOrNull(user.lastActive),
      ]
    );
  }
}

async function seedContacts() {
  for (const group of contactGroups) {
    await query(
      `INSERT INTO contact_groups (id, name, tone) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [group.id, group.name, group.tone ?? 'primary']
    );
  }

  const groupByName = new Map(contactGroups.map((group) => [group.name, group.id]));

  for (const contact of contacts) {
    await query(
      `INSERT INTO contacts (id, name, email, phone, company, tags, group_id, status, added_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        contact.id,
        contact.name,
        contact.email,
        contact.phone ?? null,
        contact.company ?? null,
        contact.tags ?? [],
        groupByName.get(contact.group) ?? null,
        contact.status ?? 'Subscribed',
        isoOrNull(contact.addedOn),
      ]
    );

    // Anyone already unsubscribed or bounced belongs on the suppression list
    // from the very first boot, not only after the next send.
    if (contact.status === 'Unsubscribed' || contact.status === 'Bounced') {
      await query(
        `INSERT INTO suppression (email, reason, detail) VALUES ($1,$2,$3)
         ON CONFLICT (email) DO NOTHING`,
        [contact.email, contact.status === 'Bounced' ? 'bounced' : 'unsubscribed', 'Imported with the seed data']
      );
    }
  }

  for (const segment of segments) {
    await query(
      `INSERT INTO segments (id, name, rule, tone) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [
        segment.id,
        segment.name,
        JSON.stringify({
          description: segment.rule,
          join: segment.join ?? 'and',
          conditions: segment.conditions ?? [],
        }),
        segment.tone ?? 'primary',
      ]
    );
  }
}

async function seedTemplates() {
  // teamUsers[0] sirf demo mode me DB me hota hai. Clean mode me asli banaya
  // hua Super Admin hi first row hota hai — isliye DB se hi poochte hain.
  const authorRow = await one('SELECT id FROM users ORDER BY created_at LIMIT 1');
  const author = authorRow?.id ?? null;

  for (const [index, starter] of starterTemplates.entries()) {
    await query(
      `INSERT INTO templates (id, name, category, subject, html, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [
        `tpl_seed_${index + 1}`,
        starter.name,
        starter.category ?? 'Custom',
        starter.subject ?? `Hello {{name}}`,
        starter.html,
        author,
      ]
    );
  }
}

async function seedAccounts() {
  for (const account of emailAccounts) {
    await query(
      `INSERT INTO email_accounts (id, email, display_name, provider, status, daily_limit, sent_today, quota_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7, current_date)
       ON CONFLICT (email) DO NOTHING`,
      [
        account.id,
        account.email,
        account.senderName ?? null,
        account.providerKey ?? 'smtp',
        account.status ?? 'Connected',
        account.dailyLimit ?? 500,
        account.usedToday ?? 0,
      ]
    );
  }
}

async function seedCampaigns() {
  const templateRow = await one('SELECT id FROM templates ORDER BY created_at LIMIT 1');
  const author = teamUsers[0]?.id ?? null;

  for (const campaign of campaigns) {
    const account = await one('SELECT id FROM email_accounts WHERE email = $1', [campaign.sender]);

    await query(
      `INSERT INTO campaigns
         (id, name, account_id, sender_name, reply_to, subject, template_id, html,
          batch_size, open_tracking, click_tracking, status, scheduled_at, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        campaign.id,
        campaign.name,
        account?.id ?? null,
        campaign.senderName ?? null,
        campaign.sender ?? null,
        `${campaign.name}`,
        templateRow?.id ?? null,
        '',
        campaign.batchSize ?? 100,
        campaign.openTracking !== false,
        Boolean(campaign.clickTracking),
        campaignStatus(campaign.status),
        isoOrNull(campaign.date),
        author,
        isoOrNull(campaign.date),
      ]
    );
  }

  // Give the most recent campaign a real recipient table so the analytics
  // screen has something to show before anything has actually been sent.
  const target = campaigns[0];
  if (target) {
    for (const person of recipientActivity) {
      await query(
        `INSERT INTO campaign_recipients
           (id, campaign_id, email, name, status, open_count, click_count, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (campaign_id, lower(email)) DO NOTHING`,
        [
          newId('rcp'),
          target.id,
          person.email,
          person.name,
          person.status === 'Failed' ? 'Failed' : 'Sent',
          person.openCount ?? 0,
          person.clickCount ?? 0,
        ]
      );
    }
  }
}

async function seedSubscribers() {
  for (const person of subscribers) {
    await query(
      `INSERT INTO subscribers (id, name, email, company, city, campaign_id, status, subscribed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (lower(email)) DO NOTHING`,
      [
        person.id,
        person.name,
        person.email,
        person.company ?? null,
        person.city ?? null,
        person.campaignId ?? null,
        person.status ?? 'Subscribed',
        isoOrNull(person.subscribedAt),
      ]
    );
  }
}

async function seedSystemEmails() {
  for (const template of systemEmailTemplates) {
    await query(
      `INSERT INTO system_emails (key, subject, html, enabled) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO NOTHING`,
      [template.key, template.subject, template.html, template.defaultEnabled !== false]
    );
  }
}

async function seedActivity() {
  for (const entry of activityLog) {
    await query(
      `INSERT INTO activity_log
         (id, user_id, user_name, initials, action, module, item, detail, before_val, after_val, ip, device, at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        entry.id,
        entry.userId ?? null,
        entry.userName ?? null,
        entry.initials ?? null,
        entry.action,
        entry.module,
        entry.item ?? null,
        entry.detail ?? null,
        entry.before ?? null,
        entry.after ?? null,
        entry.ip ?? null,
        entry.device ?? null,
        isoOrNull(entry.at),
      ]
    );
  }
}

async function seedSettings() {
  const defaults = {
    sending: { defaultBatchSize: 100, batchDelayMinutes: 2, retryOnce: true, quietHours: false },
    tracking: { openByDefault: true, clickByDefault: false, recordDevice: true, recordLocation: false },
    contacts: { dedupeOnImport: true, requireConsent: true, customFields: ['city', 'area', 'plan'] },
    unsubscribe: {
      linkText: 'Unsubscribe from these emails',
      confirmation: 'You have been removed from our mailing list.',
      oneClickHeader: true,
    },
    // url/secret khaali — koi bhi event bhejta hi nahi jab tak admin apna
    // URL na daale aur chalu na kare.
    webhooks: { url: '', secret: '', enabled: false },
  };

  for (const [key, value] of Object.entries(defaults)) {
    await query(
      `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value)]
    );
  }
}

/**
 * Every step is ON CONFLICT DO NOTHING, so seeding an already-seeded database
 * changes nothing. It never overwrites work someone has already done.
 *
 * `clean: true` (naye client ke liye) sirf roles, ek Super Admin, aur app
 * chalane ke liye zaroori cheezein (system emails, settings, generic starter
 * templates) banata hai — koi Gowebkart wala fake contact/campaign/user nahi.
 */
export async function seed({ clean = false } = {}) {
  await migrate();

  await transaction(async () => {
    await seedRoles();

    if (clean) {
      await seedCleanAdmin();
    } else {
      await seedUsers();
      await seedContacts();
      await seedAccounts();
      await seedCampaigns();
      await seedSubscribers();
      await seedActivity();
    }

    await seedTemplates();
    await seedSystemEmails();
    await seedSettings();
  });

  const counts = await many(`
    SELECT 'roles' AS name, count(*)::int AS n FROM roles
    UNION ALL SELECT 'users', count(*)::int FROM users
    UNION ALL SELECT 'contacts', count(*)::int FROM contacts
    UNION ALL SELECT 'templates', count(*)::int FROM templates
    UNION ALL SELECT 'accounts', count(*)::int FROM email_accounts
    UNION ALL SELECT 'campaigns', count(*)::int FROM campaigns
    UNION ALL SELECT 'recipients', count(*)::int FROM campaign_recipients
    UNION ALL SELECT 'subscribers', count(*)::int FROM subscribers
    UNION ALL SELECT 'system_emails', count(*)::int FROM system_emails
    UNION ALL SELECT 'activity', count(*)::int FROM activity_log
    ORDER BY name
  `);

  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const clean = process.argv.includes('--clean');

  seed({ clean })
    .then(async (counts) => {
      console.log(clean ? 'Seeded (clean — no demo data):' : 'Seeded:');
      for (const row of counts) console.log(`  ${String(row.name).padEnd(14)} ${row.n}`);
      console.log(`\nSign in with ${env.seedEmail} / ${env.seedPassword}`);
      await closeDb();
    })
    .catch(async (error) => {
      console.error('Seed failed:', error);
      await closeDb();
      process.exit(1);
    });
}

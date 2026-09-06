-- ---------------------------------------------------------------------------
-- MailWave schema.
--
-- Plain Postgres, no extensions: PGlite runs it today with no database to
-- install, and the same file runs unchanged against a hosted Postgres when
-- this outgrows a single machine.
--
-- Ids are text with a readable prefix (u_, cmp_, tpl_) rather than bare UUIDs,
-- so a row in a log or a URL says what it is.
-- ---------------------------------------------------------------------------

-- --- roles and people -------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  key         text PRIMARY KEY,
  label       text,               -- typed by a Super Admin
  label_key   text,               -- or a translation key, for the starter roles
  descr       text,
  descr_key   text,
  tone        text NOT NULL DEFAULT 'primary',
  icon        text NOT NULL DEFAULT 'bi-person',
  locked      boolean NOT NULL DEFAULT false,   -- super_admin cannot be reduced
  custom      boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per allowed action. Absence of a row means "not allowed".
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key    text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  module      text NOT NULL,
  action      text NOT NULL,
  PRIMARY KEY (role_key, module, action)
);

CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text,                              -- null until they set one
  role_key      text NOT NULL REFERENCES roles(key),
  status        text NOT NULL DEFAULT 'Invited',   -- Active | Invited | Disabled
  department    text,
  initials      text,
  last_active   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_key);

-- Refresh tokens are stored hashed: a leaked database row cannot be replayed.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  user_agent  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Har user ne pehle kis IP se login kiya hai — "naye device se sign-in" email
-- isi se decide hoti hai. refresh_tokens is kaam ke liye theek nahi thi:
-- token revoke/expire hote rehte hain, jabki yeh record hamesha ke liye
-- rehna chahiye. UNIQUE (user_id, ip) khud hi ek insaan ko ek hi IP ke liye
-- do baar email jaane se rokta hai, chahe do login request ek saath aa jayein.
CREATE TABLE IF NOT EXISTS known_devices (
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip            text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ip)
);

-- Single-use tokens for "set your password" and "forgot password".
CREATE TABLE IF NOT EXISTS password_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  purpose     text NOT NULL,           -- invite | reset
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Email change is a promise until the NEW address proves it can receive mail.
-- The users row keeps the old email until this token is used.
CREATE TABLE IF NOT EXISTS email_change_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email   text NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- --- contacts ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contact_groups (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  tone        text NOT NULL DEFAULT 'primary',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id             text PRIMARY KEY,
  name           text,
  email          text NOT NULL,
  phone          text,
  company        text,
  city           text,
  group_id       text REFERENCES contact_groups(id) ON DELETE SET NULL,
  tags           text[] NOT NULL DEFAULT '{}',
  status         text NOT NULL DEFAULT 'Subscribed',  -- Subscribed | Unsubscribed | Bounced
  consent_source text,
  custom_fields  jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_on       timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- One address may only appear once. Import de-duplication leans on this.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_key ON contacts (lower(email));
CREATE INDEX IF NOT EXISTS contacts_group_idx ON contacts (group_id);
CREATE INDEX IF NOT EXISTS contacts_status_idx ON contacts (status);

-- Addresses that must never be emailed again, whatever list they turn up on.
CREATE TABLE IF NOT EXISTS suppression (
  email       text PRIMARY KEY,
  reason      text NOT NULL,          -- unsubscribed | bounced | complaint | manual
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  rule        jsonb NOT NULL,         -- { conditions: [...], join: 'and' | 'or' }
  tone        text NOT NULL DEFAULT 'primary',
  created_by  text REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- --- templates and images ---------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'Custom',
  subject     text,
  html        text NOT NULL DEFAULT '',
  created_by  text REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  url         text NOT NULL,
  size_bytes  bigint NOT NULL DEFAULT 0,
  source      text NOT NULL DEFAULT 'upload',   -- upload | url
  uploaded_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- --- sending accounts -------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_accounts (
  id            text PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  display_name  text,
  provider      text NOT NULL,                  -- google | microsoft | smtp | sendgrid | ...
  status        text NOT NULL DEFAULT 'Connected',
  daily_limit   integer NOT NULL DEFAULT 500,
  sent_today    integer NOT NULL DEFAULT 0,
  quota_date    date,
  -- Credentials never leave the server and are never returned by the API.
  secrets       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- --- campaigns --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS campaigns (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  account_id        text REFERENCES email_accounts(id) ON DELETE SET NULL,
  sender_name       text,
  reply_to          text,
  subject           text NOT NULL DEFAULT '',
  preheader         text,
  template_id       text REFERENCES templates(id) ON DELETE SET NULL,
  -- The HTML actually sent, frozen at send time. Editing the template later
  -- must never rewrite what people already received.
  html              text NOT NULL DEFAULT '',
  batch_size        integer NOT NULL DEFAULT 100,
  batch_delay       integer NOT NULL DEFAULT 2,      -- minutes
  open_tracking     boolean NOT NULL DEFAULT true,
  click_tracking    boolean NOT NULL DEFAULT false,
  subscribe_button  boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'Draft',   -- Draft|Scheduled|Sending|Paused|Sent|Failed
  -- 'quota' — apne aap ruki (aaj ki limit khatam); 'manual' — insaan ne roka.
  -- Isi se pata chalta hai kal khud-ba-khud chalu karni hai ya nahi.
  pause_reason      text,
  scheduled_at      timestamptz,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_by        text REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Purane database me yeh column nahi hoga — naye deploy par apne aap jud jata hai.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pause_reason text;

CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id            text PRIMARY KEY,
  campaign_id   text NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    text REFERENCES contacts(id) ON DELETE SET NULL,
  email         text NOT NULL,
  name          text,
  merge_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'Pending',  -- Pending|Sent|Delivered|Failed|Bounced
  error         text,
  sent_at       timestamptz,
  open_count    integer NOT NULL DEFAULT 0,
  first_open_at timestamptz,
  last_open_at  timestamptz,
  click_count   integer NOT NULL DEFAULT 0,
  last_click_at timestamptz,
  unsubscribed  boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique
  ON campaign_recipients (campaign_id, lower(email));
CREATE INDEX IF NOT EXISTS campaign_recipients_status_idx
  ON campaign_recipients (campaign_id, status);

-- Every tracked link in a campaign, so a click can be attributed and the
-- original destination restored.
CREATE TABLE IF NOT EXISTS campaign_links (
  id           text PRIMARY KEY,
  campaign_id  text NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url          text NOT NULL,
  label        text,
  click_count  integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS campaign_links_campaign_idx ON campaign_links (campaign_id);

-- Raw events. Counters above are the fast path; these are the audit trail.
CREATE TABLE IF NOT EXISTS tracking_events (
  id           bigserial PRIMARY KEY,
  campaign_id  text NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id text REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  link_id      text REFERENCES campaign_links(id) ON DELETE SET NULL,
  kind         text NOT NULL,          -- open | click | unsubscribe | subscribe | bounce
  user_agent   text,
  ip           text,
  at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_events_campaign_idx ON tracking_events (campaign_id, kind);
CREATE INDEX IF NOT EXISTS tracking_events_at_idx ON tracking_events (at);

-- --- subscribers ------------------------------------------------------------

-- People who pressed Subscribe inside a campaign email. Stronger than an
-- imported contact: they asked to hear more.
CREATE TABLE IF NOT EXISTS subscribers (
  id            text PRIMARY KEY,
  name          text,
  email         text NOT NULL,
  company       text,
  city          text,
  campaign_id   text REFERENCES campaigns(id) ON DELETE SET NULL,
  status        text NOT NULL DEFAULT 'Subscribed',
  subscribed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key ON subscribers (lower(email));

-- --- workspace ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_emails (
  key         text PRIMARY KEY,
  subject     text NOT NULL,
  html        text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          text PRIMARY KEY,
  user_id     text REFERENCES users(id) ON DELETE SET NULL,
  user_name   text,
  initials    text,
  action      text NOT NULL,
  module      text NOT NULL,
  item        text,
  detail      text,
  before_val  text,
  after_val   text,
  ip          text,
  device      text,
  at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_at_idx ON activity_log (at DESC);
CREATE INDEX IF NOT EXISTS activity_log_module_idx ON activity_log (module);

-- --- backups ------------------------------------------------------------
--
-- Backup FILE (poora data, gzip-kiya hua JSON) kahin bhi ho sakti hai — disk
-- par ya S3-jaisi jagah (services/backupStorage.js dekho). Yeh table sirf
-- ISKI JAANKAARI rakhti hai: kaunsi backup bani, kab, kitni badi, kaam ki hai
-- ya nahi — taki "GET /api/backups" ko disk padhne ki zarurat na pade, aur
-- ek adhoori/fail hui backup kabhi "safal" na dikhe.
CREATE TABLE IF NOT EXISTS backups (
  id             text PRIMARY KEY,
  name           text NOT NULL UNIQUE,       -- storage me file/object ka naam
  -- Yeh sirf FILE ki apni haalat hai (bani/bigdi), restore alag cheez hai —
  -- warna ek restore attempt fail hone se ek bilkul theek backup bhi
  -- "kharab" dikhne lagta.
  status         text NOT NULL DEFAULT 'pending', -- pending|running|successful|failed
  reason         text NOT NULL DEFAULT 'manual',  -- manual|automatic|startup|upload
  storage_driver text,                       -- 'local' ya 's3' — us waqt jahan rakhi gayi
  format_version integer,
  size_bytes     bigint,
  table_count    integer,
  row_count      bigint,
  checksum       text,
  error          text,
  restored_at    timestamptz,                -- aakhri baar isse kab restore kiya gaya
  restore_error  text,                       -- aakhri restore koshish fail hui to kyun
  created_by     text REFERENCES users(id) ON DELETE SET NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backups_created_at_idx ON backups (created_at DESC);
CREATE INDEX IF NOT EXISTS backups_status_idx ON backups (status);

-- Applied migrations, so migrate.js is safe to run repeatedly.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     integer PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

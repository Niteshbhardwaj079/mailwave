// ---------------------------------------------------------------------------
// Developer Guide — content.
//
// This describes the CURRENT codebase, as of when each chapter was last
// checked against the actual files listed. It is not end-user help (that's
// guideChapters.js / the Guide page) — this is for whoever maintains,
// modifies, builds, deploys, migrates, or troubleshoots MailWave next.
//
// Deliberately NOT run through the i18n system like guideChapters.js is:
// file paths, command names, and env var names must never be translated,
// and this content is aimed at developers, not end users of the product.
// DeveloperGuidePage.jsx renders these fields directly as English text.
//
// Every file path, command, and env var name below was checked against the
// actual repository — nothing here is invented. If a file moves or is
// renamed, this file is what's now out of date, not the code.
//
// Section shape (all fields optional, a section can mix them):
//   heading      - string
//   paragraphs   - string[]              (renders as <p>, backticks -> inline code)
//   list         - string[]              (<ul>, backticks -> inline code)
//   numbered     - string[]              (<ol>, backticks -> inline code)
//   code         - string                (block, monospace)
//   codeLabel    - string                (small caption above a code block)
//   facts        - [term, description][] (label/value pairs)
//   fileCards    - { file, does, dependsOn, safe, careful }[]
//   table        - { headers: string[], rows: string[][] }
//   note         - { tone, icon, text }
// ---------------------------------------------------------------------------

export const devGuideChapters = [
  // =========================================================================
  {
    number: 1,
    key: 'overview',
    icon: 'bi-diagram-3',
    title: 'Architecture Overview',
    minutes: 5,
    sections: [
      {
        heading: 'Two applications, one repository',
        paragraphs: [
          'MailWave is a single git repository containing two independent applications that talk to each other only over HTTP: a React frontend at the repository root (`src/`), and an Express backend in `server/` with its own `package.json`, its own `node_modules`, and its own dependency lifecycle.',
          'They are not bundled together. In development they run as two separate processes on two separate ports. In production they are typically deployed as two separate services (a static frontend host and a backend web service), though a generic VPS can run both on the same machine behind one reverse proxy.',
        ],
        facts: [
          ['Frontend', '`src/` — React 19 + React Router 7 + Bootstrap 5/SCSS, built with Vite'],
          ['Backend', '`server/src/` — Node.js + Express 4 + PostgreSQL (`pg`)'],
          ['Communication', 'Frontend calls the backend only via `fetch`, at a base URL from `VITE_API_URL` (see Chapter 4)'],
          ['Shared config', '`brand.config.js` at the repo root — imported by both apps (see Chapter 15)'],
        ],
      },
      {
        heading: 'How a request actually flows',
        list: [
          'Browser loads the built frontend (static HTML/JS/CSS) from wherever it is hosted.',
          'React Router renders a page. If that page needs data, a component calls `src/api/client.js`, which sends a `fetch` request to the backend\'s base URL.',
          '`server/src/app.js` receives it: CORS check, rate limiting, then `requireAuth` (except for `/api/auth`, `/t`, and `/files`, which are intentionally public — see Chapter 13), then the specific route file in `server/src/routes/`.',
          'The route reads/writes Postgres via `server/src/db/client.js`, and returns JSON.',
          'For anything that isn\'t a normal request/response (sending a scheduled campaign, delivering a webhook, taking an automatic backup), an in-process background timer in `server/src/services/` does the work — see Chapter 5.',
        ],
      },
      {
        heading: 'Two database drivers, one SQL dialect',
        paragraphs: [
          '`server/src/db/client.js` can talk to either a real PostgreSQL server (via `pg`) or an embedded database called PGlite that runs inside the Node process and stores its data in a local folder. Which one is used is decided by a single environment variable: `DATABASE_URL`.',
          'If `DATABASE_URL` is set, the app connects to that real Postgres. If it is empty, it falls back to PGlite. The SQL in `server/src/db/schema.sql` and every route/service is identical either way — PGlite is Postgres-compatible.',
        ],
        note: {
          tone: 'warning',
          icon: 'bi-exclamation-triangle',
          text: 'PGlite is for local development and trying the app out ONLY. Its data folder can be corrupted by an unclean shutdown. Every real deployment must set `DATABASE_URL` to a real PostgreSQL server. `SETUP.md` section 5 covers this.',
        },
      },
    ],
  },

  // =========================================================================
  {
    number: 2,
    key: 'frontend-structure',
    icon: 'bi-folder2-open',
    title: 'Frontend Structure',
    minutes: 6,
    sections: [
      {
        heading: 'Top level',
        facts: [
          ['`src/main.jsx`', 'Entry point — mounts `<App />` with its providers (see below)'],
          ['`src/App.jsx`', 'All routes. Every page is registered here, most lazy-loaded (`lazy(() => import(...))`)'],
          ['`index.html`', 'The single HTML shell Vite builds into. Points at `/src/main.jsx`'],
          ['`vite.config.js`', 'Build tool config — React plugin, SCSS options, dev server port (5173)'],
          ['`brand.config.js`', 'App name/logo/company/theme defaults — repo root, shared with the backend'],
        ],
      },
      {
        heading: '`src/pages/` — one file per screen',
        paragraphs: [
          'Every routed page lives here as a single top-level component: `DashboardPage.jsx`, `CampaignsPage.jsx`, `CampaignWizardPage.jsx`, `CampaignAnalyticsPage.jsx`, `ContactsPage.jsx`, `ImportContactsPage.jsx`, `SegmentsPage.jsx`, `SubscribersPage.jsx`, `TemplatesPage.jsx`, `TemplateChooserPage.jsx`, `TemplateEditorPage.jsx`, `TemplateUploadPage.jsx`, `TemplateBuilderPage.jsx`, `TemplateEditRouterPage.jsx`, `TemplatePreviewPage.jsx`, `MediaLibraryPage.jsx`, `ReportsPage.jsx`, `EmailAccountsPage.jsx`, `ConnectAccountPage.jsx`, `SettingsPage.jsx`, `GuidePage.jsx`, `UsersPage.jsx`, `ActivityLogPage.jsx`, `OnboardingPage.jsx`, `LoginPage.jsx`, `ResetPasswordPage.jsx`, `ConfirmEmailPage.jsx`, `SystemEmailsPage.jsx`, `BackupPage.jsx`, `NotFoundPage.jsx`.',
          'A page owns its own data fetching (via `useApi`/`useServerList`), its own local state, and composes components from `src/components/`. Pages are the unit that `src/App.jsx` lazy-loads, so each one is its own JS chunk in the production build.',
        ],
      },
      {
        heading: '`src/components/` — reusable pieces, grouped by what they\'re for',
        facts: [
          ['`components/layout/`', '`AppLayout.jsx` (the signed-in shell: sidebar + topbar + `<Outlet/>`), `Sidebar.jsx`, `Topbar.jsx`, `navItems.js` (the nav data), `ThemeControls.jsx`, `LanguagePicker.jsx`'],
          ['`components/routing/`', '`RequireAuth.jsx` (must be signed in), `RequireModule.jsx` (must have the permission)'],
          ['`components/ui/`', 'Generic building blocks used all over the app — `Card.jsx`, `Sheet.jsx` (the modal/bottom-sheet), `Controls.jsx` (inputs, `Note`, search), `PageHeader.jsx`, `StatusPill.jsx`, `Pagination.jsx`, `ToastProvider.jsx`, `PageLoader.jsx`, `EmptyState.jsx`, and more'],
          ['`components/campaigns/`', '`CampaignTable.jsx` — the shared list/table used by the Campaigns page'],
          ['`components/charts/`', '`PerformanceChart.jsx`, `DeliveryDonut.jsx`, `OpensHeatmap.jsx`, `ChartTooltip.jsx` — built on `recharts`'],
          ['`components/contacts/`', '`ContactFilterFields.jsx` — the reusable contact-filter form used by Contacts/Segments'],
          ['`components/templates/`', 'Template editing UI — `RichTextEditor.jsx`, `HtmlPreview.jsx`, `ImageLibrary.jsx`, `TemplateDesignEditor.jsx`, `TemplateFullPreview.jsx`, `DynamicFieldManager.jsx`/`DynamicFieldPicker.jsx`, plus `components/templates/builder/` (the drag-and-drop block builder: `BuilderCanvas.jsx`, `BuilderRow.jsx`, `BuilderColumn.jsx`, `BuilderBlock.jsx`, `BuilderBlockPalette.jsx`, `BuilderBlockSettings.jsx`, `BuilderDevicePreview.jsx`)'],
          ['`components/wizard/`', 'The 6-step Create/Edit Campaign wizard — `Stepper.jsx` plus one file per step: `StepInfo.jsx`, `StepRecipients.jsx`, `StepTemplate.jsx`, `StepContent.jsx`, `StepSettings.jsx`, `StepReview.jsx`'],
        ],
      },
      {
        heading: 'State, data, and cross-cutting concerns',
        facts: [
          ['`src/store/AuthProvider.jsx`', 'Who is signed in — see Chapter 13'],
          ['`src/store/WorkspaceProvider.jsx`', 'Shared workspace data (templates, users, subscribers) and the `can(module, action)` permission check the UI uses everywhere'],
          ['`src/api/client.js`', 'The one place every HTTP call goes through — base URL, auth header, automatic token refresh'],
          ['`src/api/useApi.js` / `useServerList.js`', 'Hooks that wrap `client.js` for "fetch this on mount" and "fetch this paginated/filtered list" respectively'],
          ['`src/i18n/`', '`I18nProvider.jsx` plus `locales/` — one file per language (17 languages), each a flat `{ \'key\': \'text\' }` object'],
          ['`src/theme/ThemeProvider.jsx`', 'Light/dark mode + accent color, persisted per browser'],
          ['`src/config/appConfig.js`', 'Re-exports `brand.config.js` under the name older code already imports (see Chapter 15)'],
          ['`src/data/`', 'Static data and pure logic that isn\'t a component — `constants.js` (dropdown options), `templateBuilder.js` and `builderCompiler.js`/`builderSchemaOps.js` (template builder logic), `dynamicFields.js`, `guideChapters.js` (end-user Guide content), `developerGuideChapters.js` (this file), `storageProviders.js`, `systemEmails.js`/`systemEmailTranslations.js`'],
          ['`src/utils/`', 'Small focused helpers — `format.js` (number/date formatting), `sendEstimate.js` (batch-size time estimate), `roles.js`, `validation.js`, `download.js`, `readSheet.js` (client-side Excel/CSV parsing for contact import), `campaignReport.js`'],
          ['`src/styles/`', 'The whole design system — see Chapter 15 for how it scales; page-specific SCSS lives in `_pages.scss`, shared components in `_components.scss`, one-off feature blocks in `_features.scss`'],
        ],
      },
      {
        heading: 'How a screen is actually assembled',
        paragraphs: [
          'A typical page (e.g. `ContactsPage.jsx`) renders `<PageHeader>` for the title/actions, a `<Card>` containing a `<FilterBar>`/`<SearchInput>`, a `<table className="mw-table">` or a grid of cards, and a `<Pagination>` footer. Data comes from `useServerList(\'/api/contacts\', { params: ... })`, which handles the fetch, loading state, and page/limit state together.',
          'This same shape repeats across Contacts, Templates, Campaigns, Users, Activity Log, and Backups — once you understand one list page, you understand most of them.',
        ],
      },
      {
        heading: 'The topbar notifications panel',
        paragraphs: [
          '`Topbar.jsx`\'s bell icon shows a real unread count badge (capped at `9+`), not just a dot. The dropdown itself (`.mw-notifpanel` in `src/styles/_features.scss`) has a fixed width and an internally scrolling list past a max-height, rather than growing the page.',
          'It combines Bootstrap\'s own `dropdown-menu`/`show` classes with the custom `.mw-notifpanel` class — for any layout property both define (e.g. `display`), Bootstrap\'s more specific two-class selector silently wins regardless of stylesheet order. That is why the scroll/max-height is set on the child list (`.mw-notifpanel__list`) rather than relied on via a flex layout on the panel itself. The older `.mw-langmenu` dropdown avoids this entirely by never combining with Bootstrap\'s classes in the first place — worth copying that approach for any brand-new dropdown, rather than this workaround.',
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 3,
    key: 'backend-structure',
    icon: 'bi-hdd-rack',
    title: 'Backend Structure',
    minutes: 6,
    sections: [
      {
        heading: 'Top level (`server/`)',
        facts: [
          ['`server/src/index.js`', 'Process entry point — checks the port is free, runs migrations, starts the scheduler/backup schedule/webhook worker, starts listening, and handles graceful shutdown (`SIGINT`/`SIGTERM`/`SIGHUP`/`SIGBREAK`)'],
          ['`server/src/app.js`', 'Builds the Express app — `helmet`, CORS, rate limiting, and every route mounted (this is the map of every URL prefix the API answers to)'],
          ['`server/src/env.js`', 'Reads every environment variable ONCE into a single exported `env` object — nothing else in the backend reads `process.env` directly for these (see Chapter 14)'],
          ['`server/package.json`', 'Backend dependencies and scripts — independent from the root `package.json`'],
          ['`server/.env.example`', 'The documented list of every environment variable this backend reads'],
          ['`server/data/`', 'Runtime-only, gitignored — PGlite\'s files (if used) and local backup files (if `BACKUP_STORAGE=local`) live here'],
        ],
      },
      {
        heading: '`server/src/routes/` — one file per resource, mounted in `app.js`',
        paragraphs: [
          'Every route file exports an Express `Router`. `app.js` mounts each one at a URL prefix, almost always behind `requireAuth`. See Chapter 4 for the full list with what each one covers.',
        ],
      },
      {
        heading: '`server/src/services/` — logic that isn\'t a direct HTTP handler',
        list: [
          '`sender.js` — the campaign-sending engine (batching, quota, suppression checks)',
          '`mailer.js` — builds a nodemailer transport per connected account and sends one email',
          '`render.js` — turns a template + recipient into the final HTML/text that gets sent (token substitution, tracking pixel/links injected)',
          '`scheduler.js` — checks every minute for campaigns whose scheduled time has arrived',
          '`webhooks.js` — queues and delivers webhook events with retry',
          '`backup.js` / `backupStorage.js` — the backup/restore system (Chapter 7)',
          '`objectStorage.js` — the client\'s connected S3-compatible bucket (Chapter 8)',
          '`campaignReport.js` — builds the downloadable `.xlsx` campaign report',
          '`providers.js` — known-SMTP-provider presets (Gmail, Outlook, etc.) for the Connect Account UI',
          '`systemMail.js` — sends MailWave\'s OWN emails (password reset, invites, alerts to Super Admins)',
        ],
      },
      {
        heading: '`server/src/middleware/`, `server/src/lib/`, `server/src/db/`',
        facts: [
          ['`middleware/auth.js`', '`requireAuth` — verifies the JWT or API key on every protected request, loads the real user row fresh from the database'],
          ['`middleware/permissions.js`', '`requireModule(module, action)` — the server-side permission check every route that touches sensitive data uses'],
          ['`middleware/errors.js`', 'Turns thrown errors into a consistent JSON error shape'],
          ['`lib/tokens.js`', 'Signs/verifies JWTs, generates refresh tokens'],
          ['`lib/password.js`', 'Hashing/verifying user passwords'],
          ['`lib/secretbox.js`', 'Encrypts connected email accounts\' SMTP passwords (key derived from `JWT_SECRET`)'],
          ['`lib/crypto.js`', 'Encrypts Object Storage\'s secret access key (same `JWT_SECRET`-derived approach)'],
          ['`lib/activity.js`', 'Writes rows to the Activity Log'],
          ['`lib/storageProviders.js`', 'The list of supported S3-compatible providers and their connection quirks'],
          ['`lib/validate.js`', 'Wraps a Zod schema as Express middleware for request-body validation'],
          ['`lib/http.js`', '`asyncHandler` (catches async errors), `badRequest`/`unauthorized`/`forbidden`/`notFound` helpers'],
          ['`lib/ids.js`', '`newId(prefix)` — every row\'s primary key in this app'],
          ['`db/client.js`', 'The dual-driver (Postgres/PGlite) connection layer — every query in the app goes through this'],
          ['`db/schema.sql`', 'The entire database schema, every table, written as idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements'],
          ['`db/migrate.js`', 'Runs `schema.sql` — safe to run on every boot and does'],
          ['`db/seed.js`', 'Populates a fresh database — see Chapter 17'],
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 4,
    key: 'routes',
    icon: 'bi-signpost-split',
    title: 'Routes & API Reference',
    minutes: 5,
    sections: [
      {
        heading: 'How routes are mounted',
        paragraphs: [
          'Every prefix below is registered in `server/src/app.js`. Except where noted, each one requires a valid session (`requireAuth`) and most routes additionally check a specific module/action permission inside the route file itself (`requireModule(...)`, from `middleware/permissions.js`).',
        ],
      },
      {
        heading: 'Route map',
        table: {
          headers: ['Mounted at', 'File', 'Covers'],
          rows: [
            ['`/api/auth`', '`routes/auth.js`', 'Login, logout, refresh, password reset, invite acceptance — public (no `requireAuth`)'],
            ['`/api/contacts`', '`routes/contacts.js`', 'Contact CRUD, bulk actions, dedupe, groups'],
            ['`/api/templates`', '`routes/templates.js`', 'Template CRUD, categories, sources (custom/upload/builder)'],
            ['`/api/campaigns`', '`routes/campaigns.js`', 'Campaign CRUD, wizard save, schedule, pause/resume, `.xlsx` report'],
            ['`/api/accounts`', '`routes/accounts.js`', 'Connected email accounts — connect, test, edit, disconnect'],
            ['`/api/users`', '`routes/users.js`', 'Team members — invite, edit, disable, delete'],
            ['`/api/roles`', '`routes/roles.js`', 'Roles and their permission matrix'],
            ['`/api/stats`', '`routes/stats.js`', 'Dashboard counts and quota — what the sidebar/topbar read'],
            ['`/api/activity`', '`routes/activity.js`', 'The Activity Log list'],
            ['`/api/subscribers`', '`routes/subscribers.js`', 'People who clicked "Subscribe" in an email'],
            ['`/api/system-emails`', '`routes/systemEmails.js`', 'The editable templates for MailWave\'s own emails (reset, invite, alerts)'],
            ['`/api/segments`', '`routes/segments.js`', 'Saved contact filters'],
            ['`/api/images`', '`routes/images.js`', 'Media Library upload/list/delete (base64 in, `sharp`-processed)'],
            ['`/api/backups`', '`routes/backup.js`', 'Backup list/create/download/delete/restore/upload/acknowledge — Super Admin only (Chapter 7)'],
            ['`/api/settings`', '`routes/settings.js`', 'Per-key workspace settings (sending, tracking, contacts, unsubscribe, templateSources, imageStorage, dynamicFields, backupSettings)'],
            ['`/api/api-keys`', '`routes/apiKeys.js`', 'API keys for external programs to call this API'],
            ['`/api/webhooks`', '`routes/webhooks.js`', 'Webhook URL/secret configuration, delivery history'],
            ['`/api/storage-settings`', '`routes/storageSettings.js`', 'The client\'s connected Object Storage bucket (Chapter 8)'],
            ['`/t`', '`routes/track.js`', 'Tracking pixel, click redirects, unsubscribe/subscribe links — PUBLIC (opened by recipients\' mail clients, never logged in)'],
            ['`/files`', '`routes/files.js`', 'Serves uploaded images — PUBLIC (opened by recipients\' mail clients)'],
            ['`/api/health`', '`app.js` directly', 'Health check — `{ ok, service, env, time }`, used by hosting platforms and deploy verification'],
          ],
        },
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/app.js',
            does: 'Builds the Express app: security middleware, CORS, rate limiting, mounts every route file at its URL prefix.',
            dependsOn: '`server/src/index.js` (calls `createApp()`), every file in `routes/`.',
            safe: 'Adding a new route mount for a new route file.',
            careful: 'The mount order matters for `/api/backups` (it needs the raw request body for file uploads, so it is NOT behind the global `express.json()` body size the same way) — read the comment above it before moving things around.',
          },
          {
            file: 'server/src/middleware/permissions.js',
            does: 'The actual server-side authorization check — `roleCan()` queries the `role_permissions` table (super_admin always passes).',
            dependsOn: 'Every route that calls `requireModule(...)`.',
            safe: 'Nothing here typically needs changing — the permission model itself is data (the `role_permissions` table), not code.',
            careful: 'This is the REAL access control. The frontend\'s `can()` check (`WorkspaceProvider.jsx`) only hides UI — it is not a security boundary by itself.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 5,
    key: 'services',
    icon: 'bi-gear-wide-connected',
    title: 'Services & Background Processes',
    minutes: 5,
    sections: [
      {
        heading: 'The pattern: in-process timers, not external cron',
        paragraphs: [
          'MailWave has no dependency on OS-level cron, a job queue service, or serverless functions. Every recurring background task is a plain `setInterval` started once when the server boots (in `server/src/index.js`), running inside the same long-lived Node process as the API itself.',
          'This means the app needs an always-on host (a VPS, or a "Web Service" on a PaaS) — it will NOT work correctly on serverless/edge platforms (see Chapter 19), because those don\'t keep a process alive between requests.',
        ],
      },
      {
        heading: 'The three background loops',
        facts: [
          ['Scheduler — `services/scheduler.js`', 'Every 60 seconds: finds campaigns whose `scheduled_at` has passed and starts them. Also resumes campaigns paused only because a daily send quota ran out. Runs once immediately on boot too, so nothing scheduled during downtime is missed.'],
          ['Backup schedule — `services/backup.js`', 'One backup on every server start, then checks every 6 hours whether `BACKUP_EVERY_DAYS` has elapsed since the last one. Also runs monthly consolidation and retention/storage-limit cleanup on that same 6-hour check.'],
          ['Webhook worker — `services/webhooks.js`', 'Every 30 seconds: sends up to 20 due webhook events, with exponential backoff retry on failure.'],
        ],
      },
      {
        heading: 'The campaign-sending engine',
        paragraphs: [
          '`services/sender.js` sends in batches, not all at once, specifically because sending thousands of emails back-to-back gets real SMTP/Gmail/Outlook accounts flagged or blocked. Between batches it waits using `setTimeout` wrapped in a promise — an async wait, not a blocking loop, so the rest of the server (API requests, the scheduler) keeps working normally during a long send.',
          'Before sending to any address, it checks: the address isn\'t on the suppression list (unsubscribed/bounced), the sending account hasn\'t hit its daily limit, and the campaign hasn\'t been paused since the batch started. Recipients are pulled with a `LIMIT`-bound query per batch, never all loaded into memory at once — this is what makes very large recipient lists (tens of thousands) safe to send.',
          'If the server restarts mid-send, `recoverStuckCampaigns()` (called once, at boot, from `scheduler.js`) resumes exactly where it left off — per-recipient status in `campaign_recipients` is the source of truth, so nothing gets re-sent or silently dropped.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/services/sender.js',
            does: 'Sends a campaign: batches recipients, checks suppression/quota/pause state, calls `render.js` then `mailer.js` per recipient, updates status, retries failures once if enabled.',
            dependsOn: '`services/scheduler.js` (starts it), `services/render.js`, `services/mailer.js`, the `campaigns`/`campaign_recipients`/`email_accounts` tables.',
            safe: 'Adjusting log messages, adding new pause reasons for new failure types.',
            careful: 'The batch/delay/quota logic is deliberately conservative to avoid getting sending accounts blocked by mail providers — do not remove the inter-batch delay or the daily-limit check without understanding why they exist.',
          },
          {
            file: 'server/src/services/scheduler.js',
            does: 'The 60-second loop that starts due campaigns and resumes quota-paused ones.',
            dependsOn: '`server/src/index.js` (`startScheduler()`), `services/sender.js` (`startCampaign`, `recoverStuckCampaigns`).',
            safe: 'Changing `EVERY_MS` if a different check frequency is genuinely needed.',
            careful: '`recoverStuckCampaigns()` must only run once, at boot — the comment in the file explains why running it repeatedly would be wrong.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 6,
    key: 'database',
    icon: 'bi-database',
    title: 'Database',
    minutes: 6,
    sections: [
      {
        heading: 'Schema and migrations',
        paragraphs: [
          'The entire schema lives in one file: `server/src/db/schema.sql`. Every statement is `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — meaning it is safe to run on every single server start, on a brand-new database or a ten-version-old one. `server/src/db/migrate.js` does exactly that, and `server/src/index.js` calls it before the server starts listening.',
          'There is no separate numbered-migration-files system (no `migrations/0001_x.sql`, `0002_y.sql`). A schema change is made by editing `schema.sql` directly and adding the new `CREATE TABLE`/`ALTER TABLE` statements — they run automatically the next time the server boots.',
        ],
        note: {
          tone: 'info',
          icon: 'bi-info-circle',
          text: 'To apply a schema change without restarting the whole server, run `npm run migrate` from inside `server/` — see Chapter 16 for exact commands.',
        },
      },
      {
        heading: 'Tables (from `schema.sql`)',
        table: {
          headers: ['Table', 'What it holds'],
          rows: [
            ['`roles`, `role_permissions`', 'Role definitions and the module/action permission matrix'],
            ['`role_account_access`', 'Which connected email accounts a role may use. No rows for a role = unrestricted (every account) — opt-in restriction, the opposite default from `role_permissions`. See its comment in `schema.sql`.'],
            ['`users`, `refresh_tokens`, `known_devices`', 'Team members and their sessions'],
            ['`password_tokens`, `email_change_tokens`', 'Short-lived tokens for reset-password/invite/email-change links'],
            ['`contact_groups`, `contacts`, `suppression`', 'The contact list and who must never receive email again'],
            ['`segments`', 'Saved contact filters'],
            ['`templates`, `template_categories`', 'Email templates and their categories'],
            ['`images`', 'Uploaded images (Media Library) — either stored inline or pointing at Object Storage'],
            ['`storage_settings`', 'The client\'s connected Object Storage bucket config (secret key encrypted)'],
            ['`email_accounts`', 'Connected SMTP accounts (password encrypted), daily send counters'],
            ['`campaigns`, `campaign_recipients`, `campaign_links`, `tracking_events`', 'Campaigns, their per-recipient send status, per-link click tracking, and open/click events'],
            ['`subscribers`', 'People who clicked "Subscribe" from a sent email'],
            ['`system_emails`, `system_email_translations`', 'MailWave\'s own transactional email content, per language'],
            ['`settings`', 'A generic key/value table for workspace settings — one row per settings "key" (e.g. `sending`, `backupSettings`), each with a Zod schema in `routes/settings.js`'],
            ['`activity_log`', 'The Activity Log page\'s data'],
            ['`backups`', 'Backup bookkeeping (not the backup files themselves — see Chapter 7)'],
            ['`api_keys`', 'Hashed API keys for external programs'],
            ['`webhook_deliveries`', 'The webhook delivery queue/history'],
            ['`schema_migrations`', 'A single marker row — not really used for versioning since `schema.sql` is idempotent'],
          ],
        },
      },
      {
        heading: 'The dual-driver connection layer',
        paragraphs: [
          '`server/src/db/client.js` exports `query()`, `many()`, `one()`, `exec()`, and `transaction()` — every single database access in the whole backend goes through one of these, never a raw `pg` client or PGlite handle directly. This is what makes the Postgres/PGlite split invisible to every route and service.',
          'It also contains the actual backup dump/restore SQL logic (`dumpDatabase()`, `restoreDatabase()`, `readAndValidateBackup()`) — see Chapter 7.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/db/client.js',
            does: 'The connection layer for both drivers, plus the backup dump/restore SQL and the topological table-ordering logic restore uses to respect foreign keys.',
            dependsOn: 'Every route and service in the backend.',
            safe: 'Nothing here is typically touched unless changing how backup/restore or the connection pooling itself works.',
            careful: 'Transaction pinning (`withClient`/`runInTransaction`) exists because a connection pool can hand different physical connections to sequential calls — breaking that pinning silently breaks transaction atomicity. Read the comments before changing how `query()` resolves its connection.',
          },
          {
            file: 'server/src/db/schema.sql',
            does: 'The complete, current database schema.',
            dependsOn: '`db/migrate.js` (runs it on every boot), every route/service that queries a table defined here.',
            safe: 'Adding a new `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for a new feature.',
            careful: 'Never edit a statement that already shipped in a way that would change an EXISTING column\'s type/constraint destructively — `IF NOT EXISTS` means an edited `CREATE TABLE` for a table that already exists on someone\'s server does nothing; you need an `ALTER TABLE` instead.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 7,
    key: 'backup',
    icon: 'bi-shield-check',
    title: 'Backup & Restore System',
    minutes: 6,
    sections: [
      {
        heading: 'The three layers',
        facts: [
          ['`server/src/db/client.js`', 'WHAT gets backed up — `dumpDatabase()` reads every table (except a few excluded bookkeeping ones) into gzip JSON; `restoreDatabase()` truncates and reloads from it, inside one transaction'],
          ['`server/src/services/backupStorage.js`', 'WHERE the backup file is kept — `LocalDiskStorage` (server\'s own disk) or `S3Storage` (any S3-compatible bucket), picked by `BACKUP_STORAGE`'],
          ['`server/src/services/backup.js`', 'Orchestration — create/list/prune, monthly consolidation, retention + storage-limit cleanup, restore safety, duplicate detection, the automatic schedule'],
        ],
      },
      {
        heading: 'What actually happens on a backup',
        numbered: [
          'A `backups` table row is inserted with `status = \'running\'`.',
          '`dumpDatabase()` reads every non-excluded table into one gzip JSON file, with a sha256 checksum of its contents.',
          'The file is validated by reading it straight back (`readAndValidateBackup`) — a corrupted dump is caught before it is ever marked successful.',
          'It is saved via the storage abstraction (local disk or S3).',
          'The row is updated to `status = \'successful\'`.',
          'Monthly consolidation and retention/storage-limit cleanup run — but only now, after the new backup is verified. Nothing old is ever removed before the new one is confirmed good.',
        ],
      },
      {
        heading: 'Monthly consolidation, retention, and duplicate detection',
        list: [
          'Once a calendar month is fully complete, its daily backups are combined into one file (`mailwave-backup-2026-09.tar.gz`) and the individual daily backups from that month are removed — one file per month, not a pile.',
          'Settings > Backup (Settings page) controls retention (1–6 months of monthly backups) and a maximum total storage size — both stored in the `settings` table under the key `backupSettings`, not an env var, so they can change without a redeploy.',
          'Cleanup never removes the single most recent backup, and never removes the one daily backup a not-yet-consolidated month still needs.',
          'Uploading a backup file compares its content checksum against the current live database AND every already-saved backup — a byte-identical file is detected and not duplicated, regardless of its filename.',
        ],
      },
      {
        heading: 'Restore safety',
        paragraphs: [
          'On real Postgres, restore is instant (one transaction, no restart) — but before it starts, `restoreFromBackup()` automatically creates and verifies a fresh safety backup of whatever is in the database right now. If that safety backup cannot be created, restore does not start at all and the existing database is never touched.',
          'On PGlite (local development only), restore instead marks a pending-restore file and applies it on the next server start, since a running PGlite instance cannot safely be swapped out from under itself.',
        ],
        note: {
          tone: 'warning',
          icon: 'bi-exclamation-triangle',
          text: 'Restore signs everyone out and replaces the current data with the backup\'s data. This is expected, destructive-by-design behavior — it is why the UI requires typing `RESTORE` to confirm.',
        },
      },
      {
        heading: 'Database storage usage (Backups page)',
        paragraphs: [
          '`GET /api/backups` also returns a `database` block: used bytes come from `SELECT pg_database_size(current_database())` (`services/backup.js`\'s `getDatabaseSizeBytes()`) — a standard Postgres function, confirmed to also work unchanged on PGlite, so this stays correct across any Postgres-family host without host-specific code.',
          'An admin can optionally type in a real storage limit (in Settings, both for the database and separately for Media Library — see Chapter 8) — stored together as one `storageLimits` settings row (`{ databaseBytes, mediaBytes }`, both nullable), the same pattern `backupSettings.maxStorageBytes` already used. No host exposes "total plan size" in a portable way over SQL, so this can\'t be auto-detected: without a limit set, the page shows plain used-bytes text; once one is set, it becomes a used/limit percentage bar.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/services/backup.js',
            does: 'Everything backup-related that isn\'t "what SQL to run" or "where to put the file": scheduling, monthly consolidation, retention/storage-limit enforcement, duplicate detection, restore safety, the notification for a newly-ready monthly file, and reporting real database size (`getDatabaseSizeBytes()`).',
            dependsOn: '`server/src/routes/backup.js` (the API), `server/src/index.js` (`startBackupSchedule()`), `src/pages/BackupPage.jsx` and `src/pages/SettingsPage.jsx` (Backup section) on the frontend.',
            safe: 'Changing `EVERY_DAYS`\' default, adjusting log messages.',
            careful: 'The order of operations in `createBackup()` (dump -> validate -> save -> mark successful -> THEN clean up old ones) is intentional — reordering it risks deleting a good backup before a new one is confirmed to exist.',
          },
          {
            file: 'server/src/services/backupStorage.js',
            does: 'The storage abstraction — `save`/`read`/`delete`/`exists`/`isDurable`/`describe`, implemented once for local disk and once for any S3-compatible bucket.',
            dependsOn: '`services/backup.js` calls `getBackupStorage()` for every file operation.',
            safe: 'Adding a new storage backend by implementing the same five methods.',
            careful: 'Every `name` passed in is already server-generated and validated elsewhere — `assertSafeName()` exists as defense-in-depth, not the only check.',
          },
          {
            file: 'src/pages/BackupPage.jsx',
            does: 'The Backups screen — create/download/delete/restore/upload, the storage usage bar, and the "Monthly Backup Ready" modal.',
            dependsOn: '`/api/backups` (all methods).',
            safe: 'Adjusting layout, adding a display column.',
            careful: 'The delete and restore confirmations exist specifically to prevent accidental data loss — do not remove the typed `RESTORE` confirmation or the delete confirmation sheet.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 8,
    key: 'storage',
    icon: 'bi-cloud-arrow-up',
    title: 'Storage & Object Storage',
    minutes: 4,
    sections: [
      {
        heading: 'Two separate storage concerns',
        paragraphs: [
          'Don\'t confuse these — they are unrelated features that happen to both use the same S3-compatible-client approach:',
        ],
        facts: [
          ['Backup storage', 'Set via `.env` (`BACKUP_STORAGE`, `BACKUP_S3_*`) — where the app\'s OWN database backup files live. Covered in Chapter 7.'],
          ['Object Storage (images)', 'Configured from inside the app itself, on the Settings page — where the CLIENT wants their uploaded images to live. Covered here.'],
        ],
      },
      {
        heading: 'Where an uploaded image actually lives',
        paragraphs: [
          'Settings > Image Storage (`imageStorage` setting) decides whether new uploads go into the app\'s own Postgres database (as a `data:` URL, stored directly in the `images` table — genuinely portable, moves with the database automatically) or into the client\'s connected external bucket.',
          'Connecting external storage is done entirely through the UI (Settings > Storage) — bucket, region, endpoint, access key, and secret key, for any S3-compatible provider (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean Spaces, or "Other"). Nothing about which provider is chosen lives in an environment variable.',
          'Either way, `server/src/routes/files.js` is the one place a browser or mail client ever actually requests an image from — it reads from wherever the image really lives and streams it back, so the URL emailed to recipients never changes based on storage choice.',
        ],
      },
      {
        heading: 'Media Library storage usage',
        paragraphs: [
          '`GET /api/images` also returns a `usage` block, summed from each image\'s `size_bytes` and split by `storage_provider` (app database vs. connected external bucket) — externally-linked images (`source = \'url\'`) are excluded, since MailWave doesn\'t control storage it doesn\'t own. Uses the same optional admin-set limit pattern as database storage usage (Chapter 7) — the `mediaBytes` half of the shared `storageLimits` settings row.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/services/objectStorage.js',
            does: 'Wraps `@aws-sdk/client-s3` for the client\'s connected bucket — save/read/delete/test-connection, using credentials stored (encrypted) in the `storage_settings` table.',
            dependsOn: '`routes/storageSettings.js` (the config API), `routes/files.js` and `routes/images.js` (actually reading/writing objects).',
            safe: 'Adding a new provider to the preset list in `lib/storageProviders.js` (just needs endpoint/region/path-style conventions, not new code here).',
            careful: 'The secret access key is decrypted using a key derived from `JWT_SECRET` — if that changes (e.g. after a host move without carrying it over), previously-saved credentials become unreadable and must be re-entered. See Chapter 14.',
          },
          {
            file: 'server/src/lib/storageProviders.js',
            does: 'The list of supported S3-compatible providers and their connection quirks (needs an endpoint? needs path-style requests? what does "region" mean for this one?).',
            dependsOn: '`services/objectStorage.js`, `routes/storageSettings.js`; mirrored on the frontend by `src/data/storageProviders.js` for the setup form.',
            safe: 'Adding a new provider entry.',
            careful: 'Keep the frontend mirror (`src/data/storageProviders.js`) in sync — they intentionally duplicate the same list for the setup wizard\'s dynamic form.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 9,
    key: 'email',
    icon: 'bi-envelope-paper',
    title: 'Email Sending System',
    minutes: 5,
    sections: [
      {
        heading: 'From a connected account to a sent email',
        numbered: [
          'A user connects an email account on the Email Accounts page (`src/pages/EmailAccountsPage.jsx`, `ConnectAccountPage.jsx`) — host, port, username, password, via SMTP. `services/providers.js` supplies known presets (Gmail, Outlook, etc.) so most fields fill themselves in.',
          'The password is encrypted (`lib/secretbox.js`) before it is stored in the `email_accounts` table — it is only ever decrypted right before sending.',
          '`services/mailer.js` builds a nodemailer SMTP transport per account (cached, so a new connection isn\'t opened per email) and sends through it.',
          '`MAIL_TRANSPORT` (an env var) can override this globally for non-production use: `ethereal` for a fake test inbox, or `json` for a dry run that sends nothing.',
        ],
      },
      {
        heading: 'MailWave\'s own emails',
        paragraphs: [
          '`services/systemMail.js` sends the app\'s own transactional email (password reset, invites, alerts to Super Admins) — content comes from `system_emails`/`system_email_translations` (editable from the System Emails page), and is sent from whichever account `SYSTEM_EMAIL_FROM` names, or the first connected account if that\'s unset.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/services/mailer.js',
            does: 'Builds a transport and sends one email for a given account + message.',
            dependsOn: '`services/sender.js` (campaign sends), `services/systemMail.js` (system emails).',
            safe: 'Adjusting the "missing SMTP details" error wording.',
            careful: 'If a password fails to decrypt (`JWT_SECRET` mismatch after a host move), the error message is intentionally specific about that possibility — don\'t revert it to a generic "missing details" message, since that sends an admin chasing the wrong fix.',
          },
          {
            file: 'server/src/lib/secretbox.js',
            does: 'Encrypts/decrypts connected accounts\' SMTP passwords using a key derived from `JWT_SECRET`.',
            dependsOn: '`routes/accounts.js` (save), `services/mailer.js` (read before sending).',
            safe: 'Nothing routine — this is security-sensitive code.',
            careful: 'Never log a decrypted password. Never change the encryption scheme without a migration plan for already-encrypted rows.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 10,
    key: 'templates',
    icon: 'bi-layout-wtf',
    title: 'Templates & Template Processing',
    minutes: 5,
    sections: [
      {
        heading: 'Three ways to create a template',
        facts: [
          ['Custom (paste HTML)', '`TemplateEditorPage.jsx` — paste raw HTML directly'],
          ['Upload', '`TemplateUploadPage.jsx` — upload an `.html` file'],
          ['Builder', '`TemplateBuilderPage.jsx` + `components/templates/builder/` — drag-and-drop rows/columns/blocks, compiled to HTML by `src/data/builderCompiler.js`'],
        ],
        paragraphs: [
          'Which of these three sources are allowed is a workspace setting (`templateSources`, Settings page) — turning one off only hides it for NEW templates; nothing already created is affected.',
        ],
      },
      {
        heading: 'Two different kinds of placeholder',
        list: [
          '`{{name}}`, `{{email}}`, `{{unsubscribe_url}}` and similar — RECIPIENT-level dynamic fields, filled in at actual send time by `services/render.js`, differently for every recipient.',
          'A template\'s OWN saved field values (logo URL, heading text, etc., if built with the Builder or using Code-tab tokens) — filled in by `src/data/templateBuilder.js`\'s `resolveTemplateFieldTokens()`, using that specific template\'s own saved data. This runs on the frontend for previews/thumbnails, and happens again server-side inside `render.js` at send time.',
        ],
        note: {
          tone: 'info',
          icon: 'bi-info-circle',
          text: 'Both the Templates page thumbnail/grid AND the Preview page AND the campaign wizard\'s template picker must all resolve BOTH kinds of token the same way, or a thumbnail will show raw `{{tokens}}` instead of the real content. If you add a new page that shows a template preview, reuse `resolveTemplateFieldTokens()` + `fillDynamicPreview()` rather than writing new resolution logic.',
        },
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/services/render.js',
            does: 'Turns a campaign\'s template + one recipient into the final HTML actually sent — substitutes recipient fields, injects the tracking pixel and click-tracked link wrappers, injects the unsubscribe link.',
            dependsOn: '`services/sender.js` calls this once per recipient.',
            safe: 'Adding a new available recipient field.',
            careful: 'Tracking/unsubscribe URLs here are built from `env.publicUrl` — never hardcode a domain.',
          },
          {
            file: 'src/data/templateBuilder.js',
            does: 'Resolves a template\'s own saved field tokens against its `content_schema` — shared by the Templates page, the Preview page, and the campaign wizard.',
            dependsOn: '`TemplatesPage.jsx`, `TemplatePreviewPage.jsx`, `components/wizard/StepTemplate.jsx`.',
            safe: 'Adding support for a new field type the Builder can produce.',
            careful: 'Keep this in sync with whatever `builderCompiler.js` actually outputs — a mismatch shows raw tokens instead of resolved content.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 11,
    key: 'campaigns',
    icon: 'bi-megaphone',
    title: 'Campaign System',
    minutes: 5,
    sections: [
      {
        heading: 'The wizard',
        paragraphs: [
          '`CampaignWizardPage.jsx` drives a 6-step flow (`components/wizard/`: Info, Recipients, Template, Content, Settings, Review), saving a draft as the user moves through it. `POST/PUT /api/campaigns` (`server/src/routes/campaigns.js`) persists it; sending or scheduling happens from the final step.',
          'The Settings step (`StepSettings.jsx`) is where batch size, delay between batches, and the send-time estimate (`src/utils/sendEstimate.js`) live — the estimate reads the SELECTED account\'s real, current `dailyLimit`/`sentToday` (from `GET /api/accounts`), never a hardcoded number.',
          'Validation errors (e.g. clicking Continue with a required field missing) show both an inline banner at the top of the step AND a toast (`ToastProvider.jsx`) — the toast exists specifically so the error is still noticed on a long step (many templates/recipients) where the banner has scrolled out of view.',
        ],
      },
      {
        heading: 'Lifecycle',
        list: [
          '`Draft` — being edited, nothing scheduled.',
          '`Scheduled` — `scheduler.js` will start it once `scheduled_at` has passed.',
          '`Sending` — `sender.js` is actively working through recipients in batches.',
          '`Paused` — stopped, either by a person (`pause_reason = \'manual\'`) or automatically because a daily send quota ran out (`pause_reason = \'quota\'`, auto-resumed the next day by the scheduler).',
          '`Sent` — every recipient reached a terminal state (sent or failed).',
        ],
      },
      {
        heading: 'Analytics',
        paragraphs: [
          '`CampaignAnalyticsPage.jsx` polls `GET /api/campaigns/:id` every 30 seconds while a campaign is `Sending`, showing live batch progress and a time-remaining estimate built from the same `sendEstimate.js` used in the wizard, fed with freshly-refetched account quota data each tick.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/routes/campaigns.js',
            does: 'Campaign CRUD, the wizard\'s save endpoint, schedule/pause/resume, and the `.xlsx` report download.',
            dependsOn: '`CampaignWizardPage.jsx`, `CampaignsPage.jsx`, `CampaignAnalyticsPage.jsx` on the frontend; `services/sender.js` and `services/scheduler.js` on the backend.',
            safe: 'Adding a new field to the campaign record.',
            careful: '`scheduled_at` is stored as `timestamptz` — always send/read full ISO datetime strings with their offset, never a bare local-looking string, or send times will shift when the server\'s own timezone differs from what was intended.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 12,
    key: 'contacts',
    icon: 'bi-people',
    title: 'Contacts, Subscribers & Segments',
    minutes: 4,
    sections: [
      {
        heading: 'Contacts',
        paragraphs: [
          '`ContactsPage.jsx` + `server/src/routes/contacts.js` — CRUD, groups, bulk actions. Import (`ImportContactsPage.jsx`) parses the Excel/CSV file entirely IN THE BROWSER (`src/utils/readSheet.js`), then sends structured rows to the backend — the server never receives or parses a raw file for contact import.',
          'Before import, a dry-run check shows exactly what will happen per row: valid, already in your contacts, repeated inside this file, previously unsubscribed/bounced, or invalid — nothing is silently skipped.',
        ],
      },
      {
        heading: 'Suppression',
        paragraphs: [
          'The `suppression` table is what `sender.js` actually checks before sending to any address — an unsubscribe or hard bounce adds a row here. Whether an unsubscribe from one sending account blocks all accounts or just that one is the `applyGlobally` option under Settings > Unsubscribe.',
        ],
      },
      {
        heading: 'Subscribers and Segments',
        facts: [
          ['Subscribers', '`SubscribersPage.jsx` + `/api/subscribers` — people who clicked "Subscribe" inside a sent email (a separate list from Contacts, deliberately, since they opted in themselves)'],
          ['Segments', '`SegmentsPage.jsx` + `/api/segments` — saved contact filters, reusable when picking recipients for a new campaign'],
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 13,
    key: 'auth',
    icon: 'bi-shield-lock',
    title: 'Authentication & Session Handling',
    minutes: 5,
    sections: [
      {
        heading: 'Two credential types, both handled by the same middleware',
        facts: [
          ['JWT access + refresh token', 'A normal signed-in user. Access token is short-lived (`ACCESS_TOKEN_TTL`, default 15m) and kept only in memory on the frontend — never `localStorage`, so no script running on the page can read it. The refresh token lives in an httpOnly cookie (`mw_refresh`), invisible to JavaScript, valid for `REFRESH_TOKEN_DAYS` (default 30).'],
          ['API key', 'For an external program calling the API directly (`mw_live_...`) — never expires on its own, only on revoke, and always acts with the permissions of whoever created it (no separate role of its own).'],
        ],
      },
      {
        heading: 'Session flow',
        numbered: [
          'App loads -> `AuthProvider.jsx` calls `refreshSession()` (`src/api/client.js`) immediately, using the httpOnly cookie, to get a fresh access token without the user doing anything.',
          'Every API call attaches the in-memory access token as `Authorization: Bearer ...`.',
          'On the backend, `middleware/auth.js`\'s `requireAuth` verifies the JWT (or looks up the API key), then re-reads the user row fresh from the database — so a disabled account is blocked immediately, not only once its token happens to expire.',
          'If an access token has expired, `client.js` automatically calls the refresh endpoint once and retries the original request — the user never sees this happen.',
        ],
      },
      {
        heading: 'Authorization (what a role can do)',
        paragraphs: [
          'Real enforcement is server-side: `role_permissions` (module × action) + `middleware/permissions.js`\'s `requireModule()`, checked on the actual route. `super_admin` always passes every check.',
          'The frontend mirrors this (`WorkspaceProvider.jsx`\'s `can()`, sourced from `useAuth().role`, not any client-side toggle) purely to decide what to show — hiding a sidebar link or disabling a button is not itself security; the route guard (`components/routing/RequireModule.jsx`) plus the server-side check together are.',
          'A second, narrower dimension: `role_account_access` restricts WHICH connected email accounts a role may use (for creating/editing/sending/test-emailing a campaign) — independent of module permissions. `middleware/permissions.js`\'s `requireAccountAccess()` (body-driven) and `roleCanUseAccount()` (for routes that already have the account via a campaign row) enforce it; `CampaignWizardPage.jsx` also filters the account picker client-side using `useAuth().role.allowedAccountIds` so a restricted role never even sees an account it can\'t use. Managed from Users & Roles, below the permission matrix.',
        ],
      },
      {
        heading: 'Important files',
        fileCards: [
          {
            file: 'server/src/middleware/auth.js',
            does: 'Establishes `req.user` for every protected request — verifies the JWT or API key, re-reads the user from the database.',
            dependsOn: 'Every route mounted behind it in `app.js` (everything except `/api/auth`, `/t`, `/files`).',
            safe: 'Nothing routine.',
            careful: 'This IS the authentication boundary for the whole API — any change here affects every protected route at once. Test broadly after touching it.',
          },
          {
            file: 'src/store/AuthProvider.jsx',
            does: 'Frontend session state — who is signed in, the `checking` flag `RequireAuth.jsx` waits on before deciding whether to redirect to `/login`.',
            dependsOn: '`RequireAuth.jsx`, every page that calls `useAuth()`.',
            safe: 'Adding new fields to the exposed user object if the backend already returns them.',
            careful: 'The double-refresh-attempt-with-delay logic on boot exists specifically to avoid signing a user out just because of a slow first request — don\'t simplify it away.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 14,
    key: 'envvars',
    icon: 'bi-sliders',
    title: 'Environment Variables Reference',
    minutes: 6,
    sections: [
      {
        heading: 'Where these live',
        paragraphs: [
          'All backend environment variables are documented in `server/.env.example` and read in exactly one place, `server/src/env.js`, into a single exported `env` object. Copy `server/.env.example` to `server/.env` and fill in real values — `.env` is gitignored, never committed.',
          'The frontend has exactly one build-time environment variable, `VITE_API_URL` — there is no root-level `.env.example` file in this repository; Vite reads a `.env`/`.env.production` file at the repository root automatically if one is created (standard Vite behavior), or the hosting platform\'s own build-time environment variable setting is used instead.',
        ],
        note: {
          tone: 'danger',
          icon: 'bi-shield-exclamation',
          text: 'Never write a real secret value into this Developer Guide, a commit message, or anywhere committed to git. The examples below use placeholders like `YOUR_DATABASE_URL` on purpose.',
        },
      },
      {
        heading: 'Database',
        facts: [
          ['`DATABASE_URL`', 'Postgres connection string. Empty -> falls back to local PGlite (dev only). Example shape: `postgres://user:YOUR_DATABASE_PASSWORD@host:5432/dbname`'],
          ['`DATABASE_SSL`', '`true`/`false` — set `true` if the provider needs an explicit SSL flag rather than `sslmode=` in the URL itself'],
          ['`DATA_DIR`', 'Only used when `DATABASE_URL` is empty — where PGlite\'s files are kept (default `./data/pgdata`)'],
        ],
      },
      {
        heading: 'Sessions / security',
        facts: [
          ['`JWT_SECRET`', 'Signs access/refresh tokens AND is the source of the encryption key for connected accounts\' SMTP passwords and Object Storage\'s secret key. If unset, one is auto-generated and written to `.env` — REQUIRED to be set explicitly for any real deployment. Example: `YOUR_JWT_SECRET`'],
          ['`ACCESS_TOKEN_TTL`', 'How long an access token lasts, e.g. `15m` (default)'],
          ['`REFRESH_TOKEN_DAYS`', 'How long a refresh session lasts before requiring sign-in again, e.g. `30` (default)'],
          ['`AUTH_COOKIE_SAMESITE`', '`lax` (default, same registrable domain / subdomains) or `none` (frontend and backend on two fully unrelated domains)'],
          ['`CORS_ORIGINS`', 'Comma-separated list of browser origins allowed to call the API — must exactly match where the frontend is actually served from'],
        ],
      },
      {
        heading: 'URLs',
        facts: [
          ['`PUBLIC_URL`', 'This backend\'s own public URL — used to build tracking pixels, click-tracking redirects, unsubscribe links, and image URLs inside sent email'],
          ['`APP_URL`', 'The frontend\'s public URL — used inside system emails (e.g. "reset your password" links)'],
          ['`VITE_API_URL`', 'Frontend build-time only — the backend base URL the built frontend calls. Baked into the JS bundle at build time, not readable/changeable at runtime after the build exists.'],
        ],
      },
      {
        heading: 'First-run setup',
        facts: [
          ['`PORT`', 'What port the backend listens on (default `4000`)'],
          ['`NODE_ENV`', '`production` for a real deployment'],
          ['`SEED_EMAIL`, `SEED_PASSWORD`, `ADMIN_NAME`', 'Only used the very first time a database is seeded — the first Super Admin\'s login. No effect on an already-set-up install.'],
        ],
      },
      {
        heading: 'Email sending',
        facts: [
          ['`MAIL_TRANSPORT`', '`smtp` (default, real accounts connected via the UI) / `ethereal` (fake test inbox, never production) / `json` (dry run, nothing sent)'],
          ['`SYSTEM_EMAIL_FROM`', 'Which connected account MailWave\'s own emails (reset, invite, alerts) send from — empty uses whichever account connected first'],
        ],
      },
      {
        heading: 'Backups',
        facts: [
          ['`BACKUP_EVERY_DAYS`', 'How often an automatic backup is taken, besides the one always taken on every server start (default `7`)'],
          ['`BACKUP_STORAGE`', '`local` (server\'s own disk — not durable on most hosting) or `s3` (any S3-compatible bucket)'],
          ['`BACKUP_DIR`', 'Only used when `BACKUP_STORAGE=local` (default `./data/backups`)'],
          ['`BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_FORCE_PATH_STYLE`, `BACKUP_S3_PREFIX`', 'Only used when `BACKUP_STORAGE=s3` — leave `BACKUP_S3_ENDPOINT` empty for real AWS S3, or set it for R2/B2/Spaces/MinIO/etc. Example secret: `YOUR_STORAGE_SECRET`'],
          ['Retention & storage limit', 'NOT an env var — set from Settings > Backup inside the app itself, stored in the `settings` table (`backupSettings` key)'],
        ],
      },
      {
        heading: 'Diagnostics (optional)',
        facts: [
          ['`MW_SERVER_LOG`', 'Mirrors console output to a file as well (default: an OS temp-folder path) — useful for support regardless of how the server was started'],
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 15,
    key: 'config',
    icon: 'bi-toggles',
    title: 'brand.config.js & Configuration Files',
    minutes: 4,
    sections: [
      {
        heading: '`brand.config.js` — the ONE place branding lives',
        paragraphs: [
          'At the repository root, imported directly by both the frontend and the backend — no duplication, no second config system. Changing it changes the sidebar name/logo, the login screen, the browser tab title, sent-email footers, system-email content, and backend log lines, all at once.',
        ],
        facts: [
          ['`name`, `tagline`, `titleSuffix`, `description`', 'App identity shown across the UI and browser tab'],
          ['`logoIcon`', 'A Bootstrap Icons name (e.g. `bi-send-fill`)'],
          ['`company`, `supportEmail`, `website`, `address`', 'Shown in email footers — `address` is legally required for bulk email in most jurisdictions'],
          ['`defaultTheme`, `defaultAccent`', 'Initial light/dark mode and accent color, before a visitor picks their own'],
          ['`developerGuide`', 'Boolean — `true` shows this Developer Guide and makes its route reachable; `false` hides the nav link AND makes the route itself resolve to the normal 404 page. See Chapter 21.'],
          ['`securityProtection`', 'Boolean — `true` deters casual right-click / text-select / Ctrl+U / Ctrl+S on the app\'s own screens (not a real security boundary — no website can block an actual screenshot or dev tools). Inputs, the HTML/code editor and every clipboard "Copy" button keep working either way. See `src/utils/useSecurityProtection.js` and the CSS block at the bottom of `src/styles/_utilities.scss`. Default `false`.'],
        ],
      },
      {
        heading: 'How the frontend reads it',
        paragraphs: [
          '`src/config/appConfig.js` re-exports `brand.config.js` as `appConfig` — this exists only because earlier code imports it under that name; both names point at the exact same object. New code can import from either.',
        ],
      },
      {
        heading: 'Other configuration files',
        facts: [
          ['`vite.config.js`', 'Build tool config — React plugin, SCSS deprecation-warning silencing (from Bootstrap), dev server host/port'],
          ['`src/config/themeColors.js`', 'The available accent color options `defaultAccent` can be set to'],
          ['`.oxlintrc.json`', 'Lint rule configuration for `oxlint`'],
          ['`server/.env.example`', 'The full documented list of backend environment variables (Chapter 14)'],
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 16,
    key: 'where-to-change',
    icon: 'bi-compass',
    title: 'Where Do I Change This?',
    minutes: 4,
    sections: [
      {
        heading: 'Quick reference',
        facts: [
          ['Application name', '`brand.config.js` — `name` (and `titleSuffix` for the browser tab)'],
          ['Logo', '`brand.config.js` — `logoIcon` (a Bootstrap Icons name; there is no uploaded image file for the logo)'],
          ['Colors / theme', '`src/config/themeColors.js` (available accents) and `brand.config.js` (`defaultAccent`, `defaultTheme`); the actual CSS variables are in `src/styles/_theme.scss`'],
          ['Sidebar', '`src/components/layout/Sidebar.jsx` (layout/markup) and `src/components/layout/navItems.js` (what links appear, and for which role)'],
          ['Login screen', '`src/pages/LoginPage.jsx` (UI) and `server/src/routes/auth.js` (the actual login/session logic)'],
          ['Email provider (SMTP presets)', '`server/src/services/providers.js`'],
          ['How email is actually sent', '`server/src/services/mailer.js` (transport/send) and `server/src/lib/secretbox.js` (password encryption)'],
          ['Campaign sending logic', '`server/src/services/sender.js`'],
          ['Batch size options', '`src/data/constants.js` — `batchOptions` (used by both the campaign wizard and Settings page)'],
          ['Backup behavior', '`server/src/services/backup.js` (logic), `server/src/services/backupStorage.js` (where files go), `server/src/routes/backup.js` (API), `src/pages/BackupPage.jsx` (UI)'],
          ['Database schema', '`server/src/db/schema.sql`'],
          ['Storage (Object Storage / images)', '`server/src/services/objectStorage.js`, `server/src/lib/storageProviders.js` (+ frontend mirror `src/data/storageProviders.js`), `server/src/routes/storageSettings.js`'],
          ['API routes/services', '`server/src/routes/` (one file per resource) and `server/src/services/` (background/business logic) — see Chapter 4'],
          ['Translations', '`src/i18n/locales/` — one file per language, flat `key: text` objects; `en.js` is the reference set of keys. New language: add the file, then one line in `loaders` and one row in `LANGUAGES` in `src/i18n/languages.js`'],
          ['Design / copy protection (right-click, Ctrl+U, Ctrl+S, text-select)', '`brand.config.js` — `securityProtection` flag; behavior lives in `src/utils/useSecurityProtection.js` + `src/styles/_utilities.scss`'],
          ['Frontend API URL', '`VITE_API_URL` (build-time environment variable) — read in `src/api/client.js`'],
          ['Production domain', '`PUBLIC_URL`, `APP_URL`, and `CORS_ORIGINS` in the backend `.env` — plus wherever `VITE_API_URL` is set for the frontend build'],
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 17,
    key: 'dev-setup',
    icon: 'bi-terminal',
    title: 'Development Setup',
    minutes: 6,
    sections: [
      {
        heading: 'Requirements',
        facts: [
          ['Node.js', '`>=20` — declared in `engines.node` in both `package.json` (root) and `server/package.json`'],
          ['npm', 'Whatever ships with that Node version'],
        ],
      },
      {
        heading: 'Install dependencies',
        paragraphs: ['Frontend and backend have completely separate `node_modules` — install both, from the repository root:'],
        code: 'npm install\nnpm run server:install',
        codeLabel: 'From the repository root',
      },
      {
        heading: 'Environment file',
        numbered: [
          'Copy `server/.env.example` to `server/.env`.',
          'Leave `DATABASE_URL` empty to use local PGlite (nothing to install) — fine for development.',
          'The frontend needs no `.env` file for local development; `src/api/client.js` already defaults to `http://localhost:4000` when `VITE_API_URL` is unset.',
        ],
      },
      {
        heading: 'Database setup (first run)',
        code: 'npm run server:seed',
        codeLabel: 'From the repository root — creates the schema and seeds sample data',
        paragraphs: [
          'This prints the first sign-in email/password to the console. It seeds realistic demo data (fake campaigns, contacts) — fine for development, but `npm run server:seed:clean` (roles + one Super Admin, no fake data) is what a real client install should use instead — see Chapter 20.',
        ],
      },
      {
        heading: 'Start both apps',
        code: '# Terminal 1\nnpm run server\n\n# Terminal 2\nnpm run dev',
        codeLabel: 'Two terminals, from the repository root',
        list: [
          '`npm run server` starts the backend with `node --watch` (auto-restarts on file changes) on port `4000`.',
          '`npm run dev` starts the Vite dev server on port `5173`.',
          'The backend\'s default `CORS_ORIGINS` already includes `http://localhost:5173` and `5174` — no config needed for this default setup.',
        ],
      },
      {
        heading: 'How frontend and backend actually talk to each other',
        paragraphs: [
          'Purely over HTTP, as two independent processes — the frontend never imports backend code or vice versa. `src/api/client.js` sends every request to `VITE_API_URL` (or `http://localhost:4000` by default), with `credentials: \'include\'` so the httpOnly refresh cookie is sent. The backend\'s CORS middleware (`server/src/app.js`) only allows requests whose `Origin` header is in `CORS_ORIGINS`.',
        ],
      },
      {
        heading: 'Stopping the app',
        paragraphs: [
          'Ctrl+C in each terminal. The backend listens for `SIGINT`/`SIGTERM`/`SIGHUP`/`SIGBREAK` and closes the database connection cleanly before exiting — this matters most for PGlite, whose data folder can be corrupted by a hard kill.',
        ],
      },
      {
        heading: 'Tests',
        table: {
          headers: ['Command', 'Runs'],
          rows: [
            ['`npm test`', 'The full suite — every test script below, in sequence'],
            ['`npm run test:login`', '`test-login.mjs`, `test-reset.mjs`'],
            ['`npm run test:api`', '`test-users.mjs`, `test-routes.mjs`'],
            ['`npm run test:app`', '`test-app.mjs`, `test-save.mjs`'],
            ['`npm run test:screens`', '`test-contacts.mjs`, `test-import.mjs`, `test-segments.mjs`, `test-pages.mjs`, `test-stats.mjs`'],
            ['`npm run test:send`', '`test-send.mjs`, `test-schedule.mjs`'],
            ['`npm run test:backup`', '`test-backup.mjs`'],
            ['`npm run test:mail`', '`audit-mailvars.mjs`'],
            ['`npm run test:images`', '`test-template-image.mjs`, `test-imagelib.mjs`'],
          ],
        },
        note: {
          tone: 'warning',
          icon: 'bi-exclamation-triangle',
          text: 'These test scripts (repository root, `test-*.mjs`) drive a real running app with Playwright against a real running backend+frontend on localhost — start both first. They are written against whatever database is currently connected; use a disposable/local database, never a production one, when running tests.',
        },
      },
      {
        heading: 'Lint',
        code: 'npm run lint',
        codeLabel: 'From the repository root — runs oxlint over both `src/` and `server/`',
      },
      {
        heading: 'Production build',
        code: 'npm run build',
        codeLabel: 'From the repository root — builds the frontend only (the backend needs no build step, it runs its source directly)',
        paragraphs: ['See Chapter 18 for the complete build/verify/deploy procedure.'],
      },
    ],
  },

  // =========================================================================
  {
    number: 18,
    key: 'build',
    icon: 'bi-box-seam',
    title: 'Production Build',
    minutes: 5,
    sections: [
      {
        heading: 'A. Build before making changes (know your baseline)',
        paragraphs: [
          'Before making changes, run `npm run build` once on the unmodified code so you have a known-good baseline to compare against, and confirm it currently succeeds. This matters most when troubleshooting — "did my change break the build, or was it already broken?"',
        ],
      },
      {
        heading: 'B. Make code/config changes',
        paragraphs: [
          'Edit frontend files under `src/`, backend files under `server/src/`, `brand.config.js`, or environment variables as needed. The backend needs no build step at all — it runs `server/src/index.js` directly with plain Node.',
        ],
      },
      {
        heading: 'C. Run tests/lint',
        code: 'npm run lint\nnpm test',
        codeLabel: 'From the repository root',
      },
      {
        heading: 'D. Create the production build',
        code: 'npm run build',
        codeLabel: 'From the repository root — this is `vite build`, output goes to `dist/`',
        paragraphs: [
          'This step is FRONTEND ONLY. `dist/` contains static HTML/CSS/JS with content-hashed filenames — this is what gets deployed to a static host or served by a web server.',
        ],
      },
      {
        heading: 'E. Verify the build',
        list: [
          'Run `npm run preview` to serve the `dist/` output locally and click through the app.',
          'Confirm no console errors on the pages you changed.',
          'If you changed anything backend-related, confirm the backend still starts (`npm run server` or `node server/src/index.js`) and `GET /api/health` responds.',
        ],
      },
      {
        heading: 'F. Deploy',
        paragraphs: ['See Chapter 19 for the actual deployment steps per hosting type.'],
      },
      {
        heading: 'Build-time vs. runtime configuration — this is the part most likely to trip someone up',
        table: {
          headers: ['Value', 'When it takes effect'],
          rows: [
            ['`VITE_API_URL`', 'BUILD TIME ONLY. It is baked into the compiled JS bundle. Changing it after `dist/` exists does nothing — the frontend must be rebuilt (and redeployed) to pick up a new value.'],
            ['Every backend `.env` variable (`DATABASE_URL`, `JWT_SECRET`, `PUBLIC_URL`, `CORS_ORIGINS`, `BACKUP_*`, etc.)', 'SERVER RUNTIME. Read fresh each time the backend process starts (`server/src/env.js`). Changing one requires restarting the backend process, not rebuilding anything.'],
            ['`brand.config.js` (name, logo, `developerGuide` flag, etc.)', 'Read by BOTH apps. On the frontend it is bundled in at build time (needs a rebuild). On the backend it is read at process start (needs a restart, no build).'],
          ],
        },
      },
    ],
  },

  // =========================================================================
  {
    number: 19,
    key: 'deploy',
    icon: 'bi-cloud-upload',
    title: 'Manual Deployment',
    minutes: 8,
    sections: [
      {
        heading: 'What MailWave actually needs from a host',
        list: [
          'An always-on Node.js process for the backend — the scheduler, webhook worker, and automatic backups are in-process timers, not external cron. Serverless/edge function platforms (that don\'t keep a process alive between requests) are NOT supported.',
          'A real PostgreSQL database (13+) — `DATABASE_URL` set to it.',
          'Somewhere to serve the built static frontend (`dist/`) — any static host works, since it is plain files.',
          'HTTPS on both the frontend\'s and backend\'s public URLs, in any real deployment.',
        ],
      },
      {
        heading: 'Render',
        paragraphs: [
          'Two Render services: a Web Service for the backend, and either a Static Site or a second Web Service for the frontend.',
        ],
        numbered: [
          'Push the repository to a Git provider Render can pull from.',
          'Create a Postgres database (Render Postgres, or any other provider) and copy its connection string.',
          'Backend — new Web Service, root/working directory `server/`. Build command: `npm install`. Start command: `npm start` (runs `node src/index.js`).',
          'Set the backend\'s environment variables in Render\'s dashboard: `DATABASE_URL`, `DATABASE_SSL=true` (if the provider needs it), `JWT_SECRET` (set explicitly — do not leave this unset, see Chapter 21), `CORS_ORIGINS` (the frontend\'s real URL), `PUBLIC_URL` (this backend\'s own Render URL), `APP_URL` (the frontend\'s URL), and any `BACKUP_*`/`MAIL_TRANSPORT` values needed.',
          'Frontend — new Static Site, root directory the repository root. Build command: `npm install && npm run build`. Publish directory: `dist`. Set `VITE_API_URL` to the backend service\'s URL as a build-time environment variable.',
          'Run `npm run server:seed:clean` once against the new database (see Chapter 20) to create the first Super Admin — either via a Render Shell session, or temporarily from a machine with `DATABASE_URL` pointed at the same database.',
          'Confirm `GET https://<backend>/api/health` responds, and the frontend loads and can sign in.',
        ],
        facts: [
          ['Persistent disk', 'Render\'s default disk is NOT durable across redeploys — do not rely on `BACKUP_STORAGE=local` or PGlite here. Use `BACKUP_STORAGE=s3` and a real `DATABASE_URL`.'],
          ['Process manager', 'Not needed — Render runs the start command as the service\'s own managed process and restarts it on crash.'],
          ['Logs', 'Render\'s own service log stream.'],
          ['Restart/update', 'A new push (or manual deploy) rebuilds/restarts automatically.'],
        ],
      },
      {
        heading: 'Hostinger VPS',
        paragraphs: [
          'A VPS gives a persistent filesystem and full control — unlike Render, `BACKUP_STORAGE=local` and even PGlite\'s persistence concerns are less severe here, though a real Postgres install is still strongly recommended over PGlite for anything real.',
        ],
        numbered: [
          'SSH into the VPS. Install Node.js `>=20` (e.g. via NodeSource\'s setup script or a version manager) and confirm with `node --version`.',
          'Install PostgreSQL on the VPS, or point `DATABASE_URL` at a managed Postgres elsewhere.',
          'Clone the repository onto the VPS.',
          'Backend: `cd server && npm install`, create `server/.env` from `server/.env.example` with real values (`DATABASE_URL` pointed at the installed/managed Postgres, `JWT_SECRET` set explicitly, `PUBLIC_URL`/`APP_URL`/`CORS_ORIGINS` set to the real domain(s)).',
          'Frontend: from the repository root, `npm install`, then `VITE_API_URL=https://api.yourdomain.com npm run build` — this produces `dist/`.',
          'Run `npm run server:seed:clean` once (from `server/`, with `.env` in place) to create the first Super Admin.',
          'Start the backend as a long-running process — see "Process manager" below, do not just run `node src/index.js` in a terminal that will close.',
          'Serve `dist/` as static files — either via a web server (Nginx/Apache) pointed at the `dist/` folder, or any static file server. Configure it to serve `index.html` for unknown paths (this is a client-side-routed SPA).',
          'Point a reverse proxy (Nginx) at the backend process for the API subdomain, and at the static files for the app domain, and obtain HTTPS certificates (e.g. via Certbot/Let\'s Encrypt) for both.',
        ],
        facts: [
          ['Process manager', 'Required — use `pm2` or a `systemd` service to keep `node server/src/index.js` running, restart it on crash, and start it on boot.'],
          ['Restart/update procedure', 'Pull the new code, `npm install` again in both `server/` and the repository root if dependencies changed, rebuild the frontend (`npm run build`), restart the backend process (`pm2 restart` or `systemctl restart`).'],
          ['Logs', 'Whatever the process manager captures (`pm2 logs`, or `journalctl` for a systemd service), plus the optional `MW_SERVER_LOG` file mirror.'],
          ['Health check', '`GET https://api.yourdomain.com/api/health`.'],
        ],
      },
      {
        heading: 'Generic Linux VPS / Node.js server',
        paragraphs: [
          'The same procedure as Hostinger VPS above — nothing in this codebase assumes Hostinger specifically. The requirements are simply: Node.js `>=20`, a reachable PostgreSQL database, a process manager keeping the backend alive, and something serving the built static frontend files over HTTPS.',
        ],
      },
      {
        heading: 'Not documented because not supported',
        note: {
          tone: 'warning',
          icon: 'bi-exclamation-triangle',
          text: 'Serverless/edge function platforms (e.g. Vercel serverless functions, AWS Lambda, Cloudflare Workers) are not supported for the backend, because the scheduler, webhook worker, and automatic backups all depend on a long-lived in-process timer that a serverless invocation does not provide. A static host (Vercel, Netlify, GitHub Pages, S3+CloudFront, etc.) IS fine for the frontend\'s built `dist/` output specifically, since that part is just static files.',
        },
      },
    ],
  },

  // =========================================================================
  {
    number: 20,
    key: 'migration',
    icon: 'bi-arrow-left-right',
    title: 'Moving an Existing Installation to Another Server',
    minutes: 7,
    sections: [
      {
        heading: 'This is different from a new installation',
        paragraphs: [
          'This chapter is for an install that is already running somewhere and needs to move — same client, same data, same users, just a different host. Chapter 22 ("Cloning for a New Client") is the opposite case: a brand new, separate installation that must NOT share anything with an existing one.',
        ],
      },
      {
        heading: 'What must be backed up',
        list: [
          'The database — take a fresh backup from the Backups page (or `pg_dump` directly if working straight against Postgres), and download it. This is the actual application data: contacts, campaigns, templates, users, everything.',
          'Any uploaded images that live in Object Storage (if `imageStorage` external is used) — these live in the CLIENT\'S bucket, not in this app\'s database, so moving the app does not move them; only the credentials to reach that same bucket need to move (see below).',
        ],
      },
      {
        heading: 'What must NOT simply be copied',
        list: [
          '`node_modules` (either the root one or `server/node_modules`) — do not copy these between machines, especially across different operating systems or CPU architectures. `sharp` (image processing) ships platform-specific native binaries; a copy from one OS/architecture will not run on another. Always run `npm install` fresh on the new server.',
          '`dist/` (the old build output) — rebuild on/for the new server instead of copying, since `VITE_API_URL` is baked in at build time and almost always needs a new value for the new backend URL.',
          'The old server\'s local PGlite data folder or local backup files, if the new server will use a different database/storage setup — these are superseded by the actual database backup/restore instead.',
        ],
      },
      {
        heading: 'Environment variables that must be preserved or deliberately set',
        facts: [
          ['`JWT_SECRET`', 'MUST be carried over to the new server, set to the exact same value. This is the single most important thing to get right — see the dedicated note below.'],
          ['`DATABASE_URL`', 'New value, pointing at wherever the database now lives (the same Postgres server if it isn\'t moving, or a new one if data was migrated via backup/restore).'],
          ['`PUBLIC_URL` / `APP_URL`', 'Update if the domain is changing; keep as-is if only the underlying server changed but the domain didn\'t.'],
          ['`CORS_ORIGINS`', 'Must list the frontend\'s real, current origin(s) — stale entries here silently break the whole app with no obvious error.'],
          ['`VITE_API_URL`', 'Frontend build-time value — must point at the backend\'s new URL, and the frontend must be REBUILT with it (see Chapter 18).'],
          ['Storage credentials (Object Storage)', 'These live in the database (`storage_settings` table, encrypted), not in `.env` — they move automatically with the database backup/restore, AS LONG AS `JWT_SECRET` was preserved (see below).'],
          ['Backup storage (`BACKUP_STORAGE`, `BACKUP_S3_*`)', 'Set these on the new server the same way as any other `.env` value — if using S3-compatible storage, the same bucket can keep being used from the new server.'],
        ],
      },
      {
        heading: 'The JWT_SECRET migration requirement',
        paragraphs: [
          '`JWT_SECRET` is not only a session-signing key. `server/src/lib/secretbox.js` (connected email accounts\' SMTP passwords) and `server/src/lib/crypto.js` (Object Storage\'s secret access key) both derive their encryption key from this exact same value.',
          'If the new server generates a different `JWT_SECRET` than the old one used — which happens automatically if it is left unset, since the backend auto-generates a random one on first boot — every connected email account\'s password and any connected Object Storage bucket\'s secret key become permanently undecryptable. They are not lost from the database, just unreadable, and have to be re-entered by hand through the UI.',
        ],
        note: {
          tone: 'danger',
          icon: 'bi-shield-exclamation',
          text: 'Before starting the app on the new server, copy the OLD server\'s exact `JWT_SECRET` value into the new server\'s `.env` (or platform environment variable settings). Do this BEFORE the first boot on the new server.',
        },
      },
      {
        heading: 'Domain/DNS',
        paragraphs: [
          'If the domain itself is moving hosts too, update DNS records to point at the new server, and reissue/renew HTTPS certificates there. Until DNS propagates, the old server may still receive some traffic — plan the cutover accordingly (e.g. put the old server in a read-only/maintenance state briefly, or accept a short window where writes could land on the old server after the new one is already live).',
        ],
      },
      {
        heading: 'Migration procedure',
        numbered: [
          'On the OLD server: take a fresh backup from the Backups page and download it. Note the exact `JWT_SECRET` value from the old server\'s `.env`.',
          'On the NEW server: install Node.js `>=20`, clone the repository, run `npm install` and `npm --prefix server install` fresh (never copy `node_modules`).',
          'Create `server/.env` on the new server with the SAME `JWT_SECRET`, the new `DATABASE_URL`, and updated `PUBLIC_URL`/`APP_URL`/`CORS_ORIGINS` if the domain changed.',
          'Run `npm run migrate` (from `server/`) to create the schema on the new (empty) database.',
          'Start the backend once, sign in with an existing account (this proves the database connection and `JWT_SECRET` are both correct), then use Upload a Backup + Restore on the Backups page to load the downloaded backup into the new database.',
          'Build the frontend with `VITE_API_URL` pointed at the new backend: `VITE_API_URL=https://api.yourdomain.com npm run build`, then deploy `dist/`.',
          'Update DNS if the domain is moving too.',
        ],
      },
      {
        heading: 'Post-migration verification',
        list: [
          '`GET /api/health` on the new backend responds `{ ok: true, ... }`.',
          'Sign in with an existing user account succeeds.',
          'A connected email account\'s "Send test" still works (confirms `JWT_SECRET` was preserved correctly).',
          'If Object Storage is connected, Settings > Storage > Test Connection succeeds (same reason).',
          'A manual backup can be created and downloaded from the new server.',
          'Contacts/campaigns/templates from before the move are all present.',
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 21,
    key: 'new-client',
    icon: 'bi-person-plus',
    title: 'Cloning for a New Client',
    minutes: 5,
    sections: [
      {
        heading: 'A new client is a SEPARATE installation — never a shared one',
        paragraphs: [
          'A new client must never end up sharing another client\'s database, `JWT_SECRET`, storage bucket, or backups. Each client installation is its own clone of this repository, its own database, its own `.env`, and its own set of connected accounts.',
        ],
      },
      {
        heading: 'Procedure',
        numbered: [
          'Clone the repository fresh for this client (a new deployment, not a branch of an existing running install).',
          'Provision a SEPARATE PostgreSQL database — never reuse an existing client\'s database or connection string.',
          'Create `server/.env` from `server/.env.example` with entirely fresh values: new `DATABASE_URL`, and a newly generated `JWT_SECRET` (do NOT reuse another client\'s value — see the distinction below).',
          'Set `SEED_EMAIL`, `SEED_PASSWORD`, and `ADMIN_NAME` to this specific client\'s first admin, then run `npm run server:seed:clean` (not `server:seed` — that one fills in unrelated demo/sample data, not appropriate for a real client).',
          'If this client needs external Object Storage, connect it from inside the app (Settings > Storage) once signed in — never copy another client\'s bucket credentials.',
          'Set `PUBLIC_URL`, `APP_URL`, and `CORS_ORIGINS` to this client\'s own domain(s).',
          'Update `brand.config.js` for this client\'s name/logo/company/support email if this is a white-labeled install (see Chapter 15).',
          'Build the frontend with `VITE_API_URL` pointed at this client\'s own backend, and deploy both apps following Chapter 19.',
          'Sign in as the new admin and confirm the workspace is empty of any other client\'s data.',
        ],
      },
      {
        heading: 'New client vs. same client moving hosting — the key difference',
        table: {
          headers: ['', 'New client', 'Same client, moving hosting'],
          rows: [
            ['Database', 'Brand new, empty', 'Same data — backed up and restored, or the same DB server reused'],
            ['`JWT_SECRET`', 'GENERATE A NEW ONE — never reuse another client\'s value', 'PRESERVE THE EXISTING VALUE — carry it over exactly, see Chapter 20'],
            ['Seed command', '`npm run server:seed:clean`', 'None — restore from backup instead'],
            ['Storage/backup credentials', 'New, connected fresh by this client', 'Same credentials, carried over in `.env` / restored with the database'],
          ],
        },
        note: {
          tone: 'info',
          icon: 'bi-info-circle',
          text: 'The rule in one sentence: a new client always gets a new `JWT_SECRET`; an existing client moving servers must keep its old one.',
        },
      },
    ],
  },

  // =========================================================================
  {
    number: 22,
    key: 'post-build',
    icon: 'bi-arrow-repeat',
    title: 'Post-Build Changes',
    minutes: 4,
    sections: [
      {
        heading: 'Does changing a file after building require another build?',
        paragraphs: [
          'It depends entirely on which side of the app the file is on, and whether it\'s frontend source, backend source, or a runtime environment variable. The frontend build (`dist/`) is a static snapshot — the backend has no build step at all, it re-reads its own source and environment on every start.',
        ],
      },
      {
        heading: 'Requires rebuilding the FRONTEND',
        list: [
          'Any file under `src/` (a component, a page, a style, an i18n locale file).',
          '`brand.config.js` (affects the frontend bundle) — even though it also affects the backend, which only needs a restart, not a rebuild.',
          '`VITE_API_URL` — baked into the compiled JS at build time.',
        ],
        note: {
          tone: 'info',
          icon: 'bi-info-circle',
          text: 'After rebuilding, the new `dist/` output must actually be redeployed to wherever the frontend is served from — building alone doesn\'t update a live site.',
        },
      },
      {
        heading: 'Can be a runtime environment variable (backend) — no rebuild, but needs a RESTART',
        list: [
          'Every variable in `server/.env` — `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_URL`, `APP_URL`, `CORS_ORIGINS`, `MAIL_TRANSPORT`, all `BACKUP_*` values, `PORT`, `NODE_ENV`.',
          'The backend has no build step — editing `server/src/*.js` also only needs a restart, not a build, since Node runs the source files directly.',
        ],
      },
      {
        heading: 'Requires a backend restart',
        list: [
          'Any change to a file under `server/src/`.',
          'Any change to a `server/.env` value.',
          'A `brand.config.js` change (the backend reads it at process start, for email footers/log lines/system-email content).',
        ],
      },
      {
        heading: 'Requires a database migration (running `schema.sql` again)',
        list: [
          'Adding a new table or column in `server/src/db/schema.sql`.',
          'This happens automatically on every backend start (`server/src/index.js` runs `migrate()` before listening) — so a restart already covers this. Running `npm run migrate` by hand (from `server/`) applies it without a full restart if the process is already up and you specifically want the schema updated first.',
        ],
      },
      {
        heading: 'Needs neither a rebuild nor a restart',
        list: [
          'Data stored in the database itself and edited from inside the running app — workspace settings (Settings page), backup retention/storage limit, system email content, connected accounts, users/roles, templates. These take effect immediately because they are read from the database on each relevant request, not baked into any build.',
        ],
      },
    ],
  },

  // =========================================================================
  {
    number: 23,
    key: 'troubleshooting',
    icon: 'bi-life-preserver',
    title: 'Troubleshooting',
    minutes: 7,
    sections: [
      {
        heading: 'Frontend not loading / blank page',
        list: [
          'Check the browser console for errors first.',
          'Confirm the static files were actually deployed from the latest `dist/` build (Chapter 18) — a stale deploy is the most common cause.',
          'If it 404s on every route except `/`, the static host isn\'t configured to serve `index.html` for unknown paths — this is a client-side-routed SPA, every path needs to fall back to `index.html`.',
        ],
      },
      {
        heading: 'API unavailable / "Network error" everywhere',
        list: [
          'Check `GET /api/health` directly in a browser — if that itself fails, the backend process is down or unreachable, not a frontend problem.',
          'Confirm `VITE_API_URL` was set correctly at BUILD time for this deployment (Chapter 18) — check what URL the frontend is actually calling, in the browser Network tab.',
        ],
      },
      {
        heading: 'Database connection failure',
        list: [
          'Check the backend\'s startup log — it prints `[db] Asli Postgres se juda` on a successful real-Postgres connection, or falls back to PGlite with a clear warning if `DATABASE_URL` is empty/unreachable.',
          'Confirm `DATABASE_URL` is correct and the database is reachable from where the backend is actually running (network/firewall rules, not just a typo).',
          'If the provider requires SSL and `DATABASE_SSL` isn\'t set, connection attempts fail — check the provider\'s own connection instructions.',
        ],
      },
      {
        heading: 'CORS error in the browser console',
        list: [
          'The backend\'s `CORS_ORIGINS` does not include the exact origin the browser is loading the frontend from (scheme + host + port must match exactly).',
          'Restart the backend after changing `CORS_ORIGINS` — it\'s read once at process start.',
        ],
      },
      {
        heading: 'Login / session issue',
        list: [
          'If login works but the session doesn\'t survive a page refresh: check `AUTH_COOKIE_SAMESITE` — it needs `none` (not the default `lax`) if the frontend and backend are on two completely unrelated domains, and the backend\'s cookie is only marked `secure` when `NODE_ENV=production` or `AUTH_COOKIE_SAMESITE=none`, which requires the site to actually be served over HTTPS.',
          'If a specific account can\'t sign in even with the right password: check whether that account is disabled, or whether too many wrong attempts triggered the 15-minute per-account rate limit (`routes/auth.js`).',
        ],
      },
      {
        heading: 'SMTP / email sending failure',
        list: [
          'Check the specific error returned — `mailer.js` gives a specific message when a password can\'t be decrypted (likely `JWT_SECRET` changed) versus when SMTP details are genuinely incomplete.',
          'Confirm `MAIL_TRANSPORT` is `smtp` in production, not accidentally left as `ethereal` or `json`.',
          'Check the connected account\'s daily send limit hasn\'t been reached (the campaign would show as `Paused`, `pause_reason: quota`, not a hard failure).',
        ],
      },
      {
        heading: 'Storage (Object Storage) failure',
        list: [
          'Settings > Storage > Test Connection gives a specific message — "could not be decrypted" points at a `JWT_SECRET` mismatch (Chapter 20); anything else is a genuine bucket/credentials/network problem.',
          'Confirm the region/endpoint/path-style combination matches what that specific provider actually needs (`server/src/lib/storageProviders.js` documents this per provider).',
        ],
      },
      {
        heading: 'Backup failure',
        list: [
          'Check the backend log for `[backup] "..." banane me dikkat` — the specific error follows.',
          'If `BACKUP_STORAGE=s3`, confirm the bucket/credentials are correct the same way as Object Storage above.',
          'A failed backup never overwrites a previous good one — the failed row is marked `status: failed`, older successful backups remain untouched.',
        ],
      },
      {
        heading: 'Restore failure',
        list: [
          'Check whether it failed before or after the automatic safety backup — if the safety backup itself couldn\'t be created, restore never started and the existing data is untouched (this is by design).',
          'On real Postgres, a restore failure rolls back the whole transaction automatically — the database is left exactly as it was before the attempt.',
        ],
      },
      {
        heading: 'JWT_SECRET mismatch',
        list: [
          'Symptoms: everyone was signed out unexpectedly, AND/OR a previously-working connected email account or Object Storage bucket suddenly needs its password/secret key re-entered.',
          'Cause: `JWT_SECRET` changed (most commonly: it was never set explicitly, and the app auto-generated a new one on a redeploy/restart).',
          'Fix: set `JWT_SECRET` explicitly, to a value that will not change again, in the hosting platform\'s own environment variable settings. If the OLD value is known, restoring it recovers existing encrypted credentials; if not, affected accounts must be reconnected by hand.',
        ],
      },
      {
        heading: 'Missing environment variable',
        list: [
          'The backend does not crash outright for most missing variables — it falls back to a documented default (see Chapter 14 and `server/.env.example`). Check the startup log for warnings (e.g. about `JWT_SECRET`, or PGlite being used because `DATABASE_URL` is empty).',
          'Compare the deployed `.env` against `server/.env.example` line by line if something is behaving unexpectedly.',
        ],
      },
      {
        heading: 'Build failure',
        list: [
          'Run `npm run lint` and `npm run build` locally first to see the actual error rather than a hosting platform\'s truncated log.',
          'Confirm `npm install` was run fresh for this exact checkout (a `package-lock.json` mismatch after pulling new code is a common cause).',
        ],
      },
      {
        heading: 'Node version mismatch',
        list: [
          'Both `package.json` (root) and `server/package.json` declare `engines.node: ">=20"`. If the hosting platform defaults to an older Node version, set it explicitly in that platform\'s settings (or an `.nvmrc`-style mechanism it supports) to a version `>=20`.',
        ],
      },
      {
        heading: 'Port / process issue',
        list: [
          'The backend checks whether its port is already in use BEFORE touching the database, and exits with a clear message if so — this is deliberate, so a second accidental instance never opens the same PGlite folder concurrently.',
          'On a VPS, confirm the process manager (`pm2`/`systemd`) actually has the backend running (`pm2 status` / `systemctl status`) — a crashed process with no supervisor restarting it looks identical to "API unavailable" from the outside.',
        ],
      },
    ],
  },
];

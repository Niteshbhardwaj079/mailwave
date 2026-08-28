// ---------------------------------------------------------------------------
// SYSTEM EMAILS ("transactional" emails)
//
// These are the emails the APP itself sends — not marketing campaigns.
// Every one is listed here with the event that fires it, who receives it, the
// subject line, the variables it may use, and ready HTML.
//
// Why this file exists: when the backend is built, each event just needs
//   sendSystemEmail('user.invited', { to, vars })
// and nothing else has to be written or designed.
// ---------------------------------------------------------------------------

/** Shared shell so every system email looks the same. */
function shell(bodyHtml, accent = '#4f46e5') {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">
        <tr>
          <td align="center" style="background:${accent};padding:20px">
            <span style="color:#ffffff;font-size:18px;font-weight:bold">{{app_name}}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
${bodyHtml}
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#f9fafb;padding:18px;font-size:12px;color:#6b7280">
            {{company}} · <a href="mailto:{{support_email}}" style="color:#6b7280">{{support_email}}</a><br />
            This is an automatic message about your account. You cannot unsubscribe from it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function button(label, urlVar, accent = '#4f46e5') {
  return `            <p style="margin:24px 0 0">
              <a href="{{${urlVar}}}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:bold">${label}</a>
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#6b7280">
              If the button does not work, copy this link into your browser:<br />
              <span style="color:#4b5563">{{${urlVar}}}</span>
            </p>`;
}

export const EMAIL_GROUPS = [
  { key: 'account', labelKey: 'sysmail.groupAccount', icon: 'bi-person-lock' },
  { key: 'team', labelKey: 'sysmail.groupTeam', icon: 'bi-people' },
  { key: 'work', labelKey: 'sysmail.groupWork', icon: 'bi-send' },
];

export const systemEmailTemplates = [
  // --- Account & password ---------------------------------------------------
  {
    key: 'user.invited',
    group: 'account',
    name: 'Invitation — set your password',
    event: 'A Super Admin or Admin creates a new user',
    to: 'The new user',
    critical: true,
    subject: 'You have been added to {{app_name}} — set your password',
    variables: ['name', 'email', 'role', 'invited_by', 'set_password_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Hello {{name}},</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              {{invited_by}} has created an account for you on {{app_name}} as <strong>{{role}}</strong>.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              Your sign-in email is <strong>{{email}}</strong>. Choose your own password to finish:
            </p>
${button('Set my password', 'set_password_url')}
            <p style="margin:20px 0 0;font-size:13px;color:#6b7280">
              This link works for 48 hours. Nobody at {{company}} can see the password you choose.
            </p>`
    ),
  },
  {
    key: 'password.reset',
    group: 'account',
    name: 'Forgot password',
    event: 'A user presses “Forgot password?” on the sign-in page',
    to: 'The user who asked',
    critical: true,
    subject: 'Reset your {{app_name}} password',
    variables: ['name', 'reset_url', 'request_ip', 'request_time', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Reset your password</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, we received a request to reset your password on {{request_time}} from {{request_ip}}.
            </p>
${button('Choose a new password', 'reset_url')}
            <p style="margin:20px 0 0;font-size:13px;color:#6b7280">
              This link works for 1 hour and can be used once. If you did not ask for this, ignore this email — your
              password stays as it is.
            </p>`
    ),
  },
  {
    key: 'password.changed',
    group: 'account',
    name: 'Password changed',
    event: 'A user changes their own password',
    to: 'The user',
    critical: true,
    subject: 'Your {{app_name}} password was changed',
    variables: ['name', 'change_time', 'request_ip', 'device', 'support_email', 'app_name', 'company'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your password was changed</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, your {{app_name}} password was changed on {{change_time}} from {{device}} ({{request_ip}}).
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              If this was you, nothing more to do. If it was not you, write to
              <a href="mailto:{{support_email}}">{{support_email}}</a> straight away.
            </p>`,
      '#d97706'
    ),
  },
  {
    key: 'password.setByAdmin',
    group: 'account',
    name: 'Password set by Super Admin',
    event: 'A Super Admin sets a new password for someone',
    to: 'The user whose password was changed',
    critical: true,
    subject: 'A new password was set for your {{app_name}} account',
    variables: ['name', 'changed_by', 'change_time', 'sign_in_url', 'support_email', 'app_name', 'company'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">A new password was set for you</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, <strong>{{changed_by}}</strong> set a new password for your account on {{change_time}}.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              The password itself was given to you separately — it is never written in an email. Please sign in and
              change it to something only you know.
            </p>
${button('Sign in', 'sign_in_url', '#d97706')}`,
      '#d97706'
    ),
  },
  {
    key: 'login.newDevice',
    group: 'account',
    name: 'Sign-in from a new device',
    event: 'A user signs in from a device or place we have not seen before',
    to: 'The user',
    critical: false,
    subject: 'New sign-in to your {{app_name}} account',
    variables: ['name', 'device', 'request_ip', 'location', 'change_time', 'support_email', 'app_name', 'company'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">New sign-in</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, your account was opened on a new device.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              {{device}} · {{location}} · {{request_ip}} · {{change_time}}
            </p>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#374151">
              Not you? Change your password now and tell <a href="mailto:{{support_email}}">{{support_email}}</a>.
            </p>`,
      '#0891b2'
    ),
  },

  // --- Team & permissions ---------------------------------------------------
  {
    key: 'user.roleChanged',
    group: 'team',
    name: 'Role changed',
    event: 'A Super Admin changes someone’s role',
    to: 'The user',
    critical: false,
    subject: 'Your role in {{app_name}} is now {{new_role}}',
    variables: ['name', 'old_role', 'new_role', 'changed_by', 'change_time', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your role has changed</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, {{changed_by}} changed your role from <strong>{{old_role}}</strong> to
              <strong>{{new_role}}</strong> on {{change_time}}.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              What you can see and do may look different the next time you sign in.
            </p>`,
      '#0891b2'
    ),
  },
  {
    key: 'user.disabled',
    group: 'team',
    name: 'Account turned off',
    event: 'A Super Admin disables a user',
    to: 'The user',
    critical: false,
    subject: 'Your {{app_name}} account has been turned off',
    variables: ['name', 'changed_by', 'change_time', 'support_email', 'app_name', 'company'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your account is turned off</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, {{changed_by}} turned off your access on {{change_time}}. You will not be able to sign in.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              If you think this is a mistake, write to <a href="mailto:{{support_email}}">{{support_email}}</a>.
            </p>`,
      '#dc2626'
    ),
  },
  {
    key: 'admin.userCreated',
    group: 'team',
    name: 'Someone was added (copy to Super Admin)',
    event: 'Any user is created — a copy goes to every Super Admin',
    to: 'All Super Admins',
    critical: false,
    subject: '{{created_by}} added {{name}} to {{app_name}}',
    variables: ['name', 'email', 'role', 'created_by', 'change_time', 'activity_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">A new person was added</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              {{created_by}} added <strong>{{name}}</strong> ({{email}}) as <strong>{{role}}</strong> on {{change_time}}.
            </p>
${button('Open the activity log', 'activity_url', '#0891b2')}`,
      '#0891b2'
    ),
  },
  {
    key: 'admin.permissionChanged',
    group: 'team',
    name: 'Permissions changed (copy to Super Admin)',
    event: 'A role’s permissions are changed',
    to: 'All Super Admins',
    critical: false,
    subject: 'Permissions changed for {{role}}',
    variables: ['role', 'changed_by', 'change_time', 'change_summary', 'activity_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Permissions were changed</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              {{changed_by}} changed what <strong>{{role}}</strong> may do on {{change_time}}.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">{{change_summary}}</p>
${button('Open the activity log', 'activity_url', '#d97706')}`,
      '#d97706'
    ),
  },

  // --- Everyday work --------------------------------------------------------
  {
    key: 'campaign.finished',
    group: 'work',
    name: 'Campaign finished',
    event: 'A campaign finishes sending',
    to: 'The person who sent it',
    critical: false,
    subject: '“{{campaign_name}}” has finished sending',
    variables: ['name', 'campaign_name', 'total_sent', 'total_failed', 'report_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your campaign is done</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, <strong>{{campaign_name}}</strong> has finished. {{total_sent}} emails went out and
              {{total_failed}} failed.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              Opens and clicks keep arriving for a few days, so the numbers will still move.
            </p>
${button('See the report', 'report_url', '#16a34a')}`,
      '#16a34a'
    ),
  },
  {
    key: 'campaign.failed',
    group: 'work',
    name: 'Sending stopped with a problem',
    event: 'Sending stops because the provider refused or the account broke',
    to: 'The sender and all Super Admins',
    critical: false,
    subject: 'Sending stopped: {{campaign_name}}',
    variables: ['name', 'campaign_name', 'reason', 'sent_so_far', 'campaign_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Sending stopped</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              <strong>{{campaign_name}}</strong> stopped after {{sent_so_far}} emails.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">Reason given by the provider: {{reason}}</p>
${button('Open the campaign', 'campaign_url', '#dc2626')}`,
      '#dc2626'
    ),
  },
  {
    key: 'account.connected',
    group: 'work',
    name: 'Email account connected',
    event: 'A sending account is connected or disconnected',
    to: 'All Super Admins',
    critical: false,
    subject: '{{provider}} account {{account_email}} was connected',
    variables: ['account_email', 'provider', 'changed_by', 'change_time', 'accounts_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">A sending account was connected</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              {{changed_by}} connected <strong>{{account_email}}</strong> ({{provider}}) on {{change_time}}.
            </p>
${button('See email accounts', 'accounts_url')}`
    ),
  },
  {
    key: 'contacts.imported',
    group: 'work',
    name: 'Import finished',
    event: 'A contact import finishes',
    to: 'The person who imported',
    critical: false,
    subject: 'Import finished — {{valid_count}} contacts added',
    variables: ['name', 'file_name', 'valid_count', 'invalid_count', 'duplicate_count', 'contacts_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your import is done</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, <strong>{{file_name}}</strong> has been imported.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              Added: {{valid_count}} · Skipped as broken: {{invalid_count}} · Skipped as duplicate: {{duplicate_count}}
            </p>
${button('See contacts', 'contacts_url', '#16a34a')}`,
      '#16a34a'
    ),
  },
  {
    key: 'contact.subscribed',
    group: 'work',
    name: 'Someone subscribed',
    event: 'A reader presses the Subscribe button inside a campaign email',
    to: 'The campaign owner (and the new subscriber gets a thank-you)',
    critical: false,
    subject: '{{name}} subscribed from “{{campaign_name}}”',
    variables: ['name', 'email', 'campaign_name', 'change_time', 'subscribers_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">A new subscriber</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              <strong>{{name}}</strong> ({{email}}) pressed Subscribe in <strong>{{campaign_name}}</strong> on
              {{change_time}}.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              They are now on your subscriber list and can be picked as recipients in any new campaign.
            </p>
${button('See subscribers', 'subscribers_url', '#16a34a')}`,
      '#16a34a'
    ),
  },
  {
    key: 'report.ready',
    group: 'work',
    name: 'Export ready to download',
    event: 'A large export finishes being prepared',
    to: 'The person who asked for it',
    critical: false,
    subject: 'Your {{report_name}} export is ready',
    variables: ['name', 'report_name', 'row_count', 'download_url', 'app_name', 'company', 'support_email'],
    html: shell(
      `            <h1 style="margin:0 0 14px;font-size:22px;color:#111827">Your file is ready</h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#374151">
              Hello {{name}}, your <strong>{{report_name}}</strong> export is ready — {{row_count}} rows.
            </p>
${button('Download the file', 'download_url')}
            <p style="margin:20px 0 0;font-size:13px;color:#6b7280">The link works for 7 days.</p>`
    ),
  },
];

/** Values used only for the preview on screen. */
export const previewValues = {
  app_name: 'MailWave',
  company: 'GoWebKart',
  support_email: 'support@gowebkart.com',
  name: 'Neha Kulkarni',
  email: 'neha@gowebkart.com',
  role: 'Admin',
  old_role: 'Member',
  new_role: 'Admin',
  invited_by: 'Rohit Sharma',
  created_by: 'Rohit Sharma',
  changed_by: 'Rohit Sharma',
  change_time: '27 Aug 2026, 11:40',
  request_time: '27 Aug 2026, 11:38',
  request_ip: '103.21.58.12',
  device: 'Chrome on Windows',
  location: 'Mumbai, India',
  change_summary: 'Allowed “Send” on Campaigns; removed “Delete” on Contacts.',
  campaign_name: 'Independence Day Offer 2026',
  total_sent: '5,200',
  total_failed: '96',
  sent_so_far: '1,200',
  reason: 'Daily sending limit reached on the connected account',
  account_email: 'offers@gowebkart.com',
  provider: 'Microsoft 365',
  file_name: 'sales-leads-august.xlsx',
  valid_count: '1,201',
  invalid_count: '41',
  duplicate_count: '42',
  report_name: 'Opened list',
  row_count: '812',
  set_password_url: 'https://app.example.com/set-password?token=abc123',
  reset_url: 'https://app.example.com/reset-password?token=abc123',
  sign_in_url: 'https://app.example.com/login',
  activity_url: 'https://app.example.com/activity',
  campaign_url: 'https://app.example.com/campaigns/cmp_1041',
  accounts_url: 'https://app.example.com/accounts',
  contacts_url: 'https://app.example.com/contacts',
  download_url: 'https://app.example.com/download/abc123',
  subscribers_url: 'https://app.example.com/subscribers',
};

/** Replace {{var}} with the preview value so the screen shows a real email. */
export function fillPreview(text, values = previewValues) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    values[key] !== undefined ? values[key] : match
  );
}

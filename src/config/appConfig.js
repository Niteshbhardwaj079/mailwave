// ---------------------------------------------------------------------------
// ONE PLACE for your brand.
// Change the values here and the whole app follows: sidebar, login page,
// browser tab title, preview pages, footer text — everything.
// ---------------------------------------------------------------------------

export const appConfig = {
  /** Shown in the sidebar, the login screen and the browser tab. */
  name: 'MailWave',

  /** Small line under the name in the sidebar. */
  tagline: 'Campaigns & tracking',

  /** Bootstrap icon used as the logo mark. See https://icons.getbootstrap.com */
  logoIcon: 'bi-send-fill',

  /** Company that owns this workspace — used in email footers and the login page. */
  company: 'GoWebKart',

  /** Where users are told to write when they need help. */
  supportEmail: 'support@gowebkart.com',

  /** What the browser tab says: "<name> — <titleSuffix>" */
  titleSuffix: 'Email Campaign Platform',

  /** 'light', 'dark' or 'system' (follows the computer's setting). */
  defaultTheme: 'system',

  /** Must match one of the keys in src/config/themeColors.js */
  defaultAccent: 'indigo',
};

export default appConfig;

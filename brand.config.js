// ===========================================================================
//
//   YEH EK FILE — POORE APP KA NAAM AUR DETAILS
//
//   Client badalna ho, ya apna naam badalna ho — bas yahi file badalni hai.
//   Poora app apne aap badal jayega:
//
//     - Sidebar ka naam aur logo
//     - Login screen
//     - Browser tab ka title
//     - Bheje jane wale email ka footer
//     - System email (invite, password reset, waghairah)
//     - Backend ke log
//
//   Kahin aur "MailWave" ya company ka naam likha hua nahi hai. Yeh file
//   frontend aur backend DONO padhte hain, isliye do jagah badalne ki zarurat
//   nahi.
//
//   Badalne ke baad: dono windows band karke `start-mailwave.bat` dobara chalao.
//
// ===========================================================================

export const brand = {
  // --- Naam ----------------------------------------------------------------

  /**
   * App ka naam. Sidebar, login screen, browser tab — sab jagah yahi dikhega.
   * Domain ke hisaab se rakhna theek rehta hai (jaise domain mailwave.in hai
   * to naam "MailWave").
   */
  name: 'MailWave',

  /** Naam ke niche chhoti si line (sidebar aur login par). */
  tagline: 'Campaigns & tracking',

  /**
   * Browser ke tab me aisa dikhega: "<name> — <titleSuffix>"
   * Jaise: "MailWave — Email Campaign Platform"
   */
  titleSuffix: 'Email Campaign Platform',

  /** Google par jo do line dikhti hain. */
  description: 'Bulk email campaigns, automation and tracking',

  // --- Logo ----------------------------------------------------------------

  /**
   * Logo ka icon. Bootstrap Icons me se koi bhi naam daal sakte ho.
   * Saari icons yahan dekho: https://icons.getbootstrap.com
   * Jaise: 'bi-send-fill', 'bi-envelope-fill', 'bi-rocket-takeoff-fill'
   */
  logoIcon: 'bi-send-fill',

  // --- Company (email ke footer me aur legal ke liye) ----------------------

  /** Jis company ka yeh app hai. Email footer me yahi naam jata hai. */
  company: 'Gowebkart',

  /** Madad ke liye log yahan likhenge. */
  supportEmail: 'support@gowebkart.in',

  /** Company ki website (khali chhod sakte ho). */
  website: 'https://gowebkart.in',

  /**
   * Company ka pura pata.
   *
   * ZAROORI: bulk email me bhejne wale ka asli pata hona kanoonan zaroori hai
   * (India ka IT Act, America ka CAN-SPAM, Europe ka GDPR — sab me).
   * Pata na ho to Gmail/Outlook spam me daal dete hain.
   */
  address: '',

  // --- Shuruaati look ------------------------------------------------------

  /** 'light', 'dark' ya 'system' (computer ki setting follow karega). */
  defaultTheme: 'system',

  /**
   * Shuruaati rang. src/config/themeColors.js me jo keys hain unme se koi ek:
   * indigo, blue, teal, green, amber, rose, violet, slate
   */
  defaultAccent: 'indigo',

  // --- Developer Guide -------------------------------------------------------

  /**
   * `/developer-guide` page (file paths, env vars, deploy steps — for whoever
   * maintains this codebase next, not for end users).
   *
   * `true`  -> sidebar link visible, page reachable (still needs sign-in).
   * `false` -> sidebar link hidden AND the route itself stops resolving —
   *            visiting the URL directly lands on the normal 404 page, same
   *            as any other route that doesn't exist. Not just a hidden link.
   *
   * Turn this off before handing a build to a client who shouldn't see how
   * the app is built — leave it on for your own team's installs.
   */
  developerGuide: true,

  // --- Design / copy protection ---------------------------------------------

  /**
   * Deters CASUAL right-click / text-select / view-source / save-page on the
   * app's own screens — sidebar, dashboard, reports, cards, and so on.
   *
   * This is NOT real security and cannot be — no website can stop a
   * screenshot, a phone camera, or a screen recording, and anyone with
   * browser dev tools open can get around all of this in seconds. It only
   * raises the bar against a casual "right click > save image" or
   * "select all > copy" of the design.
   *
   * Nothing users actually need is affected either way: typing and
   * selecting inside form fields, the template/HTML code editor, and every
   * "Copy" button in the app (API keys, tracking links, {{tokens}}...) keep
   * working exactly as before — those use the clipboard API directly, not
   * text selection.
   *
   * `true`  -> right-click, Ctrl+U (view source), Ctrl+S (save page), and
   *            selecting/copying plain page text are blocked outside of
   *            actual inputs and editors.
   * `false` -> none of this runs; the app behaves like any normal website.
   */
  securityProtection: false,

  // --- Demo login banner ------------------------------------------------------

  /**
   * A "try it yourself" box on the sign-in screen — shows a working email +
   * password and a one-click "Use this account" button, so anyone visiting
   * the login page can sign in without asking for a real account.
   *
   * ONLY for a public demo/preview install. Turn this OFF (`enabled: false`)
   * before handing a build to a real client — a real client's own login
   * screen should never publish a working password to every visitor.
   *
   * The account itself (email/password/role) has to actually exist in that
   * install's database — this just displays whatever you type here. Nothing
   * here creates or changes an account by itself.
   */
  demoLogin: {
    enabled: true,
    email: 'mailwave.demo@gmail.com',
    password: 'mailwave@1234',
  },
};

export default brand;

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
  company: 'GoWebKart',

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
};

export default brand;

// Ready-made HTML people can load and edit. Plain table markup, because that
// is what email apps (Gmail, Outlook) render most reliably.

export const BLANK_HTML = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:24px;color:#111827">Hello {{name}}</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              Write your message here.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

export const starterTemplates = [
  {
    key: 'offer',
    name: 'Offer / Sale',
    description: 'Big headline, one picture, one button. Good for discounts and festival offers.',
    icon: 'bi-tag',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">

        <tr>
          <td align="center" style="background:#4f46e5;padding:22px">
            <span style="color:#ffffff;font-size:20px;font-weight:bold">YOUR COMPANY</span>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px">
            <h1 style="margin:0 0 10px;font-size:26px;color:#111827">Hello {{name}}, 30% off this week</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">
              Our biggest sale of the season is live. Use the code below before Sunday.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px 32px">
            <img src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='536' height='220'%3E%3Crect width='536' height='220' fill='%23eef2ff'/%3E%3Ctext x='268' y='118' font-family='Arial' font-size='22' fill='%234f46e5' text-anchor='middle'%3EYour banner image%3C/text%3E%3C/svg%3E" width="536" alt="Offer banner" style="display:block;border-radius:8px;max-width:100%" />
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:8px 32px 32px">
            <a href="https://yourcompany.com/offer" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:8px;font-size:15px;font-weight:bold">Shop the sale</a>
          </td>
        </tr>

        <tr>
          <td align="center" style="background:#f9fafb;padding:20px;font-size:12px;color:#6b7280">
            Your Company, Mumbai, India<br />
            <a href="{{unsubscribe_url}}" style="color:#6b7280">Unsubscribe</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,
  },
  {
    key: 'welcome',
    name: 'Welcome / Thank you',
    description: 'A warm hello for new customers. Text-first, one soft button.',
    icon: 'bi-emoji-smile',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden">

        <tr>
          <td style="padding:36px 32px 12px">
            <h1 style="margin:0 0 14px;font-size:24px;color:#111827">Welcome, {{name}} 👋</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#374151">
              Thank you for joining us. We are glad to have {{company}} on board.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.75;color:#374151">
              Here is what happens next — our team will call you within one working day to set everything up.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 32px">
            <a href="https://yourcompany.com/start" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:bold">Get started</a>
          </td>
        </tr>

        <tr>
          <td align="center" style="background:#f9fafb;padding:20px;font-size:12px;color:#6b7280">
            Your Company · <a href="{{unsubscribe_url}}" style="color:#6b7280">Unsubscribe</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,
  },
  {
    key: 'notice',
    name: 'Announcement / Notice',
    description: 'Plain and clear. Best for updates, holidays and important notices.',
    icon: 'bi-megaphone',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0">

        <tr>
          <td style="padding:24px 32px;border-left:4px solid #d97706;background:#fdf3e3">
            <h2 style="margin:0 0 8px;font-size:20px;color:#8a5209">Important notice</h2>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#7c4a08">
              Dear {{name}}, our office will stay closed on Monday for the festival.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:#374151">
              Orders placed after Saturday 6 pm will be shipped on Tuesday. Support email is answered as usual.
            </p>
            <p style="margin:0;font-size:15px;line-height:1.75;color:#374151">
              Sorry for the trouble, and thank you for your patience.
            </p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
            <a href="{{unsubscribe_url}}" style="color:#6b7280">Unsubscribe from these emails</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`,
  },
];

// ---------------------------------------------------------------------------
// Tracking — yeh routes PUBLIC hain (login ki zarurat nahi).
//
// Kyun? Kyunki inhe recipient ka mail app kholta hai, hamari website nahi.
// Isliye yahan koi private data nahi lautaya jata — sirf image, redirect ya
// ek chhota confirmation page.
//
//   /t/o/:id.png   open pixel   — email khula
//   /t/c/:link/:id click        — link dabaya, phir asli jagah bhej dete hain
//   /t/u/:id       unsubscribe  — list se hata do
//   /t/s/:id       subscribe    — subscriber list me jodo
// ---------------------------------------------------------------------------
import { Router } from 'express';

import { one, query, transaction } from '../db/client.js';
import { env } from '../env.js';
import { asyncHandler } from '../lib/http.js';
import { clientIp } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { escapeHtml } from '../services/render.js';
import { sendSystemEmail } from '../services/systemMail.js';
import { enqueueWebhookEvent } from '../services/webhooks.js';

const router = Router();

// 1x1 transparent GIF. Isko image banane ki zarurat nahi — bytes yahin likhe hain.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/** Kisi bhi haal me pixel bhejo — tracking fail ho to bhi email tuta nahi dikhna chahiye. */
function sendPixel(res) {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    // Mail app image cache kar le to dobara open count nahi hoga, isliye
    // cache poori tarah band.
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(PIXEL);
}

async function recordEvent(campaignId, recipientId, kind, req, linkId = null) {
  await query(
    `INSERT INTO tracking_events (campaign_id, recipient_id, link_id, kind, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [campaignId, recipientId, linkId, kind, req.get('user-agent')?.slice(0, 300) ?? null, clientIp(req)]
  );
}

// --- open ------------------------------------------------------------------
router.get(
  '/o/:id.png',
  asyncHandler(async (req, res) => {
    const recipientId = req.params.id;

    try {
      const recipient = await one(
        'SELECT id, campaign_id, email, name, open_count FROM campaign_recipients WHERE id = $1',
        [recipientId]
      );

      if (recipient) {
        await query(
          `UPDATE campaign_recipients
              SET open_count = open_count + 1,
                  first_open_at = COALESCE(first_open_at, now()),
                  last_open_at = now()
            WHERE id = $1`,
          [recipientId]
        );
        await recordEvent(recipient.campaign_id, recipientId, 'open', req);

        // Sirf PEHLI baar — mail app baar-baar wahi pixel dobara load kar
        // sakta hai, aur har baar webhook bhejna ek hi "khola" ko baar-baar
        // client ko batana hoga.
        if (recipient.open_count === 0) {
          await enqueueWebhookEvent('email.opened', {
            campaignId: recipient.campaign_id,
            recipientId: recipient.id,
            email: recipient.email,
            name: recipient.name,
          });
        }
      }
    } catch (error) {
      // Note kar lo, par pixel to bhejna hi hai.
      console.error('[track] open', error);
    }

    sendPixel(res);
  })
);

// --- click -----------------------------------------------------------------
router.get(
  '/c/:linkId/:recipientId',
  asyncHandler(async (req, res) => {
    const { linkId, recipientId } = req.params;

    const link = await one('SELECT id, campaign_id, url FROM campaign_links WHERE id = $1', [linkId]);

    // Link hi nahi mila to kahin bhejna khatarnak hai (open redirect banta hai).
    if (!link) {
      res.status(404).type('text/plain').send('This link is no longer available.');
      return;
    }

    try {
      await query('UPDATE campaign_links SET click_count = click_count + 1 WHERE id = $1', [linkId]);
      const recipient = await one(
        `UPDATE campaign_recipients
            SET click_count = click_count + 1, last_click_at = now()
          WHERE id = $1
      RETURNING email, name`,
        [recipientId]
      );
      await recordEvent(link.campaign_id, recipientId, 'click', req, linkId);

      if (recipient) {
        await enqueueWebhookEvent('email.clicked', {
          campaignId: link.campaign_id,
          recipientId,
          email: recipient.email,
          name: recipient.name,
          url: link.url,
        });
      }
    } catch (error) {
      console.error('[track] click', error);
    }

    // 302, 301 nahi — 301 browser hamesha ke liye yaad rakh leta hai aur
    // agli baar humein bataye bina seedha chala jata hai.
    res.redirect(302, link.url);
  })
);

// --- unsubscribe -----------------------------------------------------------

/** Chhota sa page — recipient ko dikhane ke liye. */
function page(title, message) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:48px 20px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;text-align:center">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:36px 28px;
              box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827">${escapeHtml(title)}</h1>
    <p style="margin:0;font-size:15px;color:#4b5563;line-height:1.6">${escapeHtml(message)}</p>
  </div>
</body></html>`;
}

async function unsubscribe(req, res) {
  const recipientId = req.params.id;

  const recipient = await one(
    'SELECT id, campaign_id, email, name FROM campaign_recipients WHERE id = $1',
    [recipientId]
  );

  if (!recipient) {
    res.status(404).type('html').send(page('Link not found', 'This unsubscribe link is not valid any more.'));
    return;
  }

  // All five writes below must land together or not at all — a crash between
  // them used to risk marking someone unsubscribed on this one recipient row
  // without ever reaching the suppression list, which is exactly the record
  // that stops every future campaign from emailing them again.
  await transaction(async () => {
    await query('UPDATE campaign_recipients SET unsubscribed = true WHERE id = $1', [recipientId]);
    await enqueueWebhookEvent('contact.unsubscribed', {
      campaignId: recipient.campaign_id,
      recipientId: recipient.id,
      email: recipient.email,
      name: recipient.name,
    });
    await query(
      `UPDATE contacts SET status = 'Unsubscribed', updated_at = now() WHERE lower(email) = lower($1)`,
      [recipient.email]
    );
    // Agar yeh insaan kabhi "Subscribe" bhi dabaya tha, to Subscribers page par
    // bhi ab "chhod diya" dikhna chahiye — warna wahan hamesha "Subscribed" hi
    // dikhta rehta, chahe woh unsubscribe kar chuka ho.
    await query(
      `UPDATE subscribers SET status = 'Left later' WHERE lower(email) = lower($1)`,
      [recipient.email]
    );
    // Suppression list = pakki rok. Ab koi bhi campaign ise nahi bhejega.
    await query(
      `INSERT INTO suppression (email, reason, detail) VALUES ($1,'unsubscribed',$2)
       ON CONFLICT (email) DO NOTHING`,
      [recipient.email, `Unsubscribed from campaign ${recipient.campaign_id}`]
    );
    await recordEvent(recipient.campaign_id, recipientId, 'unsubscribe', req);
  });

  res.type('html').send(
    page('You have been unsubscribed', 'You will not receive any more emails from this list. Sorry to see you go.')
  );
}

router.get('/u/:id', asyncHandler(unsubscribe));

// Gmail/Outlook ka one-click unsubscribe POST bhejta hai, GET nahi.
router.post('/u/:id', asyncHandler(unsubscribe));

// --- subscribe -------------------------------------------------------------
router.get(
  '/s/:id',
  asyncHandler(async (req, res) => {
    const recipient = await one(
      'SELECT id, campaign_id, email, name, merge_data FROM campaign_recipients WHERE id = $1',
      [req.params.id]
    );

    if (!recipient) {
      res.status(404).type('html').send(page('Link not found', 'This link is not valid any more.'));
      return;
    }

    // ON CONFLICT DO NOTHING hota to jo pehle unsubscribe kar chuka hai, wo
    // dobara "Subscribe" dabane par bhi hamesha 'Left later' hi rehta —
    // screen "Thank you for subscribing" bolti, par kuch badalta hi nahi tha.
    //
    // WHERE guard: agar yeh insaan pehle se hi 'Subscribed' hai (jaise usne
    // yeh confirmation page dobara refresh kar diya), to koi row update nahi
    // hoti aur RETURNING khaali aata — isse campaign owner ko wahi subscribe
    // ke liye do baar email nahi jaati.
    const changed = await one(
      `INSERT INTO subscribers (id, name, email, company, city, campaign_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'Subscribed')
       ON CONFLICT (lower(email)) DO UPDATE
         SET status = 'Subscribed', campaign_id = EXCLUDED.campaign_id
         WHERE subscribers.status IS DISTINCT FROM 'Subscribed'
       RETURNING id`,
      [
        newId('sub'),
        recipient.name,
        recipient.email,
        recipient.merge_data?.company ?? null,
        recipient.merge_data?.city ?? null,
        recipient.campaign_id,
      ]
    );
    await recordEvent(recipient.campaign_id, recipient.id, 'subscribe', req);

    if (changed) {
      const owner = await one(
        `SELECT c.name AS campaign_name, u.email AS owner_email, u.name AS owner_name
           FROM campaigns c LEFT JOIN users u ON u.id = c.created_by
          WHERE c.id = $1`,
        [recipient.campaign_id]
      );
      if (owner?.owner_email) {
        await sendSystemEmail(
          'contact.subscribed',
          { email: owner.owner_email, name: owner.owner_name },
          {
            name: recipient.name || recipient.email,
            email: recipient.email,
            campaign_name: owner.campaign_name,
            change_time: new Date().toUTCString(),
            subscribers_url: `${env.appUrl}/subscribers`,
          }
        );
      }
    }

    res.type('html').send(
      page('Thank you for subscribing', 'You are on the list. We will keep you posted.')
    );
  })
);

export default router;

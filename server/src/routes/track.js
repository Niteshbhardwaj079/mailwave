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

import { one, query } from '../db/client.js';
import { asyncHandler } from '../lib/http.js';
import { clientIp } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { escapeHtml } from '../services/render.js';

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
        'SELECT id, campaign_id FROM campaign_recipients WHERE id = $1',
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
      await query(
        `UPDATE campaign_recipients
            SET click_count = click_count + 1, last_click_at = now()
          WHERE id = $1`,
        [recipientId]
      );
      await recordEvent(link.campaign_id, recipientId, 'click', req, linkId);
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
    'SELECT id, campaign_id, email FROM campaign_recipients WHERE id = $1',
    [recipientId]
  );

  if (!recipient) {
    res.status(404).type('html').send(page('Link not found', 'This unsubscribe link is not valid any more.'));
    return;
  }

  await query('UPDATE campaign_recipients SET unsubscribed = true WHERE id = $1', [recipientId]);
  await query(
    `UPDATE contacts SET status = 'Unsubscribed', updated_at = now() WHERE lower(email) = lower($1)`,
    [recipient.email]
  );
  // Suppression list = pakki rok. Ab koi bhi campaign ise nahi bhejega.
  await query(
    `INSERT INTO suppression (email, reason, detail) VALUES ($1,'unsubscribed',$2)
     ON CONFLICT (email) DO NOTHING`,
    [recipient.email, `Unsubscribed from campaign ${recipient.campaign_id}`]
  );
  await recordEvent(recipient.campaign_id, recipientId, 'unsubscribe', req);

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

    await query(
      `INSERT INTO subscribers (id, name, email, company, city, campaign_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (lower(email)) DO NOTHING`,
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

    res.type('html').send(
      page('Thank you for subscribing', 'You are on the list. We will keep you posted.')
    );
  })
);

export default router;

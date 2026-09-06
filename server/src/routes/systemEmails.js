// ---------------------------------------------------------------------------
// System emails — jo email app khud bhejta hai.
//
// Password reset, naye user ka invite, campaign poora hone ki khabar. Inka
// subject aur HTML yahan se badla ja sakta hai.
//
// Naye template banaye ya hataye nahi ja sakte. Wajah simple hai: har template
// ka naam (key) code me likha hua hai. Koi key hata de to us waqt email jana
// hi band ho jayega aur kisi ko pata bhi nahi chalega.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { sendSystemEmail } from '../services/systemMail.js';

const router = Router();

function toApi(row) {
  return {
    key: row.key,
    subject: row.subject,
    html: row.html,
    enabled: row.enabled,
    updated: row.updated_at,
  };
}

router.get(
  '/',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many('SELECT * FROM system_emails ORDER BY key');
    res.json({ systemEmails: rows.map(toApi) });
  })
);

router.put(
  '/:key',
  requireModule('settings', 'edit'),
  validate(
    z.object({
      subject: z.string().trim().min(1, 'Subject khali nahi ho sakta').max(300),
      html: z.string().max(500_000, 'Yeh template bahut bada hai'),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT * FROM system_emails WHERE key = $1', [req.params.key]);
    if (!existing) throw notFound('Yeh system email nahi mili');

    await query(
      'UPDATE system_emails SET subject = $1, html = $2, updated_at = now() WHERE key = $3',
      [req.body.subject, req.body.html, req.params.key]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: req.params.key,
      detail: 'System email ka matter badla',
    });

    const row = await one('SELECT * FROM system_emails WHERE key = $1', [req.params.key]);
    res.json({ systemEmail: toApi(row) });
  })
);

/**
 * Email ko chalu ya band karo.
 *
 * Kuch email band nahi ki ja saktin — jaise password reset. Agar wo band ho
 * jaye to jiska password bhool gaya wo kabhi wapas andar nahi aa payega, aur
 * use kaaran bhi pata nahi chalega.
 */
const CANNOT_TURN_OFF = ['password.reset', 'password.changed', 'user.invited', 'password.setByAdmin'];

router.post(
  '/:key/toggle',
  requireModule('settings', 'edit'),
  validate(z.object({ enabled: z.boolean() })),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT * FROM system_emails WHERE key = $1', [req.params.key]);
    if (!existing) throw notFound('Yeh system email nahi mili');

    if (!req.body.enabled && CANNOT_TURN_OFF.includes(req.params.key)) {
      throw badRequest('Yeh email band nahi ki ja sakti — iske bina log app me ghus hi nahi payenge');
    }

    await query('UPDATE system_emails SET enabled = $1, updated_at = now() WHERE key = $2', [
      req.body.enabled,
      req.params.key,
    ]);

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: req.params.key,
      detail: req.body.enabled ? 'System email chalu ki' : 'System email band ki',
    });

    const row = await one('SELECT * FROM system_emails WHERE key = $1', [req.params.key]);
    res.json({ systemEmail: toApi(row) });
  })
);

/**
 * Template ko wapas asli (factory) haalat me le aao.
 *
 * Edit karte-karte kuch bigad jaye — jaise {{reset_url}} galti se mit jaye —
 * to bina kisi ki madad ke wapas theek kiya ja sake. Asli matter wahi hai jo
 * src/data/systemEmails.js me likha hai, aur seed bhi wahi se aata hai.
 */
router.post(
  '/:key/reset',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const { systemEmailTemplates } = await import('../../../src/data/systemEmails.js');
    const original = systemEmailTemplates.find((item) => item.key === req.params.key);
    if (!original) throw notFound('Is email ka asli matter nahi mila');

    await query(
      'UPDATE system_emails SET subject = $1, html = $2, updated_at = now() WHERE key = $3',
      [original.subject, original.html, req.params.key]
    );

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: req.params.key,
      detail: 'System email wapas asli haalat me le aayi gayi',
    });

    const row = await one('SELECT * FROM system_emails WHERE key = $1', [req.params.key]);
    res.json({ systemEmail: toApi(row) });
  })
);

/**
 * Ek test email khud ko bhejo.
 *
 * Yeh sabse kaam ki cheez hai: template badalne ke baad wo asli me kaisi dikh
 * rahi hai, yeh apne inbox me dekh lo — kisi asli user par try karne se pehle.
 */
router.post(
  '/:key/test',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT key FROM system_emails WHERE key = $1', [req.params.key]);
    if (!existing) throw notFound('Yeh system email nahi mili');

    // Saare {{variables}} ki jagah saaf-saaf nakli value, taki dekhne wale ko
    // pata chale ki asli email me wahan kya aayega.
    const sample = {
      reset_url: 'https://example.com/reset-password?token=SAMPLE',
      invite_url: 'https://example.com/reset-password?token=SAMPLE',
      request_ip: '0.0.0.0',
      request_time: new Date().toUTCString(),
      change_time: new Date().toUTCString(),
      device: 'Test email',
      invited_by: req.user.name,
      changed_by: req.user.name,
      admin_name: req.user.name,
      disabled_by: req.user.name,
      old_role: 'admin',
      new_role: 'manager',
      role: 'admin',
      campaign_name: 'Test Campaign',
      sent_count: '100',
      open_rate: '42%',
      error_message: 'Test error',
      contact_count: '250',
      account_email: req.user.email,
      report_url: 'https://example.com/reports',
    };

    // force:true — "Send test" ka matlab sirf itna hai ki template kaisi
    // dikhti hai yeh dekhna hai. Isse yeh nahi khulta ki asli event (naya
    // user, campaign khatam waghairah) par bhi ab email jaane lagegi — wo
    // toggle jaisa hai waisa hi rehta hai.
    const sent = await sendSystemEmail(
      req.params.key,
      { email: req.user.email, name: req.user.name },
      sample,
      { force: true }
    );

    if (!sent.ok) {
      const why = {
        'no-account': 'Abhi tak koi email account juda nahi hai. Settings > Email accounts me ek jodo.',
        'send-failed': 'Email bhejte waqt dikkat aayi. Server ka console dekho.',
        'no-template': 'Yeh template nahi mili.',
      };
      throw badRequest(why[sent.reason] ?? 'Test email nahi ja saka');
    }

    res.json({ ok: true, to: req.user.email, previewUrl: sent.previewUrl ?? null });
  })
);

export default router;

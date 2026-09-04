// ---------------------------------------------------------------------------
// Image library — template me lagane wali tasveerein.
//
// Pehle yeh browser ke localStorage me rehti thin. Do badi dikkatein thin:
// localStorage sirf ~5 MB ka hota hai (do-teen photo me hi bhar jata hai), aur
// wo sirf ek browser ka hota hai — doosre computer par team ko kuch dikhta hi
// nahi tha. Ab yeh server par hain, sabke liye ek jagah.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { many, one, query } from '../db/client.js';
import { asyncHandler, badRequest, notFound } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { newId } from '../lib/ids.js';
import { validate } from '../lib/validate.js';
import { requireModule } from '../middleware/permissions.js';
import { env } from '../env.js';

const router = Router();

/**
 * Ek image ki hadd: 2 MB.
 *
 * Isse badi image email me bhejna waise bhi galat hai — kai log mobile data
 * par hote hain, aur Gmail 102 KB se badi email ko "clip" kar deta hai.
 */
const MAX_BYTES = 2 * 1024 * 1024;

const imageInput = z.object({
  name: z.string().trim().min(1, 'Image ko ek naam do').max(200),
  // Do tarah ki image chalti hai: upload ki hui (data: URL) ya kisi website
  // ka seedha link (https:).
  url: z.string().trim().min(1, 'Image ka data ya link chahiye').max(4_000_000),
  size: z.number().int().min(0).max(MAX_BYTES, 'Image 2 MB se choti honi chahiye').default(0),
  source: z.enum(['upload', 'url']).default('upload'),
});

/**
 * Image ka wo link jo EMAIL ME KAAM KARTA HAI.
 *
 * Yeh is poore file ka sabse zaroori hissa hai.
 *
 * Upload ki hui image database me "data:" wale roop me padi hoti hai — yaani
 * poori tasveer ek lambe text ki tarah. Browser use dikha deta hai, isliye app
 * ke andar sab theek lagta hai. PAR Gmail, Outlook aur baaki mail app aisi
 * image ko EMAIL ME BLOCK KAR DETE HAIN — recipient ko tooti hui image dikhti
 * hai aur bhejne wale ko kabhi pata hi nahi chalta.
 *
 * Isliye bahar hamesha ek asli http link bhejte hain, jo server se seedha
 * image deta hai. Wahi link user copy karta hai, wahi template me lagta hai,
 * aur wahi email me kaam karta hai.
 *
 * Jo image kisi doosri website par pehle se padi hai (source: 'url'), uska
 * apna pata hi sabse achha hai — use waise hi rehne dete hain.
 */
function publicUrl(row) {
  if (!String(row.url).startsWith('data:')) return row.url;
  return `${env.publicUrl}/files/img/${row.id}`;
}

function toApi(row) {
  return {
    id: row.id,
    name: row.name,
    url: publicUrl(row),
    size: Number(row.size_bytes),
    source: row.source,
    uploadedBy: row.uploaded_by_name ?? null,
    addedAt: row.created_at,
  };
}

const SELECT = `
  SELECT i.*, u.name AS uploaded_by_name
    FROM images i
    LEFT JOIN users u ON u.id = i.uploaded_by
`;

router.get(
  '/',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const rows = await many(`${SELECT} ORDER BY i.created_at DESC`);
    res.json({ images: rows.map(toApi) });
  })
);

router.post(
  '/',
  requireModule('templates', 'create'),
  validate(imageInput),
  asyncHandler(async (req, res) => {
    const { name, url, size, source } = req.body;

    // Sirf yehi do tarah ke link chalenge. javascript: jaisa kuch template me
    // ghus gaya to wo email kholne wale ke browser me chal sakta hai.
    if (!/^data:image\//i.test(url) && !/^https:\/\//i.test(url)) {
      throw badRequest('Sirf uploaded image ya https:// wala link chalega');
    }

    // data: URL me asli size text ki lambai se pata chalta hai — bhejne wale
    // ke bataye size par bharosa nahi karte.
    const realSize = url.startsWith('data:') ? Math.round((url.length * 3) / 4) : size;
    if (realSize > MAX_BYTES) throw badRequest('Image 2 MB se choti honi chahiye');

    const id = newId('img');

    await query(
      'INSERT INTO images (id, name, url, size_bytes, source, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name, url, realSize, source, req.user.id]
    );

    await logActivity(req, {
      action: 'created',
      module: 'templates',
      item: name,
      detail: 'Image library me jodi gayi',
    });

    const row = await one(`${SELECT} WHERE i.id = $1`, [id]);
    res.status(201).json({ image: toApi(row) });
  })
);

/**
 * Yeh image kahan-kahan lagi hui hai.
 *
 * Delete karne se PEHLE poochha jata hai. Wajah bahut zaroori hai:
 *
 * Jo campaign JA CHUKI hai, uska email logon ke inbox me pada hai — aur usme
 * image ka link hai. Image yahan se mitte hi un puraane emails me bhi tooti
 * hui image dikhne lagegi, hamesha ke liye. Wo email wapas nahi bulaye ja
 * sakte.
 *
 * Isliye user ko pehle saaf batate hain ki kitni jagah lagi hai, phir usse
 * poochte hain.
 */
router.get(
  '/:id/usage',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    const row = await one('SELECT id, url FROM images WHERE id = $1', [req.params.id]);
    if (!row) throw notFound('Yeh image nahi mili');

    // Jo link user ne copy kiya tha wahi HTML me pada hoga.
    const link = publicUrl(row);
    const needle = `%${link}%`;

    const templates = await many('SELECT name FROM templates WHERE html LIKE $1 LIMIT 20', [needle]);

    const campaigns = await many(
      `SELECT name, status FROM campaigns WHERE html LIKE $1 ORDER BY created_at DESC LIMIT 20`,
      [needle]
    );

    // Ja chuki campaigns sabse zaroori hain — unke email wapas nahi aa sakte.
    const alreadySent = campaigns.filter((c) => c.status === 'Sent' || c.status === 'Sending');

    res.json({
      templates: templates.map((t) => t.name),
      campaigns: campaigns.map((c) => ({ name: c.name, status: c.status })),
      sentCount: alreadySent.length,
      inUse: templates.length + campaigns.length > 0,
    });
  })
);

router.delete(
  '/:id',
  requireModule('templates', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM images WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh image nahi mili');

    await query('DELETE FROM images WHERE id = $1', [req.params.id]);

    await logActivity(req, {
      action: 'deleted',
      module: 'templates',
      item: existing.name,
      detail: 'Image library se hatai gayi',
    });

    res.json({ ok: true });
  })
);

export default router;

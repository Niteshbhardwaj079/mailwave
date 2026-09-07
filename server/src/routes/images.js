// ---------------------------------------------------------------------------
// Image library — template me lagane wali tasveerein.
//
// Har upload server par pehle optimize hoti hai (sharp: resize + re-compress),
// phir do me se ek jagah jaati hai:
//   - Object Storage connected hai  -> client ke apne bucket me (private hi
//     rehta hai — dekho services/objectStorage.js ka header)
//   - nahi hai                      -> pehle jaisa hi, database row me
//     "data:" URL ke roop me
// Dono suraton me bahar ek hi tarah ka link jaata hai: GET /files/img/:id —
// isliye template/campaign ka HTML kabhi yeh jaanne ki zarurat nahi padti ki
// image kahan padi hai.
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
import { isConfigured as objectStorageConfigured, uploadObject } from '../services/objectStorage.js';

const router = Router();

/**
 * Ek image ki hadd: 2 MB (upload karte waqt, optimize se PEHLE).
 *
 * Isse badi image email me bhejna waise bhi galat hai — kai log mobile data
 * par hote hain, aur Gmail 102 KB se badi email ko "clip" kar deta hai.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const MIME_TO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

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
 * Object Storage me padi image (storage_provider='object') ka bhi yehi haal
 * hai — bucket private hai, isliye seedha koi bhi nahi khol sakta.
 *
 * Isliye bahar hamesha ek asli http link bhejte hain, jo server se seedha
 * image deta hai. Wahi link user copy karta hai, wahi template me lagta hai,
 * aur wahi email me kaam karta hai.
 *
 * Jo image kisi doosri website par pehle se padi hai (source: 'url'), uska
 * apna pata hi sabse achha hai — use waise hi rehne dete hain.
 */
function publicUrl(row) {
  if (row.storage_provider === 'object') return `${env.publicUrl}/files/img/${row.id}`;
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
    width: row.width ?? null,
    height: row.height ?? null,
    storageProvider: row.storage_provider,
    uploadedBy: row.uploaded_by_name ?? null,
    addedAt: row.created_at,
    lastUsedAt: row.last_used_at,
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
    const sort = String(req.query.sort || 'recent');
    const search = String(req.query.search || '').trim();

    const conditions = ["i.source != 'upload' OR i.name != 'Storage test image'"];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`i.name ILIKE $${params.length}`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const orderBy =
      sort === 'name'
        ? 'i.name ASC'
        : sort === 'size'
          ? 'i.size_bytes DESC'
          : sort === 'used'
            ? 'i.last_used_at DESC NULLS LAST, i.created_at DESC'
            : 'i.created_at DESC';

    const rows = await many(`${SELECT} ${where} ORDER BY ${orderBy}`, params);
    res.json({ images: rows.map(toApi) });
  })
);

/** Optimize kar ke aur (agar object storage connected hai) usme daal kar row insert karta hai. */
async function persistUploadedImage({ name, dataUrl, userId }) {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) throw badRequest('Yeh image ka format samajh nahi aaya');

  const [, mime, base64] = match;
  const original = Buffer.from(base64, 'base64');

  const sharp = (await import('sharp')).default;
  let pipeline = sharp(original, { animated: mime === 'image/gif' }).resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  // GIF/PNG-with-transparency ko unhi ke format me rakhte hain (JPEG re-encode
  // transparency mita deta); baaki sab ko JPEG me compress karte hain — sabse
  // chhota, har jagah chalne wala format.
  const keepFormat = mime === 'image/gif' || mime === 'image/png' || mime === 'image/webp';
  if (mime === 'image/png') pipeline = pipeline.png({ quality: 82, compressionLevel: 9 });
  else if (mime === 'image/webp') pipeline = pipeline.webp({ quality: 82 });
  else if (mime === 'image/gif') pipeline = pipeline.gif();
  else pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });

  const buffer = await pipeline.toBuffer();
  const meta = await sharp(buffer).metadata();
  const finalMime = keepFormat ? mime : 'image/jpeg';
  const ext = MIME_TO_EXT[finalMime] || 'jpg';

  if (buffer.length > MAX_BYTES) throw badRequest('Optimize karne ke baad bhi image 2 MB se badi hai');

  const id = newId('img');
  const useObjectStorage = await objectStorageConfigured();

  if (useObjectStorage) {
    const objectKey = `images/${id}.${ext}`;
    await uploadObject(objectKey, buffer, finalMime);
    await query(
      `INSERT INTO images (id, name, url, size_bytes, source, storage_provider, object_key, width, height, uploaded_by)
       VALUES ($1,$2,'',$3,'upload','object',$4,$5,$6,$7)`,
      [id, name, buffer.length, objectKey, meta.width ?? null, meta.height ?? null, userId]
    );
  } else {
    const storedUrl = `data:${finalMime};base64,${buffer.toString('base64')}`;
    await query(
      `INSERT INTO images (id, name, url, size_bytes, source, storage_provider, width, height, uploaded_by)
       VALUES ($1,$2,$3,$4,'upload','db',$5,$6,$7)`,
      [id, name, storedUrl, buffer.length, meta.width ?? null, meta.height ?? null, userId]
    );
  }

  return id;
}

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

    let id;
    if (source === 'upload' && url.startsWith('data:')) {
      id = await persistUploadedImage({ name, dataUrl: url, userId: req.user.id });
    } else {
      id = newId('img');
      await query(
        'INSERT INTO images (id, name, url, size_bytes, source, storage_provider, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, name, url, realSize, source, 'db', req.user.id]
      );
    }

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

/** Template editor se ek image "insert" hote hi bulaya jaata hai — "recently used" isi se ban-ta hai. */
router.post(
  '/:id/touch',
  requireModule('templates', 'view'),
  asyncHandler(async (req, res) => {
    await query('UPDATE images SET last_used_at = now() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
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
    const row = await one('SELECT id, url, storage_provider FROM images WHERE id = $1', [req.params.id]);
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

/** Crop/edit: usi id/URL par naye (optimize kiye hue) bytes chadha deta hai — koi reference toothi nahi. */
router.put(
  '/:id',
  requireModule('templates', 'edit'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name FROM images WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh image nahi mili');

    const { name, url } = req.body || {};
    if (url) {
      if (!/^data:image\//i.test(url)) throw badRequest('Sirf edited image ka data bheja ja sakta hai');

      const oldRow = await one('SELECT object_key FROM images WHERE id = $1', [req.params.id]);
      const { deleteObject } = await import('../services/objectStorage.js');

      // Purani row hata kar wahi id se nayi banate hain — persistUploadedImage
      // hamesha ek NAYI id banata hai, isliye seedha uska logic reuse nahi kar
      // sakte; edit ka poora point yeh hai ki id/URL badle hi na.
      const newId2 = await persistUploadedImage({ name: name || existing.name, dataUrl: url, userId: req.user.id });
      const fresh = await one('SELECT * FROM images WHERE id = $1', [newId2]);

      await query(
        `UPDATE images SET name = $1, url = $2, size_bytes = $3, storage_provider = $4, object_key = $5,
                            width = $6, height = $7
          WHERE id = $8`,
        [
          fresh.name,
          fresh.url,
          fresh.size_bytes,
          fresh.storage_provider,
          fresh.object_key,
          fresh.width,
          fresh.height,
          req.params.id,
        ]
      );
      await query('DELETE FROM images WHERE id = $1', [newId2]);
      if (oldRow?.object_key) await deleteObject(oldRow.object_key).catch(() => {});
    } else if (name) {
      await query('UPDATE images SET name = $1 WHERE id = $2', [name, req.params.id]);
    }

    await logActivity(req, {
      action: 'updated',
      module: 'templates',
      item: name || existing.name,
      detail: 'Image edit hui (usi link par)',
    });

    const row = await one(`${SELECT} WHERE i.id = $1`, [req.params.id]);
    res.json({ image: toApi(row) });
  })
);

router.delete(
  '/:id',
  requireModule('templates', 'delete'),
  asyncHandler(async (req, res) => {
    const existing = await one('SELECT id, name, object_key FROM images WHERE id = $1', [req.params.id]);
    if (!existing) throw notFound('Yeh image nahi mili');

    await query('DELETE FROM images WHERE id = $1', [req.params.id]);

    if (existing.object_key) {
      const { deleteObject } = await import('../services/objectStorage.js');
      await deleteObject(existing.object_key).catch(() => {});
    }

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

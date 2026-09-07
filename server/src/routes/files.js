// ---------------------------------------------------------------------------
// Upload ki hui images ko internet par dikhata hai.
//
// Yeh raasta JAAN-BOOJH KAR bina login ke khula hai — aur yahi iska poora
// matlab hai.
//
// Kyun khula hai
// --------------
// Email me lagi image ko Gmail/Outlook ka server kholta hai, aapka browser
// nahi. Wo kabhi login nahi kar sakta. Agar yahan login maanga jata, to har
// recipient ko tooti hui image dikhti.
//
// Ismein khatra kya hai
// ---------------------
// Bahut kam. Yahan sirf wahi image milti hai jiska id kisi ko pata ho, aur id
// andaza lagane layak nahi hoti. Aur ye wahi image hai jo aap khud email me
// duniya ko bhej rahe ho — chhupane wali cheez hai hi nahi.
//
// Yahan se sirf IMAGE jati hai — koi contact, koi setting, kuch aur nahi.
// ---------------------------------------------------------------------------
import { extname } from 'node:path';

import { Router } from 'express';

import { one } from '../db/client.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { getObjectBuffer } from '../services/objectStorage.js';

const router = Router();

/** Sirf yahi tarah ki image bhejte hain. */
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const EXT_TO_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

router.get(
  '/img/:id',
  asyncHandler(async (req, res) => {
    const row = await one('SELECT url, storage_provider, object_key FROM images WHERE id = $1', [req.params.id]);
    if (!row) throw notFound('Yeh image nahi mili');

    // Client ka apna (private) bucket — yahan hi credentials se padhte hain,
    // browser/mail-client ko kabhi bucket ka pata seedha nahi diya jaata.
    if (row.storage_provider === 'object') {
      if (!row.object_key) throw notFound('Yeh image padhi nahi ja saki');

      const type = EXT_TO_MIME[extname(row.object_key).slice(1).toLowerCase()] || 'application/octet-stream';
      const bytes = await getObjectBuffer(row.object_key);

      res.setHeader('Content-Type', type);
      res.setHeader('Content-Length', bytes.length);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(bytes);
      return;
    }

    // Jo image kisi doosri website par padi hai (source: url), uske liye yahan
    // kuch karne ki zarurat hi nahi — wo apne asli pate se hi khulti hai.
    if (!String(row.url).startsWith('data:')) {
      res.redirect(302, row.url);
      return;
    }

    const match = String(row.url).match(/^data:([^;,]+);base64,(.*)$/s);
    if (!match) throw notFound('Yeh image padhi nahi ja saki');

    const [, type, base64] = match;
    if (!ALLOWED.has(type)) throw notFound('Yeh image nahi hai');

    const bytes = Buffer.from(base64, 'base64');

    // Image kabhi badalti nahi (badalne par nayi id banti hai), isliye mail
    // app ise ek saal tak yaad rakh sakta hai. Isse har baar kholne par
    // dobara download nahi hoti.
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Browser ko bharosa mat karne do ki file ka type kuch aur hai — SVG me
    // script chhupa kar bhejne wale isi ka fayda uthate hain.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(bytes);
  })
);

export default router;

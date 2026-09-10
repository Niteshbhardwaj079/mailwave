// ---------------------------------------------------------------------------
// Settings → Storage → Image Storage — client apna khud ka S3-compatible
// Object Storage connect kar sake, bina developer ki madad ke.
//
// Kaam ka tareeka: PUT se pehle details save hoti hain (connected=false rehta
// hai), phir POST /test asli round-trip (write+read+delete) karke connected
// flag set karta hai. POST /test-upload ek asli image bhej kar poora
// "Upload → Storage → App URL → Image Load" chain confirm karta hai.
// ---------------------------------------------------------------------------
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, badRequest } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { requireModule } from '../middleware/permissions.js';
import { STORAGE_PROVIDER_IDS } from '../lib/storageProviders.js';
import {
  disconnectSettings,
  getSettings,
  markTested,
  saveSettings,
  testConnection,
} from '../services/objectStorage.js';

const router = Router();

const settingsInput = z.object({
  provider: z.enum(STORAGE_PROVIDER_IDS),
  bucket: z.string().trim().min(1, 'Give the bucket a name').max(200),
  region: z.string().trim().max(100).default('auto'),
  endpoint: z.string().trim().max(300).default(''),
  accessKeyId: z.string().trim().min(1, 'Enter the Access Key ID').max(300),
  // Blank = purani secret key rakh lo (write-only field, dobara nahi dikhti).
  secretAccessKey: z.string().trim().max(500).default(''),
  publicUrlBase: z.string().trim().max(300).default(''),
});

router.get(
  '/',
  requireModule('settings', 'view'),
  asyncHandler(async (req, res) => {
    res.json({ storage: await getSettings() });
  })
);

router.put(
  '/',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const parsed = settingsInput.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(
        'Some fields are not valid',
        parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      );
    }

    const storage = await saveSettings(parsed.data, req.user.id);

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'Image Storage',
      detail: `${parsed.data.provider} storage details save hui — ab "Test Connection" karo`,
    });

    res.json({ storage });
  })
);

router.post(
  '/test',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const existing = await getSettings();
    if (!existing.provider) throw badRequest('Save the storage details first');

    const result = await testConnection();
    await markTested(result.ok, result.message);

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'Image Storage',
      detail: result.ok ? 'Connection test safal raha' : `Connection test fail hua: ${result.message}`,
    });

    res.json({ ok: result.ok, message: result.message, storage: await getSettings() });
  })
);

router.post(
  '/test-upload',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    const { newId } = await import('../lib/ids.js');
    const { query, one } = await import('../db/client.js');
    const { uploadObject } = await import('../services/objectStorage.js');
    const { env } = await import('../env.js');

    const existing = await getSettings();
    if (!existing.connected) throw badRequest('Run a successful "Test Connection" first');

    // 1x1 PNG — bundled sample, taaki client ko khud koi file dena zaroori na ho.
    const SAMPLE_PNG_BASE64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const buffer = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
    const id = newId('img');
    const objectKey = `images/${id}.png`;

    await uploadObject(objectKey, buffer, 'image/png');

    await query(
      `INSERT INTO images (id, name, url, size_bytes, source, storage_provider, object_key, width, height, uploaded_by)
       VALUES ($1,$2,'',$3,'upload','object',$4,1,1,$5)`,
      [id, 'Storage test image', buffer.length, objectKey, req.user.id]
    );

    const row = await one('SELECT id FROM images WHERE id = $1', [id]);
    const url = `${env.publicUrl}/files/img/${row.id}`;

    await logActivity(req, {
      action: 'created',
      module: 'settings',
      item: 'Image Storage',
      detail: `Test image bucket me upload karke ${env.brand.name} URL se load karke dikhaya gaya`,
    });

    res.status(201).json({ ok: true, url, imageId: id });
  })
);

router.delete(
  '/',
  requireModule('settings', 'edit'),
  asyncHandler(async (req, res) => {
    await disconnectSettings();

    await logActivity(req, {
      action: 'updated',
      module: 'settings',
      item: 'Image Storage',
      detail: 'Object Storage disconnect kiya gaya — pehle se maujood images nahi hatai gayin',
    });

    res.json({ storage: await getSettings() });
  })
);

export default router;

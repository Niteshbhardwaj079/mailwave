// ---------------------------------------------------------------------------
// Client ka apna Object Storage (S3/R2/B2/Wasabi/Spaces/other) — images ke
// liye. backupStorage.js ke S3Storage jaisa hi wrapper hai, bas config ab
// database (storage_settings table) se aata hai, .env se nahi — ek non-
// technical client Settings screen se hi apna bucket connect kar sake.
//
// Bucket hamesha PRIVATE maana jaata hai. Yeh module kabhi public/anonymous
// access maangta ya check nahi karta — har image GET /files/img/:id se hi
// server ke through proxy hoti hai (dekho routes/files.js), jahan yehi
// credentials istemal hoti hain. Isliye client ko bucket kabhi public karne
// ki zarurat nahi.
// ---------------------------------------------------------------------------
import { one, query } from '../db/client.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { findStorageProvider } from '../lib/storageProviders.js';

let cachedClient = null;
let cachedConfigKey = null;

async function loadRow() {
  return one('SELECT * FROM storage_settings WHERE id = $1', ['default']);
}

/** DB row ko client ke liye safe shape me — secret kabhi nahi, access key masked. */
export function toPublicShape(row) {
  if (!row || !row.provider) {
    return { provider: null, connected: false, bucket: null, region: null, endpoint: null };
  }
  return {
    provider: row.provider,
    bucket: row.bucket,
    region: row.region,
    endpoint: row.endpoint,
    publicUrlBase: row.public_url_base || null,
    connected: Boolean(row.connected),
    lastTestedAt: row.last_tested_at,
    lastTestOk: row.last_test_ok,
    lastTestMessage: row.last_test_message,
    accessKeyIdMasked: row.access_key_id
      ? `••••${String(row.access_key_id).slice(-4)}`
      : null,
  };
}

export async function getSettings() {
  return toPublicShape(await loadRow());
}

export async function saveSettings(
  { provider, bucket, region, endpoint, accessKeyId, secretAccessKey, publicUrlBase },
  userId
) {
  const existing = await loadRow();
  // Secret field pe frontend blank bhejta hai jab tak user naya na type kare
  // (write-only field — kabhi pre-filled nahi hota) — isliye khali ho to
  // purani encrypted key ko waisa hi rakhte hain.
  const secretEnc = secretAccessKey ? encrypt(secretAccessKey) : existing?.secret_access_key_enc ?? null;

  await query(
    `INSERT INTO storage_settings
       (id, provider, bucket, region, endpoint, access_key_id, secret_access_key_enc, public_url_base,
        connected, updated_by, updated_at)
     VALUES ('default',$1,$2,$3,$4,$5,$6,$7, false, $8, now())
     ON CONFLICT (id) DO UPDATE
       SET provider = EXCLUDED.provider,
           bucket = EXCLUDED.bucket,
           region = EXCLUDED.region,
           endpoint = EXCLUDED.endpoint,
           access_key_id = EXCLUDED.access_key_id,
           secret_access_key_enc = EXCLUDED.secret_access_key_enc,
           public_url_base = EXCLUDED.public_url_base,
           connected = false,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [provider, bucket, region, endpoint || null, accessKeyId, secretEnc, publicUrlBase || null, userId]
  );

  cachedClient = null;
  cachedConfigKey = null;
  return getSettings();
}

export async function disconnectSettings() {
  // Sirf config clear karta hai — images (chahe DB me ho ya bucket me) kabhi
  // nahi mitati. Bucket credentials hata dene ke baad us provider ki images
  // load hona band ho jayengi, jab tak dobara connect na kiya jaye.
  await query(
    `UPDATE storage_settings
        SET connected = false, secret_access_key_enc = null, access_key_id = null,
            last_tested_at = null, last_test_ok = null, last_test_message = null, updated_at = now()
      WHERE id = 'default'`
  );
  cachedClient = null;
  cachedConfigKey = null;
}

async function resolveConfig() {
  const row = await loadRow();
  if (!row?.provider || !row.bucket || !row.access_key_id || !row.secret_access_key_enc) return null;

  const secret = decrypt(row.secret_access_key_enc);
  if (!secret) return null;

  const meta = findStorageProvider(row.provider);
  return {
    provider: row.provider,
    bucket: row.bucket,
    region: row.region || 'auto',
    endpoint: row.endpoint || undefined,
    forcePathStyle: meta?.forcePathStyle ?? true,
    accessKeyId: row.access_key_id,
    secretAccessKey: secret,
    connected: Boolean(row.connected),
  };
}

async function getClient(config) {
  const key = JSON.stringify({ e: config.endpoint, r: config.region, a: config.accessKeyId, b: config.bucket });
  if (cachedClient && cachedConfigKey === key) return cachedClient;

  const { S3Client } = await import('@aws-sdk/client-s3');
  cachedClient = new S3Client({
    endpoint: config.endpoint || undefined,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  cachedConfigKey = key;
  return cachedClient;
}

/** true agar ek saved-aur-connected bucket istemal ke liye taiyaar hai. */
export async function isConfigured() {
  const config = await resolveConfig();
  return Boolean(config?.connected);
}

/**
 * Auth + bucket-exists + write + read + delete — sab is chhote round-trip se
 * saabit hote hain. Public/anonymous access kabhi check nahi hoti (zarurat
 * hi nahi, dekho file ka header comment).
 */
export async function testConnection(overrideConfig) {
  const config = overrideConfig ?? (await resolveConfig());
  if (!config) return { ok: false, message: 'Bucket, region ya keys me se kuch bhara nahi hai.' };

  const { HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import(
    '@aws-sdk/client-s3'
  );
  const client = await getClient(config);
  const probeKey = `mailwave-test/${Date.now()}.txt`;

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch (error) {
    return { ok: false, message: `Bucket tak nahi pahuncha: ${describeAwsError(error)}` };
  }

  try {
    await client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: probeKey, Body: Buffer.from('mailwave'), ContentType: 'text/plain' })
    );
  } catch (error) {
    return { ok: false, message: `Likh (write) nahi paye: ${describeAwsError(error)}` };
  }

  try {
    const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: probeKey }));
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(chunk);
    if (Buffer.concat(chunks).toString('utf8') !== 'mailwave') {
      return { ok: false, message: 'Padhi hui file ka data match nahi hua.' };
    }
  } catch (error) {
    return { ok: false, message: `Padh (read) nahi paye: ${describeAwsError(error)}` };
  } finally {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: probeKey }));
    } catch (error) {
      // Cleanup fail hone se poora test fail nahi karte — asli check upar ho chuke.
    }
  }

  return { ok: true, message: 'Connection theek hai — likhna, padhna aur mitana teeno kaam kiye.' };
}

export async function uploadObject(key, buffer, contentType) {
  const config = await resolveConfig();
  if (!config?.connected) throw new Error('Object storage connected nahi hai.');

  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getClient(config);
  await client.send(
    new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer, ContentType: contentType })
  );
}

/** Buffer lautata hai (files.js seedha stream karta hai res ko). */
export async function getObjectBuffer(key) {
  const config = await resolveConfig();
  if (!config) throw new Error('Object storage configured nahi hai.');

  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getClient(config);
  const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
  const chunks = [];
  for await (const chunk of result.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function deleteObject(key) {
  const config = await resolveConfig();
  if (!config) return;

  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getClient(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function markTested(ok, message) {
  await query(
    `UPDATE storage_settings
        SET connected = $1, last_tested_at = now(), last_test_ok = $1, last_test_message = $2, updated_at = now()
      WHERE id = 'default'`,
    [ok, message]
  );
}

function describeAwsError(error) {
  const code = error?.name || error?.Code || '';
  if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch') return 'Access key ya secret key galat hai.';
  if (code === 'NoSuchBucket' || code === 'NotFound') return 'Yeh bucket nahi mila — naam/region check karo.';
  if (code === 'AccessDenied') return 'In keys ke paas is bucket ki zarurat ki permission nahi hai.';
  return error?.message || 'Anjaan error';
}

/** Testing ke liye — settings badalne ke baad cache clear ho, taaki purana client na use ho. */
export function resetObjectStorageCache() {
  cachedClient = null;
  cachedConfigKey = null;
}

// ---------------------------------------------------------------------------
// Backup file KAHAN rakhi jaati hai — iska apna, badla ja sakne wala hissa.
//
// Backup BANANE/CHADHANE ka logic (db/client.js, services/backup.js) ko kabhi
// yeh jaanne ki zarurat nahi ki file disk par hai ya kisi cloud bucket me —
// bas `save(name, buffer)` aur `read(name)` bulate hain. Isse:
//
//   - Render ka disk badle (jo ki asal me deploy par mit sakta hai)
//   - ya Neon se kisi doosre Postgres par jayein
//   - ya S3 ki jagah R2/B2/Spaces/MinIO lagayein
//
// in me se kisi ka bhi backup ke code par asar nahi padta — sirf env
// variable badalta hai.
// ---------------------------------------------------------------------------
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { env, serverRoot } from '../env.js';

/**
 * Har storage isi shape ka hona chahiye:
 *   save(name, buffer)   -> void
 *   read(name)           -> Buffer
 *   delete(name)         -> void
 *   exists(name)         -> boolean
 *   isDurable()          -> boolean   (deploy/restart me bhi bachega?)
 *   describe()           -> string    (UI ko dikhane layak, chhota sa jumla)
 */

class LocalDiskStorage {
  constructor(dir) {
    this.dir = dir;
  }

  async #ready() {
    await mkdir(this.dir, { recursive: true });
  }

  async save(name, buffer) {
    await this.#ready();
    await writeFile(resolve(this.dir, name), buffer);
  }

  async read(name) {
    return readFile(resolve(this.dir, name));
  }

  async delete(name) {
    await rm(resolve(this.dir, name), { force: true });
  }

  async exists(name) {
    try {
      await stat(resolve(this.dir, name));
      return true;
    } catch (error) {
      return false;
    }
  }

  /** Purane, is storage ne khud kabhi na dekhe files dhoondhne ke liye — orphan-check jaisi cheezon ke liye. */
  async list() {
    await this.#ready();
    const files = await readdir(this.dir);
    return files.filter((f) => f.endsWith('.tar.gz'));
  }

  isDurable() {
    return false;
  }

  describe() {
    return `Server ki apni disk (${this.dir}) — hosting restart/redeploy karte hi yeh mit sakta hai. Sirf abhi ke liye theek hai, permanent bharosa iske upar mat karo.`;
  }
}

class S3Storage {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async #getClient() {
    if (this.client) return this.client;
    const { S3Client } = await import('@aws-sdk/client-s3');
    this.client = new S3Client({
      endpoint: this.config.endpoint || undefined,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
    return this.client;
  }

  #key(name) {
    return `${this.config.prefix}${name}`;
  }

  async save(name, buffer) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.#key(name),
        Body: buffer,
        ContentType: 'application/gzip',
      })
    );
  }

  async read(name) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#getClient();
    const result = await client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: this.#key(name) })
    );
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async delete(name) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: this.#key(name) })
    );
  }

  async exists(name) {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.#getClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: this.#key(name) }));
      return true;
    } catch (error) {
      return false;
    }
  }

  isDurable() {
    return true;
  }

  describe() {
    const host = this.config.endpoint || `s3.${this.config.region}.amazonaws.com`;
    return `S3-compatible storage (${host} / bucket "${this.config.bucket}") — deploy ya restart se nahi mitta.`;
  }
}

let cached = null;

/** Env ke hisaab se sahi storage chunta hai — ek hi baar banta hai, phir dobara istemal hota hai. */
export function getBackupStorage() {
  if (cached) return cached;

  if (env.backupStorage.driver === 's3') {
    const { bucket, accessKeyId, secretAccessKey } = env.backupStorage.s3;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      console.warn(
        '[backup] BACKUP_STORAGE=s3 hai par bucket/access key/secret key me se kuch khali hai — ' +
          'local disk par wapas ja rahe hain (yeh permanent nahi hai).'
      );
    } else {
      cached = new S3Storage(env.backupStorage.s3);
      return cached;
    }
  }

  cached = new LocalDiskStorage(process.env.BACKUP_DIR || resolve(serverRoot, 'data/backups'));
  return cached;
}

/** Testing/diagnostics ke liye — cache khali kar deta hai taki agli baar env dobara padha jaye. */
export function resetBackupStorageCache() {
  cached = null;
}

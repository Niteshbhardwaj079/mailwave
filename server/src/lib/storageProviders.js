// ---------------------------------------------------------------------------
// Object Storage providers — S3-compatible hone ki wajah se sab ek hi client
// (@aws-sdk/client-s3) se kaam chalate hain, sirf endpoint/region/path-style
// alag hote hain provider ke hisaab se.
//
// src/data/storageProviders.js frontend ka isi ka mirror hai (setup wizard ke
// dynamic form ke liye) — LANGUAGE_CODES/LANGUAGES jaisa hi duplication.
// ---------------------------------------------------------------------------

export const STORAGE_PROVIDERS = [
  {
    id: 's3',
    label: 'Amazon S3',
    needsEndpoint: false,
    forcePathStyle: false,
    regionHelp: 'e.g. us-east-1 — found on the bucket\'s "Properties" tab in the AWS console.',
    endpointHelp: null,
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'For R2, always use "auto" as the region.',
    endpointHelp: 'Cloudflare dashboard → R2 → that bucket\'s "S3 API" endpoint (https://<account-id>.r2.cloudflarestorage.com).',
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'The region B2 showed when the bucket was created (e.g. us-west-004).',
    endpointHelp: 'Copy from the bucket\'s "Endpoint" field (e.g. https://s3.us-west-004.backblazeb2.com).',
  },
  {
    id: 'wasabi',
    label: 'Wasabi',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'The region chosen when the bucket was created (e.g. us-east-1).',
    endpointHelp: 'Matches the bucket\'s region in the Wasabi console (e.g. https://s3.us-east-1.wasabisys.com).',
  },
  {
    id: 'spaces',
    label: 'DigitalOcean Spaces',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'The region chosen when the Space was created (e.g. blr1).',
    endpointHelp: 'The Space\'s endpoint in DigitalOcean (e.g. https://blr1.digitaloceanspaces.com).',
  },
  {
    id: 'other',
    label: 'Other / S3-Compatible Storage',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'Whatever region your storage provider gave you — try "auto" if unsure.',
    endpointHelp: 'Your provider\'s S3-compatible API endpoint.',
  },
];

export function findStorageProvider(id) {
  return STORAGE_PROVIDERS.find((p) => p.id === id) || null;
}

export const STORAGE_PROVIDER_IDS = STORAGE_PROVIDERS.map((p) => p.id);

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
    regionHelp: 'Jaise us-east-1 — AWS console me bucket ke "Properties" tab par milega.',
    endpointHelp: null,
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'R2 me region hamesha "auto" likho.',
    endpointHelp: 'Cloudflare dashboard → R2 → us bucket ka "S3 API" endpoint (https://<account-id>.r2.cloudflarestorage.com).',
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'Bucket banate waqt B2 ne jo region dikhaya tha (jaise us-west-004).',
    endpointHelp: 'B2 bucket ke "Endpoint" field se copy karo (jaise https://s3.us-west-004.backblazeb2.com).',
  },
  {
    id: 'wasabi',
    label: 'Wasabi',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'Bucket banate waqt chuna gaya region (jaise us-east-1).',
    endpointHelp: 'Wasabi console me bucket ke region ke hisaab se (jaise https://s3.us-east-1.wasabisys.com).',
  },
  {
    id: 'spaces',
    label: 'DigitalOcean Spaces',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'Space banate waqt chuna gaya region (jaise blr1).',
    endpointHelp: 'DigitalOcean me Space ka endpoint (jaise https://blr1.digitaloceanspaces.com).',
  },
  {
    id: 'other',
    label: 'Other / S3-Compatible Storage',
    needsEndpoint: true,
    forcePathStyle: true,
    regionHelp: 'Aapke storage provider ne jo region diya ho — na pata ho to "auto" try karo.',
    endpointHelp: 'Aapke provider ka S3-compatible API endpoint.',
  },
];

export function findStorageProvider(id) {
  return STORAGE_PROVIDERS.find((p) => p.id === id) || null;
}

export const STORAGE_PROVIDER_IDS = STORAGE_PROVIDERS.map((p) => p.id);

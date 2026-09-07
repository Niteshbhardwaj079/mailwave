// Mirror of server/src/lib/storageProviders.js — kept in sync by hand, same
// duplication convention already used for LANGUAGE_CODES/LANGUAGES.
export const STORAGE_PROVIDERS = [
  {
    id: 's3',
    label: 'Amazon S3',
    needsEndpoint: false,
    regionHelp: 'Jaise us-east-1 — AWS console me bucket ke "Properties" tab par milega.',
    endpointHelp: null,
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    needsEndpoint: true,
    regionHelp: 'R2 me region hamesha "auto" likho.',
    endpointHelp: 'Cloudflare dashboard → R2 → us bucket ka "S3 API" endpoint (https://<account-id>.r2.cloudflarestorage.com).',
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    needsEndpoint: true,
    regionHelp: 'Bucket banate waqt B2 ne jo region dikhaya tha (jaise us-west-004).',
    endpointHelp: 'B2 bucket ke "Endpoint" field se copy karo (jaise https://s3.us-west-004.backblazeb2.com).',
  },
  {
    id: 'wasabi',
    label: 'Wasabi',
    needsEndpoint: true,
    regionHelp: 'Bucket banate waqt chuna gaya region (jaise us-east-1).',
    endpointHelp: 'Wasabi console me bucket ke region ke hisaab se (jaise https://s3.us-east-1.wasabisys.com).',
  },
  {
    id: 'spaces',
    label: 'DigitalOcean Spaces',
    needsEndpoint: true,
    regionHelp: 'Space banate waqt chuna gaya region (jaise blr1).',
    endpointHelp: 'DigitalOcean me Space ka endpoint (jaise https://blr1.digitaloceanspaces.com).',
  },
  {
    id: 'other',
    label: 'Other / S3-Compatible Storage',
    needsEndpoint: true,
    regionHelp: 'Aapke storage provider ne jo region diya ho — na pata ho to "auto" try karo.',
    endpointHelp: 'Aapke provider ka S3-compatible API endpoint.',
  },
];

export function findStorageProvider(id) {
  return STORAGE_PROVIDERS.find((p) => p.id === id) || null;
}

// Mirror of server/src/lib/storageProviders.js — kept in sync by hand, same
// duplication convention already used for LANGUAGE_CODES/LANGUAGES.
//
// regionHelp/endpointHelp are i18n KEYS (not literal text) so the Settings
// page can render them with t() and follow whichever language is selected —
// look them up in src/i18n/locales/*.js under the same key.
export const STORAGE_PROVIDERS = [
  {
    id: 's3',
    label: 'Amazon S3',
    needsEndpoint: false,
    regionHelp: 'storage.regionHelp.s3',
    endpointHelp: null,
  },
  {
    id: 'r2',
    label: 'Cloudflare R2',
    needsEndpoint: true,
    regionHelp: 'storage.regionHelp.r2',
    endpointHelp: 'storage.endpointHelp.r2',
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    needsEndpoint: true,
    regionHelp: 'storage.regionHelp.b2',
    endpointHelp: 'storage.endpointHelp.b2',
  },
  {
    id: 'wasabi',
    label: 'Wasabi',
    needsEndpoint: true,
    regionHelp: 'storage.regionHelp.wasabi',
    endpointHelp: 'storage.endpointHelp.wasabi',
  },
  {
    id: 'spaces',
    label: 'DigitalOcean Spaces',
    needsEndpoint: true,
    regionHelp: 'storage.regionHelp.spaces',
    endpointHelp: 'storage.endpointHelp.spaces',
  },
  {
    id: 'other',
    label: 'Other / S3-Compatible Storage',
    needsEndpoint: true,
    regionHelp: 'storage.regionHelp.other',
    endpointHelp: 'storage.endpointHelp.other',
  },
];

export function findStorageProvider(id) {
  return STORAGE_PROVIDERS.find((p) => p.id === id) || null;
}

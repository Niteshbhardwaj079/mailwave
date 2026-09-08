import { ApiError, apiBase, getAccessToken } from '../api/client';

/** Campaign name se ek safe filename-stem — sirf letters/digits/space/hyphen/underscore bachte hain. */
function safeFileStem(name) {
  const cleaned = String(name || 'Campaign')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || 'Campaign';
}

/**
 * Ek campaign ka Excel report mangwa kar seedhe browser se download karwata
 * hai — bilkul wahi tarika jo Backups page ka download istemal karta hai
 * (token in-memory hai, isliye seedha `<a href>` se nahi ho sakta).
 *
 * Report server par HAR BAAR taaza banta hai — kahin save nahi hota, isliye
 * yahan bhi kuch cache/store nahi karte.
 */
export async function downloadCampaignReport(campaignId, campaignName) {
  const res = await fetch(`${apiBase}/api/campaigns/${campaignId}/report`, {
    credentials: 'include',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  if (!res.ok) {
    throw new ApiError(res.status, 'download_failed', `Report download nahi ho saka (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${safeFileStem(campaignName)}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

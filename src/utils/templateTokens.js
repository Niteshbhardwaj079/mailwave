/**
 * Template me {{subscribe_url}} pehle se hai kya.
 *
 * Server ke mergeVariables jaisa hi: braces ke andar spaces chalte hain
 * (`{{ subscribe_url }}`). Hai to us template me Subscribe ka link/button
 * pehle se hai — wizard ko alag se "Subscribe button jodo" ka option nahi
 * dikhana chahiye (warna email me do-do Subscribe button jate).
 */
export function templateHasSubscribeUrl(html) {
  return /\{\{\s*subscribe_url\s*\}\}/.test(String(html || ''));
}

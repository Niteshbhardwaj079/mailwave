import { useEffect } from 'react';

import { appConfig } from '../config/appConfig';

// Andar text select/right-click karne dete hain — warna form bharna, HTML
// editor me kaam karna, ya kisi bhi field se copy karna toot jata.
const ALLOWED_SELECTOR =
  'input, textarea, select, [contenteditable="true"], .mw-codearea, .mw-codeblock, code, pre, .mw-allow-select';

function isAllowed(target) {
  return Boolean(target?.closest?.(ALLOWED_SELECTOR));
}

function blockContextMenu(event) {
  if (isAllowed(event.target)) return;
  event.preventDefault();
}

function blockShortcuts(event) {
  const ctrlOrCmd = event.ctrlKey || event.metaKey;
  if (!ctrlOrCmd) return;

  const key = event.key.toLowerCase();
  // Ctrl+U (view source) aur Ctrl+S (save page) — dono se poora HTML/page
  // bahar nikal jata hai. Koi bhi field/editor inhe istemal nahi karta,
  // isliye hamesha rokte hain, chahe focus kahin bhi ho.
  if (key === 'u' || key === 's') {
    event.preventDefault();
  }
}

/**
 * `brand.config.js`'s `securityProtection` flag — dekho wahan poora comment.
 *
 * Jab chalu ho: right-click, Ctrl+U, Ctrl+S, aur plain page text select/copy
 * band ho jaata hai — sirf inputs/textarea/contentEditable/code ke andar
 * nahi. Band ho to yeh hook kuch nahi karta.
 */
export function useSecurityProtection() {
  useEffect(() => {
    const root = document.documentElement;

    if (!appConfig.securityProtection) {
      root.removeAttribute('data-security-protection');
      return undefined;
    }

    root.setAttribute('data-security-protection', 'on');
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockShortcuts);

    return () => {
      root.removeAttribute('data-security-protection');
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockShortcuts);
    };
  }, []);
}

export default useSecurityProtection;

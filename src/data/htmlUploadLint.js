// ---------------------------------------------------------------------------
// Uploaded .html file ke liye — purely informational, NON-BLOCKING warnings.
// Kabhi Save ko rokte nahi, aur HTML ko kabhi khud nahi badalte (jaisa upload
// kiya waisa hi byte-for-byte save hota hai) — client ki apni, kahin aur
// test ki hui HTML ko todne ka koi khatra nahi.
//
// Har warning ek asli, jaana-pehchana risk batati hai:
//   - {{unsubscribe_url}} na hone se — safety-net footer (server/src/services/
//     render.js) hamesha ek unsubscribe link jod hi deta hai, isliye yeh
//     sirf cosmetic heads-up hai, functional risk nahi.
//   - koi <table> na hone se — Outlook sirf table-layout par bharosa karta
//     hai, isliye yeh asli rendering risk hai.
//   - <img src="data:..."> milne se — spam-filter aur file-size dono risk.
//   - bahut badi file se — bhejne me slow, spam-filter risk badhta hai.
// ---------------------------------------------------------------------------

const LARGE_FILE_BYTES = 300 * 1024;

/** `html` ka byte-length (UTF-8) — frontend me file.size use nahi karte kyunki text edit hone ke baad wo stale ho sakta hai. */
function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

/**
 * `html` string liye, warning messages ka array deta hai (khaali array =
 * koi warning nahi). Kabhi kuch throw nahi karta — khaali/malformed input
 * par bhi safe khaali array deta hai.
 */
export function lintUploadedHtml(html) {
  const text = String(html || '');
  const warnings = [];

  if (!text.includes('{{unsubscribe_url}}')) {
    warnings.push('tpl.upload.warnNoUnsubscribe');
  }
  if (!/<table[\s>]/i.test(text)) {
    warnings.push('tpl.upload.warnNoTable');
  }
  if (/<img[^>]+src\s*=\s*["']data:/i.test(text)) {
    warnings.push('tpl.upload.warnDataUri');
  }
  if (byteLength(text) > LARGE_FILE_BYTES) {
    warnings.push('tpl.upload.warnLargeFile');
  }

  return warnings;
}

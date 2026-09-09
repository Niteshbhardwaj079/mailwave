// ---------------------------------------------------------------------------
// Template HTML ke liye — purely informational, NON-BLOCKING warnings. Custom
// Editor (Email HTML tab) aur HTML Upload, dono jagah Save se pehle dikhaye
// jaate hain (ek confirm popup me). Kabhi Save ko khud rokte nahi, aur HTML
// ko kabhi khud nahi badalte — client jo likhe/upload kare waisa hi byte-for-
// byte save hota hai. Client agar "Save anyway" chuno to koi rok-tok nahi.
//
// Har warning ek asli, jaana-pehchana risk batati hai:
//   - {{unsubscribe_url}} na hone se — safety-net footer (server/src/services/
//     render.js) hamesha ek unsubscribe link jod hi deta hai, isliye yeh
//     sirf cosmetic heads-up hai, functional risk nahi.
//   - koi <table> na hone se — Outlook sirf table-layout par bharosa karta
//     hai, isliye yeh asli rendering risk hai.
//   - <img src="data:..."> milne se — spam-filter aur file-size dono risk.
//   - bahut badi file se — bhejne me slow, spam-filter risk badhta hai.
//   - unclosed/mismatched tags se — email client ke hisaab se layout kahin
//     bhi toot sakta hai (koi bhi do inbox render nahi karte).
// ---------------------------------------------------------------------------

const LARGE_FILE_BYTES = 300 * 1024;

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** `html` ka byte-length (UTF-8) — frontend me file.size use nahi karte kyunki text edit hone ke baad wo stale ho sakta hai. */
function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

/** Comments (MSO conditionals samet) aur style/script block ka content hata dete hain — inke andar `<`/`>` real tag nahi hote (CSS selectors, JS comparisons). */
function stripNonTagContent(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
}

/**
 * Ek simple stack-based scan — poora HTML parser nahi, sirf tag-balance
 * dekhta hai. Void elements (br/img/...) ko kabhi stack par nahi dalte.
 * Lautata hai: { unclosed: koi tag band nahi hua, mismatched: koi closing
 * tag apne sahi opening tag se match nahi hui }.
 */
function findTagIssues(html) {
  const text = stripNonTagContent(html);
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
  const stack = [];
  let mismatched = false;
  let match;
  while ((match = tagRe.exec(text))) {
    const [full, rawName, selfClose] = match;
    const name = rawName.toLowerCase();
    if (full.startsWith('</')) {
      const idx = stack.lastIndexOf(name);
      if (idx === -1 || idx !== stack.length - 1) mismatched = true;
      if (idx !== -1) stack.length = idx;
    } else if (!selfClose && !VOID_ELEMENTS.has(name)) {
      stack.push(name);
    }
  }
  return { unclosed: stack.length > 0, mismatched };
}

/**
 * `html` string leke, warning messages ka array deta hai (khaali array =
 * koi warning nahi). Kabhi kuch throw nahi karta — khaali/malformed input
 * par bhi safe khaali array deta hai.
 */
export function lintTemplateHtml(html) {
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

  const { unclosed, mismatched } = findTagIssues(text);
  if (unclosed) warnings.push('tpl.warnUnclosedTag');
  if (mismatched) warnings.push('tpl.warnMismatchedTag');

  return warnings;
}

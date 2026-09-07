import { useEffect, useRef } from 'react';

import { useT } from '../../i18n/I18nProvider';
import DynamicFieldPicker from './DynamicFieldPicker';

// ---------------------------------------------------------------------------
// Chhota, apna rich-text editor — Design tab ke "Text" fields ke liye.
// document.execCommand() purana API hai lekin yahan bilkul theek chalta hai:
// hum sirf 8-10 basic commands (bold/italic/underline/align/link/lists) hi
// use karte hain, aur har change ke baad output ko apne khud ke
// sanitizeRichHtml() se guzarte hain — koi bhi class/script/inline-style
// (sirf text-align chhodkar) yahin kat jaata hai, isliye final HTML hamesha
// email-safe (inline styles, safe tags) rehta hai, browser ka WYSIWYG output
// jaisa bhi ho.
// ---------------------------------------------------------------------------

const BLOCK_STYLE = 'margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151';
const HEADING_STYLE = 'margin:0 0 12px;font-size:18px;font-weight:bold;color:#111827';
const LIST_STYLE = 'margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.7;color:#374151';

function allowedAlign(styleText) {
  const match = /text-align\s*:\s*(left|center|right|justify)/i.exec(styleText || '');
  return match ? match[1].toLowerCase() : null;
}

function isSafeHref(href) {
  return /^(https?:|mailto:|tel:)/i.test(String(href || '').trim());
}

function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = node.tagName.toUpperCase();
  const align = allowedAlign(node.getAttribute?.('style'));
  const children = Array.from(node.childNodes)
    .map((child) => cleanNode(child))
    .filter(Boolean);

  function wrap(tagName, style) {
    const el = document.createElement(tagName);
    const finalStyle = [style, align ? `text-align:${align}` : ''].filter(Boolean).join(';');
    if (finalStyle) el.setAttribute('style', finalStyle);
    children.forEach((child) => el.appendChild(child));
    return el;
  }

  function unwrap() {
    const frag = document.createDocumentFragment();
    children.forEach((child) => frag.appendChild(child));
    return frag;
  }

  if (tag === 'P' || tag === 'DIV') return wrap('p', BLOCK_STYLE);
  if (/^H[1-6]$/.test(tag)) return wrap('p', HEADING_STYLE);
  if (tag === 'STRONG' || tag === 'B') return wrap('strong');
  if (tag === 'EM' || tag === 'I') return wrap('em');
  if (tag === 'U') return wrap('u');
  if (tag === 'BR') return document.createElement('br');
  if (tag === 'UL') return wrap('ul', LIST_STYLE);
  if (tag === 'OL') return wrap('ol', LIST_STYLE);
  if (tag === 'LI') return wrap('li', 'margin:0 0 4px');
  if (tag === 'A') {
    const href = node.getAttribute('href');
    if (!isSafeHref(href)) return unwrap();
    const el = document.createElement('a');
    el.setAttribute('href', href);
    el.setAttribute('style', 'color:#4f46e5;text-decoration:underline');
    children.forEach((child) => el.appendChild(child));
    return el;
  }
  // SPAN aur kuch aur (browser ke apne wrapper tags) — tag hata dete hain,
  // andar ka content rakh lete hain.
  return unwrap();
}

/** Sirf safe tags (p/strong/em/u/a/ul/ol/li/br) aur ek hi inline style (text-align) bachta hai — baaki sab hata diya jaata hai. */
export function sanitizeRichHtml(html) {
  const source = document.createElement('div');
  source.innerHTML = String(html || '');

  const container = document.createElement('div');
  Array.from(source.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) container.appendChild(cleaned);
  });

  return container.innerHTML.trim();
}

function ToolbarButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      onMouseDown={(e) => e.preventDefault()} // selection ko kho jaane se bachata hai
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

export default function RichTextEditor({ value, onChange, dynamicFields, placeholder }) {
  const t = useT();
  const elRef = useRef(null);
  const lastValueRef = useRef(value);

  // Sirf tab jab value BAHAR se badle (naya field load hua) — har keystroke
  // par nahi, warna cursor position har baar reset ho jaati.
  useEffect(() => {
    if (elRef.current && value !== lastValueRef.current && document.activeElement !== elRef.current) {
      elRef.current.innerHTML = value || '';
      lastValueRef.current = value;
    }
  }, [value]);

  function emitChange() {
    const clean = sanitizeRichHtml(elRef.current?.innerHTML || '');
    lastValueRef.current = clean;
    onChange(clean);
  }

  function exec(command, arg) {
    elRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  }

  function handleLink() {
    const url = window.prompt(t('rte.linkPrompt'));
    if (!url) return;
    exec('createLink', url);
  }

  function handleHeadingToggle() {
    exec('formatBlock', '<h2>');
  }

  return (
    <div className="mw-rte">
      <div className="mw-row mw-row--wrap mb-2">
        <ToolbarButton icon="bi-type-bold" label={t('rte.bold')} onClick={() => exec('bold')} />
        <ToolbarButton icon="bi-type-italic" label={t('rte.italic')} onClick={() => exec('italic')} />
        <ToolbarButton icon="bi-type-underline" label={t('rte.underline')} onClick={() => exec('underline')} />
        <ToolbarButton icon="bi-text-left" label={t('rte.alignLeft')} onClick={() => exec('justifyLeft')} />
        <ToolbarButton icon="bi-text-center" label={t('rte.alignCenter')} onClick={() => exec('justifyCenter')} />
        <ToolbarButton icon="bi-text-right" label={t('rte.alignRight')} onClick={() => exec('justifyRight')} />
        <ToolbarButton icon="bi-link-45deg" label={t('rte.link')} onClick={handleLink} />
        <ToolbarButton icon="bi-list-ul" label={t('rte.bulletList')} onClick={() => exec('insertUnorderedList')} />
        <ToolbarButton icon="bi-list-ol" label={t('rte.numberedList')} onClick={() => exec('insertOrderedList')} />
        <ToolbarButton icon="bi-type-h2" label={t('rte.heading')} onClick={handleHeadingToggle} />
        {dynamicFields ? (
          <DynamicFieldPicker
            fields={dynamicFields}
            getField={() => null}
            value=""
            onChange={(withToken) => {
              // Yeh field ek contentEditable hai, plain <input>/<textarea>
              // nahi — isliye DynamicFieldPicker ka diya hua poora naya text
              // use nahi karte, sirf usme se token nikaal kar Selection API
              // se cursor par daalte hain.
              const token = withToken.trim();
              elRef.current?.focus();
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0 && elRef.current?.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(token));
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                elRef.current.appendChild(document.createTextNode(token));
              }
              emitChange();
            }}
            className="form-select form-select-sm"
            ariaLabel={t('dyn.insertField')}
          />
        ) : null}
      </div>

      <div
        ref={elRef}
        className="form-control mw-rte__area"
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        style={{ minHeight: 110 }}
      />
      {/* Sirf placeholder text ke liye — koi global SCSS file chhoote bina, ek chhota scoped style. */}
      <style>{`
        .mw-rte__area:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .mw-rte__area p, .mw-rte__area ul, .mw-rte__area ol { margin: 0 0 8px; }
      `}</style>
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';

import { useT } from '../../i18n/I18nProvider';

/**
 * One dialog component for the whole app.
 * On desktop it looks like a centred modal, on phones it slides up from the
 * bottom like a native app sheet (handled entirely in CSS).
 *
 * Because it claims aria-modal="true" it also has to behave like a modal:
 * focus moves inside when it opens, Tab cannot escape it, and focus returns to
 * whatever opened it when it closes.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Several sheets can be open at once (a confirm on top of an editor), so the
// scroll lock is counted rather than simply added and removed.
let openSheets = 0;

function lockScroll() {
  openSheets += 1;
  if (openSheets === 1) document.body.classList.add('overflow-hidden');
}

function unlockScroll() {
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets === 0) document.body.classList.remove('overflow-hidden');
}

export default function Sheet({ open, title, onClose, children, footer, wide = false }) {
  const t = useT();
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  // Kept in a ref so a caller passing an inline arrow does not re-run the
  // effect (and re-lock the scroll) on every single render. Written in an
  // effect rather than during render, which React does not allow.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const focusableItems = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(dialogRef.current.querySelectorAll(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement
    );
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement;
    lockScroll();

    // Put focus on the first real control, or the dialog itself if it has none.
    const items = focusableItems();
    (items[0] || dialogRef.current)?.focus();

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const list = focusableItems();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;

      // Wrap around instead of letting focus walk into the page behind.
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKey, true);

    return () => {
      document.removeEventListener('keydown', handleKey, true);
      unlockScroll();
      const target = returnFocusRef.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
    };
  }, [open, focusableItems]);

  if (!open) return null;

  function handleBackdrop(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="mw-sheet-backdrop" role="presentation" onClick={handleBackdrop}>
      <div
        ref={dialogRef}
        className={`mw-sheet ${wide ? 'mw-sheet--wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="mw-sheet__grabber" aria-hidden="true" />
        <div className="mw-sheet__head">
          <h2 className="mw-sheet__title">{title}</h2>
          <button type="button" className="mw-iconbtn" onClick={onClose} aria-label={t('common.close')}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="mw-sheet__body">{children}</div>
        {footer ? <div className="mw-sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

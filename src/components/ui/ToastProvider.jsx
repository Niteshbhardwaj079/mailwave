import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { newId } from '../../utils/ids';

/**
 * Toast = screen ke kone me aane wala chhota message.
 *
 * Kyun banaya: pehle koi cheez save ya delete karne par kuch dikhta hi nahi
 * tha — pata hi nahi chalta tha ki kaam hua ya nahi. Ab har action ke baad ek
 * message aata hai.
 *
 * Istemal karne ka tarika kisi bhi page me:
 *
 *   const toast = useToast();
 *   toast.success('Template save ho gaya');
 *   toast.error('Save nahi hua', 'Internet check karo');
 *   toast.undo('Contact hata diya', () => wapasLaao());
 */
const ToastContext = createContext(null);

// Kitni der dikhega. Error thoda zyada, kyunki use padhna zaroori hota hai.
const DURATION = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Har toast ka timer yahan rakhte hain, taki hover par rok sakein aur
  // component hatne par saaf kar sakein.
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (tone, title, detail, options = {}) => {
      const id = newId('toast');
      const duration = options.duration ?? DURATION[tone] ?? 4000;

      setToasts((current) => {
        const next = [...current, { id, tone, title, detail, action: options.action ?? null }];
        // Ek saath 4 se zyada nahi — warna poori screen dhak jati hai.
        return next.slice(-4);
      });

      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }

      return id;
    },
    [dismiss]
  );

  // Component hatne par saare timers band — warna React warning deta hai.
  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach((timer) => clearTimeout(timer));
      running.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (title, detail, options) => show('success', title, detail, options),
      error: (title, detail, options) => show('error', title, detail, options),
      warning: (title, detail, options) => show('warning', title, detail, options),
      info: (title, detail, options) => show('info', title, detail, options),

      /** Delete jaise kaam ke liye — wapas laane ka mauka deta hai. */
      undo: (title, onUndo, detail) =>
        show('success', title, detail, {
          duration: 8000,
          action: { key: 'common.undo', run: onUndo },
        }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: 'bi-check-circle-fill',
  error: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

function ToastShelf({ toasts, onDismiss }) {
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    // aria-live: screen reader khud padh deta hai, bina focus badle.
    <div className="mw-toaster" role="region" aria-live="polite" aria-label={t('toast.region')}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`mw-toast mw-toast--${toast.tone}`} role="status">
          <i className={`bi ${ICONS[toast.tone]} mw-toast__icon`} aria-hidden="true" />

          <div className="mw-toast__body">
            <div className="mw-toast__title">{toast.title}</div>
            {toast.detail ? <div className="mw-toast__detail">{toast.detail}</div> : null}
          </div>

          {toast.action ? (
            <button
              type="button"
              className="mw-toast__action"
              onClick={() => {
                toast.action.run();
                onDismiss(toast.id);
              }}
            >
              {t(toast.action.key)}
            </button>
          ) : null}

          <button
            type="button"
            className="mw-toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('common.close')}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

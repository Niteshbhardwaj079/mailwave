import { useEffect } from 'react';

import { Segmented } from '../ui/Controls';
import { useT } from '../../i18n/I18nProvider';

/**
 * Poore viewport ka, full-screen preview overlay — Custom, Upload aur
 * Builder, teeno editors se same tarah khulta hai. `children` hi asli
 * preview render karta hai (HtmlPreview ya BuilderDevicePreview, jo bhi us
 * editor ka Live Preview panel pehle se use karta hai) — isliye preview
 * LOGIC kabhi duplicate nahi hota, sirf bade screen par dikhaya jaata hai.
 * Editor apna current, ABHI TAK UNSAVED state hi is component ko deta hai.
 */
export default function TemplateFullPreview({ open, title, device, onDeviceChange, onClose, onSave, children }) {
  const t = useT();

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('overflow-hidden');
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const DEVICES = [
    { value: 'desktop', label: t('common.desktop') },
    { value: 'mobile', label: t('common.mobile') },
  ];

  return (
    <div className="mw-shell mw-shell--overlay">
      <header className="mw-topbar">
        <button type="button" className="mw-iconbtn" onClick={onClose} aria-label={t('common.back')}>
          <i className="bi bi-arrow-left" />
        </button>
        <h1 className="mw-topbar__title">{title || t('tpl.previewButton')}</h1>
        <div className="mw-topbar__actions">
          <Segmented items={DEVICES} value={device} onChange={onDeviceChange} ariaLabel={t('common.preview')} />
          <button type="button" className="btn btn-primary" onClick={onSave}>
            <i className="bi bi-save me-2" />
            {t('common.save')}
          </button>
          <button type="button" className="btn btn-outline-secondary mw-hide-mobile" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </header>

      <main className="mw-main">
        <div className="mw-main__inner">{children}</div>
      </main>
    </div>
  );
}

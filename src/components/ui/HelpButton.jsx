import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useT } from '../../i18n/I18nProvider';
import { helpContent } from '../../data/helpContent';
import Sheet from './Sheet';

export default function HelpButton({ topic }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const content = helpContent[topic];

  if (!content) return null;

  function show() {
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="mw-iconbtn" onClick={show} aria-label={t('common.needHelp')}>
        <i className="bi bi-question-circle" />
      </button>

      <Sheet
        open={open}
        title={t('common.needHelp')}
        onClose={hide}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={hide}>
              {t('common.close')}
            </button>
            <Link to={`/guide?chapter=${content.chapter}`} className="btn btn-primary flex-fill" onClick={hide}>
              <i className="bi bi-book me-2" />
              {t('common.openGuide')}
            </Link>
          </>
        }
      >
        <h3 className="mw-fs-16 mw-fw-700 mb-3">{t(content.titleKey)}</h3>
        <ol className="mw-steps">
          {content.bullets.map((key) => (
            <li key={key} className="mw-steps__item">
              <p className="mw-steps__text">{t(key)}</p>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}

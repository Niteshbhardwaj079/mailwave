import { useState } from 'react';
import { Link } from 'react-router-dom';

import HtmlPreview from '../templates/HtmlPreview';
import { Note, Segmented } from '../ui/Controls';
import { useT } from '../../i18n/I18nProvider';
import { mergeVariables } from '../../data/mockData';

export default function StepContent({ draft, onChange, showErrors = false }) {
  const t = useT();
  const [view, setView] = useState('desktop');
  const contentMissing = showErrors && !draft.templateHtml.trim();

  const VIEWS = [
    { value: 'desktop', label: t('common.desktop') },
    { value: 'mobile', label: t('common.mobile') },
    { value: 'html', label: t('common.html') },
  ];

  function handleSubject(event) {
    onChange({ subject: event.target.value });
  }

  function handlePreheader(event) {
    onChange({ preheader: event.target.value });
  }

  function insertVariable(event) {
    onChange({ subject: `${draft.subject}{{${event.currentTarget.dataset.name}}}` });
  }

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('tpl.subject')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('tpl.variablesHelp')}</p>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="content-subject">
            {t('tpl.subject')}
          </label>
          <input
            id="content-subject"
            type="text"
            className="form-control form-control-lg"
            value={draft.subject}
            onChange={handleSubject}
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="content-preheader">
            {t('content.preheader')}
          </label>
          <input
            id="content-preheader"
            type="text"
            className="form-control"
            value={draft.preheader}
            onChange={handlePreheader}
            placeholder={t('content.preheader')}
          />
        </div>
      </div>

      <div>
        <p className="mw-fs-13 mw-fw-600 mb-2">{t('tpl.variables')}</p>
        <div className="mw-row mw-row--wrap">
          {mergeVariables.map((name) => (
            <button key={name} type="button" className="mw-var" data-name={name} onClick={insertVariable}>
              {`{{${name}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mw-row mw-row--between mw-row--wrap">
        <span className="mw-fs-14 mw-fw-700">
          {t('tpl.livePreview')} — {draft.templateName}
        </span>
        <Segmented items={VIEWS} value={view} onChange={setView} ariaLabel={t('common.preview')} />
      </div>

      {view === 'html' ? (
        <pre className="mw-card p-3 mw-fs-12 mw-mono mw-scroll-y mb-0">{draft.templateHtml}</pre>
      ) : (
        <HtmlPreview html={draft.templateHtml} device={view} />
      )}

      {contentMissing ? (
        <Note tone="warning" icon="bi-exclamation-triangle">
          {t('wiz.needContent')}
        </Note>
      ) : null}

      <Note tone="info" icon="bi-pencil-square">
        {t('tpl.htmlHelp')}{' '}
        <Link to={draft.templateId ? `/templates/${draft.templateId}/edit` : '/templates/new'}>
          {t('tpl.editTemplate')}
        </Link>
      </Note>
    </div>
  );
}

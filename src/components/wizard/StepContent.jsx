import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import HtmlPreview from '../templates/HtmlPreview';
import { Note, Segmented } from '../ui/Controls';
import { useT } from '../../i18n/I18nProvider';
import { mergeVariables } from '../../data/constants';

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

  // Button dabane par input ka focus chala jata hai — isliye cursor ki jagah
  // pehle se yaad rakhte hain (select/blur par), taaki chip wahin jude jahan
  // user ne cursor rakha tha. Kabhi cursor rakha hi nahi to end me jodte hain.
  const subjectRef = useRef(null);
  const caretRef = useRef(null);

  function rememberCaret(event) {
    caretRef.current = { start: event.target.selectionStart, end: event.target.selectionEnd };
  }

  function insertVariable(event) {
    const token = `{{${event.currentTarget.dataset.name}}}`;
    const value = draft.subject;
    const caret = caretRef.current;
    const start = caret ? Math.min(caret.start, value.length) : value.length;
    const end = caret ? Math.min(caret.end, value.length) : value.length;
    const position = start + token.length;

    onChange({ subject: value.slice(0, start) + token + value.slice(end) });
    caretRef.current = { start: position, end: position };

    // Naya value render hone ke baad cursor token ke theek baad rakho.
    requestAnimationFrame(() => {
      const input = subjectRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(position, position);
    });
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
            ref={subjectRef}
            type="text"
            className="form-control form-control-lg"
            value={draft.subject}
            onChange={handleSubject}
            onSelect={rememberCaret}
            onBlur={rememberCaret}
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

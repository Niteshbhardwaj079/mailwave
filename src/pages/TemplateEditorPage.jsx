import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import HtmlPreview from '../components/templates/HtmlPreview';
import ImageLibrary from '../components/templates/ImageLibrary';
import TemplateDesignEditor from '../components/templates/TemplateDesignEditor';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { BLANK_HTML, starterTemplates } from '../data/starterHtml';
import { mergeVariables } from '../data/constants';
import { DEFAULT_SCHEMA, renderTemplateHtml } from '../data/templateBuilder';
import { LANGUAGES } from '../i18n/languages';
import { api } from '../api/client';

function cloneSchema(schema) {
  return JSON.parse(JSON.stringify(schema));
}

export default function TemplateEditorPage() {
  const t = useT();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { getTemplate, saveTemplate, duplicateTemplate, templates } = useWorkspace();
  const existing = templateId ? getTemplate(templateId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [category, setCategory] = useState(existing?.category || 'Custom');
  const [categories, setCategories] = useState([]);
  const [subject, setSubject] = useState(existing?.subject || '');
  const [schema, setSchema] = useState(
    existing ? (existing.contentSchema ? cloneSchema(existing.contentSchema) : null) : cloneSchema(DEFAULT_SCHEMA)
  );
  const [html, setHtml] = useState(() => {
    if (existing) return existing.html || BLANK_HTML;
    return renderTemplateHtml(DEFAULT_SCHEMA);
  });
  const [language, setLanguage] = useState(existing?.language || 'en');
  const [isDefault, setIsDefault] = useState(Boolean(existing?.isDefault));
  const [tab, setTab] = useState(existing && !existing.contentSchema ? 'code' : 'design');
  const [device, setDevice] = useState('desktop');
  const [savedId, setSavedId] = useState(existing?.id || null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/templates/categories')
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  // Workspace templates load asynchronously after sign-in, so on a direct
  // page load (a refresh while already on this URL, not a click from inside
  // the app) `existing` above can be null on the very first render even
  // though this IS an edit of a real template — useState only reads it once,
  // at mount, so the form would otherwise stay permanently blank and Save
  // would create a duplicate template instead of updating this one. Once the
  // real template shows up, fill the form from it — but only if nothing has
  // been typed yet, so this can never clobber an edit already in progress.
  const hydratedRef = useRef(Boolean(existing) || !templateId);
  useEffect(() => {
    if (hydratedRef.current || !templateId || !existing) return;
    const isPristine = !name && !subject && html === BLANK_HTML && savedId === null;
    if (!isPristine) {
      hydratedRef.current = true;
      return;
    }
    setName(existing.name || '');
    setCategory(existing.category || 'Custom');
    setSubject(existing.subject || '');
    setHtml(existing.html || BLANK_HTML);
    setSchema(existing.contentSchema ? cloneSchema(existing.contentSchema) : null);
    setLanguage(existing.language || 'en');
    setIsDefault(Boolean(existing.isDefault));
    setTab(existing.contentSchema ? 'design' : 'code');
    setSavedId(existing.id || null);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, templateId]);

  const TABS = useMemo(
    () => [
      { value: 'design', label: t('tpl.design.tab') },
      { value: 'code', label: t('tpl.html') },
      { value: 'images', label: t('img.title') },
      { value: 'starters', label: t('tpl.startingPoints') },
    ],
    [t]
  );

  const DEVICES = useMemo(
    () => [
      { value: 'desktop', label: t('common.desktop') },
      { value: 'mobile', label: t('common.mobile') },
    ],
    [t]
  );

  const defaultStarters = useMemo(() => templates.filter((item) => item.isDefault), [templates]);

  function handleName(event) {
    setName(event.target.value);
  }

  function handleCategory(event) {
    setCategory(event.target.value);
  }

  function handleSubject(event) {
    setSubject(event.target.value);
  }

  function handleLanguage(event) {
    setLanguage(event.target.value);
  }

  function handleSchemaChange(nextSchema) {
    setSchema(nextSchema);
    setHtml(renderTemplateHtml(nextSchema));
  }

  function handleHtml(event) {
    // Raw HTML ko haath se edit karna structured fields ka bharosa tod deta
    // hai — Design tab tabhi tak sahi rehta hai jab tak sab kuch usi se bane.
    if (schema) setSchema(null);
    setHtml(event.target.value);
  }

  function insertAtCursor(snippet) {
    const field = codeRef.current;
    if (!field) {
      setHtml((current) => current + snippet);
      return;
    }
    const start = field.selectionStart ?? html.length;
    const end = field.selectionEnd ?? html.length;
    const next = `${html.slice(0, start)}${snippet}${html.slice(end)}`;
    if (schema) setSchema(null);
    setHtml(next);
    window.requestAnimationFrame(() => {
      field.focus();
      field.selectionStart = start + snippet.length;
      field.selectionEnd = start + snippet.length;
    });
  }

  function insertVariable(event) {
    insertAtCursor(`{{${event.currentTarget.dataset.name}}}`);
  }

  function loadStarter(event) {
    const starter = starterTemplates.find((item) => item.key === event.currentTarget.dataset.key);
    if (!starter) return;
    setSchema(null);
    setHtml(starter.html);
    if (!name) setName(starter.name);
    setTab('code');
  }

  function loadDefaultStarter(event) {
    const source = defaultStarters.find((item) => item.id === event.currentTarget.dataset.id);
    if (!source) return;
    if (!name) setName(source.name);
    setCategory(source.category);
    setSubject(source.subject);
    if (source.contentSchema) {
      setSchema(cloneSchema(source.contentSchema));
      setHtml(renderTemplateHtml(source.contentSchema));
      setTab('design');
    } else {
      setSchema(null);
      setHtml(source.html);
      setTab('code');
    }
  }

  async function handleSave() {
    if (isDefault) {
      const copy = await duplicateTemplate(savedId);
      if (copy) navigate(`/templates/${copy.id}/edit`);
      return;
    }

    const record = await saveTemplate({
      id: savedId || undefined,
      name: name.trim() || t('tpl.newTemplate'),
      category,
      subject,
      html,
      language,
      contentSchema: schema,
    });
    if (!record) return;
    setSavedId(record.id);
    setSavedOpen(true);
  }

  function closeSaved() {
    setSavedOpen(false);
  }

  function goToTemplates() {
    navigate('/templates');
  }

  function copyPreviewLink() {
    if (!savedId) return;
    const url = `${window.location.origin}/templates/${savedId}/preview`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={existing ? t('tpl.editTemplate') : t('tpl.newTemplate')}
        subtitle={t('tpl.htmlHelp')}
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: name || t('tpl.newTemplate') }]}
        helpTopic="editor"
        actions={
          <>
            {savedId ? (
              <a
                className="btn btn-outline-secondary mw-hide-mobile"
                href={`/templates/${savedId}/preview`}
                target="_blank"
                rel="noreferrer"
              >
                <i className="bi bi-box-arrow-up-right me-2" />
                {t('tpl.openPreview')}
              </a>
            ) : null}
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={handleSave}>
              <i className={`bi ${isDefault ? 'bi-files' : 'bi-save'} me-2`} />
              {isDefault ? t('tpl.duplicateAndEdit') : t('common.save')}
            </button>
          </>
        }
      />

      {isDefault ? (
        <Note tone="warning" icon="bi-lock">
          {t('tpl.defaultReadOnly')}
        </Note>
      ) : null}

      <div className="mw-editor">
        <Card flush>
          <CardHead
            title={t('tpl.newTemplate')}
            tools={<Segmented items={TABS} value={tab} onChange={setTab} ariaLabel={t('common.filter')} />}
          />

          <CardBody>
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tpl-name">
                  {t('tpl.name')}
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={handleName}
                  placeholder={t('tpl.namePlaceholder')}
                  disabled={isDefault}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tpl-category">
                  {t('common.category')}
                </label>
                <input
                  id="tpl-category"
                  type="text"
                  className="form-control"
                  list="tpl-category-options"
                  value={category}
                  onChange={handleCategory}
                  disabled={isDefault}
                  placeholder={t('tpl.design.categoryPlaceholder')}
                />
                <datalist id="tpl-category-options">
                  {categories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <p className="form-text mb-0">{t('tpl.design.categoryHelp')}</p>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tpl-language">
                  {t('tpl.language')}
                </label>
                <select id="tpl-language" className="form-select" value={language} onChange={handleLanguage} disabled={isDefault}>
                  {LANGUAGES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.flag} {item.native}
                    </option>
                  ))}
                </select>
                <p className="form-text mb-0">{t('tpl.languageHelp')}</p>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tpl-subject">
                  {t('tpl.subject')}
                </label>
                <input
                  id="tpl-subject"
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={handleSubject}
                  placeholder={t('info.subjectPlaceholder')}
                  disabled={isDefault}
                />
              </div>
            </div>

            {tab === 'design' ? (
              schema ? (
                <TemplateDesignEditor schema={schema} onChange={handleSchemaChange} readOnly={isDefault} />
              ) : (
                <div className="mw-stack--sm d-flex flex-column">
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {t('tpl.design.detached')}
                  </Note>
                  {!isDefault ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary align-self-start"
                      onClick={() => handleSchemaChange(cloneSchema(DEFAULT_SCHEMA))}
                    >
                      {t('tpl.design.startFresh')}
                    </button>
                  ) : null}
                </div>
              )
            ) : null}

            {tab === 'code' ? (
              <>
                {!isDefault && schema === null && existing?.contentSchema ? (
                  <Note tone="info" icon="bi-info-circle">
                    {t('tpl.design.detached')}
                  </Note>
                ) : null}
                <div className="mb-3">
                  <span className="form-label d-block">{t('tpl.variables')}</span>
                  <div className="mw-row mw-row--wrap">
                    {mergeVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="mw-var"
                        data-name={variable}
                        onClick={insertVariable}
                        disabled={isDefault}
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                  <p className="form-text mt-2 mb-0">{t('tpl.variablesHelp')}</p>
                </div>

                <label className="form-label" htmlFor="tpl-html">
                  {t('tpl.html')}
                </label>
                <textarea
                  id="tpl-html"
                  ref={codeRef}
                  className="mw-codearea"
                  value={html}
                  onChange={handleHtml}
                  spellCheck="false"
                  disabled={isDefault}
                />
                <p className="form-text">{t('tpl.unsavedNote')}</p>
              </>
            ) : null}

            {tab === 'images' ? <ImageLibrary onInsert={insertAtCursor} /> : null}

            {tab === 'starters' ? (
              <div className="mw-stack--sm d-flex flex-column">
                <p className="mw-fs-13 mw-text-muted mb-0">{t('tpl.startingPointsHelp')}</p>

                {defaultStarters.length ? (
                  <>
                    <h4 className="mw-fs-13 mw-fw-700 mb-1 mt-2">{t('tpl.design.readyMade')}</h4>
                    {defaultStarters.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mw-starter"
                        data-id={item.id}
                        onClick={loadDefaultStarter}
                      >
                        <span className="mw-starter__icon" aria-hidden="true">
                          <i className="bi bi-layout-text-window" />
                        </span>
                        <span className="flex-grow-1">
                          <span className="d-block mw-option__title">{item.name}</span>
                          <span className="d-block mw-option__desc">{item.category}</span>
                        </span>
                        <span className="btn btn-sm btn-outline-primary mw-nowrap">{t('tpl.loadStarter')}</span>
                      </button>
                    ))}
                    <h4 className="mw-fs-13 mw-fw-700 mb-1 mt-3">{t('tpl.design.blankStarters')}</h4>
                  </>
                ) : null}

                {starterTemplates.map((starter) => (
                  <button
                    key={starter.key}
                    type="button"
                    className="mw-starter"
                    data-key={starter.key}
                    onClick={loadStarter}
                  >
                    <span className="mw-starter__icon" aria-hidden="true">
                      <i className={`bi ${starter.icon}`} />
                    </span>
                    <span className="flex-grow-1">
                      <span className="d-block mw-option__title">{starter.name}</span>
                      <span className="d-block mw-option__desc">{starter.description}</span>
                    </span>
                    <span className="btn btn-sm btn-outline-primary mw-nowrap">{t('tpl.loadStarter')}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card flush>
          <CardHead
            title={t('tpl.livePreview')}
            tools={
              <>
                <Segmented items={DEVICES} value={device} onChange={setDevice} ariaLabel={t('common.preview')} />
                {savedId ? (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyPreviewLink}>
                    <i className="bi bi-link-45deg me-1" />
                    {copied ? t('common.copied') : t('tpl.copyLink')}
                  </button>
                ) : null}
              </>
            }
          />
          <CardBody>
            <HtmlPreview html={html} device={device} />
          </CardBody>
        </Card>
      </div>

      <Note tone="info" icon="bi-info-circle">
        {t('tpl.previewOnly')}
      </Note>

      <Sheet
        open={savedOpen}
        title={t('tpl.saved')}
        onClose={closeSaved}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeSaved}>
              {t('common.close')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={goToTemplates}>
              {t('nav.templates')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-3">{t('tpl.savedText')}</p>
        {savedId ? (
          <div className="mw-urlbox">
            <span className="mw-urlbox__text">{`${window.location.origin}/templates/${savedId}/preview`}</span>
            <button type="button" className="mw-urlbox__btn" onClick={copyPreviewLink}>
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        ) : null}
        <div className="mt-3">
          <Link to={`/templates/${savedId}/preview`} className="btn btn-outline-primary btn-sm">
            <i className="bi bi-eye me-2" />
            {t('common.preview')}
          </Link>
        </div>
      </Sheet>
    </div>
  );
}

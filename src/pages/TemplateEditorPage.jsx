import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import HtmlPreview from '../components/templates/HtmlPreview';
import ImageLibrary from '../components/templates/ImageLibrary';
import TemplateDesignEditor from '../components/templates/TemplateDesignEditor';
import DynamicFieldPicker from '../components/templates/DynamicFieldPicker';
import DynamicFieldManager from '../components/templates/DynamicFieldManager';
import TemplateSourceBadge from '../components/templates/TemplateSourceBadge';
import TemplateFullPreview from '../components/templates/TemplateFullPreview';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useToast } from '../components/ui/ToastProvider';
import { BLANK_HTML, starterTemplates } from '../data/starterHtml';
import { DEFAULT_SCHEMA, findSocialPlatform, normalizeSchema, renderTemplateHtml, resolveTemplateFieldTokens } from '../data/templateBuilder';
import { combineDynamicFields, fillDynamicPreview } from '../data/dynamicFields';
import { LANGUAGES } from '../i18n/languages';
import { api, ApiError } from '../api/client';
import { appConfig } from '../config/appConfig';

function cloneSchema(schema) {
  return JSON.parse(JSON.stringify(schema));
}

/**
 * `schema` (Design tab ka data) aur `html` (Code tab ka raw text) poori
 * tarah independent hain — WordPress ACF jaisa. Ek Design tab field kabhi
 * bhi html ko chhoo/regenerate nahi karta; Code tab me kuch bhi likhne se
 * Design tab ki field list kabhi gayab/reset nahi hoti.
 */
function schemaFromExisting(existingTemplate) {
  if (!existingTemplate?.contentSchema) return { ...cloneSchema(DEFAULT_SCHEMA), fields: [] };
  return normalizeSchema(existingTemplate.contentSchema);
}

function newSchemaForBlankTemplate() {
  return { ...cloneSchema(DEFAULT_SCHEMA), brandName: appConfig.name };
}

export default function TemplateEditorPage() {
  const t = useT();
  const toast = useToast();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { getTemplate, saveTemplate, duplicateTemplate, templates } = useWorkspace();
  const existing = templateId ? getTemplate(templateId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [category, setCategory] = useState(existing?.category || 'Custom');
  const [categories, setCategories] = useState([]);
  const [subject, setSubject] = useState(existing?.subject || '');
  const [schema, setSchema] = useState(() => (existing ? schemaFromExisting(existing) : newSchemaForBlankTemplate()));
  const [html, setHtml] = useState(() => {
    if (existing) return existing.html || BLANK_HTML;
    return renderTemplateHtml(newSchemaForBlankTemplate());
  });
  const [language, setLanguage] = useState(existing?.language || 'en');
  const [isDefault, setIsDefault] = useState(Boolean(existing?.isDefault));
  const [tab, setTab] = useState(existing && !existing.contentSchema ? 'code' : 'design');
  const [device, setDevice] = useState('desktop');
  const [savedId, setSavedId] = useState(existing?.id || null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [fieldsManagerOpen, setFieldsManagerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/templates/categories')
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    api
      .get('/api/settings')
      .then((data) => setCustomFields(data.settings?.dynamicFields ?? []))
      .catch(() => setCustomFields([]));
  }, []);

  const dynamicFields = useMemo(() => combineDynamicFields(customFields), [customFields]);

  async function saveCustomFields(next) {
    try {
      await api.put('/api/settings/dynamicFields', next);
      setCustomFields(next);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  function addDynamicField({ label, key }) {
    saveCustomFields([...customFields, { id: `df_${Date.now().toString(36)}`, label, key }]);
  }

  function renameDynamicField(id, label) {
    saveCustomFields(customFields.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  function removeDynamicField(id) {
    saveCustomFields(customFields.filter((f) => f.id !== id));
  }

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
    setSchema(schemaFromExisting(existing));
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

  // Is template ke apne fields aur links (Logo/Website/Brand Name/Unsubscribe
  // text hamesha, Heading/Text/Image/Button jo bhi client ne banaye, Footer
  // Text/Mobile Number/Custom Link/Social Link ki har ek entry) — Code tab ke
  // dropdown aur Design tab ke har text field ke apne picker, dono isi list
  // se bharte hain. `group` sirf dropdown me optgroup dikhane ke liye hai.
  const templateOwnFields = useMemo(() => {
    const groupHeader = t('tpl.design.header');
    const groupContent = t('tpl.design.content');
    const groupFooter = t('tpl.design.footer');
    const groupSocial = t('tpl.design.socialLinks');
    const base = [
      { key: 'logo_url', label: t('tpl.design.logo'), group: groupHeader },
      { key: 'website_url', label: t('tpl.design.websiteUrl'), group: groupHeader },
      { key: 'brand_name', label: t('tpl.design.brandName'), group: groupHeader },
      { key: 'unsubscribe_text', label: t('tpl.design.unsubscribeText'), group: groupFooter },
    ];
    const own = (schema.fields || []).map((f) => ({ key: f.key, label: f.label, group: groupContent }));
    const footerTexts = (schema.footerTexts || []).map((item, i) => ({
      key: item.key,
      label: `${t('tpl.design.footerText')} ${i + 1}`,
      group: groupFooter,
    }));
    const mobileNumbers = (schema.mobileNumbers || []).map((item, i) => ({
      key: item.key,
      label: `${t('tpl.design.mobileNumbers')} ${i + 1}`,
      group: groupFooter,
    }));
    const customLinks = (schema.customLinks || []).map((item) => ({
      key: item.key,
      label: item.label || t('tpl.design.addCustomLink'),
      group: groupFooter,
    }));
    const socialLinks = (schema.socialLinks || []).map((item) => ({
      key: item.key,
      label: findSocialPlatform(item.platform).label,
      group: groupSocial,
    }));
    return [...base, ...own, ...footerTexts, ...mobileNumbers, ...customLinks, ...socialLinks];
  }, [schema.fields, schema.footerTexts, schema.mobileNumbers, schema.customLinks, schema.socialLinks, t]);

  const allInsertableFields = useMemo(() => {
    const groupGlobal = t('tpl.variables');
    return [...templateOwnFields, ...dynamicFields.map((f) => ({ ...f, group: groupGlobal }))];
  }, [templateOwnFields, dynamicFields, t]);

  // Preview-only substitution — raw {{tokens}} kabhi screen par nahi dikhte.
  // Pehle is template ke apne fields (logo/heading_two/website_url/...) ki
  // ASLI value bharti hai, phir bachi hui recipient/global fields (Customer
  // Name, Company Name, ...) ki SAMPLE value — asli saved html/subject
  // bilkul waisa hi rehta hai jaisa neeche save hota hai.
  const previewHtml = useMemo(
    () => fillDynamicPreview(resolveTemplateFieldTokens(html, schema), dynamicFields),
    [html, schema, dynamicFields]
  );

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

  // Design tab kabhi html ko chhoota nahi — field ki value badalna sirf
  // schema (data) update karta hai. Wo field jahan bhi {{key}} ke roop me
  // Code tab me rakha gaya hai, wahi preview me turant nayi value dikha
  // deta hai (dekho previewHtml, upar).
  function handleSchemaChange(nextSchema) {
    setSchema(nextSchema);
  }

  function handleHtml(event) {
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
    setHtml(next);
    window.requestAnimationFrame(() => {
      field.focus();
      field.selectionStart = start + snippet.length;
      field.selectionEnd = start + snippet.length;
    });
  }

  function loadStarter(event) {
    const starter = starterTemplates.find((item) => item.key === event.currentTarget.dataset.key);
    if (!starter) return;
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
    // Default template ka apna, ASLI html seedha use karte hain — kabhi
    // dobara render nahi karte, taaki uski design/layout bilkul wahi rahe
    // jo master row me save hai. Schema sirf Design tab me edit karne ke
    // liye normalize hoti hai.
    if (source.contentSchema) setSchema(normalizeSchema(source.contentSchema));
    setHtml(source.html);
    setTab(source.contentSchema ? 'design' : 'code');
  }

  async function handleSave() {
    // Template Name aur Category — sirf yehi do fields hard-required hain
    // (Email Language hamesha bhara hota hai, ek controlled <select> hai).
    // Design tab ke andar koi bhi field kabhi required nahi — wahi to poore
    // is redesign ka matlab hai.
    if (!name.trim()) {
      toast.error(t('tpl.nameRequired'));
      return;
    }
    if (!category.trim()) {
      toast.error(t('tpl.categoryRequired'));
      return;
    }

    // {{heading_two}}/{{logo_url}}/{{website_url}}-jaise apne-hi-template
    // tokens ko YAHAN resolve NAHI karte — save/reload ke baad bhi Code tab
    // me wahi token dikhna chahiye jo type kiya tha ("Code variables remain
    // valid after save/reload"). Yeh {{unsubscribe_url}} jaise recipient/
    // global tokens jaisa hi tareeka hai: template me hamesha token hi rehta
    // hai, asli value SIRF campaign me use hote waqt bharti hai (dekho
    // StepTemplate.jsx ka resolveTemplateFieldTokens() call) — waisa hi jaisa
    // asli send par server/src/services/render.js karta hai.

    // Default templates save in place too now — the master row itself is
    // updated, permanently. Only DELETE stays blocked for them (server-side).
    const record = await saveTemplate({
      id: savedId || undefined,
      name: name.trim(),
      category: category.trim(),
      subject,
      html,
      language,
      contentSchema: schema,
      source: 'custom',
    });
    if (!record) return;
    setSavedId(record.id);
    setSavedOpen(true);
  }

  function closeSaved() {
    setSavedOpen(false);
  }

  /** Preview ke andar se Save dabane par bhi wahi save chalta hai; save ke baad preview band kar dete hain taaki neeche ka "Template saved" sheet dikh sake. */
  async function handlePreviewSave() {
    await handleSave();
    setPreviewOpen(false);
  }

  /** Makes a completely independent copy of whatever template is currently open, then edits that copy. */
  async function handleDuplicate() {
    if (!savedId) return;
    const copy = await duplicateTemplate(savedId);
    if (copy) navigate(`/templates/${copy.id}/edit`);
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
        title={
          <>
            {existing ? t('tpl.editTemplate') : t('tpl.newTemplate')}
            <TemplateSourceBadge source="custom" className="ms-2 align-middle" />
          </>
        }
        subtitle={t('tpl.htmlHelp')}
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: name || t('tpl.newTemplate') }]}
        helpTopic="editor"
        actions={
          <>
            <Link to="/templates" className="btn btn-outline-secondary mw-btn-block-mobile">
              <i className="bi bi-arrow-left me-2" />
              {t('common.back')}
            </Link>
            <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile" onClick={() => setFieldsManagerOpen(true)}>
              <i className="bi bi-braces me-2" />
              {t('dyn.manageFields')}
            </button>
            <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile" onClick={() => setPreviewOpen(true)}>
              <i className="bi bi-eye me-2" />
              {t('tpl.previewButton')}
            </button>
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
            {savedId ? (
              <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile" onClick={handleDuplicate}>
                <i className="bi bi-files me-2" />
                {t('common.duplicate')}
              </button>
            ) : null}
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={handleSave}>
              <i className="bi bi-save me-2" />
              {t('common.save')}
            </button>
          </>
        }
      />

      {isDefault ? (
        <Note tone="info" icon="bi-info-circle">
          {t('tpl.defaultEditNote')}
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
                <select id="tpl-language" className="form-select" value={language} onChange={handleLanguage}>
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
                />
              </div>
            </div>

            {tab === 'design' ? (
              <TemplateDesignEditor
                schema={schema}
                onChange={handleSchemaChange}
                dynamicFields={allInsertableFields}
                ownFieldKeys={dynamicFields.map((f) => f.key)}
              />
            ) : null}

            {tab === 'code' ? (
              <>
                <div className="mb-3">
                  <span className="form-label d-block">{t('tpl.variables')}</span>
                  <DynamicFieldPicker
                    fields={allInsertableFields}
                    getField={() => codeRef.current}
                    value={html}
                    onChange={setHtml}
                    className="form-select"
                    ariaLabel={t('dyn.insertField')}
                  />
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
            <HtmlPreview html={previewHtml} device={device} />
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

      <DynamicFieldManager
        open={fieldsManagerOpen}
        onClose={() => setFieldsManagerOpen(false)}
        customFields={customFields}
        onAdd={addDynamicField}
        onRename={renameDynamicField}
        onRemove={removeDynamicField}
      />

      <TemplateFullPreview
        open={previewOpen}
        title={name}
        device={device}
        onDeviceChange={setDevice}
        onClose={() => setPreviewOpen(false)}
        onSave={handlePreviewSave}
      >
        <HtmlPreview html={previewHtml} device={device} full title={name} />
      </TemplateFullPreview>
    </div>
  );
}

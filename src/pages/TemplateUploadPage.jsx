import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import HtmlPreview from '../components/templates/HtmlPreview';
import ImageLibrary from '../components/templates/ImageLibrary';
import TemplateSourceBadge from '../components/templates/TemplateSourceBadge';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useToast } from '../components/ui/ToastProvider';
import { lintUploadedHtml } from '../data/htmlUploadLint';
import { LANGUAGES } from '../i18n/languages';
import { api } from '../api/client';

export default function TemplateUploadPage() {
  const t = useT();
  const toast = useToast();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { getTemplate, saveTemplate, duplicateTemplate } = useWorkspace();
  const existing = templateId ? getTemplate(templateId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [category, setCategory] = useState(existing?.category || 'Custom');
  const [categories, setCategories] = useState([]);
  const [subject, setSubject] = useState(existing?.subject || '');
  const [language, setLanguage] = useState(existing?.language || 'en');
  const [html, setHtml] = useState(existing?.html || '');
  const [fileName, setFileName] = useState('');
  const [device, setDevice] = useState('desktop');
  const [savedId, setSavedId] = useState(existing?.id || null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);
  const fileInputRef = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    api
      .get('/api/templates/categories')
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  // TemplateEditorPage jaisa hi hydration guard — templates workspace load
  // hone se pehle refresh hone par `existing` null hota hai; jaise hi asli
  // data aata hai, form ek hi baar bharte hain (jab tak kuch type na kiya ho).
  const hydratedRef = useRef(Boolean(existing) || !templateId);
  useEffect(() => {
    if (hydratedRef.current || !templateId || !existing) return;
    const isPristine = !name && !subject && !html && savedId === null;
    if (!isPristine) {
      hydratedRef.current = true;
      return;
    }
    setName(existing.name || '');
    setCategory(existing.category || 'Custom');
    setSubject(existing.subject || '');
    setLanguage(existing.language || 'en');
    setHtml(existing.html || '');
    setSavedId(existing.id || null);
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, templateId]);

  const DEVICES = useMemo(
    () => [
      { value: 'desktop', label: t('common.desktop') },
      { value: 'mobile', label: t('common.mobile') },
    ],
    [t]
  );

  const warnings = useMemo(() => lintUploadedHtml(html), [html]);

  function readFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setHtml(String(reader.result || ''));
      setFileName(file.name);
      if (!name) setName(file.name.replace(/\.html?$/i, ''));
    };
    reader.onerror = () => toast.error(t('tpl.upload.readError'));
    reader.readAsText(file);
  }

  function handleFileInput(event) {
    readFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    readFile(event.dataTransfer.files?.[0]);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  // TemplateEditorPage ke Code tab jaisa hi — cursor jahan ho wahin image ka
  // snippet insert hota hai, poori HTML ko dobara likhna nahi padta.
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

  function handleImageInsert(snippet) {
    insertAtCursor(snippet);
    setImageLibraryOpen(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t('tpl.nameRequired'));
      return;
    }
    if (!category.trim()) {
      toast.error(t('tpl.categoryRequired'));
      return;
    }
    if (!html.trim()) {
      toast.error(t('tpl.upload.noFile'));
      return;
    }

    const record = await saveTemplate({
      id: savedId || undefined,
      name: name.trim(),
      category: category.trim(),
      subject,
      html,
      language,
      contentSchema: null,
      source: 'html_upload',
    });
    if (!record) return;
    setSavedId(record.id);
    setSavedOpen(true);
  }

  function closeSaved() {
    setSavedOpen(false);
  }

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
            {existing ? t('tpl.upload.editTitle') : t('tpl.upload.title')}
            <TemplateSourceBadge source="html_upload" className="ms-2 align-middle" />
          </>
        }
        subtitle={t('tpl.upload.dropHint')}
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: name || t('tpl.upload.title') }]}
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

      <div className="mw-editor">
        <Card flush>
          <CardHead title={existing ? t('tpl.upload.editTitle') : t('tpl.upload.title')} />
          <CardBody>
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tplu-name">
                  {t('tpl.name')}
                </label>
                <input
                  id="tplu-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('tpl.namePlaceholder')}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tplu-category">
                  {t('common.category')}
                </label>
                <input
                  id="tplu-category"
                  type="text"
                  className="form-control"
                  list="tplu-category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t('tpl.design.categoryPlaceholder')}
                />
                <datalist id="tplu-category-options">
                  {categories.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tplu-language">
                  {t('tpl.language')}
                </label>
                <select id="tplu-language" className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.flag} {item.native}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="tplu-subject">
                  {t('tpl.subject')}
                </label>
                <input
                  id="tplu-subject"
                  type="text"
                  className="form-control"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('info.subjectPlaceholder')}
                />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              className="d-none"
              onChange={handleFileInput}
              aria-label={t('tpl.upload.chooseFile')}
            />

            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <div className="mw-dropzone" onDrop={handleDrop} onDragOver={handleDragOver} onClick={openFilePicker}>
              <i className="bi bi-file-earmark-code mw-dropzone__icon" />
              <p className="mw-dropzone__title mb-0">{t('tpl.upload.dropHint')}</p>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openFilePicker();
                }}
              >
                {fileName ? t('tpl.upload.replaceFile') : t('tpl.upload.chooseFile')}
              </button>
              {fileName ? (
                <p className="mw-dropzone__hint mb-0">
                  {t('tpl.upload.selectedFile')}: {fileName}
                </p>
              ) : null}
            </div>

            {warnings.length ? (
              <div className="mt-3 d-flex flex-column gap-2">
                {warnings.map((key) => (
                  <Note key={key} tone="warning" icon="bi-exclamation-triangle">
                    {t(key)}
                  </Note>
                ))}
              </div>
            ) : null}

            <div className="mt-3">
              <div className="mw-row mw-row--wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label mb-0" htmlFor="tplu-html">
                  {t('tpl.html')}
                </label>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setImageLibraryOpen(true)}>
                  <i className="bi bi-image me-2" />
                  {t('tpl.upload.insertImage')}
                </button>
              </div>
              <textarea
                id="tplu-html"
                ref={codeRef}
                className="mw-codearea"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck="false"
              />
              <p className="form-text">{t('tpl.unsavedNote')}</p>
            </div>

            <Sheet open={imageLibraryOpen} title={t('img.title')} onClose={() => setImageLibraryOpen(false)}>
              <ImageLibrary onInsert={handleImageInsert} />
            </Sheet>
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

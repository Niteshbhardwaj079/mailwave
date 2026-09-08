import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import TemplateSourceBadge from '../components/templates/TemplateSourceBadge';
import TemplateFullPreview from '../components/templates/TemplateFullPreview';
import BuilderCanvas from '../components/templates/builder/BuilderCanvas';
import BuilderBlockSettings from '../components/templates/builder/BuilderBlockSettings';
import BuilderDevicePreview from '../components/templates/builder/BuilderDevicePreview';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useToast } from '../components/ui/ToastProvider';
import {
  compileBuilderHtml,
  countUnsubscribeBlocks,
  defaultBuilderSchema,
  ensureUnsubscribeBlock,
  normalizeBuilderSchema,
} from '../data/builderCompiler';
import { addBlock, addRow, duplicateBlock, moveBlock, moveRow, removeBlock, removeRow, reorderBlockWithinColumn, updateBlock, updateRow } from '../data/builderSchemaOps';
import { combineDynamicFields } from '../data/dynamicFields';
import { LANGUAGES } from '../i18n/languages';
import { api } from '../api/client';

function schemaFromExisting(existing) {
  if (!existing?.contentSchema) return defaultBuilderSchema();
  return normalizeBuilderSchema(existing.contentSchema);
}

function findBlock(schema, editing) {
  if (!editing) return null;
  const row = schema.rows.find((r) => r.id === editing.rowId);
  const col = row?.columns.find((c) => c.id === editing.colId);
  return col?.blocks.find((b) => b.id === editing.blockId) || null;
}

export default function TemplateBuilderPage() {
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
  const [schema, setSchema] = useState(() => (existing ? schemaFromExisting(existing) : defaultBuilderSchema()));
  const [device, setDevice] = useState('desktop');
  const [savedId, setSavedId] = useState(existing?.id || null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [editing, setEditing] = useState(null); // { rowId, colId, blockId }
  const [previewOpen, setPreviewOpen] = useState(false);

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

  // TemplateEditorPage/TemplateUploadPage jaisa hi hydration guard — workspace
  // async load hone se pehle refresh hone par `existing` null hota hai.
  const hydratedRef = useRef(Boolean(existing) || !templateId);
  useEffect(() => {
    if (hydratedRef.current || !templateId || !existing) return;
    setName(existing.name || '');
    setCategory(existing.category || 'Custom');
    setSubject(existing.subject || '');
    setLanguage(existing.language || 'en');
    setSchema(schemaFromExisting(existing));
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

  const editingBlock = useMemo(() => findBlock(schema, editing), [schema, editing]);

  function handleDeleteBlock(rowId, colId, blockId) {
    const block = findBlock(schema, { rowId, colId, blockId });
    if (block?.type === 'unsubscribe' && countUnsubscribeBlocks(schema) <= 1) {
      toast.error(t('tpl.builder.cannotDeleteLastUnsubscribe'));
      return;
    }
    setSchema((prev) => removeBlock(prev, rowId, colId, blockId));
  }

  function handleUpdateBlock(nextBlock) {
    if (!editing) return;
    setSchema((prev) => updateBlock(prev, editing.rowId, editing.colId, editing.blockId, nextBlock));
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

    const finalSchema = ensureUnsubscribeBlock(schema);
    const record = await saveTemplate({
      id: savedId || undefined,
      name: name.trim(),
      category: category.trim(),
      subject,
      html: compileBuilderHtml(finalSchema),
      language,
      contentSchema: finalSchema,
      source: 'builder',
    });
    if (!record) return;
    setSchema(finalSchema);
    setSavedId(record.id);
    setSavedOpen(true);
  }

  function closeSaved() {
    setSavedOpen(false);
  }

  async function handlePreviewSave() {
    await handleSave();
    setPreviewOpen(false);
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
            {existing ? t('tpl.builder.editTitle') : t('tpl.builder.title')}
            <TemplateSourceBadge source="builder" className="ms-2 align-middle" />
          </>
        }
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: name || t('tpl.builder.title') }]}
        helpTopic="editor"
        actions={
          <>
            <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile" onClick={() => setPreviewOpen(true)}>
              <i className="bi bi-eye me-2" />
              {t('tpl.previewButton')}
            </button>
            {savedId ? (
              <a className="btn btn-outline-secondary mw-hide-mobile" href={`/templates/${savedId}/preview`} target="_blank" rel="noreferrer">
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

      <Card flush>
        <CardBody>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="tplb-name">
                {t('tpl.name')}
              </label>
              <input id="tplb-name" type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tpl.namePlaceholder')} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="tplb-category">
                {t('common.category')}
              </label>
              <input id="tplb-category" type="text" className="form-control" list="tplb-category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('tpl.design.categoryPlaceholder')} />
              <datalist id="tplb-category-options">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="tplb-language">
                {t('tpl.language')}
              </label>
              <select id="tplb-language" className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.native}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="tplb-subject">
                {t('tpl.subject')}
              </label>
              <input id="tplb-subject" type="text" className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('info.subjectPlaceholder')} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mw-tplbuilder">
        <BuilderCanvas
          schema={schema}
          onAddRow={(columns) => setSchema((prev) => addRow(prev, columns))}
          onMoveRow={(rowId, dir) => setSchema((prev) => moveRow(prev, rowId, dir))}
          onDeleteRow={(rowId) => setSchema((prev) => removeRow(prev, rowId))}
          onUpdateRow={(rowId, patch) => setSchema((prev) => updateRow(prev, rowId, patch))}
          onAddBlock={(rowId, colId, type) => setSchema((prev) => addBlock(prev, rowId, colId, type))}
          onEditBlock={(rowId, colId, blockId) => setEditing({ rowId, colId, blockId })}
          onDuplicateBlock={(rowId, colId, blockId) => setSchema((prev) => duplicateBlock(prev, rowId, colId, blockId))}
          onDeleteBlock={handleDeleteBlock}
          onMoveBlock={(rowId, colId, blockId, dir) => setSchema((prev) => moveBlock(prev, rowId, colId, blockId, dir))}
          onReorderBlock={(rowId, colId, draggedId, targetId) => setSchema((prev) => reorderBlockWithinColumn(prev, rowId, colId, draggedId, targetId))}
        />

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
            <BuilderDevicePreview schema={schema} dynamicFields={dynamicFields} device={device} />
          </CardBody>
        </Card>
      </div>

      <Note tone="info" icon="bi-info-circle">
        {t('tpl.previewOnly')}
      </Note>

      <BuilderBlockSettings block={editingBlock} onChange={handleUpdateBlock} dynamicFields={dynamicFields} open={Boolean(editingBlock)} onClose={() => setEditing(null)} />

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

      <TemplateFullPreview
        open={previewOpen}
        title={name}
        device={device}
        onDeviceChange={setDevice}
        onClose={() => setPreviewOpen(false)}
        onSave={handlePreviewSave}
      >
        <BuilderDevicePreview schema={schema} dynamicFields={dynamicFields} device={device} full />
      </TemplateFullPreview>
    </div>
  );
}

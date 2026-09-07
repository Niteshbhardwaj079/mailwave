import { useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { Note } from '../ui/Controls';
import Sheet from '../ui/Sheet';
import { BUILTIN_DYNAMIC_FIELDS, uniqueFieldKey } from '../../data/dynamicFields';

/**
 * "Dynamic Fields" manager — WordPress custom-fields jaisa. Client friendly
 * label likhta hai ("Order Number"), system khud ek safe internal key banata
 * hai ({{order_number}}) — client ko kabhi yeh syntax yaad nahi rakhna padta.
 *
 * Builtin fields (Customer Name, Email Address, ...) hamesha maujood hain
 * aur real bhejne wale data se bharte hain — na hataye ja sakte hain na
 * unki key badli ja sakti hai. Custom fields client khud add/rename/remove
 * karta hai; unka data tab tak khaali (safe) rehta hai jab tak koi asli
 * source na jode — bilkul waisi hi fallback jo mergeVariables() pehle se
 * karta hai.
 */
export default function DynamicFieldManager({ open, onClose, customFields, onAdd, onRename, onRemove }) {
  const t = useT();
  const [labelDraft, setLabelDraft] = useState('');
  const [renameFor, setRenameFor] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const existingKeys = customFields.map((f) => f.key);
  const previewKey = labelDraft.trim() ? uniqueFieldKey(labelDraft, existingKeys) : '';

  function handleAdd() {
    const label = labelDraft.trim();
    if (!label) return;
    onAdd({ label, key: uniqueFieldKey(label, existingKeys) });
    setLabelDraft('');
  }

  function startRename(field) {
    setRenameFor(field.id);
    setRenameDraft(field.label);
  }

  function confirmRename(field) {
    const label = renameDraft.trim();
    if (label) onRename(field.id, label);
    setRenameFor(null);
  }

  function copyToken(key) {
    navigator.clipboard?.writeText(`{{${key}}}`);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  }

  return (
    <Sheet open={open} title={t('dyn.managerTitle')} onClose={onClose}>
      <Note tone="info" icon="bi-lightbulb">
        {t('dyn.howItWorks')}
      </Note>

      <div className="mw-stack--sm d-flex flex-column mt-3">
        <h4 className="mw-fs-13 mw-fw-700 mb-1">{t('dyn.builtinTitle')}</h4>
        {BUILTIN_DYNAMIC_FIELDS.map((field) => (
          <div key={field.key} className="mw-row align-items-center justify-content-between">
            <span>
              <span className="d-block mw-fw-650">{field.label}</span>
              <span className="d-block mw-fs-12 mw-text-muted mw-mono">{`{{${field.key}}}`}</span>
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => copyToken(field.key)}>
              {copiedKey === field.key ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        ))}

        <hr className="my-2" />

        <h4 className="mw-fs-13 mw-fw-700 mb-1">{t('dyn.customTitle')}</h4>
        <p className="mw-fs-12 mw-text-muted mb-0">{t('dyn.customHelp')}</p>

        {customFields.length === 0 ? (
          <p className="mw-fs-13 mw-text-muted">{t('dyn.customEmpty')}</p>
        ) : (
          customFields.map((field) => (
            <div key={field.id} className="mw-row align-items-center justify-content-between">
              {renameFor === field.id ? (
                <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
                  <input
                    type="text"
                    className="form-control"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="btn btn-primary" onClick={() => confirmRename(field)}>
                    {t('common.save')}
                  </button>
                </div>
              ) : (
                <span>
                  <span className="d-block mw-fw-650">{field.label}</span>
                  <span className="d-block mw-fs-12 mw-text-muted mw-mono">{`{{${field.key}}}`}</span>
                </span>
              )}
              <div className="mw-row">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => copyToken(field.key)}>
                  {copiedKey === field.key ? t('common.copied') : t('common.copy')}
                </button>
                {renameFor === field.id ? null : (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => startRename(field)}>
                    <i className="bi bi-pencil" />
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onRemove(field.id)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </div>
          ))
        )}

        <div className="mt-2">
          <label className="form-label" htmlFor="dyn-new-label">
            {t('dyn.addFieldLabel')}
          </label>
          <div className="input-group">
            <input
              id="dyn-new-label"
              type="text"
              className="form-control"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder={t('dyn.addFieldPlaceholder')}
            />
            <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={!labelDraft.trim()}>
              <i className="bi bi-plus-lg me-1" />
              {t('dyn.addField')}
            </button>
          </div>
          {previewKey ? (
            <p className="form-text mb-0">
              {t('dyn.keyPreview')} <span className="mw-mono">{`{{${previewKey}}}`}</span>
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

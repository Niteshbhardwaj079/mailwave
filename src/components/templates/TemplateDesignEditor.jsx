import { useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { Note } from '../ui/Controls';
import ColorField from '../ui/ColorField';
import Sheet from '../ui/Sheet';
import ImageLibrary from './ImageLibrary';
import { EMAIL_SAFE_FONTS, newBlock } from '../../data/templateBuilder';

/**
 * "Design" tab — TemplateEditorPage ke content_schema ko form fields ki
 * tarah edit karta hai. Kabhi raw HTML nahi dikhata; parent (TemplateEditorPage)
 * har change par renderTemplateHtml(schema) chala kar HTML khud bana leta hai.
 */
export default function TemplateDesignEditor({ schema, onChange, readOnly }) {
  const t = useT();
  const [pickerFor, setPickerFor] = useState(null); // 'logo' | { blockIndex }

  function set(patch) {
    if (readOnly) return;
    onChange({ ...schema, ...patch });
  }

  function setBlock(index, patch) {
    const blocks = schema.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block));
    set({ blocks });
  }

  function addBlock(type) {
    set({ blocks: [...schema.blocks, newBlock(type)] });
  }

  function removeBlock(index) {
    set({ blocks: schema.blocks.filter((_, i) => i !== index) });
  }

  function moveBlock(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= schema.blocks.length) return;
    const blocks = [...schema.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    set({ blocks });
  }

  function addSocialLink() {
    set({ socialLinks: [...(schema.socialLinks || []), { platform: '', url: '' }] });
  }

  function setSocialLink(index, patch) {
    const socialLinks = (schema.socialLinks || []).map((link, i) => (i === index ? { ...link, ...patch } : link));
    set({ socialLinks });
  }

  function removeSocialLink(index) {
    set({ socialLinks: (schema.socialLinks || []).filter((_, i) => i !== index) });
  }

  function handlePicked(url) {
    if (pickerFor === 'logo') set({ logoUrl: url });
    else if (pickerFor && typeof pickerFor === 'object') setBlock(pickerFor.blockIndex, { url });
    setPickerFor(null);
  }

  return (
    <fieldset disabled={readOnly} className="mw-stack">
      {readOnly ? (
        <Note tone="warning" icon="bi-lock">
          {t('tpl.defaultReadOnly')}
        </Note>
      ) : null}

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.header')}</h4>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">{t('tpl.design.brandName')}</label>
            <input
              type="text"
              className="form-control"
              value={schema.brandName}
              onChange={(e) => set({ brandName: e.target.value })}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">{t('tpl.design.logo')}</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                value={schema.logoUrl}
                onChange={(e) => set({ logoUrl: e.target.value })}
                placeholder={t('tpl.design.logoPlaceholder')}
              />
              <button type="button" className="btn btn-outline-secondary" onClick={() => setPickerFor('logo')}>
                <i className="bi bi-images me-1" />
                {t('img.title')}
              </button>
            </div>
            <p className="form-text mb-0">{t('tpl.design.logoHelp')}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.heading')}</h4>
        <input
          type="text"
          className="form-control"
          value={schema.heading}
          onChange={(e) => set({ heading: e.target.value })}
          placeholder={t('tpl.design.headingPlaceholder')}
        />
      </div>

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.content')}</h4>
        <div className="mw-stack--sm d-flex flex-column">
          {schema.blocks.map((block, index) => (
            <div key={index} className="p-3" style={{ border: '1px solid var(--mw-border, #e5e7eb)', borderRadius: 8 }}>
              <div className="mw-row mb-2 align-items-center">
                <strong className="mw-fs-13 flex-grow-1">
                  {block.type === 'paragraph' && t('tpl.design.blockParagraph')}
                  {block.type === 'image' && t('tpl.design.blockImage')}
                  {block.type === 'button' && t('tpl.design.blockButton')}
                </strong>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                  <i className="bi bi-arrow-up" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === schema.blocks.length - 1}
                >
                  <i className="bi bi-arrow-down" />
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeBlock(index)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>

              {block.type === 'paragraph' ? (
                <textarea
                  className="form-control"
                  rows={3}
                  value={block.text}
                  onChange={(e) => setBlock(index, { text: e.target.value })}
                  placeholder={t('tpl.design.paragraphPlaceholder')}
                />
              ) : null}

              {block.type === 'image' ? (
                <div className="row g-2">
                  <div className="col-12">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={block.url}
                        onChange={(e) => setBlock(index, { url: e.target.value })}
                        placeholder={t('tpl.design.logoPlaceholder')}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setPickerFor({ blockIndex: index })}
                      >
                        <i className="bi bi-images me-1" />
                        {t('img.title')}
                      </button>
                    </div>
                  </div>
                  <div className="col-12">
                    <input
                      type="text"
                      className="form-control"
                      value={block.alt}
                      onChange={(e) => setBlock(index, { alt: e.target.value })}
                      placeholder={t('tpl.design.altPlaceholder')}
                    />
                  </div>
                </div>
              ) : null}

              {block.type === 'button' ? (
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <input
                      type="text"
                      className="form-control"
                      value={block.label}
                      onChange={(e) => setBlock(index, { label: e.target.value })}
                      placeholder={t('tpl.design.buttonLabelPlaceholder')}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <input
                      type="text"
                      className="form-control"
                      value={block.url}
                      onChange={(e) => setBlock(index, { url: e.target.value })}
                      placeholder="{{subscribe_url}}"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <div className="mw-row mw-row--wrap">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addBlock('paragraph')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addParagraph')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addBlock('image')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addImage')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addBlock('button')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addButton')}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.style')}</h4>
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <ColorField id="tpl-accent" label={t('tpl.design.accentColor')} value={schema.accentColor} onChange={(v) => set({ accentColor: v })} />
          </div>
          <div className="col-6 col-md-3">
            <ColorField id="tpl-bg" label={t('tpl.design.backgroundColor')} value={schema.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />
          </div>
          <div className="col-6 col-md-3">
            <ColorField id="tpl-card" label={t('tpl.design.cardColor')} value={schema.cardColor} onChange={(v) => set({ cardColor: v })} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label" htmlFor="tpl-font">
              {t('tpl.design.font')}
            </label>
            <select id="tpl-font" className="form-select" value={schema.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {EMAIL_SAFE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
            <p className="form-text mb-0">{t('tpl.design.fontHelp')}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.footer')}</h4>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">{t('tpl.design.footerText')}</label>
            <input type="text" className="form-control" value={schema.footerText} onChange={(e) => set({ footerText: e.target.value })} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">{t('tpl.design.contactDetails')}</label>
            <input type="text" className="form-control" value={schema.contactDetails} onChange={(e) => set({ contactDetails: e.target.value })} />
          </div>

          <div className="col-12">
            <label className="form-label d-block">{t('tpl.design.socialLinks')}</label>
            {(schema.socialLinks || []).map((link, index) => (
              <div key={index} className="mw-row mb-2">
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: 160 }}
                  value={link.platform}
                  onChange={(e) => setSocialLink(index, { platform: e.target.value })}
                  placeholder={t('tpl.design.platformPlaceholder')}
                />
                <input
                  type="text"
                  className="form-control"
                  value={link.url}
                  onChange={(e) => setSocialLink(index, { url: e.target.value })}
                  placeholder="https://…"
                />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeSocialLink(index)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addSocialLink}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addSocialLink')}
            </button>
          </div>

          <div className="col-12">
            <label className="form-label">{t('tpl.design.unsubscribeText')}</label>
            <input
              type="text"
              className="form-control"
              value={schema.unsubscribeText}
              onChange={(e) => set({ unsubscribeText: e.target.value })}
            />
            <p className="form-text mb-0">{t('tpl.design.unsubscribeHelp')}</p>
          </div>
        </div>
      </div>

      <Sheet open={Boolean(pickerFor)} title={t('img.title')} onClose={() => setPickerFor(null)}>
        <ImageLibrary onPick={handlePicked} />
      </Sheet>
    </fieldset>
  );
}

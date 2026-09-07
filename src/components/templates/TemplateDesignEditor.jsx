import { useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import Sheet from '../ui/Sheet';
import ImageLibrary from './ImageLibrary';
import DynamicFieldPicker from './DynamicFieldPicker';
import { newBlock, SOCIAL_PLATFORMS } from '../../data/templateBuilder';
import { apiBase } from '../../api/client';

/**
 * "Design" tab — TemplateEditorPage ke content_schema ko form fields ki
 * tarah edit karta hai. Kabhi raw HTML nahi dikhata; parent (TemplateEditorPage)
 * har change par renderTemplateHtml(schema) chala kar HTML khud bana leta hai.
 * Default (master) templates bhi yahan se seedha edit hoti hain — is
 * component ko yeh jaanne ki zarurat nahi ki template default hai ya nahi.
 *
 * Style (colour/font) controls jaan-boojh kar yahan nahi hain — font hamesha
 * Arial hai, colors template ke saath pehle se set hain. Client sirf content
 * likhta hai, technical styling se nahi ulajhta.
 */
export default function TemplateDesignEditor({ schema, onChange, dynamicFields }) {
  const t = useT();
  const [pickerFor, setPickerFor] = useState(null); // 'logo' | { blockIndex }

  const headingRef = useRef(null);
  const blockRefs = useRef([]);
  const footerTextRefs = useRef([]);

  function set(patch) {
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

  // --- footer text lines -----------------------------------------------------
  function addFooterText() {
    set({ footerTexts: [...(schema.footerTexts || []), ''] });
  }

  function setFooterText(index, next) {
    const footerTexts = (schema.footerTexts || []).map((text, i) => (i === index ? next : text));
    set({ footerTexts });
  }

  function removeFooterText(index) {
    set({ footerTexts: (schema.footerTexts || []).filter((_, i) => i !== index) });
  }

  // --- mobile numbers ----------------------------------------------------------
  function addMobileNumber() {
    set({ mobileNumbers: [...(schema.mobileNumbers || []), ''] });
  }

  function setMobileNumber(index, next) {
    const mobileNumbers = (schema.mobileNumbers || []).map((n, i) => (i === index ? next : n));
    set({ mobileNumbers });
  }

  function removeMobileNumber(index) {
    set({ mobileNumbers: (schema.mobileNumbers || []).filter((_, i) => i !== index) });
  }

  // --- custom links --------------------------------------------------------
  function addCustomLink() {
    set({ customLinks: [...(schema.customLinks || []), { label: '', url: '' }] });
  }

  function setCustomLink(index, patch) {
    const customLinks = (schema.customLinks || []).map((link, i) => (i === index ? { ...link, ...patch } : link));
    set({ customLinks });
  }

  function removeCustomLink(index) {
    set({ customLinks: (schema.customLinks || []).filter((_, i) => i !== index) });
  }

  // --- social links --------------------------------------------------------
  function addSocialLink() {
    const platform = SOCIAL_PLATFORMS[0];
    set({
      socialLinks: [
        ...(schema.socialLinks || []),
        { platform: platform.id, url: '' },
      ],
    });
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
    <div className="mw-stack">
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
        <div className="mw-row justify-content-between align-items-center mb-2">
          <h4 className="mw-fs-14 mw-fw-700 mb-0">{t('tpl.design.heading')}</h4>
          <DynamicFieldPicker
            fields={dynamicFields}
            getField={() => headingRef.current}
            value={schema.heading}
            onChange={(next) => set({ heading: next })}
          />
        </div>
        <input
          ref={headingRef}
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
                {block.type === 'paragraph' ? (
                  <DynamicFieldPicker
                    fields={dynamicFields}
                    getField={() => blockRefs.current[index]}
                    value={block.text}
                    onChange={(next) => setBlock(index, { text: next })}
                  />
                ) : null}
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
                  ref={(el) => (blockRefs.current[index] = el)}
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
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.footer')}</h4>
        <div className="mw-stack--sm d-flex flex-column">
          <div>
            <label className="form-label d-block">{t('tpl.design.footerText')}</label>
            {(schema.footerTexts || []).map((text, index) => (
              <div key={index} className="mw-row mb-2">
                <input
                  ref={(el) => (footerTextRefs.current[index] = el)}
                  type="text"
                  className="form-control"
                  value={text}
                  onChange={(e) => setFooterText(index, e.target.value)}
                  placeholder={t('tpl.design.footerTextPlaceholder')}
                />
                <DynamicFieldPicker
                  fields={dynamicFields}
                  getField={() => footerTextRefs.current[index]}
                  value={text}
                  onChange={(next) => setFooterText(index, next)}
                />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeFooterText(index)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addFooterText}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addFooterText')}
            </button>
          </div>

          <div>
            <label className="form-label d-block">{t('tpl.design.mobileNumbers')}</label>
            {(schema.mobileNumbers || []).map((number, index) => (
              <div key={index} className="mw-row mb-2">
                <input
                  type="tel"
                  className="form-control"
                  value={number}
                  onChange={(e) => setMobileNumber(index, e.target.value)}
                  placeholder={t('tpl.design.mobileNumberPlaceholder')}
                  style={{ maxWidth: 260 }}
                />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeMobileNumber(index)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addMobileNumber}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addMobileNumber')}
            </button>
          </div>

          <div>
            <label className="form-label d-block">{t('tpl.design.customLinks')}</label>
            {(schema.customLinks || []).map((link, index) => (
              <div key={index} className="mw-row mb-2">
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: 200 }}
                  value={link.label}
                  onChange={(e) => setCustomLink(index, { label: e.target.value })}
                  placeholder={t('tpl.design.customLinkLabelPlaceholder')}
                />
                <input
                  type="text"
                  className="form-control"
                  value={link.url}
                  onChange={(e) => setCustomLink(index, { url: e.target.value })}
                  placeholder="https://example.com/privacy-policy"
                />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeCustomLink(index)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={addCustomLink}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addCustomLink')}
            </button>
          </div>

          <div>
            <label className="form-label d-block">{t('tpl.design.socialLinks')}</label>
            {(schema.socialLinks || []).map((link, index) => (
              <div key={index} className="mw-row mb-2">
                <select
                  className="form-select"
                  style={{ maxWidth: 180 }}
                  value={link.platform}
                  onChange={(e) => setSocialLink(index, { platform: e.target.value })}
                >
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                <img
                  src={`${apiBase}/social-icons/${link.platform}.png`}
                  alt=""
                  width="24"
                  height="24"
                  style={{ borderRadius: 6 }}
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

          <div>
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
    </div>
  );
}

import { useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import Sheet from '../ui/Sheet';
import ImageLibrary from './ImageLibrary';
import RichTextEditor from './RichTextEditor';
import DynamicFieldPicker from './DynamicFieldPicker';
import {
  SOCIAL_PLATFORMS,
  allTemplateFieldKeys,
  newCustomLinkItem,
  newFooterTextItem,
  newMobileNumberItem,
  newSocialLinkItem,
  newTemplateField,
  rekeySocialLinkForPlatform,
} from '../../data/templateBuilder';
import { uniqueFieldKey } from '../../data/dynamicFields';

/**
 * "Design" tab — TemplateEditorPage ke content_schema ko form fields ki
 * tarah edit karta hai (WordPress ACF jaisa). Kabhi raw HTML nahi dikhata,
 * aur kabhi html ko chhoota bhi nahi — yeh sirf DATA (schema) edit karta
 * hai. Client khud Code tab me decide karta hai ki har field/link ka
 * {{key}} kahan rakhna hai. Default (master) templates bhi yahan se seedha
 * edit hoti hain — is component ko yeh jaanne ki zarurat nahi ki template
 * default hai ya nahi.
 *
 * Har field/link (Heading, Text, Image, Button, Footer Text, Mobile Number,
 * Custom Link, Social Link) ki apni friendly label + auto-generated {{key}}
 * hoti hai — Code tab me isi key se insert hoti hai. Style (colour/font)
 * controls jaan-boojh kar yahan nahi hain — font hamesha Arial hai, colors
 * template ke saath pehle se set hain.
 */
export default function TemplateDesignEditor({ schema, onChange, dynamicFields, ownFieldKeys }) {
  const t = useT();
  const [pickerFor, setPickerFor] = useState(null); // 'logo' | { fieldId }
  const headingRefs = useRef({});
  const websiteRef = useRef(null);
  const footerTextRefs = useRef([]);

  function set(patch) {
    onChange({ ...schema, ...patch });
  }

  function setField(id, patch) {
    const fields = schema.fields.map((field) => (field.id === id ? { ...field, ...patch } : field));
    set({ fields });
  }

  function addField(type, label) {
    const existingKeys = allTemplateFieldKeys(schema).concat(ownFieldKeys || []);
    set({ fields: [...(schema.fields || []), newTemplateField(type, label, existingKeys)] });
  }

  function removeField(id) {
    set({ fields: schema.fields.filter((f) => f.id !== id) });
  }

  /**
   * Jab tak client is field se pehli baar "bahar" (blur) na jaaye, label
   * type karte hi uski {{key}} bhi saath-saath sahi ban-ti rehti hai — isliye
   * "+ Add Heading" karke turant "Heading Two" likhne par key seedha
   * {{heading_two}} banti hai, {{heading_2}} nahi. Blur hote hi key hamesha
   * ke liye lock ho jaati hai — us baad rename karne se key kabhi nahi badalti.
   */
  function setFieldLabel(field, label) {
    if (field.keyLocked) {
      setField(field.id, { label });
      return;
    }
    const existingKeys = allTemplateFieldKeys(schema)
      .filter((key) => key !== field.key)
      .concat(ownFieldKeys || []);
    setField(field.id, { label, key: uniqueFieldKey(label, existingKeys) });
  }

  function lockFieldKey(field) {
    if (!field.keyLocked) setField(field.id, { keyLocked: true });
  }

  function moveField(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= schema.fields.length) return;
    const fields = [...schema.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    set({ fields });
  }

  function newItemExistingKeys() {
    return allTemplateFieldKeys(schema).concat(ownFieldKeys || []);
  }

  // --- footer text lines -----------------------------------------------------
  function addFooterText() {
    set({ footerTexts: [...(schema.footerTexts || []), newFooterTextItem(newItemExistingKeys())] });
  }

  function setFooterText(id, next) {
    set({ footerTexts: (schema.footerTexts || []).map((item) => (item.id === id ? { ...item, value: next } : item)) });
  }

  function removeFooterText(id) {
    set({ footerTexts: (schema.footerTexts || []).filter((item) => item.id !== id) });
  }

  // --- mobile numbers ----------------------------------------------------------
  function addMobileNumber() {
    set({ mobileNumbers: [...(schema.mobileNumbers || []), newMobileNumberItem(newItemExistingKeys())] });
  }

  function setMobileNumber(id, next) {
    set({ mobileNumbers: (schema.mobileNumbers || []).map((item) => (item.id === id ? { ...item, value: next } : item)) });
  }

  function removeMobileNumber(id) {
    set({ mobileNumbers: (schema.mobileNumbers || []).filter((item) => item.id !== id) });
  }

  // --- custom links --------------------------------------------------------
  function addCustomLink() {
    set({ customLinks: [...(schema.customLinks || []), newCustomLinkItem(newItemExistingKeys())] });
  }

  function setCustomLink(id, patch) {
    set({ customLinks: (schema.customLinks || []).map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }

  function removeCustomLink(id) {
    set({ customLinks: (schema.customLinks || []).filter((item) => item.id !== id) });
  }

  /** Custom link ki key bhi content field jaisi hi hai — label ke saath live badalti hai jab tak pehli baar blur na ho. */
  function setCustomLinkLabel(item, label) {
    if (item.keyLocked) {
      setCustomLink(item.id, { label });
      return;
    }
    const existingKeys = allTemplateFieldKeys(schema)
      .filter((key) => key !== item.key)
      .concat(ownFieldKeys || []);
    setCustomLink(item.id, { label, key: uniqueFieldKey(label, existingKeys) });
  }

  function lockCustomLinkKey(item) {
    if (!item.keyLocked) setCustomLink(item.id, { keyLocked: true });
  }

  // --- social links (text label + URL only — no icon images) -----------------
  function addSocialLink() {
    set({ socialLinks: [...(schema.socialLinks || []), newSocialLinkItem(newItemExistingKeys())] });
  }

  function setSocialLink(id, patch) {
    set({ socialLinks: (schema.socialLinks || []).map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }

  function removeSocialLink(id) {
    set({ socialLinks: (schema.socialLinks || []).filter((item) => item.id !== id) });
  }

  /** Platform badalte hi key turant naye platform ke naam se dobara ban jaati hai — ismein "lock until blur" ki zaroorat nahi (dropdown ek discrete choice hai). */
  function setSocialLinkPlatform(item, platformId) {
    const existingKeys = allTemplateFieldKeys(schema)
      .filter((key) => key !== item.key)
      .concat(ownFieldKeys || []);
    setSocialLink(item.id, rekeySocialLinkForPlatform(platformId, existingKeys));
  }

  function handlePicked(url) {
    if (pickerFor === 'logo') set({ logoUrl: url });
    else if (pickerFor && typeof pickerFor === 'object') setField(pickerFor.fieldId, { url });
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
            <span className="mw-fs-12 mw-text-muted mw-mono">{'{{brand_name}}'}</span>
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
            <span className="mw-fs-12 mw-text-muted mw-mono">{'{{logo_url}}'}</span>
            <p className="form-text mb-0">{t('tpl.design.logoHelp')}</p>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">{t('tpl.design.websiteUrl')}</label>
            <input
              ref={websiteRef}
              type="text"
              className="form-control"
              value={schema.websiteUrl}
              onChange={(e) => set({ websiteUrl: e.target.value })}
              placeholder="https://example.com"
            />
            <span className="mw-fs-12 mw-text-muted mw-mono">{'{{website_url}}'}</span>
            <p className="form-text mb-0">{t('tpl.design.websiteUrlHelp')}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mw-fs-14 mw-fw-700 mb-2">{t('tpl.design.content')}</h4>
        <div className="mw-stack--sm d-flex flex-column">
          {(schema.fields || []).map((field, index) => (
            <div key={field.id} className="p-3" style={{ border: '1px solid var(--mw-border, #e5e7eb)', borderRadius: 8 }}>
              <div className="mw-row mb-2 align-items-center">
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control form-control-sm mb-1"
                    value={field.label}
                    onChange={(e) => setFieldLabel(field, e.target.value)}
                    onBlur={() => lockFieldKey(field)}
                    aria-label={t('tpl.design.fieldLabel')}
                  />
                  <span className="mw-fs-12 mw-text-muted mw-mono">{`{{${field.key}}}`}</span>
                </div>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => moveField(index, -1)} disabled={index === 0}>
                  <i className="bi bi-arrow-up" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => moveField(index, 1)}
                  disabled={index === schema.fields.length - 1}
                >
                  <i className="bi bi-arrow-down" />
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeField(field.id)}>
                  <i className="bi bi-trash3" />
                </button>
              </div>

              {field.type === 'heading' ? (
                <>
                  <div className="d-flex justify-content-end mb-1">
                    <DynamicFieldPicker
                      fields={dynamicFields}
                      getField={() => headingRefs.current[field.id]}
                      value={field.value}
                      onChange={(next) => setField(field.id, { value: next })}
                    />
                  </div>
                  <input
                    ref={(el) => (headingRefs.current[field.id] = el)}
                    type="text"
                    className="form-control"
                    value={field.value}
                    onChange={(e) => setField(field.id, { value: e.target.value })}
                    placeholder={t('tpl.design.headingPlaceholder')}
                  />
                </>
              ) : null}

              {field.type === 'richtext' ? (
                <RichTextEditor
                  value={field.value}
                  onChange={(next) => setField(field.id, { value: next })}
                  dynamicFields={dynamicFields}
                  placeholder={t('tpl.design.paragraphPlaceholder')}
                />
              ) : null}

              {field.type === 'image' ? (
                <div className="row g-2">
                  <div className="col-12">
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={field.url}
                        onChange={(e) => setField(field.id, { url: e.target.value })}
                        placeholder={t('tpl.design.logoPlaceholder')}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setPickerFor({ fieldId: field.id })}
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
                      value={field.alt}
                      onChange={(e) => setField(field.id, { alt: e.target.value })}
                      placeholder={t('tpl.design.altPlaceholder')}
                    />
                  </div>
                </div>
              ) : null}

              {field.type === 'button' ? (
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <input
                      type="text"
                      className="form-control"
                      value={field.buttonLabel}
                      onChange={(e) => setField(field.id, { buttonLabel: e.target.value })}
                      placeholder={t('tpl.design.buttonLabelPlaceholder')}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <input
                      type="text"
                      className="form-control"
                      value={field.buttonUrl}
                      onChange={(e) => setField(field.id, { buttonUrl: e.target.value })}
                      placeholder="{{subscribe_url}}"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <div className="mw-row mw-row--wrap">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addField('heading', 'Heading')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addHeadingField')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addField('richtext', 'Text')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addTextField')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addField('image', 'Image')}>
              <i className="bi bi-plus-lg me-1" />
              {t('tpl.design.addImage')}
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addField('button', 'Button')}>
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
            <p className="mw-fs-12 mw-text-muted mb-2">{t('tpl.design.footerTextHelp')}</p>
            {(schema.footerTexts || []).map((item, index) => (
              <div key={item.id} className="mw-row mb-2">
                <div className="flex-grow-1">
                  <input
                    ref={(el) => (footerTextRefs.current[index] = el)}
                    type="text"
                    className="form-control"
                    value={item.value}
                    onChange={(e) => setFooterText(item.id, e.target.value)}
                    placeholder={t('tpl.design.footerTextPlaceholder')}
                  />
                  <span className="mw-fs-12 mw-text-muted mw-mono">{`{{${item.key}}}`}</span>
                </div>
                <DynamicFieldPicker
                  fields={dynamicFields}
                  getField={() => footerTextRefs.current[index]}
                  value={item.value}
                  onChange={(next) => setFooterText(item.id, next)}
                />
                <button type="button" className="btn btn-outline-danger" onClick={() => removeFooterText(item.id)}>
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
            <p className="mw-fs-12 mw-text-muted mb-2">{t('tpl.design.mobileNumbersHelp')}</p>
            {(schema.mobileNumbers || []).map((item) => (
              <div key={item.id} className="mw-row mb-2">
                <div>
                  <input
                    type="tel"
                    className="form-control"
                    value={item.value}
                    onChange={(e) => setMobileNumber(item.id, e.target.value)}
                    placeholder={t('tpl.design.mobileNumberPlaceholder')}
                    style={{ maxWidth: 260 }}
                  />
                  <span className="mw-fs-12 mw-text-muted mw-mono">{`{{${item.key}}}`}</span>
                </div>
                <button type="button" className="btn btn-outline-danger" onClick={() => removeMobileNumber(item.id)}>
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
            <p className="mw-fs-12 mw-text-muted mb-2">{t('tpl.design.customLinksHelp')}</p>
            {(schema.customLinks || []).map((item) => (
              <div key={item.id} className="mw-row mb-2">
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: 200 }}
                  value={item.label}
                  onChange={(e) => setCustomLinkLabel(item, e.target.value)}
                  onBlur={() => lockCustomLinkKey(item)}
                  placeholder={t('tpl.design.customLinkLabelPlaceholder')}
                />
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control"
                    value={item.url}
                    onChange={(e) => setCustomLink(item.id, { url: e.target.value })}
                    placeholder="https://example.com/privacy-policy"
                  />
                  <span className="mw-fs-12 mw-text-muted mw-mono">{`{{${item.key}}}`}</span>
                </div>
                <button type="button" className="btn btn-outline-danger" onClick={() => removeCustomLink(item.id)}>
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
            <p className="mw-fs-12 mw-text-muted mb-2">{t('tpl.design.socialLinksHelp')}</p>
            {(schema.socialLinks || []).map((item) => (
              <div key={item.id} className="mw-row mb-2">
                <select
                  className="form-select"
                  style={{ maxWidth: 180 }}
                  value={item.platform}
                  onChange={(e) => setSocialLinkPlatform(item, e.target.value)}
                >
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                <div className="flex-grow-1">
                  <input
                    type="text"
                    className="form-control"
                    value={item.url}
                    onChange={(e) => setSocialLink(item.id, { url: e.target.value })}
                    placeholder="https://…"
                  />
                  <span className="mw-fs-12 mw-text-muted mw-mono">{`{{${item.key}}}`}</span>
                </div>
                <button type="button" className="btn btn-outline-danger" onClick={() => removeSocialLink(item.id)}>
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
            <span className="mw-fs-12 mw-text-muted mw-mono">{'{{unsubscribe_text}}'}</span>
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

import { useState } from 'react';

import Sheet from '../../ui/Sheet';
import ImageLibrary from '../ImageLibrary';
import RichTextEditor from '../RichTextEditor';
import DynamicFieldPicker from '../DynamicFieldPicker';
import { SOCIAL_PLATFORMS } from '../../../data/templateBuilder';
import { useT } from '../../../i18n/I18nProvider';

const ALIGN_OPTIONS = ['left', 'center', 'right'];

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function AlignField({ t, value, onChange }) {
  return (
    <Field label={t('tpl.builder.field.align')}>
      <select className="form-select" value={value || 'left'} onChange={(e) => onChange(e.target.value)}>
        {ALIGN_OPTIONS.map((a) => (
          <option key={a} value={a}>
            {t(`tpl.builder.field.align${a[0].toUpperCase()}${a.slice(1)}`)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ImagePickerField({ t, label, url, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label}>
      <div className="mw-row">
        <input type="text" className="form-control" value={url || ''} readOnly placeholder={t('tpl.builder.field.chooseImage')} />
        <button type="button" className="btn btn-outline-secondary mw-nowrap" onClick={() => setOpen(true)}>
          {t('tpl.builder.field.chooseImage')}
        </button>
      </div>
      <Sheet open={open} title={t('img.title')} onClose={() => setOpen(false)}>
        <ImageLibrary
          onPick={(pickedUrl) => {
            onPick(pickedUrl);
            setOpen(false);
          }}
        />
      </Sheet>
    </Field>
  );
}

/**
 * Right-hand settings panel — `block.type` ke hisaab se sahi fields dikhata
 * hai. Sirf `onChange(patch)` call karta hai; block-tree ke andar kahan hai
 * yeh isse pata nahi hota (parent, TemplateBuilderPage, wo mapping sambhalta
 * hai) — isliye ek hi component har block type ke liye reuse ho jaata hai.
 */
export default function BuilderBlockSettings({ block, onChange, dynamicFields, open, onClose }) {
  const t = useT();
  if (!block) return null;

  function set(patch) {
    onChange({ ...block, ...patch });
  }

  function addSocialItem() {
    set({ items: [...(block.items || []), { platform: SOCIAL_PLATFORMS[0].id, url: '' }] });
  }

  function setSocialItem(index, patch) {
    const items = block.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    set({ items });
  }

  function removeSocialItem(index) {
    set({ items: block.items.filter((_, i) => i !== index) });
  }

  return (
    <Sheet open={open} title={t('tpl.builder.blockSettings')} onClose={onClose} wide>
      {block.type === 'heading' ? (
        <>
          <Field label={t('tpl.builder.field.text')}>
            <input type="text" className="form-control" value={block.text || ''} onChange={(e) => set({ text: e.target.value })} />
            <div className="mt-1">
              <DynamicFieldPicker fields={dynamicFields} getField={() => null} value="" onChange={(v) => set({ text: (block.text || '') + v.trim() })} className="form-select form-select-sm" ariaLabel={t('dyn.insertField')} />
            </div>
          </Field>
          <Field label={t('tpl.builder.field.level')}>
            <select className="form-select" value={block.level || 'h1'} onChange={(e) => set({ level: e.target.value })}>
              <option value="h1">{t('tpl.builder.field.levelLarge')}</option>
              <option value="h2">{t('tpl.builder.field.levelSmall')}</option>
            </select>
          </Field>
          <AlignField t={t} value={block.align} onChange={(align) => set({ align })} />
          <Field label={t('tpl.builder.field.color')}>
            <input type="color" className="form-control form-control-color" value={block.color || '#111827'} onChange={(e) => set({ color: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.fontSize')}>
            <input type="number" className="form-control" min="10" max="60" value={block.fontSize || 22} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </Field>
        </>
      ) : null}

      {block.type === 'text' ? (
        <Field label={t('tpl.builder.field.text')}>
          <RichTextEditor value={block.html} onChange={(html) => set({ html })} dynamicFields={dynamicFields} />
        </Field>
      ) : null}

      {block.type === 'image' ? (
        <>
          <ImagePickerField t={t} label={t('tpl.builder.field.image')} url={block.url} onPick={(url) => set({ url })} />
          <Field label={t('tpl.builder.field.alt')}>
            <input type="text" className="form-control" value={block.alt || ''} onChange={(e) => set({ alt: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.url')}>
            <input type="text" className="form-control" value={block.link || ''} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label={t('tpl.builder.field.width')}>
            <input type="number" className="form-control" min="20" max="600" value={block.width || 536} onChange={(e) => set({ width: Number(e.target.value) })} />
          </Field>
          <AlignField t={t} value={block.align} onChange={(align) => set({ align })} />
        </>
      ) : null}

      {block.type === 'button' ? (
        <>
          <Field label={t('tpl.builder.field.label')}>
            <input type="text" className="form-control" value={block.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.url')}>
            <input type="text" className="form-control" value={block.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
          <AlignField t={t} value={block.align} onChange={(align) => set({ align })} />
          <Field label={t('tpl.builder.field.bgColor')}>
            <input type="color" className="form-control form-control-color" value={block.bgColor || '#4f46e5'} onChange={(e) => set({ bgColor: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.color')}>
            <input type="color" className="form-control form-control-color" value={block.textColor || '#ffffff'} onChange={(e) => set({ textColor: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.fontSize')}>
            <input type="number" className="form-control" min="10" max="30" value={block.fontSize || 15} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </Field>
        </>
      ) : null}

      {block.type === 'divider' ? (
        <>
          <Field label={t('tpl.builder.field.color')}>
            <input type="color" className="form-control form-control-color" value={block.color || '#e5e7eb'} onChange={(e) => set({ color: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.thickness')}>
            <input type="number" className="form-control" min="1" max="10" value={block.thickness || 1} onChange={(e) => set({ thickness: Number(e.target.value) })} />
          </Field>
        </>
      ) : null}

      {block.type === 'spacer' ? (
        <Field label={t('tpl.builder.field.height')}>
          <input type="number" className="form-control" min="4" max="200" value={block.height || 24} onChange={(e) => set({ height: Number(e.target.value) })} />
        </Field>
      ) : null}

      {block.type === 'logo' ? (
        <>
          <ImagePickerField t={t} label={t('tpl.builder.field.image')} url={block.url} onPick={(url) => set({ url })} />
          <Field label={t('tpl.builder.field.alt')}>
            <input type="text" className="form-control" value={block.alt || ''} onChange={(e) => set({ alt: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.url')}>
            <input type="text" className="form-control" value={block.link || ''} onChange={(e) => set({ link: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label={t('tpl.builder.field.height')}>
            <input type="number" className="form-control" min="16" max="120" value={block.height || 36} onChange={(e) => set({ height: Number(e.target.value) })} />
          </Field>
        </>
      ) : null}

      {block.type === 'social' ? (
        <Field label={t('tpl.builder.field.socialLinks')}>
          {(block.items || []).map((item, index) => (
            <div key={index} className="mw-row mb-2">
              <select className="form-select" value={item.platform} onChange={(e) => setSocialItem(index, { platform: e.target.value })}>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input type="text" className="form-control" value={item.url} onChange={(e) => setSocialItem(index, { url: e.target.value })} placeholder="https://…" />
              <button type="button" className="btn btn-outline-danger" onClick={() => removeSocialItem(index)} aria-label={t('common.delete')}>
                <i className="bi bi-trash3" />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={addSocialItem}>
            {t('tpl.builder.field.addSocialLink')}
          </button>
        </Field>
      ) : null}

      {block.type === 'websiteLink' ? (
        <>
          <Field label={t('tpl.builder.field.label')}>
            <input type="text" className="form-control" value={block.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.url')}>
            <input type="text" className="form-control" value={block.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
        </>
      ) : null}

      {block.type === 'phone' ? (
        <>
          <Field label={t('tpl.builder.field.label')}>
            <input type="text" className="form-control" value={block.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Phone number">
            <input type="text" className="form-control" value={block.value || ''} onChange={(e) => set({ value: e.target.value })} placeholder="+91 98765 43210" />
          </Field>
        </>
      ) : null}

      {block.type === 'customLink' ? (
        <>
          <Field label={t('tpl.builder.field.label')}>
            <input type="text" className="form-control" value={block.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label={t('tpl.builder.field.url')}>
            <input type="text" className="form-control" value={block.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
          </Field>
        </>
      ) : null}

      {block.type === 'footerText' ? (
        <Field label={t('tpl.builder.field.text')}>
          <input type="text" className="form-control" value={block.text || ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      ) : null}

      {block.type === 'unsubscribe' ? (
        <>
          <Field label={t('tpl.builder.field.label')}>
            <input type="text" className="form-control" value={block.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <p className="mw-fs-12 mw-text-muted">{t('tpl.builder.field.unsubscribeNote')}</p>
        </>
      ) : null}
    </Sheet>
  );
}

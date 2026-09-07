import { useT } from '../../i18n/I18nProvider';

/**
 * "Insert Dynamic Field ▾" — client kabhi {{key}} nahi likhta, sirf apni
 * friendly label chunta hai (jaise WordPress custom fields). Chunte hi
 * `{{key}}` us field ke cursor position par apne aap jud jaata hai.
 *
 * `getField()` us <input>/<textarea> ka DOM node lautata hai jisme insert
 * karna hai — TemplateEditorPage ke insertAtCursor() jaisa hi splice-at-
 * cursor tareeka. Function ke roop me isliye ki dynamic list (blocks, footer
 * lines) ke refs render ke DAURAAN nahi, sirf click hote hi padhe jaayein.
 */
export default function DynamicFieldPicker({ fields, getField, value, onChange, className, ariaLabel }) {
  const t = useT();

  function handleSelect(event) {
    const key = event.target.value;
    event.target.value = '';
    if (!key) return;

    const token = `{{${key}}}`;
    const current = value ?? '';
    const field = getField?.();

    if (!field) {
      onChange(current + token);
      return;
    }

    const start = field.selectionStart ?? current.length;
    const end = field.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      field.focus();
      field.selectionStart = start + token.length;
      field.selectionEnd = start + token.length;
    });
  }

  return (
    <select
      className={className || 'form-select form-select-sm mw-dynfield-picker'}
      value=""
      onChange={handleSelect}
      aria-label={ariaLabel || t('dyn.insertField')}
    >
      <option value="">{t('dyn.insertField')}</option>
      {fields.map((field) => (
        <option key={field.key} value={field.key}>
          {field.label}
        </option>
      ))}
    </select>
  );
}

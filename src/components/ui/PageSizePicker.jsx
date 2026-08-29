import { useT } from '../../i18n/I18nProvider';

/**
 * "Kitni rows dikhani hain" wala dropdown — filter ke bagal me, upar.
 *
 * Niche wale pager me bhi ek hai, par upar hona zyada kaam ka hai: pehle size
 * chuno, phir list dekho. Niche jane ki zarurat hi na pade.
 *
 * 500 ke aage nahi jate — usse zyada rows ek saath dikhane par browser slow ho
 * jata hai, aur "sab chuno" ka button waise bhi poori list uthata hai.
 */
export const PAGE_SIZES = [25, 50, 100, 200, 250, 300, 400, 500];

export default function PageSizePicker({ value, onChange, options = PAGE_SIZES, className = '' }) {
  const t = useT();

  return (
    <label className={`mw-pagesize ${className}`.trim()}>
      <span className="visually-hidden">{t('page.perPage')}</span>
      <select
        className="form-select"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={t('page.perPage')}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {t('page.showRows', { count: option })}
          </option>
        ))}
      </select>
    </label>
  );
}

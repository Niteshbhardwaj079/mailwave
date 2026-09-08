import { useCallback, useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { useClickOutside } from '../../utils/useClickOutside';
import { LABEL_KEY, TEMPLATE_SOURCE_ORDER } from './TemplateSourceBadge';

/**
 * "Template Type" multi-select checkbox filter — sirf filtering/display ke
 * liye, kisi template ko kabhi delete/modify/source-change nahi karta.
 *
 * `enabledSources` — Settings me abhi allowed sources (order preserved,
 * TEMPLATE_SOURCE_ORDER ke hisaab se) — disabled source is dropdown me option
 * ke roop me dikhta hi nahi ("Source dropdown se inaccessible").
 *
 * Koi selection nahi (`selected.length === 0`) = "sab enabled sources
 * dikhao" — yehi default state hai, jab tak user khud kuch check na kare.
 */
export default function TemplateTypeDropdown({ enabledSources, selected, onChange }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, useCallback(() => setOpen(false), []), open);

  function toggle() {
    setOpen((current) => !current);
  }

  function toggleSource(source) {
    const next = selected.includes(source) ? selected.filter((s) => s !== source) : [...selected, source];
    onChange(next);
  }

  const orderedEnabled = TEMPLATE_SOURCE_ORDER.filter((source) => enabledSources.includes(source));
  const triggerText = selected.length > 0 ? t('tpl.typeFilter.nSelected', { n: selected.length }) : t('tpl.typeFilter.allLabel');

  return (
    <div className="mw-filter mw-typefilter" ref={wrapRef}>
      <label className="mw-filter__label" htmlFor="tpl-type-filter-btn">
        <i className="bi bi-funnel" aria-hidden="true" />
        {t('tpl.typeFilter.label')}
      </label>
      <button
        type="button"
        id="tpl-type-filter-btn"
        className="form-select mw-filter__select mw-typefilter__btn"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="mw-typefilter__btntext">{triggerText}</span>
      </button>

      {open ? (
        <div className="mw-typefilter__menu" role="dialog" aria-label={t('tpl.typeFilter.label')}>
          {orderedEnabled.map((source) => (
            <label key={source} className="mw-typefilter__item">
              <input
                type="checkbox"
                className="form-check-input"
                checked={selected.includes(source)}
                onChange={() => toggleSource(source)}
              />
              <span>{t(LABEL_KEY[source])}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

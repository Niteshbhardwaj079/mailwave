import { useCallback, useMemo, useRef, useState } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import { useClickOutside } from '../../utils/useClickOutside';

export default function LanguagePicker() {
  const { t, language, languages, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, useCallback(() => setOpen(false), []), open);

  function toggle() {
    setOpen((current) => !current);
    setQuery('');
  }

  function handleQuery(event) {
    setQuery(event.target.value);
  }

  function choose(event) {
    setLanguage(event.currentTarget.dataset.code);
    setOpen(false);
  }

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return languages;
    return languages.filter(
      (item) =>
        item.native.toLowerCase().includes(text) ||
        item.english.toLowerCase().includes(text) ||
        item.code.includes(text)
    );
  }, [languages, query]);

  return (
    <div className="position-relative" ref={wrapRef}>
      <button
        type="button"
        className="mw-langbtn"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t('topbar.language')}
      >
        <span className="mw-langbtn__flag" aria-hidden="true">
          {language.flag}
        </span>
        <span className="mw-hide-mobile">{language.native}</span>
        <i className="bi bi-chevron-down mw-fs-11" aria-hidden="true" />
      </button>

      {open ? (
        <div className="mw-langmenu" role="dialog" aria-label={t('topbar.language')}>
          <div className="mw-langmenu__search">
            <div className="mw-search">
              <i className="bi bi-search mw-search__icon" aria-hidden="true" />
              <input
                type="search"
                className="mw-search__input"
                value={query}
                onChange={handleQuery}
                placeholder={t('topbar.searchLanguage')}
                aria-label={t('topbar.searchLanguage')}
              />
            </div>
          </div>

          <div className="mw-langmenu__list">
            {visible.map((item) => (
              <button
                key={item.code}
                type="button"
                data-code={item.code}
                onClick={choose}
                className={`mw-langmenu__item ${item.code === language.code ? 'is-active' : ''}`.trim()}
              >
                <span className="mw-langbtn__flag" aria-hidden="true">
                  {item.flag}
                </span>
                <span className="flex-grow-1">
                  <span className="d-block mw-langmenu__native">{item.native}</span>
                  <span className="d-block mw-langmenu__english">{item.english}</span>
                </span>
                {item.code === language.code ? (
                  <i className="bi bi-check-lg mw-text-primary" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>

          <p className="mw-langmenu__foot mb-0">{t('set.languageHelp')}</p>
        </div>
      ) : null}
    </div>
  );
}

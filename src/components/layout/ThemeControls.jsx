import { useCallback, useRef, useState } from 'react';

import { useT } from '../../i18n/I18nProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { THEME_MODES } from '../../config/themeColors';
import { useClickOutside } from '../../utils/useClickOutside';

/** Sun / moon button in the top bar. One press flips day and night. */
export function ThemeToggle() {
  const t = useT();
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      className="mw-iconbtn"
      onClick={toggle}
      aria-label={isDark ? t('theme.light') : t('theme.dark')}
      title={isDark ? t('theme.light') : t('theme.dark')}
    >
      <i className={`bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`} />
    </button>
  );
}

/** Paint-drop button that opens the colour list. */
export function AccentPicker() {
  const t = useT();
  const { accent, setAccent, accents, mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, useCallback(() => setOpen(false), []), open);

  function toggleOpen() {
    setOpen((current) => !current);
  }

  function choose(event) {
    setAccent(event.currentTarget.dataset.accent);
    setOpen(false);
  }

  function chooseMode(event) {
    setMode(event.currentTarget.dataset.mode);
  }

  return (
    <div className="position-relative" ref={wrapRef}>
      <button
        type="button"
        className={`mw-iconbtn ${open ? 'is-active' : ''}`.trim()}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={t('theme.colour')}
        title={t('theme.colour')}
      >
        <i className="bi bi-palette" />
      </button>

      {open ? (
        <div className="mw-langmenu mw-langmenu--narrow" role="dialog" aria-label={t('theme.colour')}>
          <div className="mw-langmenu__search">
            <span className="mw-filter__label mb-2">{t('theme.mode')}</span>
            <div className="mw-row mw-row--wrap">
              {THEME_MODES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-mode={item.key}
                  onClick={chooseMode}
                  className={`mw-modebtn ${mode === item.key ? 'is-active' : ''}`.trim()}
                >
                  <i className={`bi ${item.icon}`} aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="mw-langmenu__list">
            <span className="mw-filter__label mb-2 px-2">{t('theme.colour')}</span>
            <div className="mw-accentgrid">
              {accents.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-accent={item.key}
                  onClick={choose}
                  className={`mw-accentdot mw-accentdot--${item.key} ${accent === item.key ? 'is-active' : ''}`.trim()}
                  aria-label={t(item.labelKey)}
                  title={t(item.labelKey)}
                >
                  {accent === item.key ? <i className="bi bi-check-lg" /> : null}
                </button>
              ))}
            </div>
          </div>

          <p className="mw-langmenu__foot mb-0">{t('theme.help')}</p>
        </div>
      ) : null}
    </div>
  );
}

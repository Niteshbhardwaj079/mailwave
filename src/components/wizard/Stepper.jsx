import { Fragment } from 'react';

import { useT } from '../../i18n/I18nProvider';

/**
 * Steps arrive as { key, labelKey } so the wizard that owns them never has to
 * hold translated text itself.
 */
export default function Stepper({ steps, current, onJump, ariaLabel }) {
  const t = useT();

  function handleClick(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (index <= current) onJump(index);
  }

  return (
    <div className="mw-stepper" role="tablist" aria-label={ariaLabel || t('wiz.steps')}>
      {steps.map((step, index) => {
        const state = index === current ? 'is-active' : index < current ? 'is-done' : '';
        return (
          <Fragment key={step.key}>
            {index > 0 ? <span className={`mw-step__line ${index <= current ? 'is-done' : ''}`.trim()} /> : null}
            <button
              type="button"
              className={`mw-step ${state}`.trim()}
              data-index={index}
              onClick={handleClick}
              role="tab"
              aria-selected={index === current}
            >
              <span className="mw-step__num">{index < current ? <i className="bi bi-check-lg" /> : index + 1}</span>
              <span className="mw-step__label">{t(step.labelKey)}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import ProgressBar from '../components/ui/ProgressBar';
import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { onboardingSteps } from '../data/mockData';
import { formatNumber } from '../utils/format';

const STEP_LINKS = {
  welcome: '/',
  connect: '/accounts/connect',
  contacts: '/contacts/import',
  template: '/templates',
  test: '/accounts',
  campaign: '/campaigns/new',
};

export default function OnboardingPage() {
  const t = useT();
  const [done, setDone] = useState(['welcome', 'connect']);

  function toggleStep(event) {
    const { key } = event.currentTarget.dataset;
    setDone((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  const progress = (done.length / onboardingSteps.length) * 100;

  return (
    <div className="mw-stack">
      <PageHeader title={t('ob.title')} subtitle={t('ob.subtitle')} />

      <Card>
        <div className="mw-card__body">
          <div className="mw-row mw-row--between mb-2">
            <span className="mw-fs-14 mw-fw-700">
              {t('ob.progress', { done: done.length, total: onboardingSteps.length })}
            </span>
            <span className="mw-fs-13 mw-text-muted mw-num">{formatNumber(Math.round(progress))}%</span>
          </div>
          <ProgressBar
            value={progress}
            size="lg"
            tone={progress === 100 ? 'success' : 'primary'}
            label={t('ob.progressLabel')}
          />
        </div>
      </Card>

      <div className="mw-stack--sm d-flex flex-column">
        {onboardingSteps.map((step, index) => {
          const complete = done.includes(step.key);
          return (
            <article key={step.key} className={`mw-option ${complete ? 'is-selected' : ''}`.trim()}>
              <span className="mw-option__icon" aria-hidden="true">
                <i className={`bi ${complete ? 'bi-check-lg' : step.icon}`} />
              </span>

              <span className="flex-grow-1">
                <span className="d-block mw-fs-11 mw-fw-700 mw-text-muted-2">
                  {t('ob.stepNumber', { number: index + 1 })}
                </span>
                <span className="d-block mw-option__title">{t(step.titleKey)}</span>
                <span className="d-block mw-option__desc">{t(step.descKey, { app: appConfig.name })}</span>

                <span className="mw-row mw-row--wrap mt-3">
                  <Link to={STEP_LINKS[step.key]} className="btn btn-sm btn-primary">
                    {complete ? t('ob.openAgain') : t('ob.startStep')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    data-key={step.key}
                    onClick={toggleStep}
                  >
                    {complete ? t('ob.markNotDone') : t('ob.markDone')}
                  </button>
                </span>
              </span>
            </article>
          );
        })}
      </div>

      <Note tone="primary" icon="bi-life-preserver">
        {t('ob.helpNote')}
      </Note>
    </div>
  );
}

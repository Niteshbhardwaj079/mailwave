import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Stepper from '../components/wizard/Stepper';
import { providerOptions } from '../data/mockData';

// One question per screen. Every label is a translation key so the whole flow
// follows the chosen language, including the step names in the Stepper.
const SMTP_STEPS = [
  {
    key: 'email',
    labelKey: 'smtp.step.email',
    titleKey: 'smtp.email.title',
    helpKey: 'smtp.email.help',
    type: 'email',
    placeholder: 'courses@yourcompany.com',
  },
  {
    key: 'host',
    labelKey: 'smtp.step.host',
    titleKey: 'smtp.host.title',
    helpKey: 'smtp.host.help',
    type: 'text',
    placeholder: 'smtp.yourprovider.com',
  },
  {
    key: 'port',
    labelKey: 'smtp.step.port',
    titleKey: 'smtp.port.title',
    helpKey: 'smtp.port.help',
    type: 'number',
    placeholder: '587',
  },
  {
    key: 'security',
    labelKey: 'smtp.step.security',
    titleKey: 'smtp.security.title',
    helpKey: 'smtp.security.help',
    type: 'select',
    optionKeys: ['smtp.security.tls', 'smtp.security.ssl', 'smtp.security.none'],
  },
  {
    key: 'username',
    labelKey: 'smtp.step.username',
    titleKey: 'smtp.login.title',
    helpKey: 'smtp.login.help',
    type: 'credentials',
  },
  {
    key: 'test',
    labelKey: 'smtp.step.test',
    titleKey: 'smtp.test.title',
    helpKey: 'smtp.test.help',
    type: 'test',
  },
];

const DEFAULT_SECURITY = 'smtp.security.tls';

export default function ConnectAccountPage() {
  const t = useT();
  const [mode, setMode] = useState('pick');
  const [step, setStep] = useState(0);
  // The security value is stored as a translation key so switching language
  // does not leave an English string selected in the dropdown.
  const [values, setValues] = useState({ security: DEFAULT_SECURITY });
  const navigate = useNavigate();

  function handleProvider(event) {
    const key = event.currentTarget.dataset.key;
    if (key === 'smtp') {
      setMode('smtp');
      setStep(0);
    } else {
      setMode('connected');
    }
  }

  function handleValue(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function goNext() {
    setStep((current) => Math.min(SMTP_STEPS.length - 1, current + 1));
  }

  function goBack() {
    if (step === 0) {
      setMode('pick');
      return;
    }
    setStep((current) => current - 1);
  }

  function finish() {
    navigate('/accounts');
  }

  const breadcrumb = [
    { label: t('acc.title'), to: '/accounts' },
    { label: t('acc.connect') },
  ];

  if (mode === 'connected') {
    return (
      <div className="mw-stack">
        <PageHeader title={t('acc.connected')} breadcrumb={breadcrumb} />
        <Card>
          <div className="mw-card__body text-center py-5">
            <span className="mw-empty__icon mx-auto" aria-hidden="true">
              <i className="bi bi-check-lg" />
            </span>
            <h2 className="mw-fs-20 mw-fw-700 mb-2">
              {t('acc.connectedWho', { email: 'rohit@gowebkart.com' })}
            </h2>
            <p className="mw-fs-14 mw-text-muted mb-4">{t('acc.connectedNote')}</p>
            <div className="mw-row justify-content-center mw-row--wrap">
              <button type="button" className="btn btn-outline-secondary">
                <i className="bi bi-envelope-check me-2" />
                {t('acc.sendTest')}
              </button>
              <button type="button" className="btn btn-primary" onClick={finish}>
                {t('acc.goToAccounts')}
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === 'smtp') {
    const current = SMTP_STEPS[step];
    const title = t(current.titleKey);

    return (
      <div className="mw-stack">
        <PageHeader
          title={t('smtp.title')}
          subtitle={t('smtp.subtitle')}
          breadcrumb={[{ label: t('acc.title'), to: '/accounts' }, { label: t('smtp.title') }]}
        />

        <Card flush>
          <Stepper steps={SMTP_STEPS} current={step} onJump={setStep} ariaLabel={t('smtp.steps')} />

          <div className="mw-card__body">
            <h2 className="mw-fs-20 mw-fw-700 mb-2">{title}</h2>
            <p className="mw-fs-14 mw-text-muted mb-4">{t(current.helpKey)}</p>

            {current.type === 'select' ? (
              <select
                className="form-select form-select-lg"
                name={current.key}
                value={values[current.key] || current.optionKeys[0]}
                onChange={handleValue}
                aria-label={title}
              >
                {current.optionKeys.map((optionKey) => (
                  <option key={optionKey} value={optionKey}>
                    {t(optionKey)}
                  </option>
                ))}
              </select>
            ) : null}

            {current.type === 'credentials' ? (
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="smtp-username">
                    {t('smtp.login.username')}
                  </label>
                  <input
                    id="smtp-username"
                    name="username"
                    type="text"
                    className="form-control form-control-lg"
                    value={values.username || ''}
                    onChange={handleValue}
                    placeholder="courses@yourcompany.com"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="smtp-password">
                    {t('smtp.login.password')}
                  </label>
                  <input
                    id="smtp-password"
                    name="password"
                    type="password"
                    className="form-control form-control-lg"
                    value={values.password || ''}
                    onChange={handleValue}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            ) : null}

            {current.type === 'test' ? (
              <div className="mw-note mw-note--info">
                <i className="bi bi-envelope-check mw-note__icon" aria-hidden="true" />
                <div>
                  {t('smtp.test.note', {
                    email: values.email || t('smtp.test.yourAddress'),
                    host: values.host || t('smtp.test.yourServer'),
                    port: values.port || '587',
                  })}
                </div>
              </div>
            ) : null}

            {['email', 'text', 'number'].includes(current.type) ? (
              <input
                type={current.type}
                name={current.key}
                className="form-control form-control-lg"
                value={values[current.key] || ''}
                onChange={handleValue}
                placeholder={current.placeholder}
                aria-label={title}
              />
            ) : null}

            {current.key === 'username' ? (
              <p className="form-text mt-3 mb-0">{t('smtp.login.note')}</p>
            ) : null}
          </div>

          <div className="mw-wizard-foot">
            <button type="button" className="btn btn-outline-secondary" onClick={goBack}>
              <i className="bi bi-arrow-left me-2" />
              {t('common.back')}
            </button>
            <span className="mw-fs-12 mw-text-muted ms-auto mw-hide-mobile">
              {t('smtp.stepCounter', { current: step + 1, total: SMTP_STEPS.length })}
            </span>
            {step < SMTP_STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary ms-auto ms-md-3" onClick={goNext}>
                {t('common.continue')}
                <i className="bi bi-arrow-right ms-2" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary ms-auto ms-md-3" onClick={finish}>
                <i className="bi bi-send-check me-2" />
                {t('smtp.saveAndTest')}
              </button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('acc.chooseProvider')}
        subtitle={t('acc.chooseProviderSub')}
        helpTopic="connect"
        breadcrumb={breadcrumb}
      />

      <div className="mw-optiongrid">
        {providerOptions.map((provider) => (
          <button key={provider.key} type="button" className="mw-provider" data-key={provider.key} onClick={handleProvider}>
            <span className={`mw-provider__logo ${provider.logoClass}`} aria-hidden="true">
              <i className={`bi ${provider.icon}`} />
            </span>
            <span className="flex-grow-1">
              <span className="d-block mw-option__title">
                {provider.name}
                {provider.recommended ? (
                  <span className="mw-status mw-status--success ms-2">{t('acc.easiest')}</span>
                ) : null}
              </span>
              <span className="d-block mw-option__desc">{t(provider.descKey)}</span>
            </span>
            <i className="bi bi-chevron-right mw-text-muted-2" aria-hidden="true" />
          </button>
        ))}
      </div>

      <Note tone="primary" icon="bi-shield-lock">
        {t('acc.tokenNote', { app: appConfig.name })}
      </Note>
    </div>
  );
}

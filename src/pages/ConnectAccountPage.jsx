import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { appConfig } from '../config/appConfig';
import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import { useT } from '../i18n/I18nProvider';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../components/ui/ToastProvider';

const PROVIDER_ICON = {
  google: 'bi-google',
  microsoft: 'bi-microsoft',
  microsoft365: 'bi-microsoft',
  yahoo: 'bi-envelope',
  zoho: 'bi-envelope',
  sendgrid: 'bi-send',
  brevo: 'bi-send',
  smtp: 'bi-hdd-network',
};

const EMPTY = {
  email: '',
  displayName: '',
  pass: '',
  host: '',
  port: '',
  secure: false,
  user: '',
};

export default function ConnectAccountPage() {
  const t = useT();
  const toast = useToast();

  const { user } = useAuth();

  // Provider ki list server se aati hai — wahi list backend bhi istemal karta
  // hai. Ek hi jagah rakhne se dono kabhi alag nahi hote.
  const providersCall = useApi('/api/accounts/providers');
  const providers = useMemo(() => providersCall.data?.providers ?? [], [providersCall.data]);

  const [providerKey, setProviderKey] = useState('');
  const [values, setValues] = useState(EMPTY);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(null);

  const provider = useMemo(
    () => providers.find((item) => item.key === providerKey) ?? null,
    [providers, providerKey]
  );

  const isCustom = providerKey === 'smtp';

  function pickProvider(event) {
    const key = event.currentTarget.dataset.key;
    const chosen = providers.find((item) => item.key === key);

    setProviderKey(key);
    setResult(null);
    setValues({
      ...EMPTY,
      // Apna hi email sabse aam hai — pehle se bhar dete hain.
      email: user?.email ?? '',
      displayName: user?.name ?? '',
      host: chosen?.host ?? '',
      port: chosen?.port ? String(chosen.port) : '',
      secure: Boolean(chosen?.secure),
    });
  }

  function backToPick() {
    setProviderKey('');
    setResult(null);
  }

  function handleValue(event) {
    const { name, value, type, checked } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setResult(null);
  }

  /** Screen ke form ko wo shape deta hai jo server maangta hai. */
  function payload() {
    const body = {
      email: values.email.trim(),
      displayName: values.displayName.trim() || null,
      provider: providerKey,
      pass: values.pass,
    };

    // Custom SMTP me sab kuch user bharta hai. Baaki providers me server apne
    // preset se bhar leta hai — user ko host/port jaanne ki zarurat hi nahi.
    if (isCustom) {
      body.host = values.host.trim();
      body.port = Number(values.port) || 587;
      body.secure = values.secure;
      body.user = values.user.trim() || values.email.trim();
    }

    return body;
  }

  function missingFields() {
    if (!values.email.trim()) return t('acc.needEmail');
    if (!values.pass) return t('acc.needPassword');
    if (isCustom && !values.host.trim()) return t('acc.needHost');
    return '';
  }

  /**
   * Save karne se PEHLE connection jaanchta hai.
   *
   * Yeh sabse kaam ka button hai: galat App Password 500 email fail hone ke
   * baad nahi, abhi pata chal jata hai.
   */
  async function testConnection() {
    const missing = missingFields();
    if (missing) {
      setResult({ ok: false, message: missing });
      return false;
    }

    setTesting(true);
    setResult(null);

    try {
      const data = await api.post('/api/accounts/test-connection', payload());
      setResult({ ok: true, message: data.message ?? t('acc.testOk') });
      return true;
    } catch (error) {
      // Server SMTP ki ulti-seedhi galti ko aam bhasha me badal deta hai —
      // jaise "Gmail ne normal password nahi maana, App Password chahiye".
      setResult({
        ok: false,
        message: error instanceof ApiError ? error.message : t('toast.networkError'),
      });
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function saveAccount() {
    const missing = missingFields();
    if (missing) {
      setResult({ ok: false, message: missing });
      return;
    }

    setSaving(true);
    try {
      const data = await api.post('/api/accounts', payload());
      setSaved(data.account);
      toast.success(t('acc.savedToast'), data.account?.email);
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof ApiError ? error.message : t('toast.networkError'),
      });
    } finally {
      setSaving(false);
    }
  }

  const breadcrumb = [
    { label: t('acc.title'), to: '/accounts' },
    { label: t('acc.connect') },
  ];

  // --- jud gaya ------------------------------------------------------------
  if (saved) {
    return (
      <div className="mw-stack">
        <PageHeader title={t('acc.connected')} breadcrumb={breadcrumb} />
        <Card>
          <div className="mw-card__body text-center py-5">
            <span className="mw-empty__icon mx-auto" aria-hidden="true">
              <i className="bi bi-check-lg" />
            </span>
            <h2 className="mw-fs-20 mw-fw-700 mb-2">
              {t('acc.connectedWho', { email: saved.email })}
            </h2>
            <p className="mw-fs-14 mw-text-muted mb-4">{t('acc.connectedNote')}</p>
            <div className="mw-row justify-content-center mw-row--wrap">
              <Link to="/accounts" className="btn btn-primary">
                {t('acc.goToAccounts')}
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- provider chuno ------------------------------------------------------
  if (!providerKey) {
    return (
      <div className="mw-stack">
        <PageHeader title={t('acc.connect')} subtitle={t('acc.chooseProviderSub')} breadcrumb={breadcrumb} />

        {providersCall.loading ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="mw-providergrid">
            {providers.map((item) => (
              <button
                key={item.key}
                type="button"
                className="mw-provider"
                data-key={item.key}
                onClick={pickProvider}
              >
                <span
                  className={`mw-provider__logo mw-provider__logo--${item.key}`}
                  aria-hidden="true"
                >
                  <i className={`bi ${PROVIDER_ICON[item.key] ?? 'bi-envelope'}`} />
                </span>
                <span className="mw-provider__name">{item.name}</span>
                {item.needsAppPassword ? (
                  <span className="mw-provider__hint">{t('acc.needsAppPassword')}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        <Note tone="info" icon="bi-info-circle">
          {t('acc.easiest')}
        </Note>
      </div>
    );
  }

  // --- detail bharo --------------------------------------------------------
  return (
    <div className="mw-stack">
      <PageHeader
        title={provider?.name ?? t('acc.connect')}
        subtitle={t('acc.fillDetails')}
        breadcrumb={breadcrumb}
      />

      {/* Provider ke apne steps — App Password kaise banana hai, wo yahin
          likha hota hai. Bina iske Gmail/Outlook par log atak jate hain. */}
      {provider?.help ? (
        <Card>
          <div className="mw-card__body">
            <h2 className="mw-fs-16 mw-fw-700 mb-2">{provider.help.title}</h2>
            <p className="mw-fs-13 mw-text-muted">{provider.help.why}</p>
            <ol className="mw-fs-14 mb-3">
              {(provider.help.steps ?? []).map((stepText) => (
                <li key={stepText} className="mb-1">
                  {stepText}
                </li>
              ))}
            </ol>
            {provider.help.link ? (
              <a href={provider.help.link} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm">
                <i className="bi bi-box-arrow-up-right me-2" />
                {t('acc.openProvider')}
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="mw-card__body">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="acc-email">{t('common.email')}</label>
              <input
                id="acc-email"
                name="email"
                type="email"
                className="form-control"
                value={values.email}
                onChange={handleValue}
                placeholder="you@yourcompany.com"
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="acc-name">{t('camp.sender')}</label>
              <input
                id="acc-name"
                name="displayName"
                type="text"
                className="form-control"
                value={values.displayName}
                onChange={handleValue}
                placeholder={appConfig.company}
              />
              <div className="form-text">{t('acc.senderHelp')}</div>
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="acc-pass">
                {provider?.needsAppPassword ? t('acc.appPassword') : t('auth.password')}
              </label>
              <input
                id="acc-pass"
                name="pass"
                type="password"
                className="form-control"
                value={values.pass}
                onChange={handleValue}
                autoComplete="new-password"
              />
              <div className="form-text">
                {provider?.needsAppPassword ? t('acc.appPasswordHelp') : t('acc.passwordHelp')}
              </div>
            </div>

            {/* Sirf custom SMTP me hi server ki detail poochte hain. Baaki
                sab me app khud bhar leta hai. */}
            {isCustom ? (
              <>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="acc-host">{t('smtp.host.title')}</label>
                  <input
                    id="acc-host"
                    name="host"
                    type="text"
                    className="form-control"
                    value={values.host}
                    onChange={handleValue}
                    placeholder="smtp.yourprovider.com"
                  />
                  <div className="form-text">{t('smtp.host.help')}</div>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label" htmlFor="acc-port">{t('smtp.port.title')}</label>
                  <input
                    id="acc-port"
                    name="port"
                    type="number"
                    className="form-control"
                    value={values.port}
                    onChange={handleValue}
                    placeholder="587"
                  />
                </div>

                <div className="col-6 col-md-3 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="acc-secure"
                      name="secure"
                      checked={values.secure}
                      onChange={handleValue}
                    />
                    <label className="form-check-label" htmlFor="acc-secure">
                      {t('smtp.security.ssl')}
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="acc-user">{t('smtp.login.username')}</label>
                  <input
                    id="acc-user"
                    name="user"
                    type="text"
                    className="form-control"
                    value={values.user}
                    onChange={handleValue}
                    placeholder={values.email || 'you@yourcompany.com'}
                  />
                  <div className="form-text">{t('smtp.login.help')}</div>
                </div>
              </>
            ) : null}
          </div>

          {result ? (
            <div
              className={`mw-note mt-4 ${result.ok ? 'mw-note--success' : 'mw-note--warning'}`}
              role="alert"
            >
              <i
                className={`bi ${result.ok ? 'bi-check-circle' : 'bi-exclamation-triangle'} mw-note__icon`}
                aria-hidden="true"
              />
              <div>{result.message}</div>
            </div>
          ) : null}
        </div>

        <div className="mw-wizard-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={backToPick}>
            <i className="bi bi-arrow-left me-2" />
            {t('common.back')}
          </button>

          <button
            type="button"
            className="btn btn-outline-primary ms-auto"
            onClick={testConnection}
            disabled={testing || saving}
          >
            {testing ? t('common.loading') : t('acc.testConnection')}
          </button>

          <button
            type="button"
            className="btn btn-primary ms-2"
            onClick={saveAccount}
            disabled={testing || saving}
          >
            {saving ? t('common.loading') : t('acc.saveAccount')}
          </button>
        </div>
      </Card>

      <Note tone="primary" icon="bi-shield-lock">
        {t('acc.credEncryptedText')}
      </Note>
    </div>
  );
}

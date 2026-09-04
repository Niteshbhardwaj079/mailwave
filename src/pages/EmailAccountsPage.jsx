import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import StatusPill from '../components/ui/StatusPill';
import ProgressBar from '../components/ui/ProgressBar';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useAuth } from '../store/AuthProvider';
import { useToast } from '../components/ui/ToastProvider';
import { formatNumber, percentValue } from '../utils/format';

const PROVIDER_ICON = {
  google: 'bi-google',
  microsoft: 'bi-microsoft',
  smtp: 'bi-hdd-network',
  sendgrid: 'bi-send',
  brevo: 'bi-send',
  zoho: 'bi-envelope',
  yahoo: 'bi-envelope',
};

export default function EmailAccountsPage() {
  const t = useT();
  const toast = useToast();
  const { user } = useAuth();

  const accountsCall = useApi('/api/accounts');
  const accounts = accountsCall.data?.accounts ?? [];

  const [testFor, setTestFor] = useState(null);
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [removeFor, setRemoveFor] = useState(null);

  function openTest(event) {
    const account = accounts.find((item) => item.id === event.currentTarget.dataset.id) || null;
    setTestFor(account);
    // Apne hi email par bhejna sabse aam hai — wahi pehle se bhar dete hain.
    setTestTo(user?.email ?? '');
    setTestResult(null);
  }

  function closeTest() {
    setTestFor(null);
    setTestResult(null);
  }

  /**
   * Asli test email bhejta hai.
   *
   * Yeh page ka sabse kaam ka button hai: SMTP ki setting sahi hai ya nahi,
   * yeh 500 email fail hone ke baad nahi, abhi pata chal jata hai.
   */
  async function sendTest() {
    if (!testTo.trim()) return;

    setSending(true);
    setTestResult(null);

    try {
      const data = await api.post(`/api/accounts/${testFor.id}/test-email`, { to: testTo.trim() });

      setTestResult({
        ok: true,
        message: t('acc.testSent', { email: testTo.trim() }),
        // Test transport par asli inbox nahi hota — uski jagah ek link milta
        // hai jisse email khol kar dekha ja sakta hai.
        previewUrl: data.previewUrl ?? null,
      });

      accountsCall.reload();
      toast.success(t('acc.testSent', { email: testTo.trim() }));
    } catch (error) {
      // Server SMTP ki galti ko aam bhasha me samjha kar bhejta hai — jaise
      // "Gmail ne normal password nahi maana, App Password chahiye". Wahi
      // dikhate hain, technical error nahi.
      setTestResult({
        ok: false,
        message: error instanceof ApiError ? error.message : t('toast.networkError'),
      });
    } finally {
      setSending(false);
    }
  }

  function cancelRemove() {
    setRemoveFor(null);
  }

  function askRemove(event) {
    setRemoveFor(accounts.find((item) => item.id === event.currentTarget.dataset.id) || null);
  }

  async function confirmRemove() {
    const account = removeFor;
    setRemoveFor(null);
    if (!account) return;

    try {
      await api.delete(`/api/accounts/${account.id}`);
      accountsCall.reload();
      toast.success(t('toast.accountRemoved'), account.email);
    } catch (error) {
      // Chalti hui campaign wala account hatane par server saaf mana karta hai.
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('acc.title')}
        subtitle={t('acc.subtitle')}
        helpTopic="accounts"
        actions={
          <Link to="/accounts/connect" className="btn btn-primary mw-btn-block-mobile">
            <i className="bi bi-plus-lg me-2" />
            {t('acc.connect')}
          </Link>
        }
      />

      {accountsCall.loading && accounts.length === 0 ? (
        <div className="p-5 text-center mw-text-muted">
          <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          {t('common.loading')}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="bi-envelope-at"
          title={t('acc.emptyTitle')}
          text={t('acc.emptyText')}
          action={
            <Link to="/accounts/connect" className="btn btn-primary">
              {t('acc.connect')}
            </Link>
          }
        />
      ) : (
        <div className="mw-stack--sm d-flex flex-column">
          {accounts.map((account) => (
            <article key={account.id} className="mw-account">
              <span className={`mw-provider__logo mw-provider__logo--${account.provider}`} aria-hidden="true">
                <i className={`bi ${PROVIDER_ICON[account.provider] ?? 'bi-envelope'}`} />
              </span>

              <div className="mw-account__body">
                <div className="mw-row mw-row--wrap">
                  <span className="mw-account__email">{account.email}</span>
                  <StatusPill status={account.status} />
                </div>

                <div className="mw-account__meta">
                  <span>
                    <i className="bi bi-building me-1" />
                    {account.providerName}
                  </span>
                  <span>
                    <i className="bi bi-person me-1" />
                    {account.displayName}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="mw-row mw-row--between mw-fs-12 mw-text-muted mb-1">
                    <span>{t('acc.usageToday')}</span>
                    <span className="mw-num">
                      {formatNumber(account.sentToday)} / {formatNumber(account.dailyLimit)}
                    </span>
                  </div>
                  <ProgressBar
                    value={percentValue(account.sentToday, account.dailyLimit)}
                    tone={account.sentToday / account.dailyLimit > 0.8 ? 'danger' : 'primary'}
                    label={`Daily limit used for ${account.email}`}
                  />
                </div>
              </div>

              <div className="mw-account__actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  data-id={account.id}
                  onClick={openTest}
                >
                  <i className="bi bi-envelope-check me-2" />
                  {t('acc.sendTest')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  data-id={account.id}
                  onClick={askRemove}
                >
                  <i className="bi bi-plug me-2" />
                  {t('acc.disconnect')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Card>
        <CardHead title={t('acc.credTitle')} subtitle={t('acc.credSub')} />
        <CardBody>
          <div className="mw-grid-3">
            <div className="mw-note mw-note--success">
              <i className="bi bi-lock mw-note__icon" aria-hidden="true" />
              <div>
                <strong>{t('acc.credHidden')}</strong> {t('acc.credHiddenText')}
              </div>
            </div>
            <div className="mw-note mw-note--primary">
              <i className="bi bi-shield-lock mw-note__icon" aria-hidden="true" />
              <div>
                <strong>{t('acc.credEncrypted')}</strong> {t('acc.credEncryptedText')}
              </div>
            </div>
            <div className="mw-note mw-note--info">
              <i className="bi bi-arrow-repeat mw-note__icon" aria-hidden="true" />
              <div>
                <strong>{t('acc.credRefreshed')}</strong> {t('acc.credRefreshedText')}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Note tone="primary" icon="bi-collection">
        {t('acc.multipleNote')}
      </Note>

      <Note tone="warning" icon="bi-speedometer2">
        {t('acc.limitNote', { app: appConfig.name })}
      </Note>

      <Sheet
        open={Boolean(testFor)}
        title={t('acc.testTitle')}
        onClose={closeTest}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeTest}>
              {t('common.close')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-fill"
              onClick={sendTest}
              disabled={sending || !testTo.trim()}
            >
              {sending ? t('common.loading') : t('acc.testSend')}
            </button>
          </>
        }
      >
        {testFor ? (
          <>
            <p className="mw-fs-14 mb-3">{t('acc.testBody', { email: testFor.email })}</p>

            <label className="form-label" htmlFor="test-to">{t('acc.testTo')}</label>
            <input
              id="test-to"
              type="email"
              className="form-control"
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
            />
            <div className="form-text">{t('acc.testSpam')}</div>

            {testResult ? (
              <div
                className={`mw-note mt-3 ${testResult.ok ? 'mw-note--success' : 'mw-note--warning'}`}
                role="alert"
              >
                <i
                  className={`bi ${testResult.ok ? 'bi-check-circle' : 'bi-exclamation-triangle'} mw-note__icon`}
                  aria-hidden="true"
                />
                <div>
                  {testResult.message}
                  {testResult.previewUrl ? (
                    <>
                      {' '}
                      <a href={testResult.previewUrl} target="_blank" rel="noreferrer">
                        {t('acc.testPreview')}
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Sheet>

      {/* Confirm ke liye app me har jagah Sheet hi istemaal hota hai — wahi
          rakha hai, taki har screen ek jaisi lage. */}
      <Sheet
        open={Boolean(removeFor)}
        title={t('acc.removeTitle')}
        onClose={cancelRemove}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={cancelRemove}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={confirmRemove}>
              {t('acc.disconnect')}
            </button>
          </>
        }
      >
        {removeFor ? (
          <p className="mw-fs-14 mb-0">
            <strong>{removeFor.email}</strong> — {t('acc.removeText')}
          </p>
        ) : null}
      </Sheet>
    </div>
  );
}

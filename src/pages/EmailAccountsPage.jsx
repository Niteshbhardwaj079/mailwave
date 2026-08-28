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
import { emailAccounts } from '../data/mockData';
import { formatNumber, percentValue } from '../utils/format';

const PROVIDER_ICON = {
  google: 'bi-google',
  microsoft: 'bi-microsoft',
  smtp: 'bi-hdd-network',
};

export default function EmailAccountsPage() {
  const t = useT();
  const [testFor, setTestFor] = useState(null);

  function openTest(event) {
    setTestFor(emailAccounts.find((account) => account.id === event.currentTarget.dataset.id) || null);
  }

  function closeTest() {
    setTestFor(null);
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

      <div className="mw-stack--sm d-flex flex-column">
        {emailAccounts.map((account) => (
          <article key={account.id} className="mw-account">
            <span className={`mw-provider__logo mw-provider__logo--${account.providerKey}`} aria-hidden="true">
              <i className={`bi ${PROVIDER_ICON[account.providerKey]}`} />
            </span>

            <div className="mw-account__body">
              <div className="mw-row mw-row--wrap">
                <span className="mw-account__email">{account.email}</span>
                <StatusPill status={account.status} />
              </div>

              <div className="mw-account__meta">
                <span>
                  <i className="bi bi-building me-1" />
                  {account.provider}
                </span>
                <span>
                  <i className="bi bi-person me-1" />
                  {account.senderName}
                </span>
                <span>
                  <i className="bi bi-reply me-1" />
                  {account.replyTo}
                </span>
              </div>

              <div className="mt-3">
                <div className="mw-row mw-row--between mw-fs-12 mw-text-muted mb-1">
                  <span>{t('acc.usageToday')}</span>
                  <span className="mw-num">
                    {formatNumber(account.usedToday)} / {formatNumber(account.dailyLimit)}
                  </span>
                </div>
                <ProgressBar
                  value={percentValue(account.usedToday, account.dailyLimit)}
                  tone={account.usedToday / account.dailyLimit > 0.8 ? 'danger' : 'primary'}
                  label={`Daily limit used for ${account.email}`}
                />
              </div>
            </div>

            <div className="mw-account__actions">
              <button type="button" className="btn btn-outline-secondary btn-sm" data-id={account.id} onClick={openTest}>
                <i className="bi bi-envelope-check me-2" />
                {t('acc.sendTest')}
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm">
                <i className="bi bi-plug me-2" />
                {t('acc.disconnect')}
              </button>
            </div>
          </article>
        ))}
      </div>

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
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={closeTest}>
              {t('acc.testSend')}
            </button>
          </>
        }
      >
        {testFor ? (
          <>
            <p className="mw-fs-14 mb-3">{t('acc.testBody', { email: testFor.email })}</p>
            <label className="form-label" htmlFor="test-to">{t('acc.testTo')}</label>
            <input id="test-to" type="email" className="form-control" defaultValue="rohit@gowebkart.com" />
            <div className="form-text">{t('acc.testSpam')}</div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

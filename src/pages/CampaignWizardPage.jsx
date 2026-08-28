import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui/Card';
import Sheet from '../components/ui/Sheet';
import ProgressBar from '../components/ui/ProgressBar';
import Stepper from '../components/wizard/Stepper';
import StepInfo from '../components/wizard/StepInfo';
import StepRecipients from '../components/wizard/StepRecipients';
import StepTemplate from '../components/wizard/StepTemplate';
import StepContent from '../components/wizard/StepContent';
import StepSettings from '../components/wizard/StepSettings';
import StepReview from '../components/wizard/StepReview';
import { wizardSteps } from '../data/mockData';
import { useWorkspace } from '../store/WorkspaceProvider';
import { formatNumber, percentValue } from '../utils/format';

const RECIPIENT_COUNT = 500;

const INITIAL_DRAFT = {
  name: 'Summer Offer',
  account: 'hello@gowebkart.com',
  senderName: 'GoWebKart Team',
  replyTo: 'support@gowebkart.com',
  subject: 'Hello {{name}}, here is your update',
  preheader: 'Your new batch starts on Monday',
  recipientSource: 'excel',
  manualList: '',
  groups: ['g1'],
  subscriberIds: [],
  templateId: '',
  templateName: '',
  templateHtml: '',
  batchSize: 100,
  batchDelay: 2,
  openTracking: true,
  clickTracking: true,
  subscribeButton: false,
  schedule: 'now',
  scheduleAt: '',
};

export default function CampaignWizardPage() {
  const t = useT();
  const { templates } = useWorkspace();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => {
    const first = templates[0];
    return first
      ? { ...INITIAL_DRAFT, templateId: first.id, templateName: first.name, templateHtml: first.html }
      : INITIAL_DRAFT;
  });
  const [category, setCategory] = useState('All');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sending || paused) return undefined;

    const timer = window.setInterval(() => {
      setSentCount((current) => {
        if (current >= RECIPIENT_COUNT) {
          window.clearInterval(timer);
          return current;
        }
        return Math.min(RECIPIENT_COUNT, current + 17);
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [sending, paused]);

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function goNext() {
    setStep((current) => Math.min(wizardSteps.length - 1, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  function openConfirm() {
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
  }

  function startSending() {
    setConfirmOpen(false);
    setSending(true);
    setSentCount(0);
  }

  function togglePause() {
    setPaused((current) => !current);
  }

  function cancelSending() {
    setSending(false);
    setPaused(false);
    setSentCount(0);
  }

  function goToCampaigns() {
    navigate('/campaigns');
  }

  const failed = Math.floor(sentCount / 180);
  const pending = RECIPIENT_COUNT - sentCount;
  const progress = percentValue(sentCount, RECIPIENT_COUNT);
  const done = sentCount >= RECIPIENT_COUNT;

  if (sending) {
    return (
      <div className="mw-stack">
        <PageHeader
          title={done ? t('wiz.doneTitle') : t('wiz.sendingTitle')}
          subtitle={done ? t('wiz.doneSub') : t('wiz.sendingSub')}
          breadcrumb={[{ label: t('nav.campaigns'), to: '/campaigns' }, { label: draft.name }]}
        />

        <div className="mw-sending">
          <div className="mw-row mw-row--between mw-row--wrap">
            <div>
              <span className="mw-sending__count">{formatNumber(sentCount)}</span>
              <span className="mw-sending__total"> / {formatNumber(RECIPIENT_COUNT)}</span>
            </div>
            <span className="mw-row mw-fs-13 mw-fw-600">
              {done ? (
                <>
                  <i className="bi bi-check-circle-fill mw-text-success" /> {t('wiz.completed')}
                </>
              ) : paused ? (
                <>
                  <i className="bi bi-pause-circle-fill mw-text-warning" /> {t('wiz.paused')}
                </>
              ) : (
                <>
                  <span className="mw-pulse" />{' '}
                  {t('wiz.sendingBatch', { number: Math.ceil((sentCount + 1) / draft.batchSize) })}
                </>
              )}
            </span>
          </div>

          <div className="mt-3">
            <ProgressBar
              value={progress}
              size="lg"
              tone={done ? 'success' : 'primary'}
              label={t('wiz.progressLabel')}
            />
          </div>

          <div className="mw-sending__stats">
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num">{formatNumber(sentCount)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.sent')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num mw-text-warning">{formatNumber(pending)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.pending')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num mw-text-danger">{formatNumber(failed)}</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.failed')}</div>
            </div>
            <div className="mw-sending__stat">
              <div className="mw-fs-20 mw-fw-700 mw-num">{formatNumber(Math.round(progress))}%</div>
              <div className="mw-fs-12 mw-text-muted">{t('wiz.progress')}</div>
            </div>
          </div>

          <div className="mw-row mw-row--wrap mt-4">
            {done ? (
              <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={goToCampaigns}>
                <i className="bi bi-graph-up me-2" />
                {t('wiz.viewAnalytics')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-outline-secondary" onClick={togglePause}>
                  <i className={`bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'} me-2`} />
                  {paused ? t('wiz.resume') : t('wiz.pause')}
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={cancelSending}>
                  <i className="bi bi-x-lg me-2" />
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('dash.createCampaign')}
        subtitle={t('wiz.subtitle')}
        helpTopic="wizard"
        breadcrumb={[
          { label: t('nav.campaigns'), to: '/campaigns' },
          { label: t('dash.createCampaign') },
        ]}
      />

      <Card flush>
        <Stepper steps={wizardSteps} current={step} onJump={setStep} ariaLabel={t('wiz.steps')} />

        <div className="mw-card__body">
          {step === 0 ? <StepInfo draft={draft} onChange={updateDraft} /> : null}
          {step === 1 ? <StepRecipients draft={draft} onChange={updateDraft} /> : null}
          {step === 2 ? (
            <StepTemplate draft={draft} onChange={updateDraft} category={category} onCategoryChange={setCategory} />
          ) : null}
          {step === 3 ? <StepContent draft={draft} onChange={updateDraft} /> : null}
          {step === 4 ? <StepSettings draft={draft} onChange={updateDraft} recipientCount={RECIPIENT_COUNT} /> : null}
          {step === 5 ? <StepReview draft={draft} recipientCount={RECIPIENT_COUNT} onSend={openConfirm} /> : null}
        </div>

        <div className="mw-wizard-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={step === 0}>
            <i className="bi bi-arrow-left me-2" />
            {t('common.back')}
          </button>

          <span className="mw-fs-12 mw-text-muted ms-auto mw-hide-mobile">
            {t('wiz.stepCounter', {
              current: step + 1,
              total: wizardSteps.length,
              label: t(wizardSteps[step].labelKey),
            })}
          </span>

          {step < wizardSteps.length - 1 ? (
            <button type="button" className="btn btn-primary ms-auto ms-md-3" onClick={goNext}>
              {t('common.continue')}
              <i className="bi bi-arrow-right ms-2" />
            </button>
          ) : (
            <button type="button" className="btn btn-primary ms-auto ms-md-3" onClick={openConfirm}>
              <i className="bi bi-send me-2" />
              {t('wiz.send')}
            </button>
          )}
        </div>
      </Card>

      <Sheet
        open={confirmOpen}
        title={t('wiz.confirmTitle')}
        onClose={closeConfirm}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeConfirm}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={startSending}>
              {t('wiz.confirmYes')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-3">
          {t('wiz.confirmBody', {
            name: draft.name,
            count: formatNumber(RECIPIENT_COUNT),
            account: draft.account,
          })}
        </p>
        <p className="mw-fs-13 mw-text-muted mb-0">
          {t('wiz.confirmNote', { size: formatNumber(draft.batchSize), delay: draft.batchDelay })}
        </p>
      </Sheet>
    </div>
  );
}

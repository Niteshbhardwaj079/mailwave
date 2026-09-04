import { KeyValue, Note } from '../ui/Controls';
import StatusPill from '../ui/StatusPill';
import HtmlPreview from '../templates/HtmlPreview';
import { useT } from '../../i18n/I18nProvider';
import { formatNumber } from '../../utils/format';

export default function StepReview({ draft, recipientCount = 0, onSend }) {
  const t = useT();

  /** The three tracking switches all read the same way. */
  function onOff(enabled) {
    return (
      <StatusPill status={enabled ? t('rev.enabled') : t('rev.off')} tone={enabled ? 'success' : 'muted'} />
    );
  }

  const batchSummary =
    draft.batchSize === 0
      ? t('send.batchAll')
      : t('send.batchPer', { size: formatNumber(draft.batchSize) });

  const scheduleSummary =
    draft.schedule === 'now'
      ? t('rev.sendNow')
      : t('rev.scheduledFor', { when: draft.scheduleAt || t('rev.notSet') });

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('rev.title')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('rev.subtitle')}</p>
      </div>

      <div className="mw-grid-main-side">
        <div className="mw-card">
          <div className="mw-card__body">
            <KeyValue label={t('nav.campaigns')}>{draft.name || t('rev.untitled')}</KeyValue>
            <KeyValue label={t('camp.sender')}>
              {draft.senderName} &lt;{draft.account}&gt;
            </KeyValue>
            <KeyValue label={t('rev.replyTo')}>{draft.replyTo}</KeyValue>
            <KeyValue label={t('tpl.subject')}>{draft.subject}</KeyValue>
            <KeyValue label={t('camp.recipients')}>{formatNumber(recipientCount)}</KeyValue>
            <KeyValue label={t('camp.template')}>{draft.templateName}</KeyValue>
            <KeyValue label={t('rev.batchSize')}>{batchSummary}</KeyValue>
            <KeyValue label={t('rev.batchWait')}>{t('rev.minutes', { count: draft.batchDelay })}</KeyValue>
            <KeyValue label={t('send.openTracking')}>{onOff(draft.openTracking)}</KeyValue>
            <KeyValue label={t('send.clickTracking')}>{onOff(draft.clickTracking)}</KeyValue>
            <KeyValue label={t('send.subscribeButton')}>{onOff(draft.subscribeButton)}</KeyValue>
            <KeyValue label={t('rev.schedule')}>{scheduleSummary}</KeyValue>
          </div>
        </div>

        <div className="mw-card mw-card--flush">
          <div className="mw-card__head">
            <h3 className="mw-card__title">{t('common.preview')}</h3>
          </div>
          <div className="mw-card__body">
            <HtmlPreview html={draft.templateHtml} device="mobile" />
          </div>
        </div>
      </div>

      <Note tone="success" icon="bi-envelope-check">
        {t('rev.testNote')}
      </Note>

      <div className="mw-row mw-row--wrap">
        <button type="button" className="btn btn-outline-secondary">
          <i className="bi bi-envelope-check me-2" />
          {t('acc.sendTest')}
        </button>
        <button type="button" className="btn btn-primary btn-lg mw-btn-block-mobile" onClick={onSend}>
          <i className="bi bi-send me-2" />
          {t('wiz.send')}
        </button>
      </div>
    </div>
  );
}

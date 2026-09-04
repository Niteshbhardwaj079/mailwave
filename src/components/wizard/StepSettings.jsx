import { Note } from '../ui/Controls';
import { batchOptions } from '../../data/mockData';
import { formatNumber } from '../../utils/format';
import { useT } from '../../i18n/I18nProvider';

const SCHEDULE_OPTIONS = [
  { key: 'now', titleKey: 'send.now', descKey: 'send.nowDesc', icon: 'bi-lightning-charge' },
  { key: 'later', titleKey: 'send.later', descKey: 'send.laterDesc', icon: 'bi-calendar-event' },
];

export default function StepSettings({ draft, onChange, recipientCount = 0 }) {
  const t = useT();

  /** "Send all at once" has no number in it; the other choices do. */
  function batchLabel(option) {
    return option.value === 0
      ? t('send.batchAll')
      : t('send.batchPer', { size: formatNumber(option.value) });
  }

  function handleBatch(event) {
    onChange({ batchSize: Number(event.currentTarget.dataset.value) });
  }

  function handleDelay(event) {
    onChange({ batchDelay: Number(event.target.value) });
  }

  function handleSchedule(event) {
    onChange({ schedule: event.currentTarget.dataset.key });
  }

  function handleScheduleAt(event) {
    onChange({ scheduleAt: event.target.value });
  }

  function toggleOpen() {
    onChange({ openTracking: !draft.openTracking });
  }

  function toggleClick() {
    onChange({ clickTracking: !draft.clickTracking });
  }

  function toggleSubscribe() {
    onChange({ subscribeButton: !draft.subscribeButton });
  }

  const batchCount = draft.batchSize > 0 ? Math.ceil(recipientCount / draft.batchSize) : 1;
  const batches = Array.from({ length: Math.min(batchCount, 8) }, (_, index) => {
    const remaining = recipientCount - index * draft.batchSize;
    return draft.batchSize > 0 ? Math.min(draft.batchSize, remaining) : recipientCount;
  });

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('send.title')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('send.subtitle')}</p>
      </div>

      <div>
        <p className="mw-fs-14 mw-fw-700 mb-2">{t('send.batchSize')}</p>
        <div className="mw-row mw-row--wrap">
          {batchOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              data-value={option.value}
              onClick={handleBatch}
              className={`mw-chip ${draft.batchSize === option.value ? 'is-active' : ''}`.trim()}
            >
              {batchLabel(option)}
            </button>
          ))}
        </div>

        {draft.batchSize > 0 ? (
          <div className="mt-3">
            <p className="mw-fs-13 mw-text-muted mb-2">
              {t('send.batchPlan', { count: formatNumber(recipientCount), batches: batchCount })}
            </p>
            <div className="mw-batches">
              {batches.map((size, index) => (
                <span key={`batch-${index}`} className="mw-batch">
                  {t('send.batchLabel', { number: index + 1, size: formatNumber(size) })}
                </span>
              ))}
              {batchCount > 8 ? (
                <span className="mw-batch">{t('send.batchMore', { count: batchCount - 8 })}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label className="form-label" htmlFor="batch-delay">
          {t('send.delayLabel', { minutes: draft.batchDelay })}
        </label>
        <input
          id="batch-delay"
          type="range"
          className="form-range"
          min={0}
          max={30}
          step={1}
          value={draft.batchDelay}
          onChange={handleDelay}
        />
        <div className="form-text">{t('send.delayHelp')}</div>
      </div>

      <div>
        <p className="mw-fs-14 mw-fw-700 mb-2">{t('set.tracking')}</p>

        <div className="mw-switchrow">
          <div className="mw-switchrow__body">
            <div className="mw-switchrow__title">{t('send.openTracking')}</div>
            <p className="mw-switchrow__desc mb-0">{t('send.openTrackingDesc')}</p>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="open-tracking"
              checked={draft.openTracking}
              onChange={toggleOpen}
            />
            <label className="form-check-label visually-hidden" htmlFor="open-tracking">
              {t('send.openTracking')}
            </label>
          </div>
        </div>

        <div className="mw-switchrow">
          <div className="mw-switchrow__body">
            <div className="mw-switchrow__title">{t('send.clickTracking')}</div>
            <p className="mw-switchrow__desc mb-0">{t('send.clickTrackingDesc')}</p>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="click-tracking"
              checked={draft.clickTracking}
              onChange={toggleClick}
            />
            <label className="form-check-label visually-hidden" htmlFor="click-tracking">
              {t('send.clickTracking')}
            </label>
          </div>
        </div>
      </div>

      <div>
        <p className="mw-fs-14 mw-fw-700 mb-2">{t('send.subscribeButton')}</p>

        <div className="mw-switchrow">
          <div className="mw-switchrow__body">
            <div className="mw-switchrow__title">{t('send.subscribeTitle')}</div>
            <p className="mw-switchrow__desc mb-0">{t('send.subscribeDesc')}</p>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="subscribe-button"
              checked={draft.subscribeButton}
              onChange={toggleSubscribe}
            />
            <label className="form-check-label visually-hidden" htmlFor="subscribe-button">
              {t('send.subscribeButton')}
            </label>
          </div>
        </div>

        {draft.subscribeButton ? (
          <Note tone="success" icon="bi-braces">
            {t('send.subscribeNote')}
          </Note>
        ) : null}
      </div>

      <div>
        <p className="mw-fs-14 mw-fw-700 mb-2">{t('send.whenTitle')}</p>
        <div className="mw-optiongrid">
          {SCHEDULE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              data-key={option.key}
              onClick={handleSchedule}
              className={`mw-option ${draft.schedule === option.key ? 'is-selected' : ''}`.trim()}
            >
              <span className="mw-option__icon" aria-hidden="true">
                <i className={`bi ${option.icon}`} />
              </span>
              <span>
                <span className="d-block mw-option__title">{t(option.titleKey)}</span>
                <span className="d-block mw-option__desc">{t(option.descKey)}</span>
              </span>
              {draft.schedule === option.key ? (
                <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>

        {draft.schedule === 'later' ? (
          <div className="mt-3 row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="schedule-at">
                {t('send.dateTime')}
              </label>
              <input
                id="schedule-at"
                type="datetime-local"
                className="form-control"
                value={draft.scheduleAt}
                onChange={handleScheduleAt}
              />
            </div>
          </div>
        ) : null}
      </div>

      <Note tone="warning" icon="bi-clock-history">
        {t('send.queueNote')}
      </Note>
    </div>
  );
}

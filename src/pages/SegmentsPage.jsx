import { useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Sheet from '../components/ui/Sheet';
import { segments } from '../data/mockData';
import { formatNumber } from '../utils/format';

const CONDITIONS = [
  { value: 'opened', labelKey: 'seg.cond.opened' },
  { value: 'not_opened', labelKey: 'seg.cond.notOpened' },
  { value: 'clicked', labelKey: 'seg.cond.clicked' },
  { value: 'not_clicked', labelKey: 'seg.cond.notClicked' },
  { value: 'failed', labelKey: 'seg.cond.failed' },
  { value: 'unsubscribed', labelKey: 'seg.cond.unsubscribed' },
];

export default function SegmentsPage() {
  const t = useT();
  const [builderOpen, setBuilderOpen] = useState(false);

  function openBuilder() {
    setBuilderOpen(true);
  }

  function closeBuilder() {
    setBuilderOpen(false);
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('nav.segments')}
        subtitle={t('seg.subtitle')}
        helpTopic="segments"
        actions={
          <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={openBuilder}>
            <i className="bi bi-plus-lg me-2" />
            {t('seg.new')}
          </button>
        }
      />

      <Note tone="primary" icon="bi-diagram-3">
        {t('seg.autoNote')}
      </Note>

      <div className="mw-optiongrid">
        {segments.map((segment) => (
          <article key={segment.id} className="mw-option">
            <span className={`mw-option__icon mw-kpi__icon--${segment.tone}`} aria-hidden="true">
              <i className="bi bi-funnel" />
            </span>
            <span>
              <span className="d-block mw-option__title">{segment.name}</span>
              <span className="d-block mw-option__desc mw-mono">{segment.rule}</span>
              <span className="d-block mw-fs-16 mw-fw-700 mw-text-ink mt-2">
                {formatNumber(segment.count)} <span className="mw-fs-12 mw-fw-500 mw-text-muted">{t('seg.contacts')}</span>
              </span>
              <span className="mw-row mt-3">
                <span className="btn btn-sm btn-outline-primary">{t('tpl.useInCampaign')}</span>
                <span className="btn btn-sm btn-outline-secondary">{t('common.export')}</span>
              </span>
            </span>
          </article>
        ))}
      </div>

      <Card>
        <CardHead title={t('seg.automationTitle')} subtitle={t('seg.automationSub')} />
        <CardBody>
          <div className="mw-grid-2">
            <div className="mw-option">
              <span className="mw-option__icon" aria-hidden="true">
                <i className="bi bi-arrow-repeat" />
              </span>
              <span>
                <span className="d-block mw-option__title">{t('camp.resendUnopened')}</span>
                <span className="d-block mw-option__desc">{t('seg.resendDesc')}</span>
              </span>
            </div>
            <div className="mw-option">
              <span className="mw-option__icon" aria-hidden="true">
                <i className="bi bi-send-check" />
              </span>
              <span>
                <span className="d-block mw-option__title">{t('seg.followClicked')}</span>
                <span className="d-block mw-option__desc">{t('seg.followClickedDesc')}</span>
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Sheet
        open={builderOpen}
        title={t('seg.buildTitle')}
        onClose={closeBuilder}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeBuilder}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={closeBuilder}>
              {t('seg.save')}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label" htmlFor="segment-name">{t('seg.name')}</label>
            <input id="segment-name" type="text" className="form-control" placeholder="Interested Leads" />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-c1">{t('seg.condition', { number: 1 })}</label>
            <select id="segment-c1" className="form-select" defaultValue="opened">
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {t(condition.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-join">{t('seg.joinWith')}</label>
            <select id="segment-join" className="form-select" defaultValue="and">
              <option value="and">{t('seg.joinAnd')}</option>
              <option value="or">{t('seg.joinOr')}</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="segment-c2">{t('seg.condition', { number: 2 })}</label>
            <select id="segment-c2" className="form-select" defaultValue="clicked">
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {t(condition.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mw-note mw-note--success mt-4">
          <i className="bi bi-people mw-note__icon" aria-hidden="true" />
          <div>{t('seg.matchCount', { count: formatNumber(612) })}</div>
        </div>
      </Sheet>
    </div>
  );
}

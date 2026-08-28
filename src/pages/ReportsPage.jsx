import { useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import PerformanceChart from '../components/charts/PerformanceChart';
import DeliveryDonut from '../components/charts/DeliveryDonut';
import CampaignTable from '../components/campaigns/CampaignTable';
import Sheet from '../components/ui/Sheet';
import { campaigns, deliveryBreakdown, reportTypes, trendByRange } from '../data/mockData';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
];

export default function ReportsPage() {
  const t = useT();
  const [range, setRange] = useState('30d');
  const [format, setFormat] = useState('xlsx');
  const [exportFor, setExportFor] = useState(null);

  function openExport(event) {
    setExportFor(reportTypes.find((report) => report.id === event.currentTarget.dataset.id) || null);
  }

  function closeExport() {
    setExportFor(null);
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('rep.title')}
        subtitle={t('rep.subtitle')}
        helpTopic="reports"
      />

      <Card>
        <CardHead
          title={t('rep.allTitle')}
          subtitle={t('rep.allSub')}
          tools={<Segmented items={RANGES} value={range} onChange={setRange} ariaLabel={t('filter.dateRange')} />}
        />
        <CardBody className="mw-chartcard__body">
          <PerformanceChart data={trendByRange[range]} />
        </CardBody>
      </Card>

      <div className="mw-grid-main-side">
        <Card flush>
          <CardHead title={t('rep.campaignTitle')} subtitle={t('rep.campaignSub')} />
          <CampaignTable items={campaigns} />
        </Card>

        <Card>
          <CardHead title={t('rep.healthTitle')} subtitle={t('rep.healthSub')} />
          <CardBody>
            <DeliveryDonut data={deliveryBreakdown} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead
          title={t('rep.exportTitle')}
          subtitle={t('rep.exportSub')}
          tools={<Segmented items={FORMATS} value={format} onChange={setFormat} ariaLabel={t('rep.fileFormat')} />}
        />
        <CardBody>
          <div className="mw-quick-grid">
            {reportTypes.map((report) => (
              <button key={report.id} type="button" className="mw-quick" data-id={report.id} onClick={openExport}>
                <span className="mw-quick__icon" aria-hidden="true">
                  <i className={`bi ${report.icon}`} />
                </span>
                <span>
                  <span className="d-block mw-quick__label">{t(report.nameKey)}</span>
                  <span className="d-block mw-quick__hint">{t(report.descKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Note tone="info" icon="bi-clock-history">
        Large exports are prepared in the background. We email you a download link when the file is ready, so you can
        leave the page.
      </Note>

      <Sheet
        open={Boolean(exportFor)}
        title={exportFor ? `Export — ${exportFor.name}` : ''}
        onClose={closeExport}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeExport}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={closeExport}>
              <i className="bi bi-download me-2" />
              Download {format === 'csv' ? 'CSV' : 'Excel'}
            </button>
          </>
        }
      >
        {exportFor ? (
          <>
            <p className="mw-fs-14 mb-3">{exportFor.desc}</p>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="export-campaign">Campaign</label>
                <select id="export-campaign" className="form-select" defaultValue={campaigns[0].id}>
                  <option value="all">All campaigns</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="export-from">From</label>
                <input id="export-from" type="date" className="form-control" defaultValue="2026-08-01" />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="export-to">To</label>
                <input id="export-to" type="date" className="form-control" defaultValue="2026-08-26" />
              </div>
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

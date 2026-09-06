import { useMemo, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import PerformanceChart from '../components/charts/PerformanceChart';
import DeliveryDonut from '../components/charts/DeliveryDonut';
import CampaignTable from '../components/campaigns/CampaignTable';
import Sheet from '../components/ui/Sheet';
import { ApiError, api, qs } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { downloadCsv, downloadXlsx } from '../utils/download';
import { reportTypes } from '../data/constants';
import EmptyState from '../components/ui/EmptyState';
import { getActiveLocale } from '../utils/format';

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
];

/**
 * Screen par dikhne wali report ka naam, aur server par uska naam.
 *
 * Dono alag isliye rakhe hain ki screen ke id (rp1, rp2...) sirf dikhane ke
 * liye hain; server ko saaf naam chahiye taki SQL me kabhi galat cheez na
 * jaye.
 */
const REPORT_TYPE = {
  rp1: 'campaign',
  rp2: 'activity',
  rp3: 'opened',
  rp4: 'unopened',
  rp5: 'clicked',
  rp6: 'failed',
};

export default function ReportsPage() {
  const t = useT();
  const toast = useToast();

  const [range, setRange] = useState('30d');
  const [format, setFormat] = useState('xlsx');
  const [exportFor, setExportFor] = useState(null);
  const [campaignId, setCampaignId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  const trendCall = useApi(`/api/stats/trend?range=${range}`, { deps: [range] });
  const deliveryCall = useApi('/api/stats/delivery');
  const campaignsCall = useApi('/api/campaigns?limit=500');

  const campaigns = campaignsCall.data?.campaigns ?? [];

  const trend = useMemo(
    () =>
      (trendCall.data?.trend ?? []).map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString(getActiveLocale(), { day: '2-digit', month: 'short' }),
      })),
    [trendCall.data]
  );

  function openExport(event) {
    setExportFor(reportTypes.find((report) => report.id === event.currentTarget.dataset.id) || null);
    setCampaignId('all');
    setFrom('');
    setTo('');
  }

  function closeExport() {
    setExportFor(null);
  }

  /**
   * Report ki rows server se mangwa kar file bana deta hai.
   *
   * Chhaantai server par hoti hai — browser me poora data laakar yahan
   * chhaanne se bade data par screen ruk jati.
   */
  async function downloadReport() {
    if (!exportFor) return;

    const type = REPORT_TYPE[exportFor.id] ?? 'campaign';
    setDownloading(true);

    try {
      const data = await api.get(`/api/stats/report${qs({ type, campaignId, from, to })}`);
      const rows = data.rows ?? [];

      if (rows.length === 0) {
        toast.warning(t('rep.nothingToExport'));
        return;
      }

      const columns = data.columns ?? Object.keys(rows[0]);
      const table = [columns, ...rows.map((row) => columns.map((col) => row[col] ?? ''))];

      if (format === 'xlsx') {
        await downloadXlsx(`${type}-report.xlsx`, table);
      } else {
        downloadCsv(`${type}-report.csv`, table);
      }
      toast.success(t('rep.exported', { count: rows.length }));
      closeExport();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader title={t('rep.title')} subtitle={t('rep.subtitle')} helpTopic="reports" />

      <Card>
        <CardHead
          title={t('rep.allTitle')}
          subtitle={t('rep.allSub')}
          tools={<Segmented items={RANGES} value={range} onChange={setRange} ariaLabel={t('filter.dateRange')} />}
        />
        <CardBody className="mw-chartcard__body">
          <PerformanceChart data={trend} />
        </CardBody>
      </Card>

      <Card flush>
        <CardHead title={t('rep.campaignTitle')} subtitle={t('rep.campaignSub')} />
        {campaignsCall.loading && campaigns.length === 0 ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon="bi-megaphone" title={t('common.noResults')} text={t('common.noResultsText')} />
        ) : (
          <CampaignTable items={campaigns} />
        )}
      </Card>

      <div className="mw-grid-main-side">
        <Card>
          <CardHead title={t('rep.breakdownTitle')} subtitle={t('rep.breakdownSub')} />
          <CardBody>
            <DeliveryDonut data={deliveryCall.data?.delivery ?? []} />
          </CardBody>
        </Card>

        <Card>
          <CardHead title={t('rep.formatTitle')} subtitle={t('rep.formatSub')} />
          <CardBody>
            <Segmented items={FORMATS} value={format} onChange={setFormat} ariaLabel={t('rep.formatTitle')} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead title={t('rep.typesTitle')} subtitle={t('rep.typesSub')} />
        <CardBody>
          <div className="mw-optiongrid">
            {reportTypes.map((report) => (
              <button
                key={report.id}
                type="button"
                className="mw-option mw-option--button"
                data-id={report.id}
                onClick={openExport}
              >
                <span className="mw-option__icon" aria-hidden="true">
                  <i className={`bi ${report.icon}`} />
                </span>
                <span>
                  <span className="d-block mw-option__title">{t(report.nameKey)}</span>
                  <span className="d-block mw-option__desc">{t(report.descKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Note tone="info" icon="bi-clock-history">
        {t('rep.backgroundNote')}
      </Note>

      <Sheet
        open={Boolean(exportFor)}
        title={exportFor ? `${t('common.export')} — ${t(exportFor.nameKey)}` : ''}
        onClose={closeExport}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeExport}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-fill"
              onClick={downloadReport}
              disabled={downloading}
            >
              <i className="bi bi-download me-2" />
              {downloading ? t('common.loading') : t('common.download')}
            </button>
          </>
        }
      >
        {exportFor ? (
          <>
            <p className="mw-fs-14 mb-3">{t(exportFor.descKey)}</p>
            <div className="row g-3">
              {exportFor.id !== 'rp2' ? (
                <div className="col-12">
                  <label className="form-label" htmlFor="export-campaign">{t('nav.campaigns')}</label>
                  <select
                    id="export-campaign"
                    className="form-select"
                    value={campaignId}
                    onChange={(event) => setCampaignId(event.target.value)}
                  >
                    <option value="all">{t('filter.allCampaigns')}</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="export-from">{t('common.from')}</label>
                <input
                  id="export-from"
                  type="date"
                  className="form-control"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label" htmlFor="export-to">{t('common.to')}</label>
                <input
                  id="export-to"
                  type="date"
                  className="form-control"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>
            <div className="form-text mt-2">{t('rep.dateHint')}</div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

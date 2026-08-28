import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import { Note, Segmented } from '../components/ui/Controls';
import { useT } from '../i18n/I18nProvider';
import PerformanceChart from '../components/charts/PerformanceChart';
import DeliveryDonut from '../components/charts/DeliveryDonut';
import OpensHeatmap from '../components/charts/OpensHeatmap';
import CampaignTable from '../components/campaigns/CampaignTable';
import {
  campaigns,
  dashboardKpis,
  deliveryBreakdown,
  heatmapData,
  heatmapDays,
  trendByRange,
} from '../data/mockData';

const QUICK_ACTIONS = [
  { to: '/campaigns/new', labelKey: 'dash.createCampaign', hint: 'Guided 6-step wizard', icon: 'bi-megaphone' },
  { to: '/contacts/import', labelKey: 'con.importExcel', hint: '.xlsx, .xls or .csv', icon: 'bi-file-earmark-spreadsheet' },
  { to: '/contacts', labelKey: 'con.add', hint: 'One by one or in bulk', icon: 'bi-person-plus' },
  { to: '/templates/new', labelKey: 'tpl.create', hint: 'Write or paste HTML', icon: 'bi-code-square' },
  { to: '/accounts/connect', labelKey: 'acc.connect', hint: 'Gmail, Outlook, SMTP', icon: 'bi-plug' },
];

const KPI_LABEL_KEYS = {
  campaigns: 'kpi.campaigns',
  sent: 'kpi.sent',
  opened: 'kpi.opened',
  openRate: 'kpi.openRate',
  clicked: 'kpi.clicked',
  clickRate: 'kpi.clickRate',
  failed: 'kpi.failed',
  pending: 'kpi.pending',
  scheduled: 'kpi.scheduled',
};

export default function DashboardPage() {
  const t = useT();
  const [range, setRange] = useState('30d');
  const navigate = useNavigate();

  const RANGE_OPTIONS = [
    { value: '7d', label: t('dash.days7') },
    { value: '30d', label: t('dash.days30') },
    { value: '90d', label: t('dash.days90') },
  ];

  const trend = useMemo(() => trendByRange[range], [range]);
  const recent = useMemo(() => campaigns.slice(0, 5), []);

  function goToNewCampaign() {
    navigate('/campaigns/new');
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('dash.title')}
        subtitle={t('dash.subtitle')}
        helpTopic="dashboard"
        actions={
          <>
            <Link to="/reports" className="btn btn-outline-secondary mw-hide-mobile">
              <i className="bi bi-download me-2" />
              {t('dash.exportReport')}
            </Link>
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={goToNewCampaign}>
              <i className="bi bi-plus-lg me-2" />
              {t('dash.createCampaign')}
            </button>
          </>
        }
      />

      <div className="mw-kpi-grid">
        {dashboardKpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={t(KPI_LABEL_KEYS[kpi.id] || kpi.label)}
            value={kpi.value}
            icon={kpi.icon}
            tone={kpi.tone}
            delta={kpi.delta}
            trend={kpi.trend}
          />
        ))}
      </div>

      <Card>
        <CardHead
          title={t('dash.performance')}
          subtitle={t('dash.performanceSub')}
          tools={
            <>
              <div className="mw-legend mw-hide-mobile">
                <span className="mw-legend__item">
                  <span className="mw-legend__swatch mw-legend__swatch--sent" /> {t('kpi.sent')}
                </span>
                <span className="mw-legend__item">
                  <span className="mw-legend__swatch mw-legend__swatch--opened" /> {t('kpi.opened')}
                </span>
                <span className="mw-legend__item">
                  <span className="mw-legend__swatch mw-legend__swatch--clicked" /> {t('kpi.clicked')}
                </span>
              </div>
              <Segmented items={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel={t('filter.dateRange')} />
            </>
          }
        />
        <CardBody className="mw-chartcard__body">
          <PerformanceChart data={trend} />
        </CardBody>
      </Card>

      <div className="mw-grid-main-side">
        <Card>
          <CardHead title={t('dash.heatmap')} subtitle={t('dash.heatmapSub')} />
          <CardBody>
            <OpensHeatmap data={heatmapData} days={heatmapDays} />
          </CardBody>
        </Card>

        <Card>
          <CardHead title={t('dash.breakdown')} subtitle={t('dash.breakdownSub')} />
          <CardBody>
            <DeliveryDonut data={deliveryBreakdown} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead title={t('dash.quickActions')} subtitle={t('dash.quickActionsSub')} />
        <CardBody>
          <div className="mw-quick-grid">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.to} to={action.to} className="mw-quick">
                <span className="mw-quick__icon" aria-hidden="true">
                  <i className={`bi ${action.icon}`} />
                </span>
                <span>
                  <span className="d-block mw-quick__label">{t(action.labelKey)}</span>
                  <span className="d-block mw-quick__hint">{action.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      <Note tone="info" icon="bi-shield-check">
        <strong>{t('note.openTrackingTitle')} </strong>
        {t('note.openTracking')}
      </Note>

      <Card flush>
        <CardHead
          title={t('dash.recent')}
          subtitle={t('dash.recentSub')}
          tools={
            <Link to="/campaigns" className="btn btn-sm btn-outline-secondary">
              {t('common.all')}
            </Link>
          }
        />
        <CampaignTable items={recent} />
      </Card>
    </div>
  );
}

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
import { useApi } from '../api/useApi';

const QUICK_ACTIONS = [
  { to: '/campaigns/new', labelKey: 'dash.createCampaign', hint: 'Guided 6-step wizard', icon: 'bi-megaphone' },
  { to: '/contacts/import', labelKey: 'con.importExcel', hint: '.xlsx, .xls or .csv', icon: 'bi-file-earmark-spreadsheet' },
  { to: '/contacts', labelKey: 'con.add', hint: 'One by one or in bulk', icon: 'bi-person-plus' },
  { to: '/templates/new', labelKey: 'tpl.create', hint: 'Write or paste HTML', icon: 'bi-code-square' },
  { to: '/accounts/connect', labelKey: 'acc.connect', hint: 'Gmail, Outlook, SMTP', icon: 'bi-plug' },
];

/**
 * Har card ka naam, icon aur rang.
 *
 * Server sirf NUMBER bhejta hai, naam nahi — kyunki naam har bhasha me alag
 * hota hai. Isliye dikhne wali cheezein yahan rehti hain aur ginti wahan.
 */
const KPI_META = {
  campaigns: { labelKey: 'kpi.campaigns', icon: 'bi-megaphone', tone: 'primary' },
  sent: { labelKey: 'kpi.sent', icon: 'bi-send', tone: 'info' },
  opened: { labelKey: 'kpi.opened', icon: 'bi-envelope-open', tone: 'success' },
  openRate: { labelKey: 'kpi.openRate', icon: 'bi-graph-up-arrow', tone: 'success' },
  clicked: { labelKey: 'kpi.clicked', icon: 'bi-cursor', tone: 'primary' },
  clickRate: { labelKey: 'kpi.clickRate', icon: 'bi-bar-chart', tone: 'info' },
  failed: { labelKey: 'kpi.failed', icon: 'bi-exclamation-octagon', tone: 'danger' },
  pending: { labelKey: 'kpi.pending', icon: 'bi-hourglass-split', tone: 'warning' },
  scheduled: { labelKey: 'kpi.scheduled', icon: 'bi-calendar-event', tone: 'muted' },
};

const HEATMAP_HOURS = 24;

export default function DashboardPage() {
  const t = useT();
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');

  const RANGE_OPTIONS = [
    { value: '7d', label: t('dash.days7') },
    { value: '30d', label: t('dash.days30') },
    { value: '90d', label: t('dash.days90') },
  ];

  // Sab numbers server se — har baar taaza gine jate hain, kahin save nahi
  // hote. Isliye screen par jo dikhta hai wahi asli haal hota hai.
  const statsCall = useApi(`/api/stats/dashboard?range=${range}`, { deps: [range] });
  const trendCall = useApi(`/api/stats/trend?range=${range}`, { deps: [range] });
  const deliveryCall = useApi('/api/stats/delivery');
  const heatmapCall = useApi('/api/stats/heatmap');
  const recentCall = useApi('/api/campaigns?limit=5&sort=date');

  const kpis = statsCall.data?.kpis ?? [];
  const recent = recentCall.data?.campaigns ?? [];

  // Graph ke X-axis par chhoti date chahiye ("26 Aug"). Server sirf asli date
  // bhejta hai; use padhne layak banana screen ka kaam hai, kyunki har bhasha
  // me tarika alag hota hai.
  const trend = useMemo(
    () =>
      (trendCall.data?.trend ?? []).map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
      })),
    [trendCall.data]
  );

  /**
   * Heatmap ke liye 7 x 24 ka poora grid.
   *
   * Server sirf un khaano ke number bhejta hai jahan kuch hua tha. Baaki khane
   * yahan zero se bhar dete hain, warna grid me chhed reh jate.
   *
   * `level` 0 se 5 tak hota hai (rang ki gehrai). Sabse zyada khulne wale
   * khane ko 5 maan kar baaki uske hisaab se naap lete hain — isse chhote
   * data par bhi heatmap kuch dikhata hai, khali kaala nahi rehta.
   */
  const heatmap = useMemo(() => {
    const days = heatmapCall.data?.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const points = heatmapCall.data?.heatmap ?? [];

    const max = points.reduce((top, point) => Math.max(top, point.value), 0);
    const lookup = new Map(points.map((point) => [`${point.day}-${point.hour}`, point.value]));

    const grid = days.map((day, dayIndex) =>
      Array.from({ length: HEATMAP_HOURS }, (unused, hour) => {
        const opens = lookup.get(`${dayIndex}-${hour}`) ?? 0;
        return {
          day,
          hour,
          opens,
          level: max === 0 ? 0 : Math.min(5, Math.ceil((opens / max) * 5)),
        };
      })
    );

    return { grid, days };
  }, [heatmapCall.data]);

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
        {kpis.map((kpi) => {
          const meta = KPI_META[kpi.id];
          if (!meta) return null;

          return (
            <KpiCard
              key={kpi.id}
              label={t(meta.labelKey)}
              value={kpi.value}
              icon={meta.icon}
              tone={meta.tone}
              delta={kpi.delta}
              trend={kpi.trend}
            />
          );
        })}
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
            <OpensHeatmap data={heatmap.grid} days={heatmap.days} />
          </CardBody>
        </Card>

        <Card>
          <CardHead title={t('dash.breakdown')} subtitle={t('dash.breakdownSub')} />
          <CardBody>
            <DeliveryDonut data={deliveryCall.data?.delivery ?? []} />
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

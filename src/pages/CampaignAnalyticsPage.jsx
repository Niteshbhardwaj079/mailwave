import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import KpiCard from '../components/ui/KpiCard';
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { downloadCsv, objectsToRows } from '../utils/download';
import StatusPill from '../components/ui/StatusPill';
import Sheet from '../components/ui/Sheet';
import PerformanceChart from '../components/charts/PerformanceChart';
import { widthClass, formatDateTime, formatNumber, percent, percentValue } from '../utils/format';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import EmptyState from '../components/ui/EmptyState';

/** The click handler does the work; React just needs an onChange to be happy. */
function noop() {}

// Har event ka naam aur rang. Ek hi jagah rakhne se timeline aur baaki screen
// kabhi alag nahi dikhte.
const EVENT_LABEL = {
  sent: 'camp.evSent',
  open: 'camp.evOpened',
  click: 'camp.evClicked',
  unsubscribe: 'camp.evUnsubscribed',
  subscribe: 'camp.evSubscribed',
  bounce: 'camp.evBounced',
  failed: 'camp.evFailed',
};

const EVENT_TONE = {
  sent: 'primary',
  open: 'info',
  click: 'success',
  unsubscribe: 'muted',
  subscribe: 'success',
  bounce: 'warning',
  failed: 'danger',
};

export default function CampaignAnalyticsPage() {
  const t = useT();
  const { bulkRecipientAction } = useWorkspace();
  const { campaignId } = useParams();
  const [removedIds, setRemovedIds] = useState([]);
  const [status, setStatus] = useState('All');
  const [frequency, setFrequency] = useState('0');
  const [dateRange, setDateRange] = useState('all');
  const [query, setQuery] = useState('');
  // Box me turant, chhantai 200ms ruk kar — type karte waqt atakta nahi.
  const search = useDebouncedValue(query, 200);
  const [logFor, setLogFor] = useState(null);
  const [logEvents, setLogEvents] = useState([]);
  const [bulkDone, setBulkDone] = useState('');

  // Is page ka saara data ISI campaign ka hai — koi saanjhi list nahi.
  const campaignCall = useApi(`/api/campaigns/${campaignId}`, { deps: [campaignId] });
  const recipientsCall = useApi(`/api/campaigns/${campaignId}/recipients?limit=500`, {
    deps: [campaignId],
  });
  const trendCall = useApi(`/api/campaigns/${campaignId}/trend`, { deps: [campaignId] });
  const linksCall = useApi(`/api/campaigns/${campaignId}/links`, { deps: [campaignId] });

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Chaaron calls apna-apna data ek hi hamare server se laate hain — koi
  // per-hit paid API nahi, isliye baar-baar mangwana bhi free hai.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      campaignCall.refresh(),
      recipientsCall.refresh(),
      trendCall.refresh(),
      linksCall.refresh(),
    ]);
    setLastUpdated(new Date());
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Tab khuli rehte hue har 30s me chupchap taaza kar deta hai — page reload
  // ki zaroorat nahi. Tab background me ho to rukta hai, taaki fazool na chale.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAll();
    }, 30000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  const campaign = campaignCall.data?.campaign ?? null;
  // Kuch contacts bina naam ke import hue the (purana data) — naam khaali ho
  // to email hi dikha dete hain, taaki row.name.slice() jaisi jagah crash na
  // ho aur list me khaali jagah bhi na dikhe.
  const rows = useMemo(
    () =>
      (recipientsCall.data?.recipients ?? []).map((row) => ({
        ...row,
        name: row.name?.trim() || row.email,
        // Unsubscribe alag column hai, status nahi — isliye jab tak yahan na
        // jodein, table/filter me kabhi dikhta hi nahi ki kaun chhod gaya.
        displayStatus: row.unsubscribed ? 'Unsubscribed' : row.status,
      })),
    [recipientsCall.data]
  );

  // Graph ke X-axis par chhoti date chahiye ("26 Aug"). Server asli date
  // bhejta hai; padhne layak banana screen ka kaam hai.
  const trend = useMemo(
    () =>
      (trendCall.data?.trend ?? []).map((point) => ({
        ...point,
        label: new Date(point.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
      })),
    [trendCall.data]
  );

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (removedIds.includes(row.id)) return false;
      const statusOk =
        status === 'All' ||
        (status === 'Opened' && row.opened) ||
        (status === 'NotOpened' && !row.opened) ||
        (status === 'Clicked' && row.clicked) ||
        (status === 'NotClicked' && !row.clicked) ||
        row.displayStatus === status;
      const freqOk = row.openCount >= Number(frequency);
      const textOk = !text || row.name.toLowerCase().includes(text) || row.email.toLowerCase().includes(text);
      return statusOk && freqOk && textOk;
    });
  }, [rows, status, frequency, search, removedIds]);

  const visibleIds = useMemo(() => filtered.map((row) => row.id), [filtered]);
  const bulk = useBulkSelection(visibleIds);

  const selectedRows = useMemo(
    () => filtered.filter((row) => bulk.isSelected(row.id)),
    [filtered, bulk]
  );

  const [resendingTop, setResendingTop] = useState(false);

  async function handleResendUnopened() {
    setResendingTop(true);
    try {
      const data = await api.post(`/api/campaigns/${campaignId}/resend`, { target: 'unopened' });
      setBulkDone(
        data.affected > 0
          ? t('toast.resendUnopenedDone', { count: data.affected })
          : t('toast.resendNothing')
      );
      recipientsCall.reload();
      campaignCall.reload();
    } catch (error) {
      setBulkDone('');
    } finally {
      setResendingTop(false);
    }
  }

  function quickFilterFailed() {
    setStatus('Failed');
    bulk.clear();
  }

  function quickFilterBounced() {
    setStatus('Bounced');
    bulk.clear();
  }

  function handleRowCheck(event) {
    event.stopPropagation();
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  function handleBulkResend() {
    bulkRecipientAction('resend', bulk.selectedIds, campaign.name);
    setBulkDone(t('bulk.doneResend', { count: selectedRows.length }));
    bulk.clear();
  }

  function handleBulkRemove() {
    setRemovedIds((current) => [...current, ...bulk.selectedIds]);
    bulkRecipientAction('remove', bulk.selectedIds, campaign.name);
    setBulkDone(t('bulk.doneRemove', { count: selectedRows.length }));
    bulk.clear();
  }

  function handleBulkSuppress() {
    setRemovedIds((current) => [...current, ...bulk.selectedIds]);
    bulkRecipientAction('suppress', bulk.selectedIds, campaign.name);
    setBulkDone(t('bulk.doneSuppress', { count: selectedRows.length }));
    bulk.clear();
  }

  function handleBulkExport() {
    downloadCsv(
      'recipients-selected.csv',
      objectsToRows(selectedRows, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
        { key: 'openCount', label: 'Opens' },
        { key: 'clickCount', label: 'Clicks' },
        { key: 'lastActivity', label: 'Last activity' },
      ])
    );
    bulkRecipientAction('export', bulk.selectedIds, campaign.name);
  }

  async function openLog(event) {
    const row = rows.find((item) => item.id === event.currentTarget.dataset.id) || null;
    setLogFor(row);
    setLogEvents([]);
    if (!row) return;

    // Poora hisaab: kab bheja, kab khola, kab click kiya. Yeh sabse kaam ka
    // tab hota hai jab koi kahe "mujhe mail mila hi nahi".
    try {
      const data = await api.get(`/api/campaigns/${campaignId}/recipients/${row.id}/events`);
      setLogEvents(data.events ?? []);
    } catch (error) {
      // Log na aaye to sheet phir bhi khulti hai — upar wali detail dikh jati
      // hai. Iske liye poora page rokna galat hoga.
      setLogEvents([]);
    }
  }

  function closeLog() {
    setLogFor(null);
    setLogEvents([]);
  }

  const statusOptions = [
    { value: 'All', label: t('filter.allStatuses') },
    { value: 'Sent', label: t('kpi.sent') },
    { value: 'Opened', label: t('kpi.opened') },
    { value: 'NotOpened', label: t('filter.notOpened') },
    { value: 'Clicked', label: t('kpi.clicked') },
    { value: 'NotClicked', label: t('filter.notClicked') },
    { value: 'Failed', label: t('kpi.failed') },
    { value: 'Bounced', label: t('kpi.bounced') },
    { value: 'Unsubscribed', label: t('kpi.unsubscribed') },
  ];

  const frequencyOptions = [
    { value: '0', label: t('filter.anyOpens') },
    { value: '1', label: t('filter.opens1') },
    { value: '2', label: t('filter.opens2') },
    { value: '3', label: t('filter.opens3') },
  ];

  const dateOptions = [
    { value: 'all', label: t('filter.allTime') },
    { value: 'today', label: t('filter.today') },
    { value: '7d', label: t('filter.last7') },
    { value: '30d', label: t('filter.last30') },
  ];

  function clearFilters() {
    setStatus('All');
    setFrequency('0');
    setDateRange('all');
    setQuery('');
  }

  // Data abhi aaya nahi (ya campaign hai hi nahi) — neeche ka poora page
  // isi par tika hai, isliye yahin ruk jate hain.
  if (!campaign) {
    return (
      <div className="mw-stack">
        {campaignCall.loading ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : (
          <EmptyState icon="bi-megaphone" title={t('common.noResults')} text={t('common.noResultsText')} />
        )}
      </div>
    );
  }

  const kpis = [
    { id: 'sent', label: t('kpi.sent'), value: campaign.sent, icon: 'bi-send', tone: 'primary' },
    { id: 'pending', label: t('kpi.pending'), value: campaign.pending, icon: 'bi-hourglass-split', tone: 'muted' },
    { id: 'opened', label: t('kpi.openedEstimate'), value: campaign.opened, icon: 'bi-envelope-open', tone: 'info' },
    { id: 'openRate', label: t('kpi.openRate'), value: percent(campaign.opened, campaign.sent), icon: 'bi-graph-up-arrow', tone: 'info' },
    { id: 'clicked', label: t('kpi.clicked'), value: campaign.clicked, icon: 'bi-cursor', tone: 'success' },
    { id: 'clickRate', label: t('kpi.clickRate'), value: percent(campaign.clicked, campaign.sent), icon: 'bi-bar-chart', tone: 'success' },
    { id: 'failed', label: t('kpi.failed'), value: campaign.failed, icon: 'bi-exclamation-octagon', tone: 'danger' },
    { id: 'bounced', label: t('kpi.bounced'), value: campaign.bounced, icon: 'bi-arrow-return-left', tone: 'warning' },
    { id: 'unsub', label: t('kpi.unsubscribed'), value: campaign.unsubscribed, icon: 'bi-person-dash', tone: 'muted' },
  ];

  const funnel = [
    { key: 'sent', label: t('kpi.sent'), value: campaign.sent, tone: 'sent' },
    { key: 'opened', label: t('kpi.opened'), value: campaign.opened, tone: 'opened' },
    { key: 'clicked', label: t('kpi.clicked'), value: campaign.clicked, tone: 'clicked' },
  ];

  // Nothing has gone out yet for a draft or a scheduled campaign, so the whole
  // results half of this page must stay quiet instead of showing borrowed data.
  const hasResults = campaign.sent > 0;

  // Asli click ginti — campaign_links table se, kisi andaze se nahi.
  const topLinks = linksCall.data?.links ?? [];
  const maxClicks = Math.max(1, ...topLinks.map((link) => link.clicks));

  return (
    <div className="mw-stack">
      <PageHeader
        title={campaign.name}
        subtitle={`Sent from ${campaign.sender} · ${campaign.template} template`}
        breadcrumb={[{ label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]}
        actions={
          <>
            <span className="mw-fs-12 mw-text-muted mw-hide-mobile me-1 align-self-center">
              {t('camp.lastUpdated', { time: lastUpdated.toLocaleTimeString() })}
            </span>
            <button type="button" className="btn btn-outline-secondary" onClick={refreshAll} disabled={refreshing}>
              <i className={`bi bi-arrow-clockwise me-2 ${refreshing ? 'mw-spin' : ''}`.trim()} />
              {refreshing ? t('camp.refreshing') : t('camp.refresh')}
            </button>
            <button type="button" className="btn btn-outline-secondary mw-hide-mobile" disabled={!hasResults}>
              <i className="bi bi-download me-2" />
              Export
            </button>
            <button
              type="button"
              className="btn btn-outline-primary mw-hide-mobile"
              onClick={handleResendUnopened}
              disabled={!hasResults || resendingTop}
            >
              <i className={`bi bi-arrow-repeat me-2 ${resendingTop ? 'mw-spin' : ''}`.trim()} />
              {resendingTop ? t('camp.refreshing') : t('camp.resendUnopened')}
            </button>
            <button type="button" className="btn btn-primary mw-btn-block-mobile">
              <i className="bi bi-diagram-3 me-2" />
              {t('camp.createSegment')}
            </button>
          </>
        }
      />

      <div className="mw-kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
        ))}
      </div>

      <Note tone="info" icon="bi-info-circle">
        <strong>{t('camp.sentMeaning')}</strong> {t('camp.sentMeaningText')}
      </Note>

      <div className="mw-grid-main-side">
        <Card>
          <CardHead title={t('camp.activityOverTime')} subtitle={t('camp.activityOverTimeSub')} />
          <CardBody className="mw-chartcard__body">
            {trend.length > 0 ? (
              <PerformanceChart data={trend} height="sm" />
            ) : (
              <p className="mw-fs-13 mw-text-muted mb-0">
                Nothing has been sent yet, so there is no activity to show.
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title={t('camp.journey')} subtitle={t('camp.journeySub')} />
          <CardBody>
            <div className="mw-funnel">
              {funnel.map((stage) => (
                <div key={stage.key} className="mw-funnel__step">
                  <span className="mw-funnel__label">{stage.label}</span>
                  <span className="mw-funnel__track">
                    <span
                      className={`mw-funnel__fill mw-funnel__fill--${stage.tone} ${widthClass(
                        percentValue(stage.value, campaign.sent)
                      )}`}
                    />
                  </span>
                  <span className="mw-funnel__pct">
                    {formatNumber(stage.value)}
                    <small>{percent(stage.value, campaign.sent, 1)}</small>
                  </span>
                </div>
              ))}
            </div>

            <hr className="my-4" />

            <h3 className="mw-fs-14 mw-fw-700 mb-2">{t('camp.topLinks')}</h3>
            {campaign.clickTracking && topLinks.length > 0 ? (
              topLinks.map((link) => (
                <div key={link.id} className="mw-linkstat">
                  <span className="mw-linkstat__body">
                    <span className="d-block mw-linkstat__name">{link.name}</span>
                    <span className="d-block mw-linkstat__url">{link.url}</span>
                    <span className="mw-progress mt-2">
                      <span className={`mw-progress__bar ${widthClass(percentValue(link.clicks, maxClicks))}`} />
                    </span>
                  </span>
                  <span className="mw-linkstat__count">{link.clicks}</span>
                </div>
              ))
            ) : (
              <p className="mw-fs-13 mw-text-muted mb-0">
                {campaign.clickTracking
                  ? 'No link has been clicked yet. Numbers appear here as soon as someone presses a link.'
                  : 'Click tracking was turned off for this campaign.'}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mw-grid-2">
        <Card>
          <CardHead title={t('camp.afterSending')} subtitle={t('camp.afterSendingSub')} />
          <CardBody>
            <div className="mw-breakdown">
              <div className="mw-breakdown__row">
                <span className="mw-legend__swatch mw-legend__swatch--sent" aria-hidden="true" />
                <span className="mw-breakdown__name">{t('kpi.sent')}</span>
                <span className="mw-breakdown__value">{formatNumber(campaign.sent)}</span>
                <span className="mw-breakdown__pct">{percent(campaign.sent, campaign.recipients)}</span>
              </div>
              <div className="mw-breakdown__row">
                <span className="mw-legend__swatch mw-legend__swatch--muted" aria-hidden="true" />
                <span className="mw-breakdown__name">{t('kpi.pending')}</span>
                <span className="mw-breakdown__value">{formatNumber(campaign.pending)}</span>
                <span className="mw-breakdown__pct">{percent(campaign.pending, campaign.recipients)}</span>
              </div>
              <div className="mw-breakdown__row">
                <span className="mw-legend__swatch mw-legend__swatch--failed" aria-hidden="true" />
                <span className="mw-breakdown__name">Failed</span>
                <span className="mw-breakdown__value">{formatNumber(campaign.failed)}</span>
                <span className="mw-breakdown__pct">{percent(campaign.failed, campaign.recipients)}</span>
              </div>
              <div className="mw-breakdown__row">
                <span className="mw-legend__swatch mw-legend__swatch--bounced" aria-hidden="true" />
                <span className="mw-breakdown__name">Bounced</span>
                <span className="mw-breakdown__value">{formatNumber(campaign.bounced)}</span>
                <span className="mw-breakdown__pct">{percent(campaign.bounced, campaign.recipients)}</span>
              </div>
              <div className="mw-breakdown__row">
                <span className="mw-legend__swatch mw-legend__swatch--unsub" aria-hidden="true" />
                <span className="mw-breakdown__name">{t('kpi.unsubscribed')}</span>
                <span className="mw-breakdown__value">{formatNumber(campaign.unsubscribed)}</span>
                <span className="mw-breakdown__pct">{percent(campaign.unsubscribed, campaign.recipients)}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHead title={t('camp.settingsUsed')} subtitle={t('camp.settingsUsedSub')} />
          <CardBody>
            <div className="mw-kv">
              <span className="mw-kv__key">Batch size</span>
              <span className="mw-kv__value">{formatNumber(campaign.batchSize)} per batch</span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">Open tracking</span>
              <span className="mw-kv__value">
                <StatusPill status={campaign.openTracking ? 'Enabled' : 'Off'} tone={campaign.openTracking ? 'success' : 'muted'} />
              </span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">Click tracking</span>
              <span className="mw-kv__value">
                <StatusPill status={campaign.clickTracking ? 'Enabled' : 'Off'} tone={campaign.clickTracking ? 'success' : 'muted'} />
              </span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">{hasResults ? 'Sent on' : 'Planned for'}</span>
              <span className="mw-kv__value">
                {hasResults
                  ? formatDateTime(campaign.date)
                  : `${formatDateTime(campaign.date)} — not sent yet`}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Note tone="info" icon="bi-eye">
        <strong>{t('camp.openEstimate')}</strong> {t('camp.openEstimateText')}
      </Note>

      <Card flush>
        <CardHead
          title={t('camp.recipientActivity')}
          subtitle={`${t('common.showing')} ${filtered.length} ${t('common.of')} ${rows.length}`}
        />

        {hasResults ? (
        <div className="mw-toolbar">
          <span className="mw-fs-13 mw-fw-650">{t('bulk.quickClean')}</span>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={quickFilterFailed}>
            <i className="bi bi-exclamation-octagon me-2" />
            {t('kpi.failed')} ({campaign.failed})
          </button>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={quickFilterBounced}>
            <i className="bi bi-arrow-return-left me-2" />
            {t('kpi.bounced')} ({campaign.bounced})
          </button>
          <span className="mw-fs-12 mw-text-muted">{t('bulk.quickCleanHint')}</span>
        </div>
        ) : null}

        {bulkDone ? (
          <div className="mw-toolbar">
            <span className="mw-note mw-note--success w-100">
              <i className="bi bi-check-circle mw-note__icon" aria-hidden="true" />
              <span>{bulkDone}</span>
            </span>
          </div>
        ) : null}

        <BulkBar
          count={bulk.count}
          total={filtered.length}
          onSelectAll={bulk.selectAllVisible}
          onClear={bulk.clear}
          actions={
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleBulkResend}>
                <i className="bi bi-arrow-repeat me-2" />
                {t('bulk.resend')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleBulkExport}>
                <i className="bi bi-download me-2" />
                {t('bulk.export')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-warning" onClick={handleBulkSuppress}>
                <i className="bi bi-slash-circle me-2" />
                {t('bulk.suppress')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleBulkRemove}>
                <i className="bi bi-trash3 me-2" />
                {t('bulk.remove')}
              </button>
            </>
          }
        />

        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('log.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="rec-filter-status"
            label={t('filter.status')}
            icon="bi-funnel"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <FilterSelect
            id="rec-filter-opens"
            label={t('filter.opens')}
            icon="bi-envelope-open"
            value={frequency}
            onChange={setFrequency}
            options={frequencyOptions}
          />
          <FilterSelect
            id="rec-filter-date"
            label={t('filter.dateRange')}
            icon="bi-calendar3"
            value={dateRange}
            onChange={setDateRange}
            options={dateOptions}
          />
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState icon="bi-people" title={t('common.noResults')} text={t('common.noResultsText')} />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table mw-table--wide mw-table--clickable">
                <thead>
                  <tr>
                    <th scope="col" className="mw-table__check">
                      <SelectAllCheckbox
                        checked={bulk.allVisibleSelected}
                        indeterminate={bulk.someVisibleSelected}
                        onChange={bulk.toggleAllVisible}
                        label={t('bulk.selectAllRows')}
                      />
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Sent</th>
                    <th scope="col">Opened</th>
                    <th scope="col" className="mw-table__num">Opens</th>
                    <th scope="col">First open</th>
                    <th scope="col">Last open</th>
                    <th scope="col">Clicked</th>
                    <th scope="col" className="mw-table__num">Clicks</th>
                    <th scope="col">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} data-id={row.id} onClick={openLog}>
                      <td className="mw-table__check">
                        <input
                          type="checkbox"
                          className="form-check-input mw-rowcheck"
                          checked={bulk.isSelected(row.id)}
                          data-id={row.id}
                          onClick={handleRowCheck}
                          onChange={noop}
                          aria-label={`${t('bulk.select')} ${row.name}`}
                        />
                      </td>
                      <td>
                        <div className="mw-cellstack">
                          <span className="mw-avatar mw-avatar--sm">{row.name.slice(0, 1)}</span>
                          <span>
                            <span className="d-block mw-table__primary">{row.name}</span>
                            <span className="d-block mw-table__muted">{row.company}</span>
                          </span>
                        </div>
                      </td>
                      <td className="mw-table__muted">{row.email}</td>
                      <td>
                        <StatusPill status={row.displayStatus} />
                      </td>
                      <td>{row.sent ? <i className="bi bi-check-lg mw-text-success" /> : <span className="mw-text-muted-2">—</span>}</td>
                      <td>{row.opened ? <i className="bi bi-check-lg mw-text-success" /> : <span className="mw-text-muted-2">No</span>}</td>
                      <td className="mw-table__num">{row.openCount}</td>
                      <td className="mw-table__muted mw-nowrap">{row.firstOpen}</td>
                      <td className="mw-table__muted mw-nowrap">{row.lastOpen}</td>
                      <td>{row.clicked ? <i className="bi bi-check-lg mw-text-success" /> : <span className="mw-text-muted-2">No</span>}</td>
                      <td className="mw-table__num">{row.clickCount}</td>
                      <td className="mw-table__muted mw-nowrap">{row.lastActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {filtered.map((row) => (
                <div key={row.id} className={`mw-rec ${bulk.isSelected(row.id) ? 'is-selected' : ''}`.trim()}>
                  <div className="mw-rec__top">
                    <input
                      type="checkbox"
                      className="form-check-input mw-rowcheck mw-rec__check"
                      checked={bulk.isSelected(row.id)}
                      data-id={row.id}
                      onClick={handleRowCheck}
                      onChange={noop}
                      aria-label={`${t('bulk.select')} ${row.name}`}
                    />
                    <span className="mw-avatar mw-avatar--sm">{row.name.slice(0, 1)}</span>
                    <span className="mw-rec__title">
                      {row.name}
                      <span className="d-block mw-rec__sub">{row.email}</span>
                    </span>
                    <StatusPill status={row.displayStatus} />
                  </div>
                  <div className="mw-rec__stats">
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">Opens</span>
                      <span className="mw-rec__statvalue">{row.openCount}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">Clicks</span>
                      <span className="mw-rec__statvalue">{row.clickCount}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">First open</span>
                      <span className="mw-rec__statvalue mw-fs-12">{row.firstOpen}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">Last activity</span>
                      <span className="mw-rec__statvalue mw-fs-12">{row.lastActivity}</span>
                    </span>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary mt-3" data-id={row.id} onClick={openLog}>
                    <i className="bi bi-clock-history me-2" />
                    {t('log.details')}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <CardFoot>
          <div className="mw-row mw-row--wrap">
            <button type="button" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-filetype-csv me-2" />
              Export CSV
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-file-earmark-excel me-2" />
              Export Excel
            </button>
            <button type="button" className="btn btn-sm btn-outline-primary">
              <i className="bi bi-diagram-3 me-2" />
              Save this filter as a segment
            </button>
          </div>
        </CardFoot>
      </Card>

      <Sheet open={Boolean(logFor)} title={logFor ? `${logFor.name} — email log` : ''} onClose={closeLog}>
        {logFor ? (
          <>
            <div className="mw-row mw-row--between mb-4">
              <span className="mw-fs-13 mw-text-muted">{logFor.email}</span>
              <StatusPill status={logFor.status} />
            </div>

            <ul className="mw-timeline">
              {logEvents.map((event, index) => (
                <li key={`${event.kind}-${event.at}-${index}`} className="mw-timeline__item">
                  <span
                    className={`mw-timeline__dot mw-timeline__dot--${EVENT_TONE[event.kind] ?? 'primary'}`}
                    aria-hidden="true"
                  />
                  <span className="d-block mw-timeline__time">{formatDateTime(event.at)}</span>
                  <span className="d-block mw-timeline__text">
                    {t(EVENT_LABEL[event.kind] ?? 'common.actions')}
                    {event.detail ? <span className="d-block mw-text-muted mw-fs-12">{event.detail}</span> : null}
                  </span>
                </li>
              ))}
              {logEvents.length === 0 ? (
                <li className="mw-timeline__item mw-text-muted mw-fs-13">{t('camp.noEvents')}</li>
              ) : null}
            </ul>

            <hr className="my-4" />

            <div className="mw-fs-13">
              <div className="mw-kv">
                <span className="mw-kv__key">Provider</span>
                <span className="mw-kv__value">Gmail API</span>
              </div>
              <div className="mw-kv">
                <span className="mw-kv__key">Opens</span>
                <span className="mw-kv__value">{logFor.openCount} (estimate)</span>
              </div>
              <div className="mw-kv">
                <span className="mw-kv__key">Clicks</span>
                <span className="mw-kv__value">{logFor.clickCount}</span>
              </div>
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import Pagination, { usePagination } from '../components/ui/Pagination';
import PageSizePicker from '../components/ui/PageSizePicker';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { downloadCsv, objectsToRows } from '../utils/download';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';

function noop() {}

export default function SubscribersPage() {
  const t = useT();
  const navigate = useNavigate();
  const { subscribers, removeSubscribers } = useWorkspace();

  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [done, setDone] = useState('');

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return subscribers.filter((item) => {
      const campaignOk = campaignFilter === 'all' || item.campaignId === campaignFilter;
      const statusOk = statusFilter === 'all' || item.status === statusFilter;
      const textOk =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.email.toLowerCase().includes(text) ||
        (item.company || '').toLowerCase().includes(text);
      return campaignOk && statusOk && textOk;
    });
  }, [subscribers, query, campaignFilter, statusFilter]);

  // Sirf ek page jitni rows render hoti hain — badi list par browser hang na ho.
  const pager = usePagination(filtered, 50);

  // Tick-box sirf dikh rahi rows par — warna "sab chuno" un logon ko bhi chun
  // leta jo screen par hain hi nahi.
  // Header ka tick-box is page ko chunta hai; "Select all" poori matching list.
  const pageIds = useMemo(() => pager.visible.map((item) => item.id), [pager.visible]);
  const allIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const bulk = useBulkSelection(pageIds, allIds);
  const selectedRows = useMemo(() => filtered.filter((item) => bulk.isSelected(item.id)), [filtered, bulk]);

  const active = subscribers.filter((item) => item.status === 'Subscribed');

  function handleRowCheck(event) {
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  function handleExport() {
    downloadCsv(
      'subscribers.csv',
      objectsToRows(selectedRows.length ? selectedRows : filtered, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'company', label: 'Company' },
        { key: 'city', label: 'City' },
        { key: 'campaign', label: 'Subscribed from' },
        { key: 'subscribedAt', label: 'Subscribed on' },
        { key: 'status', label: 'Status' },
      ])
    );
  }

  function handleRemove() {
    removeSubscribers(bulk.selectedIds);
    setDone(t('sub.removed', { count: bulk.selectedIds.length }));
    bulk.clear();
  }

  function handleCampaign() {
    navigate('/campaigns/new');
  }

  function clearFilters() {
    setQuery('');
    setCampaignFilter('all');
    setStatusFilter('all');
  }

  const usedCampaigns = useMemo(() => {
    const seen = new Map();
    subscribers.forEach((item) => seen.set(item.campaignId, item.campaign));
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [subscribers]);

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('sub.title')}
        subtitle={t('sub.subtitle')}
        helpTopic="subscribers"
        actions={
          <>
            <button type="button" className="btn btn-outline-secondary mw-hide-mobile" onClick={handleExport}>
              <i className="bi bi-download me-2" />
              {t('common.export')}
            </button>
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={handleCampaign}>
              <i className="bi bi-send me-2" />
              {t('sub.emailThem')}
            </button>
          </>
        }
      />

      <div className="mw-kpi-grid">
        <KpiCard label={t('sub.total')} value={subscribers.length} icon="bi-hand-thumbs-up" tone="success" />
        <KpiCard label={t('sub.active')} value={active.length} icon="bi-person-check" tone="primary" />
        <KpiCard
          label={t('sub.left')}
          value={subscribers.length - active.length}
          icon="bi-person-dash"
          tone="muted"
        />
        <KpiCard label={t('sub.fromCampaigns')} value={usedCampaigns.length} icon="bi-megaphone" tone="info" />
      </div>

      <Note tone="success" icon="bi-hand-thumbs-up">
        {t('sub.intro')}
      </Note>

      <Card flush>
        <CardHead title={t('sub.list')} subtitle={t('sub.listSub')} />

        {done ? (
          <div className="mw-toolbar">
            <span className="mw-note mw-note--success w-100">
              <i className="bi bi-check-circle mw-note__icon" aria-hidden="true" />
              <span>{done}</span>
            </span>
          </div>
        ) : null}

        <BulkBar
          count={bulk.count}
          total={bulk.total}
          pageCount={pageIds.length}
          onSelectAll={bulk.selectAll}
          onClear={bulk.clear}
          actions={
            <>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleCampaign}>
                <i className="bi bi-send me-2" />
                {t('sub.emailSelected')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleExport}>
                <i className="bi bi-download me-2" />
                {t('bulk.export')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleRemove}>
                <i className="bi bi-trash3 me-2" />
                {t('bulk.remove')}
              </button>
            </>
          }
        />

        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('sub.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="sub-campaign"
            label={t('sub.fromCampaign')}
            icon="bi-megaphone"
            value={campaignFilter}
            onChange={setCampaignFilter}
            options={[{ value: 'all', label: t('common.all') }, ...usedCampaigns]}
          />
          <FilterSelect
            id="sub-status"
            label={t('common.status')}
            icon="bi-funnel"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: t('filter.allStatuses') },
              { value: 'Subscribed', label: t('sub.statusActive') },
              { value: 'Left later', label: t('sub.statusLeft') },
            ]}
          />
          {/* Kitni rows dikhani hain — filter ke bagal me. */}
          <PageSizePicker value={pager.limit} onChange={pager.setLimit} />
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            icon="bi-hand-thumbs-up"
            title={t('sub.empty')}
            text={t('sub.emptyText')}
            action={
              <Link to="/campaigns/new" className="btn btn-primary">
                {t('dash.createCampaign')}
              </Link>
            }
          />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table">
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
                    <th scope="col">{t('common.name')}</th>
                    <th scope="col">{t('common.email')}</th>
                    <th scope="col">{t('common.company')}</th>
                    <th scope="col">{t('sub.fromCampaign')}</th>
                    <th scope="col">{t('sub.when')}</th>
                    <th scope="col">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.visible.map((item) => (
                    <tr key={item.id}>
                      <td className="mw-table__check">
                        <input
                          type="checkbox"
                          className="form-check-input mw-rowcheck"
                          checked={bulk.isSelected(item.id)}
                          data-id={item.id}
                          onClick={handleRowCheck}
                          onChange={noop}
                          aria-label={`${t('bulk.select')} ${item.name}`}
                        />
                      </td>
                      <td className="mw-table__primary">{item.name}</td>
                      <td className="mw-table__muted">{item.email}</td>
                      <td>{item.company}</td>
                      <td className="mw-table__muted">{item.campaign}</td>
                      <td className="mw-nowrap mw-num">{item.subscribedAt}</td>
                      <td>
                        <StatusPill
                          status={item.status === 'Subscribed' ? t('sub.statusActive') : t('sub.statusLeft')}
                          tone={item.status === 'Subscribed' ? 'success' : 'muted'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {pager.visible.map((item) => (
                <div key={item.id} className={`mw-rec ${bulk.isSelected(item.id) ? 'is-selected' : ''}`.trim()}>
                  <div className="mw-rec__top">
                    <input
                      type="checkbox"
                      className="form-check-input mw-rowcheck mw-rec__check"
                      checked={bulk.isSelected(item.id)}
                      data-id={item.id}
                      onClick={handleRowCheck}
                      onChange={noop}
                      aria-label={`${t('bulk.select')} ${item.name}`}
                    />
                    <span className="mw-rec__title">
                      {item.name}
                      <span className="d-block mw-rec__sub">{item.email}</span>
                    </span>
                    <StatusPill
                      status={item.status === 'Subscribed' ? t('sub.statusActive') : t('sub.statusLeft')}
                      tone={item.status === 'Subscribed' ? 'success' : 'muted'}
                    />
                  </div>
                  <div className="mw-fs-12 mw-text-muted">
                    <i className="bi bi-megaphone me-1" />
                    {item.campaign} · {item.subscribedAt}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Pagination


          page={pager.page}


          pages={pager.pages}


          total={pager.total}


          limit={pager.limit}


          onPageChange={pager.setPage}


          onLimitChange={pager.setLimit}


        />
      </Card>

      <Card>
        <CardHead title={t('sub.howTitle')} subtitle={t('sub.howSub')} />
        <CardBody>
          <ol className="mw-steps">
            <li className="mw-steps__item">
              <p className="mw-steps__text">{t('sub.how1')}</p>
            </li>
            <li className="mw-steps__item">
              <p className="mw-steps__text">{t('sub.how2')}</p>
            </li>
            <li className="mw-steps__item">
              <p className="mw-steps__text">{t('sub.how3')}</p>
            </li>
            <li className="mw-steps__item">
              <p className="mw-steps__text">{t('sub.how4')}</p>
            </li>
          </ol>

          <Note tone="info" icon="bi-braces">
            {t('sub.variableNote')} <span className="mw-var">{'{{subscribe_url}}'}</span>
          </Note>
        </CardBody>
      </Card>
    </div>
  );
}

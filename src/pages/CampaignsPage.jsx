import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { Card } from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import PageSizePicker from '../components/ui/PageSizePicker';
import { SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import { useT } from '../i18n/I18nProvider';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { useServerList } from '../api/useServerList';
import { formatDate, formatNumber, percent } from '../utils/format';
import { ApiError, api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';

const STATUSES = ['Sent', 'Sending', 'Scheduled', 'Paused', 'Draft'];

const ROW_ACTIONS = [
  { key: 'analytics', labelKey: 'camp.viewAnalytics', icon: 'bi-graph-up' },
  { key: 'recipients', labelKey: 'camp.viewRecipients', icon: 'bi-people' },
  { key: 'duplicate', labelKey: 'common.duplicate', icon: 'bi-files' },
  { key: 'resend', labelKey: 'camp.resendUnopened', icon: 'bi-arrow-repeat' },
  { key: 'failed', labelKey: 'camp.resendFailed', icon: 'bi-arrow-clockwise' },
  { key: 'export', labelKey: 'camp.exportReport', icon: 'bi-download' },
];

const SORTS = [
  { value: 'date', labelKey: 'common.date' },
  { value: 'name', labelKey: 'common.name' },
  { value: 'recipients', labelKey: 'camp.recipients' },
];

export default function CampaignsPage() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();

  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('date');
  const [query, setQuery] = useState('');
  // Box me turant, server se 200ms ruk kar — type karte waqt atakta nahi.
  const search = useDebouncedValue(query, 200);
  const [actionsFor, setActionsFor] = useState(null);
  // Delete se pehle ek confirm step — campaign ka bheja hua data waapas nahi
  // aata, isliye galti se ek click me delete nahi hone dena.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * Search, filter aur sort — teenon server par lagte hain.
   *
   * Pehle poori list browser me aati thi aur yahin chhanti thi. Ek client ke
   * paas hazaron campaign ho sakte hain; tab wo tarika screen ko rok deta.
   */
  const pager = useServerList('/api/campaigns', {
    key: 'campaigns',
    limit: 50,
    params: {
      search: search.trim(),
      status: status === 'All' ? '' : status,
      sort,
    },
  });

  const campaigns = pager.visible;

  // Har status ke aage POORI list ki ginti — server se aati hai, kyunki screen
  // ke paas ab sirf ek page hota hai.
  const counts = pager.raw?.counts ?? {};

  const statusOptions = [
    { value: 'All', label: t('filter.allStatuses'), count: counts.All ?? pager.total },
    ...STATUSES.map((name) => ({ value: name, label: name, count: counts[name] ?? 0 })),
  ];

  function clearFilters() {
    setStatus('All');
    setSort('date');
    setQuery('');
  }

  function openActions(event) {
    event.stopPropagation();
    setActionsFor(campaigns.find((c) => c.id === event.currentTarget.dataset.id) || null);
  }

  function closeActions() {
    setActionsFor(null);
    setConfirmDelete(false);
  }

  async function handleDelete() {
    if (!actionsFor) return;
    setDeleting(true);
    try {
      await api.delete(`/api/campaigns/${actionsFor.id}`);
      pager.reload();
      toast.success(t('toast.campaignDeleted'), actionsFor.name);
      closeActions();
    } catch (error) {
      // Chalti hui campaign ko backend khud rok deta hai — wahi wajah dikha
      // dete hain, koi generic error nahi.
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setDeleting(false);
    }
  }

  function openCampaign(event) {
    const { id, status } = event.currentTarget.dataset;
    // Draft abhi bhi badli ja sakti hai — usko edit wizard me kholte hain.
    // Baaki sab (bheji ja chuki, chal rahi, waghera) sirf report dikhati hai.
    navigate(status === 'Draft' ? `/campaigns/${id}/edit` : `/campaigns/${id}`);
  }

  function goToNewCampaign() {
    navigate('/campaigns/new');
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('camp.title')}
        subtitle={t('camp.subtitle')}
        helpTopic="campaigns"
        actions={
          <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={goToNewCampaign}>
            <i className="bi bi-plus-lg me-2" />
            {t('dash.createCampaign')}
          </button>
        }
      />

      <Card flush>
        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('camp.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="camp-filter-status"
            label={t('filter.status')}
            icon="bi-funnel"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <FilterSelect
            id="camp-filter-sort"
            label={t('common.filter')}
            icon="bi-sort-down"
            value={sort}
            onChange={setSort}
            options={SORTS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
          />
          <PageSizePicker value={pager.limit} onChange={pager.setLimit} />
        </FilterBar>

        {pager.loading && campaigns.length === 0 ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState icon="bi-megaphone" title={t('common.noResults')} text={t('common.noResultsText')} />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table mw-table--clickable">
                <thead>
                  <tr>
                    <th scope="col">{t('nav.campaigns')}</th>
                    <th scope="col">{t('camp.sender')}</th>
                    <th scope="col" className="mw-table__num">{t('camp.recipients')}</th>
                    <th scope="col" className="mw-table__num">{t('kpi.sent')}</th>
                    <th scope="col" className="mw-table__num">{t('kpi.opened')}</th>
                    <th scope="col" className="mw-table__num">{t('kpi.clicked')}</th>
                    <th scope="col" className="mw-table__num">{t('kpi.failed')}</th>
                    <th scope="col">{t('common.status')}</th>
                    <th scope="col">{t('common.date')}</th>
                    <th scope="col" className="text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr
                      key={campaign.id}
                      data-id={campaign.id}
                      data-status={campaign.status}
                      onClick={openCampaign}
                    >
                      <td>
                        <div className="mw-table__primary">{campaign.name}</div>
                        {campaign.template ? (
                          <div className="mw-table__muted">{campaign.template}</div>
                        ) : null}
                      </td>
                      <td className="mw-table__muted">{campaign.sender}</td>
                      <td className="mw-table__num">{formatNumber(campaign.recipients)}</td>
                      <td className="mw-table__num">{formatNumber(campaign.sent)}</td>
                      <td className="mw-table__num">
                        {formatNumber(campaign.opened)}
                        <span className="d-block mw-table__muted">{percent(campaign.opened, campaign.sent)}</span>
                      </td>
                      <td className="mw-table__num">
                        {formatNumber(campaign.clicked)}
                        <span className="d-block mw-table__muted">{percent(campaign.clicked, campaign.sent)}</span>
                      </td>
                      <td className="mw-table__num mw-text-danger">{formatNumber(campaign.failed)}</td>
                      <td>
                        <StatusPill status={campaign.status} />
                      </td>
                      <td className="mw-nowrap mw-table__muted">{formatDate(campaign.date)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="mw-iconbtn"
                          data-id={campaign.id}
                          onClick={openActions}
                          aria-label={`Actions for ${campaign.name}`}
                        >
                          <i className="bi bi-three-dots-vertical" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="mw-rec">
                  <div className="mw-rec__top">
                    <button
                      type="button"
                      className="mw-rec__title mw-rec__titlebtn"
                      data-id={campaign.id}
                      data-status={campaign.status}
                      onClick={openCampaign}
                    >
                      {campaign.name}
                      <span className="d-block mw-rec__sub">{campaign.sender}</span>
                    </button>
                    <StatusPill status={campaign.status} />
                  </div>

                  <div className="mw-rec__stats">
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">{t('kpi.sent')}</span>
                      <span className="mw-rec__statvalue">{formatNumber(campaign.sent)}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">{t('kpi.opened')}</span>
                      <span className="mw-rec__statvalue mw-text-info">{formatNumber(campaign.opened)}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">{t('kpi.clicked')}</span>
                      <span className="mw-rec__statvalue mw-text-success">{formatNumber(campaign.clicked)}</span>
                    </span>
                    <span className="mw-rec__stat">
                      <span className="d-block mw-rec__statlabel">{t('kpi.failed')}</span>
                      <span className="mw-rec__statvalue mw-text-danger">{formatNumber(campaign.failed)}</span>
                    </span>
                  </div>

                  <div className="mw-row mw-row--between mt-3">
                    <span className="mw-fs-12 mw-text-muted">{formatDate(campaign.date)}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      data-id={campaign.id}
                      onClick={openActions}
                    >
                      <i className="bi bi-three-dots" /> {t('common.actions')}
                    </button>
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

      <Sheet
        open={Boolean(actionsFor)}
        title={actionsFor ? (confirmDelete ? t('camp.deleteConfirmTitle') : actionsFor.name) : ''}
        onClose={closeActions}
      >
        {actionsFor && confirmDelete ? (
          <>
            <p className="mw-fs-14 mw-text-muted mb-4">
              {t('camp.deleteConfirmText')} <strong>{actionsFor.name}</strong>
            </p>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary flex-fill"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger flex-fill"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </>
        ) : actionsFor ? (
          <>
            <div className="mw-row mw-row--between mb-3">
              <StatusPill status={actionsFor.status} />
              <span className="mw-fs-12 mw-text-muted">{formatDate(actionsFor.date)}</span>
            </div>
            <div className="list-group list-group-flush">
              {ROW_ACTIONS.map((action) => (
                <Link
                  key={action.key}
                  to={
                    action.key === 'analytics' || action.key === 'recipients'
                      ? actionsFor.status === 'Draft'
                        ? `/campaigns/${actionsFor.id}/edit`
                        : `/campaigns/${actionsFor.id}`
                      : '/reports'
                  }
                  className="list-group-item list-group-item-action d-flex align-items-center gap-3"
                  onClick={closeActions}
                >
                  <i className={`bi ${action.icon} mw-fs-16 mw-text-primary`} />
                  <span className="mw-fs-14 mw-fw-600">{t(action.labelKey)}</span>
                  <i className="bi bi-chevron-right ms-auto mw-fs-12 mw-text-muted-2" />
                </Link>
              ))}
              <button
                type="button"
                className="list-group-item list-group-item-action d-flex align-items-center gap-3 text-danger"
                onClick={() => setConfirmDelete(true)}
              >
                <i className="bi bi-trash3 mw-fs-16" />
                <span className="mw-fs-14 mw-fw-600">{t('common.delete')}</span>
                <i className="bi bi-chevron-right ms-auto mw-fs-12 mw-text-muted-2" />
              </button>
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

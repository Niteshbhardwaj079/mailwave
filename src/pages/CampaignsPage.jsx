import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { Card, CardFoot } from '../components/ui/Card';
import { SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import { useT } from '../i18n/I18nProvider';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { campaigns } from '../data/mockData';
import { formatDate, formatNumber, percent } from '../utils/format';

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
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('date');
  const [query, setQuery] = useState('');
  // Box me turant, chhantai 200ms ruk kar — type karte waqt atakta nahi.
  const search = useDebouncedValue(query, 200);
  const [actionsFor, setActionsFor] = useState(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    const list = campaigns.filter((campaign) => {
      const statusOk = status === 'All' || campaign.status === status;
      const textOk =
        !text || campaign.name.toLowerCase().includes(text) || campaign.sender.toLowerCase().includes(text);
      return statusOk && textOk;
    });

    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'recipients') return b.recipients - a.recipients;
      return String(b.date).localeCompare(String(a.date));
    });
  }, [status, sort, search]);

  const statusOptions = [
    { value: 'All', label: t('filter.allStatuses'), count: campaigns.length },
    ...STATUSES.map((name) => ({
      value: name,
      label: name,
      count: campaigns.filter((item) => item.status === name).length,
    })),
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
  }

  function openCampaign(event) {
    navigate(`/campaigns/${event.currentTarget.dataset.id}`);
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
        </FilterBar>

        {filtered.length === 0 ? (
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
                  {filtered.map((campaign) => (
                    <tr key={campaign.id} data-id={campaign.id} onClick={openCampaign}>
                      <td>
                        <div className="mw-table__primary">{campaign.name}</div>
                        <div className="mw-table__muted">{campaign.template} template</div>
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
              {filtered.map((campaign) => (
                <div key={campaign.id} className="mw-rec">
                  <div className="mw-rec__top">
                    <button type="button" className="mw-rec__title mw-rec__titlebtn" data-id={campaign.id} onClick={openCampaign}>
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
                    <button type="button" className="btn btn-sm btn-outline-secondary" data-id={campaign.id} onClick={openActions}>
                      <i className="bi bi-three-dots" /> {t('common.actions')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <CardFoot>
          <div className="mw-row mw-row--between mw-row--wrap">
            <span className="mw-fs-12 mw-text-muted">
              {t('common.showing')} {filtered.length} {t('common.of')} {campaigns.length}
            </span>
            <Link to="/reports" className="mw-fs-12 mw-fw-600">
              {t('camp.exportReport')}
            </Link>
          </div>
        </CardFoot>
      </Card>

      <Sheet open={Boolean(actionsFor)} title={actionsFor ? actionsFor.name : ''} onClose={closeActions}>
        {actionsFor ? (
          <>
            <div className="mw-row mw-row--between mb-3">
              <StatusPill status={actionsFor.status} />
              <span className="mw-fs-12 mw-text-muted">{formatDate(actionsFor.date)}</span>
            </div>
            <div className="list-group list-group-flush">
              {ROW_ACTIONS.map((action) => (
                <Link
                  key={action.key}
                  to={action.key === 'analytics' || action.key === 'recipients' ? `/campaigns/${actionsFor.id}` : '/reports'}
                  className="list-group-item list-group-item-action d-flex align-items-center gap-3"
                  onClick={closeActions}
                >
                  <i className={`bi ${action.icon} mw-fs-16 mw-text-primary`} />
                  <span className="mw-fs-14 mw-fw-600">{t(action.labelKey)}</span>
                  <i className="bi bi-chevron-right ms-auto mw-fs-12 mw-text-muted-2" />
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

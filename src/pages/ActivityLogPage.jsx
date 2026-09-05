import { useMemo, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import Pagination, { usePagination } from '../components/ui/Pagination';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import PageSizePicker from '../components/ui/PageSizePicker';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useToast } from '../components/ui/ToastProvider';
import { ApiError, api, qs } from '../api/client';
import { downloadCsv, objectsToRows } from '../utils/download';
import { ACTION_TYPES, PERMISSION_MODULES } from '../data/adminData';
import { formatDateTime, formatNumber } from '../utils/format';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function withinRange(stamp, range) {
  if (range === 'all') return true;
  const day = stamp.slice(0, 10);
  if (range === 'today') return day === todayIso();
  if (range === 'yesterday') return day === daysAgoIso(1);

  const days = range === '7d' ? 7 : 30;
  return day >= daysAgoIso(days);
}

export default function ActivityLogPage() {
  const t = useT();
  const toast = useToast();
  const { activity, refreshActivity } = useWorkspace();
  const [query, setQuery] = useState('');
  // Box me turant dikhta hai, par chhantai 200ms ruk kar — bade data par type
  // karte waqt screen atakti nahi.
  const search = useDebouncedValue(query, 200);
  const [user, setUser] = useState('all');
  const [action, setAction] = useState('all');
  const [module, setModule] = useState('all');
  const [range, setRange] = useState('all');
  // Preset range ke alawa exact "kis din se kis din tak" bhi chun sakte hain —
  // ye diye ho to preset se zyada tarjeeh milti hai.
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [detailFor, setDetailFor] = useState(null);

  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteFilterOpen, setDeleteFilterOpen] = useState(false);
  const [filterDeleteCount, setFilterDeleteCount] = useState(null);
  const [countingDelete, setCountingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const actionLabel = useMemo(
    () => ACTION_TYPES.reduce((acc, item) => ({ ...acc, [item.key]: t(item.labelKey) }), {}),
    [t]
  );

  const people = useMemo(() => {
    const seen = new Map();
    activity.forEach((entry) => seen.set(entry.userId, entry.userName));
    return Array.from(seen, ([id, name]) => ({ value: id, label: name }));
  }, [activity]);

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return activity.filter((entry) => {
      const userOk = user === 'all' || entry.userId === user;
      const actionOk = action === 'all' || entry.action === action;
      const moduleOk = module === 'all' || entry.module === module;
      const day = entry.at.slice(0, 10);
      const customOk = (!customFrom || day >= customFrom) && (!customTo || day <= customTo);
      const rangeOk = customFrom || customTo ? customOk : withinRange(entry.at, range);
      const textOk =
        !text ||
        entry.userName.toLowerCase().includes(text) ||
        entry.item.toLowerCase().includes(text) ||
        entry.detail.toLowerCase().includes(text);
      return userOk && actionOk && moduleOk && rangeOk && textOk;
    });
  }, [activity, search, user, action, module, range, customFrom, customTo]);

  // Activity log sabse tezi se badhta hai, isliye yahan pagination sabse
  // zaroori hai.
  const pager = usePagination(filtered, 50);

  const pageIds = useMemo(() => pager.visible.map((entry) => entry.id), [pager.visible]);
  const allFilteredIds = useMemo(() => filtered.map((entry) => entry.id), [filtered]);
  const bulk = useBulkSelection(pageIds, allFilteredIds);

  function openDetail(event) {
    setDetailFor(activity.find((entry) => entry.id === event.currentTarget.dataset.id) || null);
  }

  function closeDetail() {
    setDetailFor(null);
  }

  function clearFilters() {
    setQuery('');
    setUser('all');
    setAction('all');
    setModule('all');
    setRange('all');
    setCustomFrom('');
    setCustomTo('');
  }

  function toneOf(key) {
    return ACTION_TYPES.find((item) => item.key === key)?.tone || 'muted';
  }

  function iconOf(key) {
    return ACTION_TYPES.find((item) => item.key === key)?.icon || 'bi-dot';
  }

  function handleRowCheck(event) {
    event.stopPropagation();
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  /** Screen par chuna hua filter, server ki bhasha me — delete/count dono isi se. */
  function serverFilterParams() {
    const params = {};
    if (user !== 'all') params.user = user;
    if (action !== 'all') params.action = action;
    if (module !== 'all') params.module = module;
    if (query.trim()) params.search = query.trim();

    if (customFrom || customTo) {
      if (customFrom) params.from = `${customFrom}T00:00:00.000Z`;
      if (customTo) params.to = `${customTo}T23:59:59.999Z`;
    } else if (range !== 'all') {
      if (range === 'today') {
        const d = todayIso();
        params.from = `${d}T00:00:00.000Z`;
        params.to = `${d}T23:59:59.999Z`;
      } else if (range === 'yesterday') {
        const d = daysAgoIso(1);
        params.from = `${d}T00:00:00.000Z`;
        params.to = `${d}T23:59:59.999Z`;
      } else {
        params.from = `${daysAgoIso(range === '7d' ? 7 : 30)}T00:00:00.000Z`;
      }
    }

    return params;
  }

  function exportLog() {
    if (filtered.length === 0) {
      toast.warning(t('rep.nothingToExport'));
      return;
    }

    downloadCsv(
      'activity-log.csv',
      objectsToRows(filtered, [
        { key: 'userName', label: 'User' },
        { key: 'action', label: 'Action' },
        { key: 'module', label: 'Module' },
        { key: 'item', label: 'Item' },
        { key: 'detail', label: 'Detail' },
        { key: 'at', label: 'When' },
        { key: 'device', label: 'Device' },
        { key: 'ip', label: 'IP' },
      ])
    );
  }

  function openDeleteSelected() {
    setDeleteSelectedOpen(true);
  }

  async function confirmDeleteSelected() {
    setDeleting(true);
    try {
      const data = await api.delete('/api/activity', { body: { ids: bulk.selectedIds } });
      toast.success(t('log.deletedToast', { count: formatNumber(data.removed ?? bulk.selectedIds.length) }));
      bulk.clear();
      setDeleteSelectedOpen(false);
      await refreshActivity();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setDeleting(false);
    }
  }

  async function openDeleteByFilter() {
    setDeleteFilterOpen(true);
    setFilterDeleteCount(null);
    setCountingDelete(true);
    try {
      const data = await api.get(`/api/activity${qs({ ...serverFilterParams(), limit: 1 })}`);
      setFilterDeleteCount(data.total ?? 0);
    } catch (error) {
      setFilterDeleteCount(0);
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setCountingDelete(false);
    }
  }

  function closeDeleteByFilter() {
    setDeleteFilterOpen(false);
  }

  async function confirmDeleteByFilter() {
    const params = serverFilterParams();
    setDeleting(true);
    try {
      const body = Object.keys(params).length === 0 ? { confirmAll: true } : params;
      const data = await api.delete('/api/activity', { body });
      toast.success(t('log.deletedToast', { count: formatNumber(data.removed ?? 0) }));
      bulk.clear();
      setDeleteFilterOpen(false);
      await refreshActivity();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('log.title')}
        subtitle={t('log.subtitle')}
        helpTopic="activity"
        actions={
          <>
            <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile" onClick={exportLog}>
              <i className="bi bi-download me-2" />
              {t('log.exportLog')}
            </button>
            <button type="button" className="btn btn-outline-danger mw-btn-block-mobile" onClick={openDeleteByFilter}>
              <i className="bi bi-trash3 me-2" />
              {t('log.deleteByFilter')}
            </button>
          </>
        }
      />

      <Card flush>
        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('log.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="log-user"
            label={t('filter.user')}
            icon="bi-person"
            value={user}
            onChange={setUser}
            options={[{ value: 'all', label: t('filter.allUsers') }, ...people]}
          />
          <FilterSelect
            id="log-action"
            label={t('filter.action')}
            icon="bi-lightning"
            value={action}
            onChange={setAction}
            options={[
              { value: 'all', label: t('filter.allActions') },
              ...ACTION_TYPES.map((item) => ({ value: item.key, label: t(item.labelKey) })),
            ]}
          />
          <FilterSelect
            id="log-module"
            label={t('filter.module')}
            icon="bi-grid"
            value={module}
            onChange={setModule}
            options={[
              { value: 'all', label: t('filter.allSections') },
              ...PERMISSION_MODULES.map((item) => ({ value: item.key, label: t(item.labelKey) })),
            ]}
          />
          <FilterSelect
            id="log-range"
            label={t('filter.dateRange')}
            icon="bi-calendar3"
            value={range}
            onChange={setRange}
            options={[
              { value: 'all', label: t('filter.allTime') },
              { value: 'today', label: t('filter.today') },
              { value: 'yesterday', label: t('filter.yesterday') },
              { value: '7d', label: t('filter.last7') },
              { value: '30d', label: t('filter.last30') },
            ]}
          />
          <div className="mw-filter">
            <label className="mw-filter__label" htmlFor="log-from">
              <i className="bi bi-calendar-minus" aria-hidden="true" />
              {t('common.from')}
            </label>
            <input
              id="log-from"
              type="date"
              className="form-control mw-filter__select"
              value={customFrom}
              max={customTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
          </div>
          <div className="mw-filter">
            <label className="mw-filter__label" htmlFor="log-to">
              <i className="bi bi-calendar-plus" aria-hidden="true" />
              {t('common.to')}
            </label>
            <input
              id="log-to"
              type="date"
              className="form-control mw-filter__select"
              value={customTo}
              min={customFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </div>
          {/* Kitni rows dikhani hain — filter ke bagal me. */}
          <PageSizePicker value={pager.limit} onChange={pager.setLimit} />
        </FilterBar>

        <BulkBar
          count={bulk.count}
          total={bulk.total}
          pageCount={pageIds.length}
          onSelectAll={bulk.selectAllVisible}
          onClear={bulk.clear}
          actions={
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={openDeleteSelected}>
              <i className="bi bi-trash3 me-2" />
              {t('bulk.remove')}
            </button>
          }
        />

        {filtered.length === 0 ? (
          <EmptyState icon="bi-clock-history" title={t('common.noResults')} text={t('common.noResultsText')} />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table mw-table--clickable">
                <thead>
                  <tr>
                    <th scope="col" className="mw-table__check">
                      <SelectAllCheckbox
                        checked={bulk.allPageSelected}
                        indeterminate={bulk.somePageSelected}
                        onChange={bulk.toggleAllVisible}
                        label={t('bulk.select')}
                      />
                    </th>
                    <th scope="col">{t('log.who')}</th>
                    <th scope="col">{t('log.what')}</th>
                    <th scope="col">{t('log.where')}</th>
                    <th scope="col">{t('log.details')}</th>
                    <th scope="col">{t('log.when')}</th>
                    <th scope="col">{t('log.device')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.visible.map((entry) => (
                    <tr key={entry.id} data-id={entry.id} onClick={openDetail}>
                      <td className="mw-table__check">
                        <input
                          type="checkbox"
                          className="form-check-input mw-rowcheck"
                          checked={bulk.isSelected(entry.id)}
                          data-id={entry.id}
                          onClick={handleRowCheck}
                          onChange={() => {}}
                          aria-label={`${t('bulk.select')} ${entry.userName}`}
                        />
                      </td>
                      <td>
                        <div className="mw-cellstack">
                          <span className="mw-avatar mw-avatar--sm">{entry.initials}</span>
                          <span className="mw-table__primary">{entry.userName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="mw-cellstack">
                          <span className={`mw-logicon mw-kpi__icon--${toneOf(entry.action)}`} aria-hidden="true">
                            <i className={`bi ${iconOf(entry.action)}`} />
                          </span>
                          <span>
                            <span className="d-block mw-table__primary">{actionLabel[entry.action]}</span>
                            <span className="d-block mw-table__muted">{entry.item}</span>
                          </span>
                        </div>
                      </td>
                      <td className="mw-table__muted">
                        {t(PERMISSION_MODULES.find((item) => item.key === entry.module)?.labelKey || entry.module)}
                      </td>
                      <td className="mw-table__muted">{entry.detail}</td>
                      <td className="mw-nowrap mw-num">{formatDateTime(entry.at)}</td>
                      <td className="mw-table__muted mw-nowrap">
                        {entry.device}
                        <span className="d-block mw-fs-11">{entry.ip}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {pager.visible.map((entry) => (
                <div key={entry.id} className={`mw-rec ${bulk.isSelected(entry.id) ? 'is-selected' : ''}`.trim()}>
                  <div className="mw-rec__top">
                    <input
                      type="checkbox"
                      className="form-check-input mw-rowcheck mw-rec__check"
                      checked={bulk.isSelected(entry.id)}
                      data-id={entry.id}
                      onClick={handleRowCheck}
                      onChange={() => {}}
                      aria-label={`${t('bulk.select')} ${entry.userName}`}
                    />
                    <span className={`mw-logicon mw-kpi__icon--${toneOf(entry.action)}`} aria-hidden="true">
                      <i className={`bi ${iconOf(entry.action)}`} />
                    </span>
                    <span className="mw-rec__title">
                      {actionLabel[entry.action]} — {entry.item}
                      <span className="d-block mw-rec__sub">{entry.detail}</span>
                    </span>
                  </div>
                  <div className="mw-row mw-row--between mw-fs-12 mw-text-muted">
                    <span>
                      <i className="bi bi-person me-1" />
                      {entry.userName}
                    </span>
                    <span className="mw-num">{formatDateTime(entry.at)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary mt-3"
                    data-id={entry.id}
                    onClick={openDetail}
                  >
                    <i className="bi bi-eye me-2" />
                    {t('log.details')}
                  </button>
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

      <Note tone="info" icon="bi-shield-check">
        {t('log.note')}
      </Note>

      <Sheet open={Boolean(detailFor)} title={t('log.entryTitle')} onClose={closeDetail}>
        {detailFor ? (
          <>
            <div className="mw-row mb-4">
              <span className="mw-avatar">{detailFor.initials}</span>
              <span>
                <span className="d-block mw-fs-15 mw-fw-700">{detailFor.userName}</span>
                <span className="d-block mw-fs-12 mw-text-muted">{formatDateTime(detailFor.at)}</span>
              </span>
            </div>

            <div className="mw-kv">
              <span className="mw-kv__key">{t('log.what')}</span>
              <span className="mw-kv__value">
                {actionLabel[detailFor.action]} — {detailFor.item}
              </span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">{t('log.where')}</span>
              <span className="mw-kv__value">
                {t(PERMISSION_MODULES.find((item) => item.key === detailFor.module)?.labelKey || detailFor.module)}
              </span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">{t('log.details')}</span>
              <span className="mw-kv__value">{detailFor.detail}</span>
            </div>
            <div className="mw-kv">
              <span className="mw-kv__key">{t('log.device')}</span>
              <span className="mw-kv__value">
                {detailFor.device} · {detailFor.ip}
              </span>
            </div>

            {detailFor.before === '—' && detailFor.after === '—' ? (
              <p className="mw-fs-13 mw-text-muted mt-3 mb-0">{t('log.noChange')}</p>
            ) : (
              <div className="mw-diff">
                <div className="mw-diff__box mw-diff__box--before">
                  <span className="mw-diff__label">{t('log.before')}</span>
                  {detailFor.before}
                </div>
                <div className="mw-diff__box mw-diff__box--after">
                  <span className="mw-diff__label">{t('log.after')}</span>
                  {detailFor.after}
                </div>
              </div>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={deleteSelectedOpen}
        title={t('log.deleteConfirmTitle')}
        onClose={() => setDeleteSelectedOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline-secondary flex-fill"
              onClick={() => setDeleteSelectedOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-fill"
              onClick={confirmDeleteSelected}
              disabled={deleting}
            >
              {deleting ? t('common.loading') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">{t('log.deleteSelectedText', { count: formatNumber(bulk.count) })}</p>
      </Sheet>

      <Sheet
        open={deleteFilterOpen}
        title={t('log.deleteConfirmTitle')}
        onClose={closeDeleteByFilter}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeDeleteByFilter}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger flex-fill"
              onClick={confirmDeleteByFilter}
              disabled={deleting || countingDelete || !filterDeleteCount}
            >
              {deleting ? t('common.loading') : t('common.delete')}
            </button>
          </>
        }
      >
        {countingDelete ? (
          <p className="mw-fs-14 mb-0 mw-text-muted">{t('common.loading')}</p>
        ) : filterDeleteCount === 0 ? (
          <p className="mw-fs-14 mb-0 mw-text-muted">{t('log.deleteFilterEmpty')}</p>
        ) : (
          <p className="mw-fs-14 mb-0">{t('log.deleteFilterText', { count: formatNumber(filterDeleteCount ?? 0) })}</p>
        )}
      </Sheet>
    </div>
  );
}

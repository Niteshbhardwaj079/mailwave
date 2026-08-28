import { useMemo, useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardFoot } from '../components/ui/Card';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { ACTION_TYPES, PERMISSION_MODULES } from '../data/adminData';

function withinRange(stamp, range) {
  if (range === 'all') return true;
  const day = stamp.slice(0, 10);
  const today = '2026-08-26';
  if (range === 'today') return day === today;
  if (range === 'yesterday') return day === '2026-08-25';

  const days = range === '7d' ? 7 : 30;
  const limit = new Date(today);
  limit.setDate(limit.getDate() - days);
  return new Date(day) >= limit;
}

export default function ActivityLogPage() {
  const t = useT();
  const { activity } = useWorkspace();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState('all');
  const [action, setAction] = useState('all');
  const [module, setModule] = useState('all');
  const [range, setRange] = useState('all');
  const [detailFor, setDetailFor] = useState(null);

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
    const text = query.trim().toLowerCase();
    return activity.filter((entry) => {
      const userOk = user === 'all' || entry.userId === user;
      const actionOk = action === 'all' || entry.action === action;
      const moduleOk = module === 'all' || entry.module === module;
      const rangeOk = withinRange(entry.at, range);
      const textOk =
        !text ||
        entry.userName.toLowerCase().includes(text) ||
        entry.item.toLowerCase().includes(text) ||
        entry.detail.toLowerCase().includes(text);
      return userOk && actionOk && moduleOk && rangeOk && textOk;
    });
  }, [activity, query, user, action, module, range]);

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
  }

  function toneOf(key) {
    return ACTION_TYPES.find((item) => item.key === key)?.tone || 'muted';
  }

  function iconOf(key) {
    return ACTION_TYPES.find((item) => item.key === key)?.icon || 'bi-dot';
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('log.title')}
        subtitle={t('log.subtitle')}
        helpTopic="activity"
        actions={
          <button type="button" className="btn btn-outline-secondary mw-btn-block-mobile">
            <i className="bi bi-download me-2" />
            {t('log.exportLog')}
          </button>
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
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState icon="bi-clock-history" title={t('common.noResults')} text={t('common.noResultsText')} />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table mw-table--clickable">
                <thead>
                  <tr>
                    <th scope="col">{t('log.who')}</th>
                    <th scope="col">{t('log.what')}</th>
                    <th scope="col">{t('log.where')}</th>
                    <th scope="col">{t('log.details')}</th>
                    <th scope="col">{t('log.when')}</th>
                    <th scope="col">{t('log.device')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id} data-id={entry.id} onClick={openDetail}>
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
                      <td className="mw-nowrap mw-num">{entry.at}</td>
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
              {filtered.map((entry) => (
                <button key={entry.id} type="button" className="mw-rec" data-id={entry.id} onClick={openDetail}>
                  <div className="mw-rec__top">
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
                    <span className="mw-num">{entry.at}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <CardFoot>
          <span className="mw-fs-12 mw-text-muted">
            {t('common.showing')} {filtered.length} {t('common.of')} {activity.length}
          </span>
        </CardFoot>
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
                <span className="d-block mw-fs-12 mw-text-muted">{detailFor.at}</span>
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
    </div>
  );
}

import { useState } from 'react';

import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import { Card } from '../components/ui/Card';
import { Note, Required, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import StatusPill from '../components/ui/StatusPill';
import Pagination from '../components/ui/Pagination';
import PageSizePicker from '../components/ui/PageSizePicker';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { useServerList } from '../api/useServerList';
import { ApiError, api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { formatDateTime } from '../utils/format';

function rowKey(row) {
  return `${row.accountId ?? ''}:${row.email}`;
}

const REASON_TONE = {
  bounced: 'warning',
  unsubscribed: 'muted',
  complaint: 'danger',
  manual: 'primary',
  invalid: 'muted',
};

const EMPTY_DRAFT = { email: '', reason: 'manual', detail: '' };

export default function SuppressionPage() {
  const t = useT();
  const toast = useToast();
  const { can } = useWorkspace();
  const canEdit = can('contacts', 'edit');

  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query, 200);
  const [reason, setReason] = useState('All');

  const pager = useServerList('/api/suppression', {
    limit: 50,
    params: { search, reason: reason === 'All' ? '' : reason },
  });
  const rows = pager.visible;
  // Server poori list se ginta hai (search/filter se bhale hi neeche ki
  // table chhoti ho jaye) — isliye cards hamesha asli, poora haal dikhate hain.
  const counts = pager.raw?.counts ?? {};

  // Tick-box selection — sirf abhi screen par dikh rahi (filter/page ke
  // baad wali) rows, jaisa is app ke baaki tables me hota hai.
  const pageIds = rows.map(rowKey);
  const rowByKey = new Map(rows.map((row) => [rowKey(row), row]));
  const bulk = useBulkSelection(pageIds);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);

  function toggleRow(event) {
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  async function handleBulkRemove() {
    const items = bulk.selectedIds
      .map((id) => rowByKey.get(id))
      .filter(Boolean)
      .map((row) => ({ email: row.email, accountId: row.accountId ?? '' }));
    if (items.length === 0) return;

    setBulkRemoving(true);
    try {
      await api.post('/api/suppression/bulk-delete', { items });
      bulk.clear();
      pager.reload();
      toast.success(t('sup.removedBulk', { count: items.length }));
      setBulkRemoveOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBulkRemoving(false);
    }
  }

  const REASON_LABEL = {
    bounced: t('sup.reasonBounced'),
    unsubscribed: t('sup.reasonUnsubscribed'),
    complaint: t('sup.reasonComplaint'),
    manual: t('sup.reasonManual'),
    invalid: t('sup.reasonInvalid'),
  };

  // --- add ---------------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function openAdd() {
    setDraft(EMPTY_DRAFT);
    setFormError('');
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

  function handleDraftField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function submitAdd() {
    if (!draft.email.trim()) {
      setFormError(t('sup.emailNeeded'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.post('/api/suppression', {
        email: draft.email.trim(),
        reason: draft.reason,
        detail: draft.detail.trim() || null,
      });
      toast.success(t('sup.added'));
      setAddOpen(false);
      pager.reload();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSaving(false);
    }
  }

  // --- remove --------------------------------------------------------------
  const [removeFor, setRemoveFor] = useState(null); // { email, accountId, reason }
  const [removing, setRemoving] = useState(false);

  async function confirmRemove() {
    const target = removeFor;
    if (!target) return;
    setRemoving(true);
    try {
      await api.delete(`/api/suppression/${encodeURIComponent(target.email)}?accountId=${encodeURIComponent(target.accountId ?? '')}`);
      toast.success(t('sup.removed'), target.email);
      setRemoveFor(null);
      pager.reload();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('sup.title')}
        subtitle={t('sup.subtitle')}
        actions={
          canEdit ? (
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <i className="bi bi-plus-lg me-2" />
              {t('sup.addEmail')}
            </button>
          ) : null
        }
      />

      <div className="mw-kpi-grid">
        <KpiCard label={t('sup.totalSuppressed')} value={counts.All ?? pager.total} icon="bi-shield-slash" tone="primary" />
        <KpiCard label={t('sup.reasonBounced')} value={counts.bounced ?? 0} icon="bi-exclamation-octagon" tone="warning" />
        <KpiCard label={t('sup.reasonUnsubscribed')} value={counts.unsubscribed ?? 0} icon="bi-person-dash" tone="muted" />
        <KpiCard label={t('sup.reasonComplaint')} value={counts.complaint ?? 0} icon="bi-flag" tone="danger" />
        <KpiCard label={t('sup.reasonManual')} value={counts.manual ?? 0} icon="bi-hand-index" tone="info" />
        <KpiCard label={t('sup.reasonInvalid')} value={counts.invalid ?? 0} icon="bi-envelope-x" tone="muted" />
      </div>

      <Card flush>
        <FilterBar onClear={() => { setQuery(''); setReason('All'); }} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('sup.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="sup-filter-reason"
            label={t('filter.reason')}
            icon="bi-funnel"
            value={reason}
            onChange={setReason}
            options={[
              { value: 'All', label: t('common.all') },
              { value: 'bounced', label: t('sup.reasonBounced') },
              { value: 'unsubscribed', label: t('sup.reasonUnsubscribed') },
              { value: 'complaint', label: t('sup.reasonComplaint') },
              { value: 'manual', label: t('sup.reasonManual') },
              { value: 'invalid', label: t('sup.reasonInvalid') },
            ]}
          />
          <PageSizePicker value={pager.limit} onChange={pager.setLimit} />
        </FilterBar>

        {canEdit ? (
          <BulkBar
            count={bulk.count}
            total={bulk.total}
            pageCount={pageIds.length}
            onSelectAll={bulk.selectAll}
            onClear={bulk.clear}
            actions={
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setBulkRemoveOpen(true)}>
                <i className="bi bi-trash3 me-1" />
                {t('sup.remove')}
              </button>
            }
          />
        ) : null}

        {pager.loading && rows.length === 0 ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="bi-shield-slash" title={t('common.noResults')} text={t('sup.emptyText')} />
        ) : (
          <>
            <div className="mw-tablewrap">
              <table className="mw-table">
                <thead>
                  <tr>
                    {canEdit ? (
                      <th scope="col" className="mw-table__check">
                        <SelectAllCheckbox
                          checked={bulk.allPageSelected}
                          indeterminate={bulk.somePageSelected}
                          onChange={bulk.toggleAllVisible}
                          label={t('bulk.selectAllRows')}
                        />
                      </th>
                    ) : null}
                    <th scope="col">{t('common.email')}</th>
                    <th scope="col">{t('sup.reason')}</th>
                    <th scope="col">{t('sup.source')}</th>
                    <th scope="col">{t('sup.addedOn')}</th>
                    <th scope="col">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={rowKey(row)} className={bulk.isSelected(rowKey(row)) ? 'is-selected' : ''}>
                      {canEdit ? (
                        <td className="mw-table__check">
                          <input
                            type="checkbox"
                            className="form-check-input mw-rowcheck"
                            checked={bulk.isSelected(rowKey(row))}
                            data-id={rowKey(row)}
                            onChange={toggleRow}
                            aria-label={`${t('bulk.select')} ${row.email}`}
                          />
                        </td>
                      ) : null}
                      <td>
                        <span className="d-block">{row.email}</span>
                        {row.detail ? <span className="d-block mw-fs-11 mw-text-muted">{row.detail}</span> : null}
                      </td>
                      <td>
                        <StatusPill status={REASON_LABEL[row.reason] ?? row.reason} tone={REASON_TONE[row.reason] ?? 'muted'} />
                      </td>
                      <td className="mw-fs-13 mw-text-muted">
                        {row.accountId ? (row.accountEmail ?? t('sup.sourceUnknownAccount')) : t('sup.sourceGlobal')}
                      </td>
                      <td className="mw-fs-13 mw-text-muted">{formatDateTime(row.createdAt)}</td>
                      <td>
                        {canEdit ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setRemoveFor(row)}
                          >
                            <i className="bi bi-trash3 me-1" />
                            {t('sup.remove')}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {rows.map((row) => (
                <div key={rowKey(row)} className={`mw-rec ${bulk.isSelected(rowKey(row)) ? 'is-selected' : ''}`.trim()}>
                  <div className="mw-rec__top">
                    {canEdit ? (
                      <input
                        type="checkbox"
                        className="form-check-input mw-rowcheck mw-rec__check"
                        checked={bulk.isSelected(rowKey(row))}
                        data-id={rowKey(row)}
                        onChange={toggleRow}
                        aria-label={`${t('bulk.select')} ${row.email}`}
                      />
                    ) : null}
                    <span className="mw-rec__title">
                      {row.email}
                      {row.detail ? <span className="d-block mw-rec__sub">{row.detail}</span> : null}
                    </span>
                    <StatusPill status={REASON_LABEL[row.reason] ?? row.reason} tone={REASON_TONE[row.reason] ?? 'muted'} />
                  </div>
                  <div className="mw-row mw-row--between mw-fs-12 mw-text-muted">
                    <span>{row.accountId ? (row.accountEmail ?? t('sup.sourceUnknownAccount')) : t('sup.sourceGlobal')}</span>
                    <span className="mw-num">{formatDateTime(row.createdAt)}</span>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger mt-3"
                      onClick={() => setRemoveFor(row)}
                    >
                      <i className="bi bi-trash3 me-1" />
                      {t('sup.remove')}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <Pagination
              page={pager.page}
              pages={pager.pages}
              total={pager.total}
              limit={pager.limit}
              onPageChange={pager.setPage}
              onLimitChange={pager.setLimit}
            />
          </>
        )}
      </Card>

      <Sheet
        open={addOpen}
        title={t('sup.addTitle')}
        onClose={closeAdd}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeAdd}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={submitAdd} disabled={saving}>
              {saving ? t('common.loading') : t('sup.addEmail')}
            </button>
          </>
        }
      >
        {formError ? (
          <div className="mw-note mw-note--warning mb-3" role="alert">
            <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
            <div>{formError}</div>
          </div>
        ) : null}

        <div className="row g-3">
          <div className="col-12">
            <label className="form-label" htmlFor="sup-new-email">
              {t('common.email')}
              <Required />
            </label>
            <input
              id="sup-new-email"
              name="email"
              type="email"
              className="form-control"
              placeholder="name@example.com"
              value={draft.email}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="sup-new-reason">
              {t('sup.reason')}
              <Required />
            </label>
            <select id="sup-new-reason" name="reason" className="form-select" value={draft.reason} onChange={handleDraftField}>
              <option value="manual">{t('sup.reasonManual')}</option>
              <option value="invalid">{t('sup.reasonInvalid')}</option>
              <option value="unsubscribed">{t('sup.reasonUnsubscribed')}</option>
              <option value="bounced">{t('sup.reasonBounced')}</option>
              <option value="complaint">{t('sup.reasonComplaint')}</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="sup-new-detail">
              {t('sup.noteOptional')}
            </label>
            <textarea
              id="sup-new-detail"
              name="detail"
              className="form-control"
              rows={2}
              placeholder={t('sup.notePlaceholder')}
              value={draft.detail}
              onChange={handleDraftField}
            />
          </div>
        </div>

        <Note tone="info" icon="bi-info-circle">
          {t('sup.addNote')}
        </Note>
      </Sheet>

      <Sheet open={Boolean(removeFor)} title={t('sup.removeConfirmTitle')} onClose={() => setRemoveFor(null)}>
        <p className="mw-fs-14 mw-text-muted mb-4">{t('sup.removeConfirmText', { email: removeFor?.email ?? '' })}</p>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary flex-fill"
            onClick={() => setRemoveFor(null)}
            disabled={removing}
          >
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger flex-fill" onClick={confirmRemove} disabled={removing}>
            {removing ? t('common.loading') : t('sup.remove')}
          </button>
        </div>
      </Sheet>

      <Sheet open={bulkRemoveOpen} title={t('sup.removeConfirmTitle')} onClose={() => setBulkRemoveOpen(false)}>
        <p className="mw-fs-14 mw-text-muted mb-4">{t('sup.removeBulkConfirmText', { count: bulk.count })}</p>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary flex-fill"
            onClick={() => setBulkRemoveOpen(false)}
            disabled={bulkRemoving}
          >
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger flex-fill" onClick={handleBulkRemove} disabled={bulkRemoving}>
            {bulkRemoving ? t('common.loading') : t('sup.remove')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

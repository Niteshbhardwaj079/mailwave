import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import PageSizePicker from '../components/ui/PageSizePicker';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import { useT } from '../i18n/I18nProvider';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { downloadCsv, objectsToRows } from '../utils/download';
import SampleFileCard from '../components/ui/SampleFileCard';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { ApiError, api, qs } from '../api/client';
import { useServerList } from '../api/useServerList';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { formatDate, formatNumber, initialsOf } from '../utils/format';

function noop() {}

const EMPTY_CONTACT = {
  name: '',
  email: '',
  phone: '',
  company: '',
  city: '',
  groupId: '',
  tags: [],
  consentSource: 'website',
};

export default function ContactsPage() {
  const t = useT();
  const toast = useToast();

  const [status, setStatus] = useState('All');
  const [group, setGroup] = useState('All');
  const [tag, setTag] = useState('All');
  const [query, setQuery] = useState('');
  // Box me turant dikhta hai, par server ko 200ms ruk kar poochte hain — har
  // akshar par ek request bhejna server aur internet dono par bhaari padta hai.
  const search = useDebouncedValue(query, 200);

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CONTACT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // null = naya contact banaya jaa raha hai; id = us contact ko edit kiya jaa raha hai.
  const [editingId, setEditingId] = useState(null);
  const [tagInput, setTagInput] = useState('');

  // --- naya group (bilkul optional — koi majboor nahi, jisko chahiye banaye) --
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState('');

  // --- group ka naam badalna / hatana -----------------------------------
  const [manageGroup, setManageGroup] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Groups aur tags — filter ke dropdown aur upar wale KPI card ke liye.
  const groupsCall = useApi('/api/contacts/groups/all');
  const tagsCall = useApi('/api/contacts/tags/all');
  const suppressionCall = useApi('/api/contacts/suppression/all');

  const groups = useMemo(() => groupsCall.data?.groups ?? [], [groupsCall.data]);
  const allTags = tagsCall.data?.tags ?? [];

  // Screen par group ka NAAM dikhta hai, par server ko uski id chahiye.
  const groupId = useMemo(
    () => (group === 'All' ? '' : (groups.find((item) => item.name === group)?.id ?? '')),
    [group, groups]
  );

  /**
   * Rows ab server se aati hain — sirf ek page jitni.
   *
   * Pehle poori list browser me aati thi aur chhantai yahin hoti thi. 200
   * contacts par theek tha, 50,000 par browser hang ho jata. Ab search aur
   * filter dono server par lagte hain, isliye list kitni bhi badi ho — screen
   * utni hi tez rehti hai.
   */
  const pager = useServerList('/api/contacts', {
    key: 'contacts',
    limit: 50,
    params: {
      search: search.trim(),
      status: status === 'All' ? '' : status,
      groupId,
      tag: tag === 'All' ? '' : tag,
    },
  });

  const contacts = pager.visible;

  // --- chunna (tick-box) ----------------------------------------------------
  /**
   * "Select all" ke liye server se saare id mangwate hain.
   *
   * Screen par sirf 50 rows hoti hain, isliye baaki 12,430 ke id browser ke
   * paas hote hi nahi. Bina iske "Select all 12,480" dabane par sirf dikhne
   * wali 50 chunti — aur user ko lagta ki 12,480 chun li hain. Delete ya send
   * jaise kaam me yeh galti bahut mehngi padti.
   */
  const [allIds, setAllIds] = useState([]);

  const pageIds = useMemo(() => contacts.map((item) => item.id), [contacts]);

  // Filter badalte hi purane id bekaar ho jate hain — turant bhool jao.
  const filterKey = `${search}|${status}|${groupId}|${tag}`;
  useEffect(() => {
    setAllIds([]);
  }, [filterKey]);

  const bulk = useBulkSelection(pageIds, allIds.length ? allIds : pageIds);

  const fetchAllIds = useCallback(async () => {
    try {
      const data = await api.get(
        `/api/contacts/ids${qs({
          search: search.trim(),
          status: status === 'All' ? '' : status,
          groupId,
          tag: tag === 'All' ? '' : tag,
        })}`
      );

      if (data.capped) {
        toast.warning(t('con.selectAllCapped', { max: formatNumber(data.max) }));
      }

      setAllIds(data.ids ?? []);
      return data.ids ?? [];
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
      return [];
    }
  }, [search, status, groupId, tag, toast, t]);

  async function handleSelectAll() {
    const ids = allIds.length ? allIds : await fetchAllIds();
    bulk.selectExactly(ids);
  }

  function handleRowCheck(event) {
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  // --- bulk kaam ------------------------------------------------------------
  /**
   * Export me poori rows chahiye, sirf id se kaam nahi chalta.
   *
   * Chune hue log alag-alag page par ho sakte hain, isliye server se dobara
   * mangwate hain — screen par jo 50 dikh rahi hain unse export banana adhoora
   * hota.
   */
  async function handleBulkExport() {
    const ids = bulk.selectedIds;
    if (ids.length === 0) return;

    try {
      const data = await api.post('/api/contacts/export', { ids });

      downloadCsv(
        'contacts-selected.csv',
        objectsToRows(data.contacts ?? [], [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'company', label: 'Company' },
          { key: 'group', label: 'Group' },
          { key: 'status', label: 'Status' },
        ])
      );

      toast.success(t('bulk.doneExport', { count: ids.length }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  async function handleBulkDelete() {
    const ids = bulk.selectedIds;
    if (ids.length === 0) return;

    try {
      await api.post('/api/contacts/bulk-delete', { ids });
      bulk.clear();
      setAllIds([]);
      pager.reload();
      groupsCall.reload();
      toast.success(t('bulk.doneDelete', { count: ids.length }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  async function handleDeleteOne(event) {
    const { id, name } = event.currentTarget.dataset;

    try {
      await api.delete(`/api/contacts/${id}`);
      pager.reload();
      groupsCall.reload();
      toast.success(t('toast.contactDeleted'), name);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    }
  }

  // --- quick filters --------------------------------------------------------
  function quickBounced() {
    setStatus('Bounced');
    bulk.clear();
  }

  function quickUnsubscribed() {
    setStatus('Unsubscribed');
    bulk.clear();
  }

  function clearFilters() {
    setStatus('All');
    setGroup('All');
    setTag('All');
    setQuery('');
  }

  // --- naya contact ---------------------------------------------------------
  function openAdd() {
    setEditingId(null);
    setDraft(EMPTY_CONTACT);
    setTagInput('');
    setFormError('');
    setAddOpen(true);
  }

  function openEditContact(contact) {
    setEditingId(contact.id);
    setDraft({
      name: contact.name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      city: contact.city ?? '',
      groupId: contact.groupId ?? '',
      tags: contact.tags ?? [],
      consentSource: contact.consentSource ?? 'website',
    });
    setTagInput('');
    setFormError('');
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

  /** Enter ya comma dabate hi likha hua text ek tag ban jata hai. */
  function handleTagInputKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();

    const value = tagInput.trim();
    if (!value) return;

    setDraft((current) =>
      current.tags.includes(value) ? current : { ...current, tags: [...current.tags, value] }
    );
    setTagInput('');
  }

  function removeTag(tagToRemove) {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tagToRemove) }));
  }

  // --- naya group --------------------------------------------------------
  function openNewGroup() {
    setGroupName('');
    setGroupError('');
    setGroupFormOpen(true);
  }

  function closeNewGroup() {
    setGroupFormOpen(false);
  }

  async function submitGroup(event) {
    event.preventDefault();
    if (!groupName.trim()) {
      setGroupError(t('con.groupNameNeeded'));
      return;
    }

    setGroupSaving(true);
    try {
      await api.post('/api/contacts/groups', { name: groupName.trim() });
      groupsCall.reload();
      toast.success(t('toast.groupCreated'), groupName.trim());
      setGroupFormOpen(false);
    } catch (error) {
      setGroupError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setGroupSaving(false);
    }
  }

  function openManageGroup(item) {
    setManageGroup(item);
    setRenameValue(item.name);
    setRenameError('');
    setConfirmDeleteGroup(false);
  }

  function closeManageGroup() {
    setManageGroup(null);
  }

  async function submitRenameGroup(event) {
    event.preventDefault();
    if (!renameValue.trim()) {
      setRenameError(t('con.groupNameNeeded'));
      return;
    }

    setRenameSaving(true);
    try {
      await api.put(`/api/contacts/groups/${manageGroup.id}`, { name: renameValue.trim() });
      groupsCall.reload();
      pager.reload();
      toast.success(t('toast.groupRenamed'), renameValue.trim());
      setManageGroup(null);
    } catch (error) {
      setRenameError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setRenameSaving(false);
    }
  }

  async function deleteGroup() {
    setDeletingGroup(true);
    try {
      await api.delete(`/api/contacts/groups/${manageGroup.id}`);
      groupsCall.reload();
      pager.reload();
      toast.success(t('toast.groupDeleted'), manageGroup.name);
      setManageGroup(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setDeletingGroup(false);
    }
  }

  function handleDraftField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setFormError('');
  }

  async function submitContact() {
    if (!draft.email.trim()) {
      setFormError(t('con.emailNeeded'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim() || null,
        email: draft.email.trim(),
        phone: draft.phone.trim() || null,
        company: draft.company.trim() || null,
        city: draft.city.trim() || null,
        groupId: draft.groupId || null,
        consentSource: draft.consentSource,
        tags: draft.tags,
      };

      if (editingId) {
        await api.put(`/api/contacts/${editingId}`, payload);
      } else {
        await api.post('/api/contacts', payload);
      }

      setAddOpen(false);
      pager.reload();
      groupsCall.reload();
      tagsCall.reload();
      toast.success(editingId ? t('toast.contactUpdated') : t('toast.contactAdded'), draft.email);
    } catch (error) {
      // Wahi email pehle se hai — yeh sabse aam galti hai, isliye saaf message
      // form me hi dikhate hain, toast me nahi jo ud jata hai.
      setFormError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSaving(false);
    }
  }

  const suppression = suppressionCall.data?.suppression ?? [];
  const unsubscribed = suppression.filter((item) => item.reason === 'unsubscribed').length;
  const bounced = suppression.filter((item) => item.reason === 'bounced').length;

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('con.title')}
        subtitle={t('con.subtitle')}
        helpTopic="contacts"
        actions={
          <>
            <Link to="/contacts/import" className="btn btn-outline-secondary mw-hide-mobile">
              <i className="bi bi-file-earmark-spreadsheet me-2" />
              {t('con.importExcel')}
            </Link>
            <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={openAdd}>
              <i className="bi bi-person-plus me-2" />
              {t('con.add')}
            </button>
          </>
        }
      />

      <div className="mw-kpi-grid">
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            className="mw-kpi mw-kpi--button"
            onClick={() => openManageGroup(item)}
          >
            <span className={`mw-kpi__icon mw-kpi__icon--${item.tone}`} aria-hidden="true">
              <i className="bi bi-collection" />
            </span>
            <div className="mw-kpi__body">
              <p className="mw-kpi__label">{item.name}</p>
              <div className="mw-kpi__value">{formatNumber(item.count)}</div>
            </div>
          </button>
        ))}
        <button type="button" className="mw-kpi mw-kpi--button mw-kpi--add" onClick={openNewGroup}>
          <span className="mw-kpi__icon mw-kpi__icon--muted" aria-hidden="true">
            <i className="bi bi-plus-lg" />
          </span>
          <div className="mw-kpi__body">
            <p className="mw-kpi__label">{t('con.newGroup')}</p>
          </div>
        </button>
      </div>

      <Sheet
        open={Boolean(manageGroup)}
        title={manageGroup ? manageGroup.name : ''}
        onClose={closeManageGroup}
      >
        {manageGroup && confirmDeleteGroup ? (
          <>
            <p className="mw-fs-14 mw-text-muted mb-4">
              {t('con.deleteGroupConfirmText', { count: formatNumber(manageGroup.count) })}{' '}
              <strong>{manageGroup.name}</strong>
            </p>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary flex-fill"
                onClick={() => setConfirmDeleteGroup(false)}
                disabled={deletingGroup}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger flex-fill"
                onClick={deleteGroup}
                disabled={deletingGroup}
              >
                {deletingGroup ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </>
        ) : manageGroup ? (
          <>
            <form onSubmit={submitRenameGroup}>
              {renameError ? (
                <div className="mw-note mw-note--warning mb-3" role="alert">
                  <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                  <div>{renameError}</div>
                </div>
              ) : null}
              <div className="mb-4">
                <label className="form-label" htmlFor="rename-group-name">{t('con.groupName')}</label>
                <input
                  id="rename-group-name"
                  type="text"
                  className="form-control"
                  value={renameValue}
                  onChange={(event) => {
                    setRenameValue(event.target.value);
                    setRenameError('');
                  }}
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary w-100 mb-3" disabled={renameSaving}>
                {renameSaving ? t('common.loading') : t('common.save')}
              </button>
            </form>
            <hr />
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={() => setConfirmDeleteGroup(true)}
            >
              <i className="bi bi-trash3 me-2" />
              {t('con.deleteGroup')}
            </button>
          </>
        ) : null}
      </Sheet>

      <Sheet open={groupFormOpen} title={t('con.newGroupTitle')} onClose={closeNewGroup}>
        <form onSubmit={submitGroup}>
          {groupError ? (
            <div className="mw-note mw-note--warning mb-3" role="alert">
              <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
              <div>{groupError}</div>
            </div>
          ) : null}
          <div className="mb-4">
            <label className="form-label" htmlFor="new-group-name">{t('con.groupName')}</label>
            <input
              id="new-group-name"
              type="text"
              className="form-control"
              placeholder="VIP Customers"
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                setGroupError('');
              }}
              autoFocus
            />
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeNewGroup}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary flex-fill" disabled={groupSaving}>
              {groupSaving ? t('common.loading') : t('con.newGroup')}
            </button>
          </div>
        </form>
      </Sheet>

      <Card flush>
        <div className="mw-toolbar">
          <span className="mw-fs-13 mw-fw-650">{t('bulk.quickClean')}</span>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={quickBounced}>
            <i className="bi bi-arrow-return-left me-2" />
            {t('kpi.bounced')}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={quickUnsubscribed}>
            <i className="bi bi-person-dash me-2" />
            {t('kpi.unsubscribed')}
          </button>
          <span className="mw-fs-12 mw-text-muted">{t('bulk.quickCleanHint')}</span>
        </div>

        <BulkBar
          count={bulk.count}
          total={pager.total}
          pageCount={pageIds.length}
          onSelectAll={handleSelectAll}
          onClear={bulk.clear}
          actions={
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleBulkExport}>
                <i className="bi bi-download me-2" />
                {t('bulk.export')}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleBulkDelete}>
                <i className="bi bi-trash3 me-2" />
                {t('bulk.delete')}
              </button>
            </>
          }
        />

        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('con.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="con-filter-status"
            label={t('filter.status')}
            icon="bi-funnel"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'All', label: t('filter.allStatuses') },
              { value: 'Subscribed', label: 'Subscribed' },
              { value: 'Unsubscribed', label: t('kpi.unsubscribed') },
              { value: 'Bounced', label: t('kpi.bounced') },
            ]}
          />
          <FilterSelect
            id="con-filter-group"
            label={t('filter.group')}
            icon="bi-collection"
            value={group}
            onChange={setGroup}
            options={[
              { value: 'All', label: t('filter.allGroups') },
              ...groups.map((item) => ({ value: item.name, label: item.name })),
            ]}
          />
          <FilterSelect
            id="con-filter-tag"
            label={t('filter.tag')}
            icon="bi-tags"
            value={tag}
            onChange={setTag}
            options={[{ value: 'All', label: t('common.all') }, ...allTags.map((item) => ({ value: item, label: item }))]}
          />
          {/* Kitni rows dikhani hain — filter ke bagal me, taki niche jane ki
              zarurat na pade. */}
          <PageSizePicker value={pager.limit} onChange={pager.setLimit} />
        </FilterBar>

        {pager.loading && contacts.length === 0 ? (
          <div className="p-5 text-center mw-text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            {t('common.loading')}
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon="bi-people"
            title={t('common.noResults')}
            text={t('common.noResultsText')}
            action={
              <Link to="/contacts/import" className="btn btn-primary">
                {t('con.importExcel')}
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
                    <th scope="col">{t('common.phone')}</th>
                    <th scope="col">{t('common.company')}</th>
                    <th scope="col">{t('con.group')}</th>
                    <th scope="col">{t('con.tags')}</th>
                    <th scope="col">{t('common.status')}</th>
                    <th scope="col">{t('con.added')}</th>
                    <th scope="col" className="text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="mw-table__check">
                        <input
                          type="checkbox"
                          className="form-check-input mw-rowcheck"
                          checked={bulk.isSelected(contact.id)}
                          data-id={contact.id}
                          onClick={handleRowCheck}
                          onChange={noop}
                          aria-label={`${t('bulk.select')} ${contact.name}`}
                        />
                      </td>
                      <td>
                        <div className="mw-cellstack">
                          <span className="mw-avatar mw-avatar--sm">{initialsOf(contact.name)}</span>
                          <span className="mw-table__primary">{contact.name}</span>
                        </div>
                      </td>
                      <td className="mw-table__muted">{contact.email}</td>
                      <td className="mw-table__muted mw-nowrap">{contact.phone}</td>
                      <td>{contact.company}</td>
                      <td className="mw-table__muted">{contact.group}</td>
                      <td>
                        <span className="mw-row mw-row--wrap">
                          {contact.tags.map((item) => (
                            <span key={item} className="mw-status mw-status--primary">
                              {item}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={contact.status} />
                      </td>
                      <td className="mw-table__muted mw-nowrap">{formatDate(contact.addedOn)}</td>
                      <td className="text-end mw-nowrap">
                        <button
                          type="button"
                          className="mw-iconbtn"
                          onClick={() => openEditContact(contact)}
                          aria-label={`${t('common.edit')} ${contact.name}`}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className="mw-iconbtn"
                          data-id={contact.id}
                          data-name={contact.name}
                          onClick={handleDeleteOne}
                          aria-label={`${t('common.delete')} ${contact.name}`}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {contacts.map((contact) => (
                <div key={contact.id} className={`mw-rec ${bulk.isSelected(contact.id) ? 'is-selected' : ''}`.trim()}>
                  <div className="mw-rec__top">
                    <input
                      type="checkbox"
                      className="form-check-input mw-rowcheck mw-rec__check"
                      checked={bulk.isSelected(contact.id)}
                      data-id={contact.id}
                      onClick={handleRowCheck}
                      onChange={noop}
                      aria-label={`${t('bulk.select')} ${contact.name}`}
                    />
                    <span className="mw-avatar mw-avatar--sm">{initialsOf(contact.name)}</span>
                    <span className="mw-rec__title">
                      {contact.name}
                      <span className="d-block mw-rec__sub">{contact.email}</span>
                    </span>
                    <StatusPill status={contact.status} />
                  </div>
                  <div className="mw-row mw-row--between mw-fs-12 mw-text-muted">
                    <span>{contact.company}</span>
                    <span>{contact.phone}</span>
                    <button
                      type="button"
                      className="mw-iconbtn"
                      onClick={() => openEditContact(contact)}
                      aria-label={`${t('common.edit')} ${contact.name}`}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                  </div>
                  <div className="mw-row mw-row--wrap mt-2">
                    {contact.tags.map((item) => (
                      <span key={item} className="mw-status mw-status--primary">
                        {item}
                      </span>
                    ))}
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
        <CardHead title={t('sample.title')} subtitle={t('sample.subtitle')} />
        <CardBody>
          <SampleFileCard compact />
        </CardBody>
      </Card>

      <Card>
        <CardHead title={t('con.suppressionTitle')} subtitle={t('con.suppressionSub')} />
        <CardBody>
          <Note tone="success" icon="bi-shield-check">
            {t('con.suppressionNote', {
              unsubscribed: formatNumber(unsubscribed),
              bounced: formatNumber(bounced),
            })}
          </Note>
        </CardBody>
      </Card>

      <Sheet
        open={addOpen}
        title={editingId ? t('con.editTitle') : t('con.addTitle')}
        onClose={closeAdd}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeAdd}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-fill"
              onClick={submitContact}
              disabled={saving}
            >
              {saving ? t('common.loading') : t('con.saveContact')}
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
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-name">{t('common.name')}</label>
            <input
              id="new-name"
              name="name"
              type="text"
              className="form-control"
              placeholder="Rahul Verma"
              value={draft.name}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-email">{t('common.email')}</label>
            <input
              id="new-email"
              name="email"
              type="email"
              className="form-control"
              placeholder="rahul@example.com"
              value={draft.email}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-phone">{t('common.phone')}</label>
            <input
              id="new-phone"
              name="phone"
              type="tel"
              className="form-control"
              placeholder="+91 98200 11223"
              value={draft.phone}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-company">{t('common.company')}</label>
            <input
              id="new-company"
              name="company"
              type="text"
              className="form-control"
              placeholder="Verma Traders"
              value={draft.company}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-city">{t('common.city')}</label>
            <input
              id="new-city"
              name="city"
              type="text"
              className="form-control"
              placeholder="Mumbai"
              value={draft.city}
              onChange={handleDraftField}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="new-group">{t('con.group')}</label>
            <select
              id="new-group"
              name="groupId"
              className="form-select"
              value={draft.groupId}
              onChange={handleDraftField}
            >
              <option value="">{t('imp.noGroup')}</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="new-tags">{t('con.tags')}</label>
            <input
              id="new-tags"
              type="text"
              className="form-control"
              placeholder={t('con.tagsPlaceholder')}
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagInputKeyDown}
            />
            <div className="form-text">{t('con.tagsHelp')}</div>
            {draft.tags.length > 0 ? (
              <div className="mw-row mw-row--wrap mt-2">
                {draft.tags.map((item) => (
                  <span key={item} className="mw-status mw-status--primary">
                    {item}
                    <button
                      type="button"
                      className="mw-tagremove"
                      onClick={() => removeTag(item)}
                      aria-label={`${t('common.delete')} ${item}`}
                    >
                      <i className="bi bi-x" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="new-consent">{t('con.consentLabel')}</label>
            {/* Stable values, translated labels — so the default stays selected in every language. */}
            <select
              id="new-consent"
              name="consentSource"
              className="form-select"
              value={draft.consentSource}
              onChange={handleDraftField}
            >
              <option value="website">{t('con.consent.website')}</option>
              <option value="purchase">{t('con.consent.purchase')}</option>
              <option value="event">{t('con.consent.event')}</option>
              <option value="person">{t('con.consent.person')}</option>
            </select>
            <div className="form-text">{t('con.consentHelp')}</div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

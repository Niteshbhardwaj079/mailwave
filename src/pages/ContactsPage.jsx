import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card, CardBody, CardHead } from '../components/ui/Card';
import Pagination, { usePagination } from '../components/ui/Pagination';
import PageSizePicker from '../components/ui/PageSizePicker';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import { useT } from '../i18n/I18nProvider';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import { useBulkSelection } from '../utils/useBulkSelection';
import { downloadCsv, objectsToRows } from '../utils/download';
import SampleFileCard from '../components/ui/SampleFileCard';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { contactGroups, contacts } from '../data/mockData';
import { formatDate, formatNumber, initialsOf } from '../utils/format';

function noop() {}

export default function ContactsPage() {
  const t = useT();
  const [removedIds, setRemovedIds] = useState([]);
  const [bulkDone, setBulkDone] = useState('');
  const [status, setStatus] = useState('All');
  const [group, setGroup] = useState('All');
  const [tag, setTag] = useState('All');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const allTags = useMemo(() => {
    const set = new Set();
    contacts.forEach((contact) => contact.tags.forEach((item) => set.add(item)));
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (removedIds.includes(contact.id)) return false;
      const statusOk = status === 'All' || contact.status === status;
      const groupOk = group === 'All' || contact.group === group;
      const tagOk = tag === 'All' || contact.tags.includes(tag);
      const textOk =
        !text ||
        contact.name.toLowerCase().includes(text) ||
        contact.email.toLowerCase().includes(text) ||
        contact.company.toLowerCase().includes(text);
      return statusOk && groupOk && tagOk && textOk;
    });
  }, [status, group, tag, query, removedIds]);

  // Ek page jitni hi rows dikhti hain. 10,000 contacts ek saath render karna
  // browser ko hang kar deta hai.
  const pager = usePagination(filtered, 50);

  // Tick-box sirf DIKH RAHI rows par lagta hai — warna "sab chuno" dabane par
  // wo log bhi chun liye jate jo screen par hain hi nahi.
  // Do list deni padti hain: is page ki rows, aur filter se match hone wali
  // SAARI rows. Header ka tick-box page chunta hai; "Select all" poori list.
  const pageIds = useMemo(() => pager.visible.map((item) => item.id), [pager.visible]);
  const allIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const bulk = useBulkSelection(pageIds, allIds);
  const selectedRows = useMemo(() => filtered.filter((item) => bulk.isSelected(item.id)), [filtered, bulk]);

  function handleRowCheck(event) {
    bulk.toggleOne(event.currentTarget.dataset.id);
  }

  function handleBulkExport() {
    downloadCsv(
      'contacts-selected.csv',
      objectsToRows(selectedRows, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'company', label: 'Company' },
        { key: 'group', label: 'Group' },
        { key: 'status', label: 'Status' },
      ])
    );
  }

  function handleBulkDelete() {
    setRemovedIds((current) => [...current, ...bulk.selectedIds]);
    setBulkDone(t('bulk.doneDelete', { count: bulk.selectedIds.length }));
    bulk.clear();
  }

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

  function openAdd() {
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

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
        {contactGroups.map((group) => (
          <article key={group.id} className="mw-kpi">
            <span className={`mw-kpi__icon mw-kpi__icon--${group.tone}`} aria-hidden="true">
              <i className="bi bi-collection" />
            </span>
            <div className="mw-kpi__body">
              <p className="mw-kpi__label">{group.name}</p>
              <div className="mw-kpi__value">{formatNumber(group.count)}</div>
            </div>
          </article>
        ))}
      </div>

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
          total={bulk.total}
          pageCount={pageIds.length}
          onSelectAll={bulk.selectAll}
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
              ...contactGroups.map((item) => ({ value: item.name, label: item.name })),
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

        {filtered.length === 0 ? (
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
                  {pager.visible.map((contact) => (
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
                          {contact.tags.map((tag) => (
                            <span key={tag} className="mw-status mw-status--primary">
                              {tag}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={contact.status} />
                      </td>
                      <td className="mw-table__muted mw-nowrap">{formatDate(contact.addedOn)}</td>
                      <td className="text-end mw-nowrap">
                        <button type="button" className="mw-iconbtn" aria-label={`Edit ${contact.name}`}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button type="button" className="mw-iconbtn" aria-label={`Delete ${contact.name}`}>
                          <i className="bi bi-trash3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mw-reclist p-3">
              {pager.visible.map((contact) => (
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
                  </div>
                  <div className="mw-row mw-row--wrap mt-2">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="mw-status mw-status--primary">
                        {tag}
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
            {t('con.suppressionNote', { unsubscribed: formatNumber(2), bounced: formatNumber(1) })}
          </Note>
        </CardBody>
      </Card>

      <Sheet
        open={addOpen}
        title={t('con.addTitle')}
        onClose={closeAdd}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeAdd}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary flex-fill" onClick={closeAdd}>
              {t('con.saveContact')}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-name">{t('common.name')}</label>
            <input id="new-name" type="text" className="form-control" placeholder="Rahul Verma" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-email">{t('common.email')}</label>
            <input id="new-email" type="email" className="form-control" placeholder="rahul@example.com" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-phone">{t('common.phone')}</label>
            <input id="new-phone" type="tel" className="form-control" placeholder="+91 98200 11223" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="new-company">{t('common.company')}</label>
            <input id="new-company" type="text" className="form-control" placeholder="Verma Traders" />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="new-group">{t('con.group')}</label>
            <select id="new-group" className="form-select" defaultValue="Website Leads">
              {contactGroups.map((group) => (
                <option key={group.id} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="new-consent">{t('con.consentLabel')}</label>
            {/* Stable values, translated labels — so the default stays selected in every language. */}
            <select id="new-consent" className="form-select" defaultValue="website">
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

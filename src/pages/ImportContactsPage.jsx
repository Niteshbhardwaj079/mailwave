import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Note, SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import BulkBar, { SelectAllCheckbox } from '../components/ui/BulkBar';
import Sheet from '../components/ui/Sheet';
import Stepper from '../components/wizard/Stepper';
import StatusPill from '../components/ui/StatusPill';
import SampleFileCard from '../components/ui/SampleFileCard';
import { useT } from '../i18n/I18nProvider';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { useBulkSelection } from '../utils/useBulkSelection';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { readSheet } from '../utils/readSheet';
import { downloadCsv, objectsToRows } from '../utils/download';
import { appFields } from '../data/mockData';
import { formatNumber } from '../utils/format';

const STEPS = [
  { key: 'upload', labelKey: 'imp.step.upload' },
  { key: 'map', labelKey: 'imp.step.map' },
  { key: 'validate', labelKey: 'imp.step.validate' },
  { key: 'preview', labelKey: 'imp.step.preview' },
  { key: 'import', labelKey: 'imp.step.import' },
];

const FLAG_TONE = { valid: 'success', invalid: 'danger', duplicate: 'warning', missing: 'muted' };
const FLAG_KEY = {
  valid: 'imp.flag.valid',
  invalid: 'imp.flag.invalid',
  duplicate: 'imp.flag.duplicate',
  missing: 'imp.flag.missing',
};

/**
 * Server jo wajah batata hai, use screen ke rang aur naam se jodta hai.
 *
 * Teen tarah ke duplicate hote hain aur teenon ka matlab alag hai — isliye
 * teenon ko "duplicate" hi dikhate hain par wajah alag likhi rehti hai.
 */
const REASON_FLAG = {
  missing: 'missing',
  invalid: 'invalid',
  duplicateInDatabase: 'duplicate',
  duplicateInFile: 'duplicate',
  suppressed: 'duplicate',
};

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_BYTES = 20 * 1024 * 1024;

/** Jo column apne aap pehchaan liye jate hain. */
const GUESS = {
  email: ['email', 'email address', 'e-mail', 'mail'],
  name: ['name', 'full name', 'contact name', 'first name'],
  phone: ['phone', 'mobile', 'contact', 'phone number'],
  company: ['company', 'organisation', 'organization', 'firm', 'business'],
  city: ['city', 'town', 'location'],
};

function guessField(header) {
  const clean = String(header).trim().toLowerCase();
  for (const [field, names] of Object.entries(GUESS)) {
    if (names.includes(clean)) return field;
  }
  return 'skip';
}

function readableSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ImportContactsPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef(null);

  // File se padhi hui asli rows aur uske asli column ke naam.
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});

  const [groupId, setGroupId] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  // --- preview me edit/delete/filter (import se pehle saaf karne ke liye) ----
  // `rows` ke original index — jo rows hata di gayi hain (import me nahi jayengi).
  const [excludedIndices, setExcludedIndices] = useState(() => new Set());
  const [previewFlag, setPreviewFlag] = useState('all');
  const [previewQuery, setPreviewQuery] = useState('');
  const previewSearch = useDebouncedValue(previewQuery, 200);
  const [revalidating, setRevalidating] = useState(false);

  const [editingRow, setEditingRow] = useState(null); // previewRow object
  const [editDraft, setEditDraft] = useState({ name: '', email: '', company: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const groupsCall = useApi('/api/contacts/groups/all');
  const groups = groupsCall.data?.groups ?? [];

  function handleMap(event) {
    setMapping((current) => ({ ...current, [event.target.dataset.source]: event.target.value }));
  }

  // --- file padhna -----------------------------------------------------------
  async function acceptFile(candidate) {
    if (!candidate) return;

    if (!/\.(xlsx|xls|csv)$/i.test(candidate.name)) {
      setFile(null);
      setFileError(t('imp.badType'));
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setFile(null);
      setFileError(t('imp.tooBig'));
      return;
    }

    setFileError('');
    setReading(true);

    try {
      const sheet = await readSheet(candidate);

      if (sheet.rows.length === 0) {
        setFile(null);
        setFileError(t('imp.emptyFile'));
        return;
      }

      setFile(candidate);
      setHeaders(sheet.headers);
      setRows(sheet.rows);

      // Column apne aap pehchan lete hain — "Email Address" ko email, "Full
      // Name" ko name. User ko sirf jaanch kar aage badhna hota hai.
      setMapping(sheet.headers.reduce((acc, header) => ({ ...acc, [header]: guessField(header) }), {}));
      setReport(null);
    } catch (error) {
      // Kharab ya password wali Excel file yahin ruk jati hai.
      setFile(null);
      setFileError(t('imp.readFailed'));
    } finally {
      setReading(false);
    }
  }

  function openPicker() {
    fileRef.current?.click();
  }

  function handleFileInput(event) {
    acceptFile(event.target.files?.[0]);
    // Reset so choosing the same file twice still fires a change event.
    event.target.value = '';
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function clearFile() {
    setFile(null);
    setFileError('');
    setHeaders([]);
    setRows([]);
    setReport(null);
    setExcludedIndices(new Set());
    setPreviewFlag('all');
    setPreviewQuery('');
  }

  const hasEmailColumn = Object.values(mapping).includes('email');

  /** field (email/name/company) se us column ka naam jo file me tha — edit likhne ke liye. */
  const fieldToHeader = useMemo(() => {
    const out = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field !== 'skip') out[field] = header;
    }
    return out;
  }, [mapping]);

  /**
   * Hataayi hui rows chhod kar mapping lagata hai — isi ko server bhejte hain,
   * chahe jaanch ke liye ho ya asli import ke liye.
   */
  function buildWorkingMapped(sourceRows, excluded) {
    return sourceRows
      .map((row, index) => ({ index, row }))
      .filter((entry) => !excluded.has(entry.index))
      .map((entry) => {
        const out = {};
        for (const [source, field] of Object.entries(mapping)) {
          if (field === 'skip') continue;
          out[field] = entry.row[source] ?? '';
        }
        return out;
      });
  }

  // Preview screen isi se banti hai — hataayi hui rows ke bina, par har row ka
  // asli file-row-number yaad rakhte hue (taaki spreadsheet me dhoondh sakein).
  const workingEntries = useMemo(
    () =>
      rows
        .map((row, index) => ({ originalIndex: index, row }))
        .filter((entry) => !excludedIndices.has(entry.originalIndex)),
    [rows, excludedIndices]
  );

  const workingMapped = useMemo(
    () => buildWorkingMapped(rows, excludedIndices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, excludedIndices, mapping]
  );

  /** Edit ya delete ke baad dobara jaanch — bina kuch save kiye. */
  async function revalidate(nextMapped) {
    setRevalidating(true);
    try {
      const data = await api.post('/api/contacts/import', {
        rows: nextMapped,
        groupId: groupId || null,
        commit: false,
      });
      setReport(data.report ?? data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setRevalidating(false);
    }
  }

  /**
   * Jaanch — bina kuch save kiye.
   *
   * Server ko `commit: false` bhejte hain: wo poori jaanch karta hai aur
   * report deta hai, par database me kuch nahi likhta. Isse user ko pehle hi
   * dikh jata hai ki kitne duplicate hain aur kaun si rows galat hain.
   */
  async function validateRows() {
    setBusy(true);
    try {
      const data = await api.post('/api/contacts/import', {
        rows: workingMapped,
        groupId: groupId || null,
        commit: false,
      });
      setReport(data.report ?? data);
      setStep(2);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  /** Ab sach me save karo. */
  async function runImport() {
    setBusy(true);
    try {
      const data = await api.post('/api/contacts/import', {
        rows: workingMapped,
        groupId: groupId || null,
        commit: true,
      });

      const result = data.report ?? data;
      setDone(result);
      setStep(4);
      toast.success(t('imp.importedToast', { count: formatNumber(result.imported ?? 0) }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    // Har step apna kaam karke hi aage badhta hai.
    if (step === 1) {
      if (!hasEmailColumn) {
        toast.warning(t('imp.needEmailColumn'));
        return;
      }
      validateRows();
      return;
    }

    if (step === 3) {
      runImport();
      return;
    }

    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  function finishImport() {
    navigate('/contacts');
  }

  // Jaanch server ko jitni rows bheji thi (workingMapped) unhi ki ginti se
  // nishaan lagta hai — hataayi hui rows to bheji hi nahi jatin.
  const problemsByRow = useMemo(() => {
    const map = new Map();
    for (const problem of report?.problems ?? []) map.set(problem.row, problem);
    return map;
  }, [report]);

  const previewRows = useMemo(
    () =>
      workingEntries.slice(0, 200).map((entry, index) => {
        const sentPosition = index + 2; // jaanch ke waqt server ko isi number par mila tha
        const problem = problemsByRow.get(sentPosition);
        const value = workingMapped[index] ?? {};

        return {
          // Screen par asli file wala row-number dikhate hain, taaki spreadsheet
          // me wahi row dhoondh sakein — server ko bheja gaya number alag hai.
          row: entry.originalIndex + 2,
          originalIndex: entry.originalIndex,
          name: value.name ?? '',
          email: value.email ?? '',
          company: value.company ?? '',
          flag: problem ? (REASON_FLAG[problem.reason] ?? 'invalid') : 'valid',
          detail: problem?.detail ?? '',
        };
      }),
    [workingEntries, workingMapped, problemsByRow]
  );

  const filteredPreviewRows = useMemo(() => {
    const text = previewSearch.trim().toLowerCase();
    return previewRows.filter((row) => {
      if (previewFlag !== 'all' && row.flag !== previewFlag) return false;
      if (
        text &&
        !row.name.toLowerCase().includes(text) &&
        !row.email.toLowerCase().includes(text) &&
        !row.company.toLowerCase().includes(text)
      ) {
        return false;
      }
      return true;
    });
  }, [previewRows, previewFlag, previewSearch]);

  const filteredIds = useMemo(
    () => filteredPreviewRows.map((row) => row.originalIndex),
    [filteredPreviewRows]
  );
  const bulk = useBulkSelection(filteredIds, filteredIds);

  // --- ek row hatana / kai row hatana -----------------------------------
  function removeRows(indices) {
    const next = new Set(excludedIndices);
    for (const index of indices) next.add(index);
    setExcludedIndices(next);
    revalidate(buildWorkingMapped(rows, next));
    bulk.clear();
  }

  function removeOneRow(originalIndex) {
    removeRows([originalIndex]);
    toast.success(t('imp.rowRemoved'));
  }

  function removeSelectedRows() {
    const count = bulk.selectedIds.length;
    removeRows(bulk.selectedIds);
    toast.success(t('imp.rowsRemoved', { count: formatNumber(count) }));
  }

  // --- ek row edit karna --------------------------------------------------
  function openEditRow(row) {
    setEditingRow(row);
    setEditDraft({ name: row.name, email: row.email, company: row.company });
    setEditError('');
  }

  function closeEditRow() {
    setEditingRow(null);
  }

  async function saveEditRow(event) {
    event.preventDefault();
    if (fieldToHeader.email && !editDraft.email.trim()) {
      setEditError(t('con.emailNeeded'));
      return;
    }

    setEditSaving(true);
    try {
      const nextRows = rows.map((row, index) => {
        if (index !== editingRow.originalIndex) return row;
        const updated = { ...row };
        if (fieldToHeader.name) updated[fieldToHeader.name] = editDraft.name.trim();
        if (fieldToHeader.email) updated[fieldToHeader.email] = editDraft.email.trim();
        if (fieldToHeader.company) updated[fieldToHeader.company] = editDraft.company.trim();
        return updated;
      });

      setRows(nextRows);
      setEditingRow(null);
      await revalidate(buildWorkingMapped(nextRows, excludedIndices));
      toast.success(t('imp.rowUpdated'));
    } finally {
      setEditSaving(false);
    }
  }

  /** Jo abhi valid hain unhi ko file me utaarta hai — sahi, saaf list. */
  function downloadCorrected() {
    const validRows = previewRows.filter((row) => row.flag === 'valid');
    downloadCsv(
      'contacts-corrected.csv',
      objectsToRows(validRows, [
        { key: 'name', label: t('common.name') },
        { key: 'email', label: t('common.email') },
        { key: 'company', label: t('common.company') },
      ])
    );
  }

  const duplicates =
    (report?.duplicateInDatabase ?? 0) + (report?.duplicateInFile ?? 0) + (report?.suppressed ?? 0);

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('con.importExcel')}
        helpTopic="import"
        subtitle={t('imp.subtitle')}
        breadcrumb={[{ label: t('nav.contacts'), to: '/contacts' }, { label: t('common.import') }]}
      />

      <Card flush>
        <Stepper steps={STEPS} current={step} onJump={setStep} ariaLabel={t('imp.steps')} />

        <div className="mw-card__body mw-stack">
          {step === 0 ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="visually-hidden"
                accept={ACCEPT}
                onChange={handleFileInput}
                aria-label={t('imp.chooseFile')}
              />

              {file ? (
                <div className="mw-urlbox">
                  <span className="mw-urlbox__text">
                    {t('imp.chosenFile', { name: file.name, size: readableSize(file.size) })}
                    <span className="d-block mw-fs-12 mw-text-muted">
                      {t('imp.rowsFound', { count: formatNumber(rows.length) })}
                    </span>
                  </span>
                  <button type="button" className="mw-urlbox__btn" onClick={clearFile}>
                    {t('imp.removeFile')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`mw-dropzone ${dragging ? 'is-dragging' : ''}`.trim()}
                  onClick={openPicker}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  disabled={reading}
                >
                  <span className="mw-dropzone__icon" aria-hidden="true">
                    <i className={`bi ${reading ? 'bi-hourglass-split' : 'bi-cloud-arrow-up'}`} />
                  </span>
                  <span className="mw-dropzone__title">
                    {reading ? t('imp.reading') : t('imp.dropTitle')}
                  </span>
                  <span className="mw-dropzone__hint">{t('imp.dropHint')}</span>
                </button>
              )}

              {fileError ? (
                <Note tone="warning" icon="bi-exclamation-triangle">
                  {fileError}
                </Note>
              ) : null}

              <SampleFileCard />
              <Note tone="info" icon="bi-info-circle">
                {t('imp.headerNote')}
              </Note>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div>
                <h2 className="mw-fs-16 mw-fw-700 mb-1">{t('imp.mapTitle')}</h2>
                <p className="mw-fs-13 mw-text-muted mb-0">{t('imp.mapSubtitle')}</p>
              </div>

              <div>
                {headers.map((header) => (
                  <div key={header} className="mw-maprow">
                    <span className="mw-maprow__source">
                      {header}
                      <span className="d-block mw-fs-11 mw-text-muted mw-fw-500">{t('imp.fromYourFile')}</span>
                    </span>
                    <span className="mw-maprow__arrow" aria-hidden="true">
                      <i className="bi bi-arrow-right" />
                    </span>
                    <select
                      className="form-select"
                      data-source={header}
                      value={mapping[header] ?? 'skip'}
                      onChange={handleMap}
                      aria-label={t('imp.mapAria', { column: header })}
                    >
                      {appFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {t(field.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!hasEmailColumn ? (
                <Note tone="warning" icon="bi-exclamation-triangle">
                  {t('imp.needEmailColumn')}
                </Note>
              ) : null}

              <div>
                <label className="form-label" htmlFor="import-group">{t('con.group')}</label>
                <select
                  id="import-group"
                  className="form-select"
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                >
                  <option value="">{t('imp.noGroup')}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <Note tone="primary" icon="bi-braces">
                {t('imp.varNote')}
              </Note>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="mw-importsummary">
                <div className="mw-importstat">
                  <div className="mw-importstat__value">{formatNumber(report?.total ?? 0)}</div>
                  <div className="mw-importstat__label">{t('imp.totalRows')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-success">{formatNumber(report?.valid ?? 0)}</div>
                  <div className="mw-importstat__label">{t('imp.valid')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-danger">{formatNumber(report?.invalid ?? 0)}</div>
                  <div className="mw-importstat__label">{t('imp.invalid')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-warning">{formatNumber(duplicates)}</div>
                  <div className="mw-importstat__label">{t('imp.duplicates')}</div>
                </div>
              </div>

              {/* Duplicate teen wajah se hota hai, aur teenon ka matlab alag
                  hai — isliye teenon alag-alag likhte hain. */}
              <div className="mw-grid-3">
                <div className="mw-note mw-note--warning">
                  <i className="bi bi-database mw-note__icon" aria-hidden="true" />
                  <div>
                    <strong>{formatNumber(report?.duplicateInDatabase ?? 0)}</strong>{' '}
                    {t('imp.dupInDatabase')}
                  </div>
                </div>
                <div className="mw-note mw-note--warning">
                  <i className="bi bi-files mw-note__icon" aria-hidden="true" />
                  <div>
                    <strong>{formatNumber(report?.duplicateInFile ?? 0)}</strong> {t('imp.dupInFile')}
                  </div>
                </div>
                <div className="mw-note mw-note--muted">
                  <i className="bi bi-shield-slash mw-note__icon" aria-hidden="true" />
                  <div>
                    <strong>{formatNumber(report?.suppressed ?? 0)}</strong> {t('imp.dupSuppressed')}
                  </div>
                </div>
              </div>

              <Note tone="info" icon="bi-info-circle">
                {t('imp.validateNote', {
                  invalid: formatNumber(report?.invalid ?? 0),
                  duplicates: formatNumber(duplicates),
                })}
              </Note>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="mw-row mw-row--between mw-row--wrap">
                <span className="mw-fs-13 mw-fw-650">
                  {filteredPreviewRows.length === workingEntries.length
                    ? t('imp.totalCount', { count: formatNumber(workingEntries.length) })
                    : t('imp.filteredCount', {
                        shown: formatNumber(filteredPreviewRows.length),
                        total: formatNumber(workingEntries.length),
                      })}
                </span>
                {revalidating ? (
                  <span className="mw-fs-12 mw-text-muted">
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </span>
                ) : null}
              </div>

              <FilterBar
                onClear={() => {
                  setPreviewFlag('all');
                  setPreviewQuery('');
                }}
                clearLabel={t('common.clear')}
              >
                <div className="mw-filterbar__search">
                  <SearchInput
                    value={previewQuery}
                    onChange={setPreviewQuery}
                    placeholder={t('imp.searchPlaceholder')}
                  />
                </div>
                <FilterSelect
                  id="imp-filter-flag"
                  label={t('imp.col.check')}
                  icon="bi-funnel"
                  value={previewFlag}
                  onChange={setPreviewFlag}
                  options={[
                    { value: 'all', label: t('common.all') },
                    { value: 'valid', label: t(FLAG_KEY.valid) },
                    { value: 'invalid', label: t(FLAG_KEY.invalid) },
                    { value: 'duplicate', label: t(FLAG_KEY.duplicate) },
                    { value: 'missing', label: t(FLAG_KEY.missing) },
                  ]}
                />
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={downloadCorrected}>
                  <i className="bi bi-download me-2" />
                  {t('imp.downloadCorrected')}
                </button>
              </FilterBar>

              <BulkBar
                count={bulk.count}
                total={bulk.total}
                pageCount={filteredIds.length}
                onSelectAll={bulk.selectAll}
                onClear={bulk.clear}
                actions={
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeSelectedRows}>
                    <i className="bi bi-trash3 me-2" />
                    {t('bulk.delete')}
                  </button>
                }
              />

              {excludedIndices.size > 0 ? (
                <Note tone="info" icon="bi-trash3">
                  {t('imp.removedNote', { count: formatNumber(excludedIndices.size) })}{' '}
                  <button
                    type="button"
                    className="mw-linkbtn"
                    onClick={() => {
                      setExcludedIndices(new Set());
                      revalidate(buildWorkingMapped(rows, new Set()));
                    }}
                  >
                    {t('imp.undoRemovals')}
                  </button>
                </Note>
              ) : null}

              {filteredPreviewRows.length === 0 ? (
                <Note tone="info" icon="bi-search">
                  {t('common.noResults')}
                </Note>
              ) : (
                <>
                  <div className="mw-tablewrap">
                    <table className="mw-table">
                      <thead>
                        <tr>
                          <th scope="col" className="mw-table__check">
                            <SelectAllCheckbox
                              checked={bulk.allPageSelected}
                              indeterminate={bulk.somePageSelected}
                              onChange={bulk.toggleAllVisible}
                              label={t('bulk.selectAllRows')}
                            />
                          </th>
                          <th scope="col">{t('imp.col.row')}</th>
                          <th scope="col">{t('common.name')}</th>
                          <th scope="col">{t('common.email')}</th>
                          <th scope="col">{t('common.company')}</th>
                          <th scope="col">{t('imp.col.check')}</th>
                          <th scope="col" className="text-end">
                            {t('imp.col.action')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreviewRows.map((row) => (
                          <tr key={row.row}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={bulk.isSelected(row.originalIndex)}
                                onChange={() => bulk.toggleOne(row.originalIndex)}
                                aria-label={t('imp.rowOf', { row: row.row })}
                              />
                            </td>
                            <td className="mw-table__muted">{row.row}</td>
                            <td className="mw-table__primary">{row.name}</td>
                            <td>{row.email || <span className="mw-text-muted-2">{t('imp.empty')}</span>}</td>
                            <td className="mw-table__muted">{row.company}</td>
                            <td>
                              <StatusPill status={t(FLAG_KEY[row.flag])} tone={FLAG_TONE[row.flag]} />
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="mw-iconbtn"
                                onClick={() => openEditRow(row)}
                                aria-label={t('imp.col.fix')}
                                title={t('imp.col.fix')}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              <button
                                type="button"
                                className="mw-iconbtn mw-text-danger"
                                onClick={() => removeOneRow(row.originalIndex)}
                                aria-label={t('common.delete')}
                                title={t('common.delete')}
                              >
                                <i className="bi bi-trash3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mw-reclist">
                    {filteredPreviewRows.map((row) => (
                      <div key={row.row} className="mw-rec">
                        <div className="mw-rec__top">
                          <input
                            type="checkbox"
                            className="form-check-input me-2"
                            checked={bulk.isSelected(row.originalIndex)}
                            onChange={() => bulk.toggleOne(row.originalIndex)}
                            aria-label={t('imp.rowOf', { row: row.row })}
                          />
                          <span className="mw-rec__title">
                            {row.name}
                            <span className="d-block mw-rec__sub">{row.email || t('imp.empty')}</span>
                          </span>
                          <StatusPill status={t(FLAG_KEY[row.flag])} tone={FLAG_TONE[row.flag]} />
                        </div>
                        <div className="mw-row mw-row--between mt-2">
                          <span className="mw-fs-12 mw-text-muted">
                            {t('imp.rowOf', { row: row.row })} · {row.company}
                          </span>
                          <span>
                            <button type="button" className="mw-iconbtn" onClick={() => openEditRow(row)}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              type="button"
                              className="mw-iconbtn mw-text-danger"
                              onClick={() => removeOneRow(row.originalIndex)}
                            >
                              <i className="bi bi-trash3" />
                            </button>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {rows.length > 200 ? (
                <Note tone="info" icon="bi-list-ol">
                  {t('imp.previewLimit', { shown: 200, total: formatNumber(rows.length) })}
                </Note>
              ) : null}
            </>
          ) : null}

          <Sheet open={Boolean(editingRow)} title={t('imp.editTitle')} onClose={closeEditRow}>
            {editingRow ? (
              <form onSubmit={saveEditRow}>
                {editError ? (
                  <div className="mw-note mw-note--warning mb-3" role="alert">
                    <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                    <div>{editError}</div>
                  </div>
                ) : null}

                {fieldToHeader.name ? (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-row-name">{t('common.name')}</label>
                    <input
                      id="edit-row-name"
                      type="text"
                      className="form-control"
                      value={editDraft.name}
                      onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                ) : null}

                {fieldToHeader.email ? (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-row-email">{t('common.email')}</label>
                    <input
                      id="edit-row-email"
                      type="email"
                      className="form-control"
                      value={editDraft.email}
                      onChange={(event) => {
                        setEditDraft((current) => ({ ...current, email: event.target.value }));
                        setEditError('');
                      }}
                      autoFocus
                    />
                  </div>
                ) : null}

                {fieldToHeader.company ? (
                  <div className="mb-4">
                    <label className="form-label" htmlFor="edit-row-company">{t('common.company')}</label>
                    <input
                      id="edit-row-company"
                      type="text"
                      className="form-control"
                      value={editDraft.company}
                      onChange={(event) => setEditDraft((current) => ({ ...current, company: event.target.value }))}
                    />
                  </div>
                ) : null}

                <button type="submit" className="btn btn-primary w-100" disabled={editSaving}>
                  {editSaving ? t('common.loading') : t('common.save')}
                </button>
              </form>
            ) : null}
          </Sheet>

          {step === 4 ? (
            <div className="text-center py-4">
              <span className="mw-empty__icon mx-auto" aria-hidden="true">
                <i className="bi bi-check-lg" />
              </span>
              <h2 className="mw-fs-20 mw-fw-700 mb-2">
                {t('imp.doneTitle', { count: formatNumber(done?.imported ?? 0) })}
              </h2>
              <p className="mw-fs-14 mw-text-muted mb-4">
                {t('imp.doneSub', {
                  skipped: formatNumber((done?.total ?? 0) - (done?.imported ?? 0)),
                })}
              </p>
              <button type="button" className="btn btn-primary btn-lg" onClick={finishImport}>
                <i className="bi bi-people me-2" />
                {t('nav.contacts')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mw-wizard-foot">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={goBack}
            disabled={step === 0 || step === 4}
          >
            <i className="bi bi-arrow-left me-2" />
            {t('common.back')}
          </button>
          <span className="mw-fs-12 mw-text-muted ms-auto mw-hide-mobile">
            {t('wiz.stepCounter', {
              current: step + 1,
              total: STEPS.length,
              label: t(STEPS[step].labelKey),
            })}
          </span>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary ms-auto ms-md-3"
              onClick={goNext}
              disabled={(step === 0 && !file) || busy || reading}
            >
              {busy ? t('common.loading') : step === 3 ? t('imp.importValid') : t('common.continue')}
              <i className="bi bi-arrow-right ms-2" />
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

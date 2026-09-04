import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import Stepper from '../components/wizard/Stepper';
import StatusPill from '../components/ui/StatusPill';
import SampleFileCard from '../components/ui/SampleFileCard';
import { useT } from '../i18n/I18nProvider';
import { ApiError, api } from '../api/client';
import { useApi } from '../api/useApi';
import { useToast } from '../components/ui/ToastProvider';
import { readSheet } from '../utils/readSheet';
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
  'no-email': 'missing',
  'bad-email': 'invalid',
  'duplicate-in-database': 'duplicate',
  'duplicate-in-file': 'duplicate',
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
  }

  /**
   * Mapping lagakar rows ko app ke naamon me badalta hai.
   *
   * File me column ka naam kuch bhi ho sakta hai ("Email Address", "मेल"),
   * par server ko hamesha `email`, `name` jaise naam chahiye.
   */
  const mapped = useMemo(
    () =>
      rows.map((row) => {
        const out = {};
        for (const [source, field] of Object.entries(mapping)) {
          if (field === 'skip') continue;
          out[field] = row[source] ?? '';
        }
        return out;
      }),
    [rows, mapping]
  );

  const hasEmailColumn = Object.values(mapping).includes('email');

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
        rows: mapped,
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
        rows: mapped,
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

  // Jaanch ke baad har row par ek nishaan — screen par pehli 200 dikhti hain.
  const problemsByRow = useMemo(() => {
    const map = new Map();
    for (const problem of report?.problems ?? []) map.set(problem.row, problem);
    return map;
  }, [report]);

  const previewRows = useMemo(
    () =>
      rows.slice(0, 200).map((row, index) => {
        const rowNumber = index + 2; // header ko row 1 maan kar
        const problem = problemsByRow.get(rowNumber);
        const value = mapped[index] ?? {};

        return {
          row: rowNumber,
          name: value.name ?? '',
          email: value.email ?? '',
          company: value.company ?? '',
          flag: problem ? (REASON_FLAG[problem.reason] ?? 'invalid') : 'valid',
          detail: problem?.detail ?? '',
        };
      }),
    [rows, mapped, problemsByRow]
  );

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
              <div className="mw-tablewrap">
                <table className="mw-table">
                  <thead>
                    <tr>
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
                    {previewRows.map((row) => (
                      <tr key={row.row}>
                        <td className="mw-table__muted">{row.row}</td>
                        <td className="mw-table__primary">{row.name}</td>
                        <td>{row.email || <span className="mw-text-muted-2">{t('imp.empty')}</span>}</td>
                        <td className="mw-table__muted">{row.company}</td>
                        <td>
                          <StatusPill status={t(FLAG_KEY[row.flag])} tone={FLAG_TONE[row.flag]} />
                        </td>
                        <td className="text-end mw-fs-12 mw-text-muted-2">
                          {row.flag === 'valid' ? t('imp.willImport') : row.detail || t('imp.willSkip')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mw-reclist">
                {previewRows.map((row) => (
                  <div key={row.row} className="mw-rec">
                    <div className="mw-rec__top">
                      <span className="mw-rec__title">
                        {row.name}
                        <span className="d-block mw-rec__sub">{row.email || t('imp.empty')}</span>
                      </span>
                      <StatusPill status={t(FLAG_KEY[row.flag])} tone={FLAG_TONE[row.flag]} />
                    </div>
                    <span className="mw-fs-12 mw-text-muted">
                      {t('imp.rowOf', { row: row.row })} · {row.company}
                    </span>
                  </div>
                ))}
              </div>

              {rows.length > 200 ? (
                <Note tone="info" icon="bi-list-ol">
                  {t('imp.previewLimit', { shown: 200, total: formatNumber(rows.length) })}
                </Note>
              ) : null}
            </>
          ) : null}

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

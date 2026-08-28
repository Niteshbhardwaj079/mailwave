import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import SampleFileCard from '../components/ui/SampleFileCard';
import StatusPill from '../components/ui/StatusPill';
import Stepper from '../components/wizard/Stepper';
import { appFields, excelColumns, excelPreviewRows, importSummary } from '../data/mockData';
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

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_BYTES = 20 * 1024 * 1024;

function readableSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ImportContactsPage() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const [mapping, setMapping] = useState(() =>
    excelColumns.reduce((acc, column) => ({ ...acc, [column.source]: column.target }), {})
  );
  const navigate = useNavigate();

  function handleMap(event) {
    setMapping((current) => ({ ...current, [event.target.dataset.source]: event.target.value }));
  }

  // --- the file itself ------------------------------------------------------
  function acceptFile(candidate) {
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
    setFile(candidate);
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
  }

  function goNext() {
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  function goBack() {
    setStep((current) => Math.max(0, current - 1));
  }

  function finishImport() {
    navigate('/contacts');
  }

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
                >
                  <span className="mw-dropzone__icon" aria-hidden="true">
                    <i className="bi bi-cloud-arrow-up" />
                  </span>
                  <span className="mw-dropzone__title">{t('imp.dropTitle')}</span>
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
                {excelColumns.map((column) => (
                  <div key={column.source} className="mw-maprow">
                    <span className="mw-maprow__source">
                      {column.source}
                      <span className="d-block mw-fs-11 mw-text-muted mw-fw-500">{t('imp.fromYourFile')}</span>
                    </span>
                    <span className="mw-maprow__arrow" aria-hidden="true">
                      <i className="bi bi-arrow-right" />
                    </span>
                    <select
                      className="form-select"
                      data-source={column.source}
                      value={mapping[column.source]}
                      onChange={handleMap}
                      aria-label={t('imp.mapAria', { column: column.source })}
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

              <Note tone="primary" icon="bi-braces">
                {t('imp.varNote')}
              </Note>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="mw-importsummary">
                <div className="mw-importstat">
                  <div className="mw-importstat__value">{formatNumber(importSummary.total)}</div>
                  <div className="mw-importstat__label">{t('imp.totalRows')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-success">{formatNumber(importSummary.valid)}</div>
                  <div className="mw-importstat__label">{t('imp.valid')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-danger">{formatNumber(importSummary.invalid)}</div>
                  <div className="mw-importstat__label">{t('imp.invalid')}</div>
                </div>
                <div className="mw-importstat">
                  <div className="mw-importstat__value mw-text-warning">{formatNumber(importSummary.duplicates)}</div>
                  <div className="mw-importstat__label">{t('imp.duplicates')}</div>
                </div>
              </div>

              <Note tone="warning" icon="bi-exclamation-triangle">
                {t('imp.validateNote', {
                  invalid: formatNumber(importSummary.invalid),
                  duplicates: formatNumber(importSummary.duplicates),
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
                    {excelPreviewRows.map((row) => (
                      <tr key={row.row}>
                        <td className="mw-table__muted">{row.row}</td>
                        <td className="mw-table__primary">{row.name}</td>
                        <td>{row.email || <span className="mw-text-muted-2">{t('imp.empty')}</span>}</td>
                        <td className="mw-table__muted">{row.company}</td>
                        <td>
                          <StatusPill status={t(FLAG_KEY[row.flag])} tone={FLAG_TONE[row.flag]} />
                        </td>
                        <td className="text-end">
                          {row.flag === 'valid' ? (
                            <span className="mw-fs-12 mw-text-muted-2">{t('imp.willImport')}</span>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline-secondary">
                              {t('imp.fixRemove')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mw-reclist">
                {excelPreviewRows.map((row) => (
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
            </>
          ) : null}

          {step === 4 ? (
            <div className="text-center py-4">
              <span className="mw-empty__icon mx-auto" aria-hidden="true">
                <i className="bi bi-check-lg" />
              </span>
              <h2 className="mw-fs-20 mw-fw-700 mb-2">
                {t('imp.readyTitle', { count: formatNumber(importSummary.valid) })}
              </h2>
              <p className="mw-fs-14 mw-text-muted mb-4">{t('imp.readySub')}</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={finishImport}>
                <i className="bi bi-download me-2" />
                {t('imp.importValid')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mw-wizard-foot">
          <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={step === 0}>
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
              disabled={step === 0 && !file}
            >
              {t('common.continue')}
              <i className="bi bi-arrow-right ms-2" />
            </button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

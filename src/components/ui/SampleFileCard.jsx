import { useT } from '../../i18n/I18nProvider';
import { buildSampleCsvRows, sampleColumns, sampleRows } from '../../data/sampleImport';
import { downloadCsv } from '../../utils/download';
import { Note } from './Controls';

/**
 * Shown next to every "upload your Excel file" box.
 * People can download a filled-in example and just replace the rows.
 */
export default function SampleFileCard({ compact = false }) {
  const t = useT();

  function handleDownload() {
    downloadCsv('mailwave-sample-contacts.csv', buildSampleCsvRows());
  }

  return (
    <div className="mw-sample">
      <div className="mw-sample__head">
        <span className="mw-sample__icon" aria-hidden="true">
          <i className="bi bi-file-earmark-arrow-down" />
        </span>
        <div className="flex-grow-1 min-w-0">
          <h3 className="mw-sample__title">{t('sample.title')}</h3>
          <p className="mw-sample__sub mb-0">{t('sample.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm mw-nowrap" onClick={handleDownload}>
          <i className="bi bi-download me-2" />
          {t('sample.download')}
        </button>
      </div>

      <div className="mw-tablewrap">
        <table className="mw-table mw-table--sample">
          <thead>
            <tr>
              {sampleColumns.map((column) => (
                <th key={column.key} scope="col">
                  {column.header}
                  {column.required ? <span className="mw-sample__req"> *</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(compact ? sampleRows.slice(0, 2) : sampleRows).map((row) => (
              <tr key={row.email}>
                {sampleColumns.map((column) => (
                  <td key={column.key} className="mw-nowrap">
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compact ? null : (
        <ul className="mw-sample__legend">
          {sampleColumns.map((column) => (
            <li key={column.key} className="mw-sample__legenditem">
              <span className="mw-sample__legendname">
                {column.header}
                {column.required ? <span className="mw-sample__req"> *</span> : null}
              </span>
              <span className="mw-sample__legenddesc">{t(column.descKey)}</span>
            </li>
          ))}
          {/* Reminds people the five columns above are a starting point, not a limit. */}
          <li className="mw-sample__legenditem">
            <span className="mw-sample__legendname">+</span>
            <span className="mw-sample__legenddesc">{t('sample.colCustom')}</span>
          </li>
        </ul>
      )}

      <Note tone="info" icon="bi-info-circle">
        {t('sample.note')}
      </Note>
    </div>
  );
}

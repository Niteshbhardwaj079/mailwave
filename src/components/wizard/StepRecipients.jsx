import { Note } from '../ui/Controls';
import SampleFileCard from '../ui/SampleFileCard';
import StatusPill from '../ui/StatusPill';
import { contactGroups, excelPreviewRows, importSummary, segments } from '../../data/mockData';
import { formatDate, formatNumber } from '../../utils/format';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';

const SOURCES = [
  { key: 'excel', titleKey: 'rec.src.excel', descKey: 'rec.src.excelDesc', icon: 'bi-file-earmark-spreadsheet' },
  { key: 'manual', titleKey: 'rec.src.manual', descKey: 'rec.src.manualDesc', icon: 'bi-keyboard' },
  { key: 'existing', titleKey: 'rec.src.existing', descKey: 'rec.src.existingDesc', icon: 'bi-people' },
  {
    key: 'subscribers',
    titleKey: 'rec.src.subscribers',
    descKey: 'rec.src.subscribersDesc',
    icon: 'bi-hand-thumbs-up',
  },
];

const FLAG_TONE = {
  valid: 'success',
  invalid: 'danger',
  duplicate: 'warning',
  missing: 'muted',
};

const FLAG_KEY = {
  valid: 'imp.flag.valid',
  invalid: 'imp.flag.invalid',
  duplicate: 'imp.flag.duplicate',
  missing: 'imp.flag.missing',
};

export default function StepRecipients({ draft, onChange }) {
  const t = useT();
  const { subscribers } = useWorkspace();
  const activeSubscribers = subscribers.filter((item) => item.status === 'Subscribed');

  function handleSubscriberToggle(event) {
    const { id } = event.currentTarget.dataset;
    const next = draft.subscriberIds.includes(id)
      ? draft.subscriberIds.filter((item) => item !== id)
      : [...draft.subscriberIds, id];
    onChange({ subscriberIds: next });
  }

  function selectAllSubscribers() {
    onChange({ subscriberIds: activeSubscribers.map((item) => item.id) });
  }

  function clearSubscribers() {
    onChange({ subscriberIds: [] });
  }

  function handleSource(event) {
    onChange({ recipientSource: event.currentTarget.dataset.key });
  }

  function handleManual(event) {
    onChange({ manualList: event.target.value });
  }

  function handleGroupToggle(event) {
    const { id } = event.currentTarget.dataset;
    const next = draft.groups.includes(id) ? draft.groups.filter((g) => g !== id) : [...draft.groups, id];
    onChange({ groups: next });
  }

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('rec.title')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('rec.subtitle')}</p>
      </div>

      <div className="mw-optiongrid">
        {SOURCES.map((source) => (
          <button
            key={source.key}
            type="button"
            data-key={source.key}
            onClick={handleSource}
            className={`mw-option ${draft.recipientSource === source.key ? 'is-selected' : ''}`.trim()}
          >
            <span className="mw-option__icon" aria-hidden="true">
              <i className={`bi ${source.icon}`} />
            </span>
            <span>
              <span className="d-block mw-option__title">{t(source.titleKey)}</span>
              <span className="d-block mw-option__desc">{t(source.descKey)}</span>
            </span>
            {draft.recipientSource === source.key ? (
              <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>

      {draft.recipientSource === 'excel' ? (
        <div className="mw-stack--sm d-flex flex-column">
          <SampleFileCard compact />
          <button type="button" className="mw-dropzone">
            <span className="mw-dropzone__icon" aria-hidden="true">
              <i className="bi bi-cloud-arrow-up" />
            </span>
            <span className="mw-dropzone__title">{t('rec.dropTitle')}</span>
            <span className="mw-dropzone__hint">{t('rec.dropHint')}</span>
          </button>

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
                    {t('imp.col.fix')}
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
                        <span className="mw-text-muted-2 mw-fs-12">{t('imp.noAction')}</span>
                      ) : (
                        <button type="button" className="btn btn-sm btn-outline-secondary">
                          {t('imp.editRemove')}
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
                <div className="mw-fs-12 mw-text-muted">
                  {t('imp.rowOf', { row: row.row })} · {row.company}
                </div>
              </div>
            ))}
          </div>

          <Note tone="warning" icon="bi-exclamation-triangle">
            {t('rec.onlyValid')}
          </Note>
        </div>
      ) : null}

      {draft.recipientSource === 'subscribers' ? (
        <div className="mw-stack--sm d-flex flex-column">
          <Note tone="success" icon="bi-hand-thumbs-up">
            {t('rec.subscriberNote', { count: activeSubscribers.length })}
          </Note>

          <div className="mw-row mw-row--wrap">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={selectAllSubscribers}>
              <i className="bi bi-check-all me-2" />
              {t('rec.selectAllCount', { count: activeSubscribers.length })}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearSubscribers}>
              {t('common.clear')}
            </button>
            <span className="mw-fs-12 mw-text-muted">{t('rec.chosen', { count: draft.subscriberIds.length })}</span>
          </div>

          <div className="mw-optiongrid">
            {activeSubscribers.map((person) => (
              <button
                key={person.id}
                type="button"
                data-id={person.id}
                onClick={handleSubscriberToggle}
                className={`mw-option ${draft.subscriberIds.includes(person.id) ? 'is-selected' : ''}`.trim()}
              >
                <span className="mw-option__icon" aria-hidden="true">
                  <i className="bi bi-person-check" />
                </span>
                <span>
                  <span className="d-block mw-option__title">{person.name}</span>
                  <span className="d-block mw-option__desc">{person.email}</span>
                  <span className="d-block mw-fs-11 mw-text-muted-2 mt-1">
                    {t('rec.subscribedFrom', { campaign: person.campaign })} · {formatDate(person.subscribedAt)}
                  </span>
                </span>
                {draft.subscriberIds.includes(person.id) ? (
                  <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft.recipientSource === 'manual' ? (
        <div className="mw-stack--sm d-flex flex-column">
          <div>
            <label className="form-label" htmlFor="manual-emails">
              {t('rec.emailAddresses')}
            </label>
            <textarea
              id="manual-emails"
              className="form-control"
              rows={8}
              value={draft.manualList}
              onChange={handleManual}
              placeholder={'rahul@example.com\nAmit Kumar <amit@example.com>\npriya@example.com, neha@example.com'}
            />
            <div className="form-text">{t('rec.manualHelp')}</div>
          </div>
          <Note tone="info" icon="bi-info-circle">
            {t('rec.manualNote')}
          </Note>
        </div>
      ) : null}

      {draft.recipientSource === 'existing' ? (
        <div className="mw-stack--sm d-flex flex-column">
          <div>
            <h3 className="mw-fs-14 mw-fw-700 mb-2">{t('rec.groups')}</h3>
            <div className="mw-optiongrid">
              {contactGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  data-id={group.id}
                  onClick={handleGroupToggle}
                  className={`mw-option ${draft.groups.includes(group.id) ? 'is-selected' : ''}`.trim()}
                >
                  <span className="mw-option__icon" aria-hidden="true">
                    <i className="bi bi-collection" />
                  </span>
                  <span>
                    <span className="d-block mw-option__title">{group.name}</span>
                    <span className="d-block mw-option__desc">
                      {t('rec.contactsCount', { count: formatNumber(group.count) })}
                    </span>
                  </span>
                  {draft.groups.includes(group.id) ? (
                    <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mw-fs-14 mw-fw-700 mb-2 mt-3">{t('rec.segments')}</h3>
            <div className="mw-optiongrid">
              {segments.slice(0, 4).map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  data-id={segment.id}
                  onClick={handleGroupToggle}
                  className={`mw-option ${draft.groups.includes(segment.id) ? 'is-selected' : ''}`.trim()}
                >
                  <span className="mw-option__icon" aria-hidden="true">
                    <i className="bi bi-diagram-3" />
                  </span>
                  <span>
                    <span className="d-block mw-option__title">{segment.name}</span>
                    <span className="d-block mw-option__desc">
                      {segment.rule} · {t('rec.contactsCount', { count: formatNumber(segment.count) })}
                    </span>
                  </span>
                  {draft.groups.includes(segment.id) ? (
                    <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <Note tone="success" icon="bi-shield-check">
            {t('rec.cleanNote')}
          </Note>
        </div>
      ) : null}
    </div>
  );
}

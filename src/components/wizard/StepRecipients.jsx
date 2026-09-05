import { useNavigate } from 'react-router-dom';

import { Note } from '../ui/Controls';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { formatDate, formatNumber } from '../../utils/format';

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

/**
 * `draft.groups` sirf EK id rakhta hai — group ya segment. Dono ke id ka
 * prefix alag hota hai (g_ / seg_), isliye alag se "kaunsa chuna" yaad
 * rakhne ki zarurat nahi.
 */
export default function StepRecipients({ draft, onChange, contactGroups, segments }) {
  const t = useT();
  const navigate = useNavigate();
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
    const { key } = event.currentTarget.dataset;
    // Naye upload ke liye asli Import page hai — usi ek jagah se ho, taaki
    // duplicate/invalid jaanch waghera bhi wahi mile jo Import me milti hai.
    if (key === 'excel') {
      navigate('/contacts/import');
      return;
    }
    onChange({ recipientSource: key });
  }

  function handleManual(event) {
    onChange({ manualList: event.target.value });
  }

  /** Ek waqt me sirf ek group YA ek segment — dono ek saath nahi chal sakte. */
  function handleGroupToggle(event) {
    const { id } = event.currentTarget.dataset;
    onChange({ groups: draft.groups[0] === id ? [] : [id] });
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
            {contactGroups.length === 0 ? (
              <p className="mw-fs-13 mw-text-muted">{t('rec.noGroups')}</p>
            ) : (
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
            )}
          </div>

          <div>
            <h3 className="mw-fs-14 mw-fw-700 mb-2 mt-3">{t('rec.segments')}</h3>
            {segments.length === 0 ? (
              <p className="mw-fs-13 mw-text-muted">{t('rec.noSegments')}</p>
            ) : (
              <div className="mw-optiongrid">
                {segments.map((segment) => (
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
                        {segment.ruleText} · {t('rec.contactsCount', { count: formatNumber(segment.count) })}
                      </span>
                    </span>
                    {draft.groups.includes(segment.id) ? (
                      <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Note tone="success" icon="bi-shield-check">
            {t('rec.cleanNote')}
          </Note>
        </div>
      ) : null}
    </div>
  );
}

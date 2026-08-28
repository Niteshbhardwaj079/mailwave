import { Note } from '../ui/Controls';
import { appConfig } from '../../config/appConfig';
import { emailAccounts } from '../../data/mockData';
import { useT } from '../../i18n/I18nProvider';

export default function StepInfo({ draft, onChange }) {
  const t = useT();
  function handleField(event) {
    onChange({ [event.target.name]: event.target.value });
  }

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('info.title')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('info.subtitle')}</p>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <label className="form-label" htmlFor="campaign-name">
            {t('info.name')}
          </label>
          <input
            id="campaign-name"
            name="name"
            type="text"
            className="form-control"
            value={draft.name}
            onChange={handleField}
            placeholder={t('tpl.namePlaceholder')}
          />
          <div className="form-text">{t('info.nameHelp')}</div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="campaign-account">
            {t('info.account')}
          </label>
          <select
            id="campaign-account"
            name="account"
            className="form-select"
            value={draft.account}
            onChange={handleField}
          >
            {emailAccounts.map((account) => (
              <option key={account.id} value={account.email}>
                {account.email} — {account.provider}
              </option>
            ))}
          </select>
          <div className="form-text">{t('info.accountHelp')}</div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="campaign-sender">
            {t('info.sender')}
          </label>
          <input
            id="campaign-sender"
            name="senderName"
            type="text"
            className="form-control"
            value={draft.senderName}
            onChange={handleField}
            placeholder={`${appConfig.company} Team`}
          />
          <div className="form-text">{t('info.senderHelp')}</div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="campaign-replyto">
            {t('info.replyTo')}
          </label>
          <input
            id="campaign-replyto"
            name="replyTo"
            type="email"
            className="form-control"
            value={draft.replyTo}
            onChange={handleField}
            placeholder="support@yourcompany.com"
          />
          <div className="form-text">{t('info.replyToHelp')}</div>
        </div>

        {/* People always ask this, so it is answered before they send, not after. */}
        <div className="col-12">
          <Note tone="info" icon="bi-reply">
            {t('camp.replyNote')}
          </Note>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="campaign-subject">
            {t('info.subject')}
          </label>
          <input
            id="campaign-subject"
            name="subject"
            type="text"
            className="form-control"
            value={draft.subject}
            onChange={handleField}
            placeholder={t('info.subjectPlaceholder')}
          />
          <div className="form-text">{t('info.subjectHelp')}</div>
        </div>
      </div>

      <Note tone="primary" icon="bi-lightbulb">
        {t('info.subjectTip')}
      </Note>
    </div>
  );
}

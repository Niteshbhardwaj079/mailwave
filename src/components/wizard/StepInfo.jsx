import { Note, Required } from '../ui/Controls';
import { appConfig } from '../../config/appConfig';
import { useT } from '../../i18n/I18nProvider';
import { isValidEmail } from '../../utils/validation';

// accounts wo hain jo SACH ME jude hue hain — server se aate hain. Pehle
// yahan ek nakli list dikhti thi, aur us email se kabhi kuch jata hi nahi.
export default function StepInfo({ draft, onChange, accounts = [], showErrors = false }) {
  const t = useT();
  function handleField(event) {
    onChange({ [event.target.name]: event.target.value });
  }

  const nameInvalid = showErrors && !draft.name.trim();
  const accountInvalid = showErrors && !draft.account;
  const subjectInvalid = showErrors && !draft.subject.trim();
  const replyToInvalid = showErrors && draft.replyTo.trim() && !isValidEmail(draft.replyTo);

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
            <Required />
          </label>
          <input
            id="campaign-name"
            name="name"
            type="text"
            className={`form-control ${nameInvalid ? 'is-invalid' : ''}`.trim()}
            value={draft.name}
            onChange={handleField}
            placeholder={t('tpl.namePlaceholder')}
          />
          <div className="invalid-feedback">{t('wiz.needName')}</div>
          <div className="form-text">{t('info.nameHelp')}</div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="campaign-account">
            {t('info.account')}
            <Required />
          </label>
          <select
            id="campaign-account"
            name="account"
            className={`form-select ${accountInvalid ? 'is-invalid' : ''}`.trim()}
            value={draft.account}
            onChange={handleField}
          >
            {accounts.length === 0 ? <option value="">—</option> : null}
            {accounts.map((account) => (
              <option key={account.id} value={account.email}>
                {account.email} — {account.providerName}
              </option>
            ))}
          </select>
          <div className="invalid-feedback">{t('wiz.needAccount')}</div>
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
            className={`form-control ${replyToInvalid ? 'is-invalid' : ''}`.trim()}
            value={draft.replyTo}
            onChange={handleField}
            placeholder="support@yourcompany.com"
          />
          <div className="invalid-feedback">{t('wiz.badReplyTo')}</div>
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
            <Required />
          </label>
          <input
            id="campaign-subject"
            name="subject"
            type="text"
            className={`form-control ${subjectInvalid ? 'is-invalid' : ''}`.trim()}
            value={draft.subject}
            onChange={handleField}
            placeholder={t('info.subjectPlaceholder')}
          />
          <div className="invalid-feedback">{t('wiz.needSubject')}</div>
          <div className="form-text">{t('info.subjectHelp')}</div>
        </div>
      </div>

      <Note tone="primary" icon="bi-lightbulb">
        {t('info.subjectTip')}
      </Note>
    </div>
  );
}

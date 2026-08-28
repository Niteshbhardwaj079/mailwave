import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { Note } from '../components/ui/Controls';
import ProgressBar from '../components/ui/ProgressBar';

/**
 * Opened from the link in the "set your password" or "forgot password" email.
 * The token in the URL is what proves the person owns the mailbox — that is
 * why nobody can create an account from the sign-in page.
 */
export default function ResetPasswordPage({ mode = 'reset' }) {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score; // 0 – 5
  }, [password]);

  const strengthLabel = [t('auth.strength0'), t('auth.strength1'), t('auth.strength2'), t('auth.strength3'), t('auth.strength4'), t('auth.strength5')][strength];
  const strengthTone = strength <= 1 ? 'danger' : strength <= 3 ? 'primary' : 'success';

  function handlePassword(event) {
    setPassword(event.target.value);
    setError('');
  }

  function handleConfirm(event) {
    setConfirm(event.target.value);
    setError('');
  }

  function toggleShow() {
    setShow((current) => !current);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (password.length < 8) {
      setError(t('auth.errShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.errMatch'));
      return;
    }
    setDone(true);
  }

  function goToSignIn() {
    navigate('/login');
  }

  return (
    <div className="mw-auth mw-auth--single">
      <div className="mw-auth__panel">
        <div className="mw-auth__form">
          <div className="mw-row mb-5">
            <span className="mw-sidebar__logo" aria-hidden="true">
              <i className={`bi ${appConfig.logoIcon}`} />
            </span>
            <span>
              <span className="d-block mw-sidebar__name">{appConfig.name}</span>
              <span className="d-block mw-sidebar__tagline">{appConfig.tagline}</span>
            </span>
          </div>

          {done ? (
            <div className="text-center">
              <span className="mw-empty__icon mx-auto" aria-hidden="true">
                <i className="bi bi-check-lg" />
              </span>
              <h1 className="mw-fs-24 mw-fw-700 mb-2">{t('auth.doneTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">{t('auth.doneSub')}</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={goToSignIn}>
                {t('auth.signIn')}
              </button>
            </div>
          ) : !token ? (
            <>
              <h1 className="mw-fs-24 mw-fw-700 mb-2">{t('auth.badLinkTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">{t('auth.badLinkSub')}</p>
              <button type="button" className="btn btn-primary" onClick={goToSignIn}>
                {t('auth.backToSignIn')}
              </button>
            </>
          ) : (
            <>
              <h1 className="mw-fs-28 mw-fw-700 mb-2">
                {mode === 'invite' ? t('auth.setTitle') : t('auth.resetTitle')}
              </h1>
              <p className="mw-fs-14 mw-text-muted mb-4">
                {mode === 'invite' ? t('auth.setSub') : t('auth.resetSub')}
              </p>

              {error ? (
                <div className="mw-note mw-note--warning mb-3" role="alert">
                  <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                  <div>{error}</div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label className="form-label" htmlFor="new-password">
                    {t('auth.newPassword')}
                  </label>
                  <div className="input-group input-group-lg">
                    <input
                      id="new-password"
                      type={show ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={handlePassword}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={toggleShow}
                      aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>

                  <div className="mt-2">
                    <ProgressBar value={strength * 20} tone={strengthTone} label={t('auth.strength')} />
                    <span className="d-block form-text mt-1">
                      {t('auth.strength')}: {strengthLabel}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label" htmlFor="confirm-password">
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    id="confirm-password"
                    type={show ? 'text' : 'password'}
                    className="form-control form-control-lg"
                    value={confirm}
                    onChange={handleConfirm}
                    autoComplete="new-password"
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100 mb-4">
                  {mode === 'invite' ? t('auth.setPassword') : t('auth.savePassword')}
                </button>
              </form>

              <Note tone="info" icon="bi-shield-lock">
                {t('auth.passwordRule')}
              </Note>
            </>
          )}
        </div>

        <p className="mw-auth__foot">
          {appConfig.company} · <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a>
        </p>
      </div>
    </div>
  );
}

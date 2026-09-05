import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { ApiError, api } from '../api/client';

/**
 * Opened from the "confirm your new email" link. The token proves this
 * mailbox is really reachable — until this runs, the account's sign-in email
 * has not actually changed (see routes/auth.js confirm-email-change).
 */
export default function ConfirmEmailPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState('working'); // working | done | error
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setError(t('auth.badLinkSub'));
      return;
    }

    let cancelled = false;

    api
      .post('/api/auth/confirm-email-change', { token }, { retry: false })
      .then((data) => {
        if (cancelled) return;
        setEmail(data?.email ?? '');
        setState('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t('toast.networkError'));
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

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

          {state === 'working' ? (
            <div className="text-center">
              <p className="mw-fs-14 mw-text-muted mb-0">{t('auth.confirmEmailWorking')}</p>
            </div>
          ) : state === 'done' ? (
            <div className="text-center">
              <span className="mw-empty__icon mx-auto" aria-hidden="true">
                <i className="bi bi-check-lg" />
              </span>
              <h1 className="mw-fs-24 mw-fw-700 mb-2">{t('auth.confirmEmailDoneTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">
                {t('auth.confirmEmailDoneSub')}
                {email ? <strong className="d-block mt-1">{email}</strong> : null}
              </p>
              <button type="button" className="btn btn-primary btn-lg" onClick={goToSignIn}>
                {t('auth.signIn')}
              </button>
            </div>
          ) : (
            <>
              <h1 className="mw-fs-24 mw-fw-700 mb-2">{t('auth.confirmEmailErrorTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">{error || t('auth.confirmEmailErrorSub')}</p>
              <button type="button" className="btn btn-primary" onClick={goToSignIn}>
                {t('auth.backToSignIn')}
              </button>
            </>
          )}
        </div>

        <p className="mw-auth__foot">
          {appConfig.company} · <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a>
          {appConfig.website ? (
            <>
              {' · '}
              <a href={appConfig.website} target="_blank" rel="noreferrer">
                {appConfig.website.replace(/^https?:\/\//, '')}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

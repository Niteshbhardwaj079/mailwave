import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { appConfig } from '../config/appConfig';
import { useT } from '../i18n/I18nProvider';
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../store/AuthProvider';
import { Note } from '../components/ui/Controls';
import { ThemeToggle } from '../components/layout/ThemeControls';
import LanguagePicker from '../components/layout/LanguagePicker';

export default function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn, signIn } = useAuth();

  const [view, setView] = useState('signin'); // signin | forgot | sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  // Already signed in? Go straight back to where they were headed.
  const redirectTo = location.state?.from?.pathname || '/';
  if (isSignedIn) return <Navigate to={redirectTo} replace />;

  function handleEmail(event) {
    setEmail(event.target.value);
    setError('');
  }

  function handlePassword(event) {
    setPassword(event.target.value);
    setError('');
  }

  function toggleShowPassword() {
    setShowPassword((current) => !current);
  }

  function handleSignIn(event) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError(t('auth.errEmpty'));
      return;
    }

    if (!signIn(email, password)) {
      setError(t('auth.errWrong'));
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  function openForgot() {
    setResetEmail(email);
    setError('');
    setView('forgot');
  }

  function backToSignIn() {
    setError('');
    setView('signin');
  }

  function handleResetEmail(event) {
    setResetEmail(event.target.value);
    setError('');
  }

  function handleForgot(event) {
    event.preventDefault();
    if (!resetEmail.trim()) {
      setError(t('auth.errEmpty'));
      return;
    }
    setView('sent');
  }

  return (
    <div className="mw-auth">
      <div className="mw-auth__panel">
        <div className="mw-auth__topbar">
          <ThemeToggle />
          <LanguagePicker />
        </div>

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

          {view === 'signin' ? (
            <>
              <h1 className="mw-fs-28 mw-fw-700 mb-2">{t('auth.signInTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">{t('auth.signInSub')}</p>

              {error ? (
                <div className="mw-note mw-note--warning mb-3" role="alert">
                  <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                  <div>{error}</div>
                </div>
              ) : null}

              <form onSubmit={handleSignIn} noValidate>
                <div className="mb-3">
                  <label className="form-label" htmlFor="login-email">
                    {t('auth.email')}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    className="form-control form-control-lg"
                    value={email}
                    onChange={handleEmail}
                    autoComplete="username"
                    placeholder="you@yourcompany.com"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="login-password">
                    {t('auth.password')}
                  </label>
                  <div className="input-group input-group-lg">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      value={password}
                      onChange={handlePassword}
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={toggleShowPassword}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                </div>

                <div className="mw-row mw-row--between mb-4">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="login-remember" defaultChecked />
                    <label className="form-check-label mw-fs-13" htmlFor="login-remember">
                      {t('auth.keepSignedIn')}
                    </label>
                  </div>
                  <button type="button" className="mw-linkbtn" onClick={openForgot}>
                    {t('auth.forgot')}
                  </button>
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100 mb-4">
                  {t('auth.signIn')}
                </button>
              </form>

              <Note tone="info" icon="bi-shield-lock">
                {t('auth.noSignupNote')}
              </Note>

              <p className="mw-fs-12 mw-text-muted-2 text-center mt-4 mb-0">
                {t('auth.demoHint')} <span className="mw-mono">{DEMO_EMAIL}</span> /{' '}
                <span className="mw-mono">{DEMO_PASSWORD}</span>
              </p>
            </>
          ) : null}

          {view === 'forgot' ? (
            <>
              <button type="button" className="mw-linkbtn mb-3" onClick={backToSignIn}>
                <i className="bi bi-arrow-left me-2" />
                {t('auth.backToSignIn')}
              </button>

              <h1 className="mw-fs-28 mw-fw-700 mb-2">{t('auth.forgotTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">{t('auth.forgotSub')}</p>

              {error ? (
                <div className="mw-note mw-note--warning mb-3" role="alert">
                  <i className="bi bi-exclamation-triangle mw-note__icon" aria-hidden="true" />
                  <div>{error}</div>
                </div>
              ) : null}

              <form onSubmit={handleForgot} noValidate>
                <div className="mb-4">
                  <label className="form-label" htmlFor="reset-email">
                    {t('auth.email')}
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    className="form-control form-control-lg"
                    value={resetEmail}
                    onChange={handleResetEmail}
                    placeholder="you@yourcompany.com"
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100">
                  {t('auth.sendResetLink')}
                </button>
              </form>
            </>
          ) : null}

          {view === 'sent' ? (
            <div className="text-center">
              <span className="mw-empty__icon mx-auto" aria-hidden="true">
                <i className="bi bi-envelope-check" />
              </span>
              <h1 className="mw-fs-24 mw-fw-700 mb-2">{t('auth.sentTitle')}</h1>
              <p className="mw-fs-14 mw-text-muted mb-4">
                {t('auth.sentSub')} <strong>{resetEmail}</strong>
              </p>
              <Note tone="info" icon="bi-clock">
                {t('auth.sentNote')}
              </Note>
              <button type="button" className="btn btn-outline-secondary mt-4" onClick={backToSignIn}>
                {t('auth.backToSignIn')}
              </button>
            </div>
          ) : null}
        </div>

        <p className="mw-auth__foot">
          {appConfig.company} · <a href={`mailto:${appConfig.supportEmail}`}>{appConfig.supportEmail}</a>
        </p>
      </div>

      <aside className="mw-auth__aside">
        <h2 className="mw-auth__headline">{t('auth.asideTitle')}</h2>
        <p className="mw-auth__lede">{t('auth.asideText')}</p>
        <ul className="mw-auth__points">
          {['auth.point1', 'auth.point2', 'auth.point3', 'auth.point4'].map((key) => (
            <li key={key} className="mw-auth__point">
              <i className="bi bi-check-circle-fill" aria-hidden="true" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

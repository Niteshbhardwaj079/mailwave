import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import HelpButton from '../components/ui/HelpButton';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { appConfig } from '../config/appConfig';
import { THEME_MODES } from '../config/themeColors';
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import { useAuth } from '../store/AuthProvider';
import { useApi } from '../api/useApi';
import { ApiError, api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { formatNumber } from '../utils/format';

const SECTIONS = [
  { key: 'profile', labelKey: 'topbar.profile', icon: 'bi-person' },
  { key: 'appearance', labelKey: 'set.appearance', icon: 'bi-palette' },
  { key: 'language', labelKey: 'set.language', icon: 'bi-translate' },
  { key: 'accounts', labelKey: 'nav.accounts', icon: 'bi-envelope-at' },
  { key: 'sending', labelKey: 'set.sending', icon: 'bi-send' },
  { key: 'tracking', labelKey: 'set.tracking', icon: 'bi-eye' },
  { key: 'contacts', labelKey: 'nav.contacts', icon: 'bi-people' },
  { key: 'unsubscribe', labelKey: 'set.unsubscribe', icon: 'bi-box-arrow-right' },
  { key: 'security', labelKey: 'topbar.security', icon: 'bi-shield-lock' },
  { key: 'api', labelKey: 'set.api', icon: 'bi-code-slash' },
];

function SwitchRow({ id, title, desc, checked, onChange, disabled }) {
  return (
    <div className="mw-switchrow">
      <div className="mw-switchrow__body">
        <div className="mw-switchrow__title">{title}</div>
        <p className="mw-switchrow__desc mb-0">{desc}</p>
      </div>
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <label className="form-check-label visually-hidden" htmlFor={id}>
          {title}
        </label>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, language, languages, setLanguage } = useI18n();
  const { mode, setMode, accent, setAccent, accents } = useTheme();
  const toast = useToast();
  const [section, setSection] = useState('profile');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Jo abhi sign in hai uski apni detail — profile isi ko badalti hai.
  const { user, reloadSession } = useAuth();

  // --- profile ---------------------------------------------------------------
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDepartment, setProfileDepartment] = useState(user?.department ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // user context load hone ke baad (ya kisi aur tab me badalne ke baad) box
  // usi se bhar jaaye.
  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileDepartment(user?.department ?? '');
  }, [user?.name, user?.department]);

  async function saveProfile() {
    if (!profileName.trim()) {
      setProfileError(t('set.nameNeeded'));
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      await api.put('/api/auth/me', { name: profileName.trim(), department: profileDepartment.trim() });
      await reloadSession();
      toast.success(t('set.profileSaved'));
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setProfileSaving(false);
    }
  }

  // --- security / password ----------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securityDone, setSecurityDone] = useState('');

  async function changePassword() {
    setSecurityError('');
    setSecurityDone('');
    if (!currentPassword) {
      setSecurityError(t('set.needCurrentPassword'));
      return;
    }
    if (newPassword.length < 8) {
      setSecurityError(t('auth.errShort'));
      return;
    }

    setSecuritySaving(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setSecurityDone(t('set.passwordChanged'));
      toast.success(t('set.passwordChanged'));
    } catch (error) {
      setSecurityError(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSecuritySaving(false);
    }
  }

  // --- workspace settings (sending/tracking/contacts/unsubscribe) ------------
  //
  // Chaaron ek hi table se aate hain (settings, key se). Load ek hi baar hoti
  // hai; har card apna khud ka draft rakhta hai taaki ek card badalne se
  // doosre ka "unsaved" nishaan na lag jaye.
  const settingsCall = useApi('/api/settings');
  const serverSettings = settingsCall.data?.settings ?? {};

  const [sendingDraft, setSendingDraft] = useState(null);
  const [trackingDraft, setTrackingDraft] = useState(null);
  const [contactsDraft, setContactsDraft] = useState(null);
  const [unsubDraft, setUnsubDraft] = useState(null);
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => {
    if (serverSettings.sending && !sendingDraft) setSendingDraft(serverSettings.sending);
    if (serverSettings.tracking && !trackingDraft) setTrackingDraft(serverSettings.tracking);
    if (serverSettings.contacts && !contactsDraft) setContactsDraft(serverSettings.contacts);
    if (serverSettings.unsubscribe && !unsubDraft) setUnsubDraft(serverSettings.unsubscribe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSettings]);

  async function saveWorkspaceSetting(key, value) {
    setSavingKey(key);
    try {
      await api.put(`/api/settings/${key}`, value);
      toast.success(t('toast.settingsSaved'));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('toast.networkError'));
    } finally {
      setSavingKey('');
    }
  }

  function handleSection(event) {
    setSection(event.currentTarget.dataset.key);
  }

  function handleLanguage(event) {
    setLanguage(event.currentTarget.dataset.code);
  }

  function handleMode(event) {
    setMode(event.currentTarget.dataset.mode);
  }

  function handleAccent(event) {
    setAccent(event.currentTarget.dataset.accent);
  }

  return (
    <div className="mw-stack">
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} helpTopic="settings" />

      <div className="mw-grid-side-main">
        <Card flush>
          <nav className="mw-settingsnav" aria-label={t('set.sections')}>
            {SECTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                data-key={item.key}
                onClick={handleSection}
                className={`mw-settingsnav__item ${section === item.key ? 'is-active' : ''}`.trim()}
              >
                <i className={`bi ${item.icon}`} aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            ))}
          </nav>
        </Card>

        <div className="mw-stack--sm d-flex flex-column">
          {section === 'profile' ? (
            <Card>
              <CardHead title={t('set.profileTitle')} subtitle={t('set.profileSub', { app: appConfig.name })} />
              <CardBody>
                {profileError ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {profileError}
                  </Note>
                ) : null}

                <div className="mw-row mb-4">
                  <span className="mw-avatar mw-avatar--lg">{user?.initials ?? ''}</span>
                  <div>
                    <div className="mw-fs-16 mw-fw-700">{user?.name ?? ''}</div>
                    <div className="mw-fs-13 mw-text-muted">{user?.email ?? ''}</div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-name">{t('set.fullName')}</label>
                    <input
                      id="p-name"
                      type="text"
                      className="form-control"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-email">{t('set.loginEmail')}</label>
                    <input id="p-email" type="email" className="form-control" value={user?.email ?? ''} readOnly disabled />
                    <div className="form-text">{t('set.emailChangeNote')}</div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-company">{t('common.company')}</label>
                    <input
                      id="p-company"
                      type="text"
                      className="form-control"
                      value={profileDepartment}
                      onChange={(event) => setProfileDepartment(event.target.value)}
                    />
                  </div>
                </div>
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'appearance' ? (
            <Card>
              <CardHead title={t('theme.title')} subtitle={t('theme.subtitle')} />
              <CardBody>
                <p className="mw-fs-14 mw-fw-700 mb-2">{t('theme.mode')}</p>
                <div className="mw-optiongrid mb-4">
                  {THEME_MODES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      data-mode={item.key}
                      onClick={handleMode}
                      className={`mw-option ${mode === item.key ? 'is-selected' : ''}`.trim()}
                    >
                      <span className="mw-option__icon" aria-hidden="true">
                        <i className={`bi ${item.icon}`} />
                      </span>
                      <span>
                        <span className="d-block mw-option__title">{t(item.labelKey)}</span>
                      </span>
                      {mode === item.key ? (
                        <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <p className="mw-fs-14 mw-fw-700 mb-2">{t('theme.colour')}</p>
                <div className="mw-accentgrid mw-accentgrid--lg mb-3">
                  {accents.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      data-accent={item.key}
                      onClick={handleAccent}
                      className={`mw-accentdot mw-accentdot--${item.key} ${accent === item.key ? 'is-active' : ''}`.trim()}
                      aria-label={t(item.labelKey)}
                      title={t(item.labelKey)}
                    >
                      {accent === item.key ? <i className="bi bi-check-lg" /> : null}
                    </button>
                  ))}
                </div>
                <p className="form-text mb-4">{t('theme.help')}</p>

                <hr className="my-4" />

                <p className="mw-fs-14 mw-fw-700 mb-2">{t('set.brand')}</p>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('common.name')}</span>
                  <span className="mw-kv__value">{appConfig.name}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('app.tagline')}</span>
                  <span className="mw-kv__value">{appConfig.tagline}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('common.company')}</span>
                  <span className="mw-kv__value">{appConfig.company}</span>
                </div>
                {/* Support email, website aur pata bhi yahin dikhate hain, taki
                    ek nazar me pata chale ki client ko kya dikh raha hai.
                    Teeno brand.config.js se aate hain. */}
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.supportEmail')}</span>
                  <span className="mw-kv__value">{appConfig.supportEmail || '—'}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.website')}</span>
                  <span className="mw-kv__value">{appConfig.website || '—'}</span>
                </div>
                <div className="mw-kv">
                  <span className="mw-kv__key">{t('set.address')}</span>
                  <span className="mw-kv__value">{appConfig.address || '—'}</span>
                </div>

                {!appConfig.address ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {t('set.addressMissing')}
                  </Note>
                ) : null}

                <Note tone="info" icon="bi-file-earmark-code">
                  {t('theme.brandNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'language' ? (
            <Card>
              <CardHead title={t('set.language')} subtitle={t('set.languageHelp')} />
              <CardBody>
                <div className="mw-optiongrid">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      data-code={item.code}
                      onClick={handleLanguage}
                      className={`mw-option ${item.code === language.code ? 'is-selected' : ''}`.trim()}
                    >
                      <span className="mw-option__icon" aria-hidden="true">
                        {item.flag}
                      </span>
                      <span>
                        <span className="d-block mw-option__title">{item.native}</span>
                        <span className="d-block mw-option__desc">
                          {item.english} · {item.code.toUpperCase()}
                          {item.dir === 'rtl' ? ' · RTL' : ''}
                        </span>
                      </span>
                      {item.code === language.code ? (
                        <i className="bi bi-check-circle-fill mw-option__check" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <Note tone="info" icon="bi-translate">
                  {t('set.addLanguageNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'accounts' ? (
            <Card>
              <CardHead title={t('acc.title')} subtitle={t('acc.subtitle')} />
              <CardBody>
                <p className="mw-fs-14 mw-text-muted">{t('set.accountsNote')}</p>
                <Link to="/accounts" className="btn btn-primary">
                  <i className="bi bi-envelope-at me-2" />
                  {t('set.openAccounts')}
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {section === 'sending' ? (
            <Card>
              <CardHead title={t('set.sendingTitle')} subtitle={t('set.sendingSub')} />
              <CardBody>
                {!sendingDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-batch">{t('set.defaultBatch')}</label>
                        <select
                          id="s-batch"
                          className="form-select"
                          value={sendingDraft.defaultBatchSize}
                          onChange={(event) =>
                            setSendingDraft((current) => ({ ...current, defaultBatchSize: Number(event.target.value) }))
                          }
                        >
                          <option value="0">{t('send.batchAll')}</option>
                          <option value="100">{t('send.batchPer', { size: formatNumber(100) })}</option>
                          <option value="200">{t('send.batchPer', { size: formatNumber(200) })}</option>
                          <option value="500">{t('send.batchPer', { size: formatNumber(500) })}</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="s-delay">{t('set.minutesBetween')}</label>
                        <input
                          id="s-delay"
                          type="number"
                          className="form-control"
                          value={sendingDraft.batchDelayMinutes}
                          min={0}
                          max={1440}
                          onChange={(event) =>
                            setSendingDraft((current) => ({ ...current, batchDelayMinutes: Number(event.target.value) || 0 }))
                          }
                        />
                      </div>
                    </div>

                    <SwitchRow
                      id="s-retry"
                      title={t('set.retryTitle')}
                      desc={t('set.retryDesc')}
                      checked={sendingDraft.retryOnce}
                      onChange={(event) => setSendingDraft((current) => ({ ...current, retryOnce: event.target.checked }))}
                    />
                    <SwitchRow
                      id="s-quiet"
                      title={t('set.quietTitle')}
                      desc={t('set.quietDesc')}
                      checked={sendingDraft.quietHours}
                      onChange={(event) => setSendingDraft((current) => ({ ...current, quietHours: event.target.checked }))}
                    />

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.sendingNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('sending', sendingDraft)}
                  disabled={!sendingDraft || savingKey === 'sending'}
                >
                  {savingKey === 'sending' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'tracking' ? (
            <Card>
              <CardHead title={t('set.trackingTitle')} subtitle={t('set.trackingSub')} />
              <CardBody>
                {!trackingDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="t-open"
                      title={t('set.openDefaultTitle')}
                      desc={t('set.openDefaultDesc')}
                      checked={trackingDraft.openByDefault}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, openByDefault: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-click"
                      title={t('set.clickDefaultTitle')}
                      desc={t('set.clickDefaultDesc')}
                      checked={trackingDraft.clickByDefault}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, clickByDefault: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-device"
                      title={t('set.deviceTitle')}
                      desc={t('set.deviceDesc')}
                      checked={trackingDraft.recordDevice}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, recordDevice: event.target.checked }))}
                    />
                    <SwitchRow
                      id="t-location"
                      title={t('set.locationTitle')}
                      desc={t('set.locationDesc')}
                      checked={trackingDraft.recordLocation}
                      onChange={(event) => setTrackingDraft((current) => ({ ...current, recordLocation: event.target.checked }))}
                    />

                    <Note tone="warning" icon="bi-exclamation-circle">
                      {t('set.openEstimateNote')}
                    </Note>
                    <Note tone="info" icon="bi-info-circle">
                      {t('set.trackingNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('tracking', trackingDraft)}
                  disabled={!trackingDraft || savingKey === 'tracking'}
                >
                  {savingKey === 'tracking' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'contacts' ? (
            <Card>
              <CardHead title={t('set.contactsTitle')} subtitle={t('set.contactsSub')} />
              <CardBody>
                {!contactsDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <SwitchRow
                      id="c-dedupe"
                      title={t('set.dedupeTitle')}
                      desc={t('set.dedupeDesc')}
                      checked={contactsDraft.dedupeOnImport}
                      onChange={(event) => setContactsDraft((current) => ({ ...current, dedupeOnImport: event.target.checked }))}
                    />
                    <SwitchRow
                      id="c-consent"
                      title={t('set.consentTitle')}
                      desc={t('set.consentDesc')}
                      checked={contactsDraft.requireConsent}
                      onChange={(event) => setContactsDraft((current) => ({ ...current, requireConsent: event.target.checked }))}
                    />
                    <div className="mt-4">
                      <label className="form-label" htmlFor="c-fields">{t('set.customFields')}</label>
                      <input
                        id="c-fields"
                        type="text"
                        className="form-control"
                        value={contactsDraft.customFields.join(', ')}
                        onChange={(event) =>
                          setContactsDraft((current) => ({
                            ...current,
                            customFields: event.target.value.split(',').map((f) => f.trim()).filter(Boolean),
                          }))
                        }
                      />
                      <div className="form-text">{t('set.customFieldsHelp')}</div>
                    </div>

                    <Note tone="info" icon="bi-info-circle">
                      {t('set.contactsNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('contacts', contactsDraft)}
                  disabled={!contactsDraft || savingKey === 'contacts'}
                >
                  {savingKey === 'contacts' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'unsubscribe' ? (
            <Card>
              <CardHead title={t('set.unsubTitle')} subtitle={t('set.unsubSub')} />
              <CardBody>
                {!unsubDraft ? (
                  <div className="p-3 text-center mw-text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="u-text">{t('set.unsubLinkText')}</label>
                      <input
                        id="u-text"
                        type="text"
                        className="form-control"
                        value={unsubDraft.linkText}
                        onChange={(event) => setUnsubDraft((current) => ({ ...current, linkText: event.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="u-page">{t('set.unsubMessage')}</label>
                      <textarea
                        id="u-page"
                        className="form-control"
                        rows={3}
                        value={unsubDraft.confirmation}
                        onChange={(event) => setUnsubDraft((current) => ({ ...current, confirmation: event.target.value }))}
                      />
                    </div>
                    <SwitchRow
                      id="u-onelick"
                      title={t('set.oneClickTitle')}
                      desc={t('set.oneClickDesc')}
                      checked={unsubDraft.oneClickHeader}
                      onChange={(event) => setUnsubDraft((current) => ({ ...current, oneClickHeader: event.target.checked }))}
                    />
                    <Note tone="success" icon="bi-shield-check">
                      {t('set.unsubNote')}
                    </Note>
                  </>
                )}
              </CardBody>
              <CardFoot>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => saveWorkspaceSetting('unsubscribe', unsubDraft)}
                  disabled={!unsubDraft || savingKey === 'unsubscribe'}
                >
                  {savingKey === 'unsubscribe' ? t('common.loading') : t('common.saveChanges')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'security' ? (
            <Card>
              <CardHead title={t('topbar.security')} subtitle={t('set.securitySub')} />
              <CardBody>
                {securityError ? (
                  <Note tone="warning" icon="bi-exclamation-triangle">
                    {securityError}
                  </Note>
                ) : null}
                {securityDone ? (
                  <Note tone="success" icon="bi-check-circle">
                    {securityDone}
                  </Note>
                ) : null}

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-current">{t('set.currentPassword')}</label>
                    <div className="input-group">
                      <input
                        id="sec-current"
                        type={showCurrentPass ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowCurrentPass((current) => !current)}
                        aria-label={showCurrentPass ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        <i className={`bi ${showCurrentPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-new">{t('auth.newPassword')}</label>
                    <div className="input-group">
                      <input
                        id="sec-new"
                        type={showNewPass ? 'text' : 'password'}
                        className="form-control"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowNewPass((current) => !current)}
                        aria-label={showNewPass ? t('auth.hidePassword') : t('auth.showPassword')}
                      >
                        <i className={`bi ${showNewPass ? 'bi-eye-slash' : 'bi-eye'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <Note tone="info" icon="bi-shield-lock">
                  {t('set.passwordChangeNote')}
                </Note>

                <hr className="my-4" />

                {/* Yeh switch nahi hai — audit log kabhi band nahi hoti, isliye
                    ek jhoothi toggle dikhane ki bajaye seedha bata dete hain
                    ki yeh pehle se chalu hai aur kahan dekhi ja sakti hai. */}
                <div className="mw-switchrow">
                  <div className="mw-switchrow__body">
                    <div className="mw-switchrow__title">{t('set.auditTitle')}</div>
                    <p className="mw-switchrow__desc mb-0">{t('set.auditDesc')}</p>
                  </div>
                  <Link to="/activity" className="btn btn-sm btn-outline-secondary">
                    {t('set.viewAuditLog')}
                  </Link>
                </div>
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-primary" onClick={changePassword} disabled={securitySaving}>
                  {securitySaving ? t('common.loading') : t('set.changePassword')}
                </button>
              </CardFoot>
            </Card>
          ) : null}

          {section === 'api' ? (
            <Card>
              <CardHead
                title={
                  <span className="mw-row">
                    {t('set.apiTitle')}
                    <HelpButton topic="settingsApi" />
                  </span>
                }
                subtitle={t('set.apiSub')}
              />
              <CardBody>
                <Note tone="info" icon="bi-info-circle">
                  {t('set.apiNotAvailable')}
                </Note>
                <p className="mw-fs-13 mw-text-muted mt-3 mb-0">{t('set.apiNotAvailableText')}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

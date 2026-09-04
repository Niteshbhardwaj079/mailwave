import { useState } from 'react';
import { Link } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { appConfig } from '../config/appConfig';
import { THEME_MODES } from '../config/themeColors';
import { Card, CardBody, CardFoot, CardHead } from '../components/ui/Card';
import { Note } from '../components/ui/Controls';
import { useAuth } from '../store/AuthProvider';
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

function SwitchRow({ id, title, desc, defaultChecked }) {
  return (
    <div className="mw-switchrow">
      <div className="mw-switchrow__body">
        <div className="mw-switchrow__title">{title}</div>
        <p className="mw-switchrow__desc mb-0">{desc}</p>
      </div>
      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" role="switch" id={id} defaultChecked={defaultChecked} />
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
  const [section, setSection] = useState('profile');

  // Jo abhi sign in hai uski apni detail. Pehle yahan ek nakli user ki detail
  // dikhti thi — chahe koi bhi sign in ho.
  const { user } = useAuth();
  const currentUser = {
    name: user?.name ?? '',
    email: user?.email ?? '',
    initials: user?.initials ?? '',
    company: user?.department ?? '',
  };

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
                <div className="mw-row mb-4">
                  <span className="mw-avatar mw-avatar--lg">{currentUser.initials}</span>
                  <div>
                    <div className="mw-fs-16 mw-fw-700">{currentUser.name}</div>
                    <div className="mw-fs-13 mw-text-muted">{currentUser.email}</div>
                    <button type="button" className="btn btn-sm btn-outline-secondary mt-2">
                      {t('set.changePhoto')}
                    </button>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-name">{t('set.fullName')}</label>
                    <input id="p-name" type="text" className="form-control" defaultValue={currentUser.name} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-email">{t('set.loginEmail')}</label>
                    <input id="p-email" type="email" className="form-control" defaultValue={currentUser.email} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-company">{t('common.company')}</label>
                    <input id="p-company" type="text" className="form-control" defaultValue={currentUser.company} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="p-timezone">{t('set.timezone')}</label>
                    <select id="p-timezone" className="form-select" defaultValue="Asia/Kolkata">
                      <option>Asia/Kolkata</option>
                      <option>Asia/Dubai</option>
                      <option>Europe/London</option>
                      <option>America/New_York</option>
                    </select>
                  </div>
                </div>
              </CardBody>
              <CardFoot>
                <button type="button" className="btn btn-primary">{t('common.saveChanges')}</button>
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
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="s-batch">{t('set.defaultBatch')}</label>
                    <select id="s-batch" className="form-select" defaultValue="100">
                      <option value="0">{t('send.batchAll')}</option>
                      <option value="100">{t('send.batchPer', { size: formatNumber(100) })}</option>
                      <option value="200">{t('send.batchPer', { size: formatNumber(200) })}</option>
                      <option value="500">{t('send.batchPer', { size: formatNumber(500) })}</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="s-delay">{t('set.minutesBetween')}</label>
                    <input id="s-delay" type="number" className="form-control" defaultValue={2} min={0} max={60} />
                  </div>
                </div>

                <SwitchRow
                  id="s-retry"
                  title={t('set.retryTitle')}
                  desc={t('set.retryDesc')}
                  defaultChecked
                />
                <SwitchRow
                  id="s-quiet"
                  title={t('set.quietTitle')}
                  desc={t('set.quietDesc')}
                  defaultChecked={false}
                />
              </CardBody>
            </Card>
          ) : null}

          {section === 'tracking' ? (
            <Card>
              <CardHead title={t('set.trackingTitle')} subtitle={t('set.trackingSub')} />
              <CardBody>
                <SwitchRow
                  id="t-open"
                  title={t('set.openDefaultTitle')}
                  desc={t('set.openDefaultDesc')}
                  defaultChecked
                />
                <SwitchRow
                  id="t-click"
                  title={t('set.clickDefaultTitle')}
                  desc={t('set.clickDefaultDesc')}
                  defaultChecked={false}
                />
                <SwitchRow
                  id="t-device"
                  title={t('set.deviceTitle')}
                  desc={t('set.deviceDesc')}
                  defaultChecked
                />
                <SwitchRow
                  id="t-location"
                  title={t('set.locationTitle')}
                  desc={t('set.locationDesc')}
                  defaultChecked={false}
                />

                <Note tone="warning" icon="bi-exclamation-circle">
                  {t('set.openEstimateNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'contacts' ? (
            <Card>
              <CardHead title={t('set.contactsTitle')} subtitle={t('set.contactsSub')} />
              <CardBody>
                <SwitchRow
                  id="c-dedupe"
                  title={t('set.dedupeTitle')}
                  desc={t('set.dedupeDesc')}
                  defaultChecked
                />
                <SwitchRow
                  id="c-consent"
                  title={t('set.consentTitle')}
                  desc={t('set.consentDesc')}
                  defaultChecked
                />
                <div className="mt-4">
                  <label className="form-label" htmlFor="c-fields">{t('set.customFields')}</label>
                  <input id="c-fields" type="text" className="form-control" defaultValue="city, area, plan" />
                  <div className="form-text">{t('set.customFieldsHelp')}</div>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {section === 'unsubscribe' ? (
            <Card>
              <CardHead title={t('set.unsubTitle')} subtitle={t('set.unsubSub')} />
              <CardBody>
                <div className="mb-3">
                  <label className="form-label" htmlFor="u-text">{t('set.unsubLinkText')}</label>
                  <input id="u-text" type="text" className="form-control" defaultValue="Unsubscribe from these emails" />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="u-page">{t('set.unsubMessage')}</label>
                  <textarea
                    id="u-page"
                    className="form-control"
                    rows={3}
                    defaultValue="You have been removed from our mailing list. Sorry to see you go!"
                  />
                </div>
                <SwitchRow
                  id="u-onelick"
                  title={t('set.oneClickTitle')}
                  desc={t('set.oneClickDesc')}
                  defaultChecked
                />
                <Note tone="success" icon="bi-shield-check">
                  {t('set.unsubNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}

          {section === 'security' ? (
            <Card>
              <CardHead title={t('topbar.security')} subtitle={t('set.securitySub')} />
              <CardBody>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-current">{t('set.currentPassword')}</label>
                    <input id="sec-current" type="password" className="form-control" placeholder="••••••••" />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label" htmlFor="sec-new">{t('auth.newPassword')}</label>
                    <input id="sec-new" type="password" className="form-control" placeholder="••••••••" />
                  </div>
                </div>

                <SwitchRow
                  id="sec-2fa"
                  title={t('set.twoStepTitle')}
                  desc={t('set.twoStepDesc')}
                  defaultChecked
                />
                <SwitchRow
                  id="sec-audit"
                  title={t('set.auditTitle')}
                  desc={t('set.auditDesc')}
                  defaultChecked
                />

                <hr className="my-4" />

                <h3 className="mw-fs-14 mw-fw-700 mw-text-danger mb-2">{t('set.dangerZone')}</h3>
                <p className="mw-fs-13 mw-text-muted">{t('set.dangerText')}</p>
                <button type="button" className="btn btn-outline-danger">
                  {t('set.deleteData')}
                </button>
              </CardBody>
            </Card>
          ) : null}

          {section === 'api' ? (
            <Card>
              <CardHead title={t('set.apiTitle')} subtitle={t('set.apiSub')} />
              <CardBody>
                <label className="form-label" htmlFor="api-key">{t('set.apiKey')}</label>
                <div className="input-group">
                  <input id="api-key" type="password" className="form-control mw-mono" defaultValue="mw_live_8fj2••••••••" readOnly />
                  <button type="button" className="btn btn-outline-secondary">
                    <i className="bi bi-eye" />
                  </button>
                  <button type="button" className="btn btn-outline-secondary">
                    <i className="bi bi-clipboard" />
                  </button>
                </div>
                <div className="form-text mb-4">{t('set.apiKeyHelp')}</div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="api-webhook">{t('set.webhookUrl')}</label>
                  <input id="api-webhook" type="url" className="form-control" placeholder="https://yourapp.com/webhooks/mailwave" />
                  <div className="form-text">{t('set.webhookHelp')}</div>
                </div>

                <Note tone="info" icon="bi-file-code">
                  {t('set.apiDocsNote')}
                </Note>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { SearchInput } from '../ui/Controls';
import LanguagePicker from './LanguagePicker';
import { AccentPicker, ThemeToggle } from './ThemeControls';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { useAuth } from '../../store/AuthProvider';
import { useApi } from '../../api/useApi';
import { roleLabel } from '../../utils/roles';
import { formatRelative } from '../../utils/format';

/** Server ke aankde ko screen ka title/text deta hai — dono ek hi jagah. */
function describeNotification(item, t) {
  if (item.kind === 'sending') {
    return { title: t('notif.sendingTitle'), text: t('notif.sendingText', { name: item.name, done: item.done, total: item.total }) };
  }
  if (item.kind === 'finished') {
    return { title: t('notif.finishedTitle'), text: t('notif.finishedText', { name: item.name, count: item.sent }) };
  }
  return { title: t('notif.accountTitle'), text: t('notif.accountText', { email: item.email, status: item.status }) };
}

export default function Topbar({ title, onOpenMenu }) {
  const t = useT();
  const { roles, viewAs, setViewAs } = useWorkspace();
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [openPanel, setOpenPanel] = useState(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const notificationsCall = useApi('/api/stats/notifications');
  const notifications = notificationsCall.data?.notifications ?? [];

  // Bahar kahin bhi click karte hi khula hua panel band ho jaye — dono
  // dropdown ek hi jagah se sambhalte hain kyunki state ek hi hai.
  useEffect(() => {
    if (!openPanel) return undefined;

    function handlePointerDown(event) {
      const insideNotif = notifRef.current?.contains(event.target);
      const insideProfile = profileRef.current?.contains(event.target);
      if (!insideNotif && !insideProfile) setOpenPanel(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openPanel]);

  // Jo abhi sign in hai wahi. Pehle yahan list ka pehla user dikhta tha —
  // yaani doosre logon ko upar kisi aur ka naam dikhta tha.
  const me = user;
  const currentRoleLabel = roleLabel(roles.find((role) => role.key === viewAs), t);

  function toggleNotifications() {
    setOpenPanel((current) => (current === 'notifications' ? null : 'notifications'));
  }

  function toggleProfile() {
    setOpenPanel((current) => (current === 'profile' ? null : 'profile'));
  }

  function closePanels() {
    setOpenPanel(null);
  }

  // Clearing the session is enough — <RequireAuth> sends the app to /login.
  function handleSignOut() {
    closePanels();
    signOut();
  }

  function handleViewAs(event) {
    setViewAs(event.target.value);
  }

  return (
    <header className="mw-topbar">
      <button type="button" className="mw-iconbtn d-md-none" onClick={onOpenMenu} aria-label={t('topbar.openMenu')}>
        <i className="bi bi-list" />
      </button>

      <h1 className="mw-topbar__title d-md-none">{title}</h1>

      <div className="mw-topbar__search">
        <SearchInput id="global-search" value={query} onChange={setQuery} placeholder={t('topbar.search')} />
      </div>

      <div className="mw-topbar__actions">
        <ThemeToggle />
        <AccentPicker />
        <LanguagePicker />

        <div className="position-relative" ref={notifRef}>
          <button
            type="button"
            className={`mw-iconbtn ${openPanel === 'notifications' ? 'is-active' : ''}`.trim()}
            onClick={toggleNotifications}
            aria-label={t('topbar.notifications')}
            aria-expanded={openPanel === 'notifications'}
          >
            <i className="bi bi-bell" />
            {notifications.length > 0 ? <span className="mw-iconbtn__dot" aria-hidden="true" /> : null}
          </button>

          {openPanel === 'notifications' ? (
            <div className="dropdown-menu dropdown-menu-end show p-0 shadow border-0 mt-2">
              <div className="px-3 py-3 border-bottom">
                <span className="mw-fs-14 mw-fw-700">{t('topbar.notifications')}</span>
              </div>
              {notifications.length === 0 ? (
                <p className="mw-fs-13 mw-text-muted px-3 py-4 mb-0 text-center">{t('topbar.noNotifications')}</p>
              ) : (
                <ul className="list-unstyled m-0 p-0">
                  {notifications.map((item) => {
                    const { title, text } = describeNotification(item, t);
                    return (
                      <li key={item.id} className="px-3 py-3 border-bottom">
                        <div className="mw-row align-items-start">
                          <span className={`mw-kpi__icon mw-kpi__icon--${item.tone}`} aria-hidden="true">
                            <i className={`bi ${item.icon}`} />
                          </span>
                          <span className="flex-grow-1">
                            <span className="d-block mw-fs-13 mw-fw-600 mw-text-ink">{title}</span>
                            <span className="d-block mw-fs-12 mw-text-muted">{text}</span>
                            <span className="d-block mw-fs-11 mw-text-muted-2 mt-1">{formatRelative(item.at, t)}</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="px-3 py-2 text-center">
                <Link to="/activity" className="mw-fs-12 mw-fw-600" onClick={closePanels}>
                  {t('topbar.viewAll')}
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <Link to="/guide" className="mw-iconbtn mw-hide-mobile" aria-label={t('topbar.help')}>
          <i className="bi bi-question-circle" />
        </Link>

        <div className="position-relative" ref={profileRef}>
          <button
            type="button"
            className="mw-profile"
            onClick={toggleProfile}
            aria-label={t('topbar.profile')}
            aria-expanded={openPanel === 'profile'}
          >
            <span className="mw-avatar">{me?.initials}</span>
            <span className="text-start mw-hide-mobile">
              <span className="d-block mw-profile__name">{me?.name}</span>
              <span className="d-block mw-profile__role">{currentRoleLabel}</span>
            </span>
            <i className="bi bi-chevron-down mw-fs-11 mw-text-muted mw-hide-mobile" />
          </button>

          {openPanel === 'profile' ? (
            <div className="dropdown-menu dropdown-menu-end show shadow border-0 mt-2">
              <div className="px-3 py-2 border-bottom mb-2">
                <span className="d-block mw-fs-13 mw-fw-700">{me?.name}</span>
                <span className="d-block mw-fs-12 mw-text-muted">{me?.email}</span>
              </div>

              <div className="px-3 pb-2">
                <label className="form-label mw-fs-11" htmlFor="view-as">
                  {t('topbar.viewAs')}
                </label>
                <select id="view-as" className="form-select form-select-sm" value={viewAs} onChange={handleViewAs}>
                  {roles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {roleLabel(role, t)}
                    </option>
                  ))}
                </select>
              </div>

              <hr className="dropdown-divider" />

              <Link className="dropdown-item" to="/settings" onClick={closePanels}>
                <i className="bi bi-person me-2" /> {t('topbar.profile')}
              </Link>
              <Link className="dropdown-item" to="/accounts" onClick={closePanels}>
                <i className="bi bi-envelope-at me-2" /> {t('nav.accounts')}
              </Link>
              <Link className="dropdown-item" to="/guide" onClick={closePanels}>
                <i className="bi bi-book me-2" /> {t('nav.guide')}
              </Link>
              <hr className="dropdown-divider" />
              <button type="button" className="dropdown-item text-danger" onClick={handleSignOut}>
                <i className="bi bi-box-arrow-right me-2" /> {t('topbar.signOut')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

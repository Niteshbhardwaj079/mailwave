import { useState } from 'react';
import { Link } from 'react-router-dom';

import { notifications } from '../../data/mockData';
import { SearchInput } from '../ui/Controls';
import LanguagePicker from './LanguagePicker';
import { AccentPicker, ThemeToggle } from './ThemeControls';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { useAuth } from '../../store/AuthProvider';
import { roleLabel } from '../../utils/roles';

export default function Topbar({ title, onOpenMenu }) {
  const t = useT();
  const { roles, viewAs, setViewAs, users } = useWorkspace();
  const { signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [openPanel, setOpenPanel] = useState(null);

  const me = users[0];
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

        <div className="position-relative">
          <button
            type="button"
            className={`mw-iconbtn ${openPanel === 'notifications' ? 'is-active' : ''}`.trim()}
            onClick={toggleNotifications}
            aria-label={t('topbar.notifications')}
            aria-expanded={openPanel === 'notifications'}
          >
            <i className="bi bi-bell" />
            <span className="mw-iconbtn__dot" aria-hidden="true" />
          </button>

          {openPanel === 'notifications' ? (
            <div className="dropdown-menu dropdown-menu-end show p-0 shadow border-0 mt-2">
              <div className="px-3 py-3 border-bottom">
                <span className="mw-fs-14 mw-fw-700">{t('topbar.notifications')}</span>
              </div>
              <ul className="list-unstyled m-0 p-0">
                {notifications.map((item) => (
                  <li key={item.id} className="px-3 py-3 border-bottom">
                    <div className="mw-row align-items-start">
                      <span className={`mw-kpi__icon mw-kpi__icon--${item.tone}`} aria-hidden="true">
                        <i className={`bi ${item.icon}`} />
                      </span>
                      <span className="flex-grow-1">
                        <span className="d-block mw-fs-13 mw-fw-600 mw-text-ink">{item.title}</span>
                        <span className="d-block mw-fs-12 mw-text-muted">{item.text}</span>
                        <span className="d-block mw-fs-11 mw-text-muted-2 mt-1">{item.time}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
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

        <div className="position-relative">
          <button
            type="button"
            className="mw-profile"
            onClick={toggleProfile}
            aria-label={t('topbar.profile')}
            aria-expanded={openPanel === 'profile'}
          >
            <span className="mw-avatar">{me.initials}</span>
            <span className="text-start mw-hide-mobile">
              <span className="d-block mw-profile__name">{me.name}</span>
              <span className="d-block mw-profile__role">{currentRoleLabel}</span>
            </span>
            <i className="bi bi-chevron-down mw-fs-11 mw-text-muted mw-hide-mobile" />
          </button>

          {openPanel === 'profile' ? (
            <div className="dropdown-menu dropdown-menu-end show shadow border-0 mt-2">
              <div className="px-3 py-2 border-bottom mb-2">
                <span className="d-block mw-fs-13 mw-fw-700">{me.name}</span>
                <span className="d-block mw-fs-12 mw-text-muted">{me.email}</span>
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

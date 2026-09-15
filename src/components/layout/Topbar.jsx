import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { SearchInput } from '../ui/Controls';
import LanguagePicker from './LanguagePicker';
import { ThemeToggle } from './ThemeControls';
import { useT } from '../../i18n/I18nProvider';
import { useAuth } from '../../store/AuthProvider';
import { useApi } from '../../api/useApi';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { roleLabel } from '../../utils/roles';
import { formatRelative } from '../../utils/format';

const SEARCH_MIN_LENGTH = 2;

/** Ek category ke results, sirf jab kuch mila ho — khaali section kabhi nahi dikhata. */
function SearchGroup({ titleKey, t, items, onPick }) {
  if (items.length === 0) return null;
  return (
    <div className="mw-searchpanel__group">
      <span className="mw-searchpanel__grouptitle">{t(titleKey)}</span>
      {items.map((item) => (
        <Link key={item.id} to={item.link} className="mw-searchpanel__item" onClick={onPick}>
          <span className="d-block mw-searchpanel__itemtitle">{item.title}</span>
          {item.subtitle ? <span className="d-block mw-searchpanel__itemsub">{item.subtitle}</span> : null}
        </Link>
      ))}
    </div>
  );
}

// Notifications DB me kahin persist nahi hotin — server har baar unhi live
// events se dobara banata hai (jo abhi bhej rahi hai, jo 7 din me poori hui,
// jo account "Connected" nahi hai). Isliye "dekh liya" yahin, browser me hi
// yaad rakhte hain — id sirf campaign/account ka nahi, uske `at` (timestamp)
// ke saath jodi hui hai, taaki wahi account/campaign baad me phir se koi naya
// event de (status dobara badle) to woh sach me NAYI notification maani
// jaaye, purani wali ki tarah chup-chap dab na jaaye.
const SEEN_KEY = 'mailwave.notifications.seen';

function stampOf(item) {
  return `${item.id}:${item.at}`;
}

function loadSeenStamps() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (error) {
    return new Set();
  }
}

function saveSeenStamps(set) {
  try {
    // Hamesha ke liye badhte rehne ki jagah, sirf jitni abhi ke liye
    // zaroori hain (500) rakhte hain — kisi bhi asli session ke liye kaafi.
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-500)));
  } catch (error) {
    // Private mode ya blocked storage — bas is baar yaad nahi rahega.
  }
}

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

export default function Topbar({ title, onOpenMenu, sidebarCollapsed, onToggleSidebar }) {
  const t = useT();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const debouncedQuery = useDebouncedValue(query.trim(), 250);
  const searchEnabled = debouncedQuery.length >= SEARCH_MIN_LENGTH;
  const searchCall = useApi(searchEnabled ? `/api/search?q=${encodeURIComponent(debouncedQuery)}` : null, {
    deps: [debouncedQuery],
  });
  const searchResults = searchCall.data;
  const searchOpen =
    searchFocused && query.trim().length >= SEARCH_MIN_LENGTH;
  const hasAnyResults =
    searchResults && (searchResults.campaigns.length > 0 || searchResults.contacts.length > 0 || searchResults.templates.length > 0);
  const firstResultLink = searchResults
    ? (searchResults.campaigns[0] || searchResults.contacts[0] || searchResults.templates[0])?.link
    : null;

  const [openPanel, setOpenPanel] = useState(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const notificationsCall = useApi('/api/stats/notifications');
  const notifications = notificationsCall.data?.notifications ?? [];
  const [seenStamps, setSeenStamps] = useState(loadSeenStamps);
  // Panel khulte hi jo dikh raha tha wahi "frozen" rakhte hain, taaki usi
  // pal seen-mark hone se list khud-ba-khud khaali na dikhne lage — agli
  // baar kholne par sirf naye items hi bachenge.
  const [panelSnapshot, setPanelSnapshot] = useState([]);
  const unreadCount = notifications.filter((item) => !seenStamps.has(stampOf(item))).length;

  // Bahar kahin bhi click karte hi khula hua panel (ya search dropdown) band
  // ho jaye — teeno ek hi jagah se sambhalte hain.
  useEffect(() => {
    if (!openPanel && !searchOpen) return undefined;

    function handlePointerDown(event) {
      const insideNotif = notifRef.current?.contains(event.target);
      const insideProfile = profileRef.current?.contains(event.target);
      const insideSearch = searchRef.current?.contains(event.target);
      if (!insideNotif && !insideProfile) setOpenPanel(null);
      if (!insideSearch) setSearchFocused(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openPanel, searchOpen]);

  function closeSearch() {
    setSearchFocused(false);
  }

  function clearAndCloseSearch() {
    setQuery('');
    setSearchFocused(false);
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      closeSearch();
      event.currentTarget.blur();
    } else if (event.key === 'Enter' && firstResultLink) {
      navigate(firstResultLink);
      clearAndCloseSearch();
    }
  }

  // Jo abhi sign in hai wahi. Pehle yahan list ka pehla user dikhta tha —
  // yaani doosre logon ko upar kisi aur ka naam dikhta tha.
  const me = user;
  const currentRoleLabel = roleLabel(role, t);

  function toggleNotifications() {
    setOpenPanel((current) => {
      if (current === 'notifications') return null;
      setPanelSnapshot(notifications);
      setSeenStamps((prevSeen) => {
        const next = new Set(prevSeen);
        notifications.forEach((item) => next.add(stampOf(item)));
        saveSeenStamps(next);
        return next;
      });
      return 'notifications';
    });
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

  return (
    <header className="mw-topbar">
      <button type="button" className="mw-iconbtn d-md-none" onClick={onOpenMenu} aria-label={t('topbar.openMenu')}>
        <i className="bi bi-list" />
      </button>

      <button
        type="button"
        className="mw-iconbtn mw-hide-mobile"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? t('topbar.openMenu') : t('topbar.closeMenu')}
        aria-expanded={!sidebarCollapsed}
      >
        <i className="bi bi-list" />
      </button>

      <h1 className="mw-topbar__title d-md-none">{title}</h1>

      <div className="mw-topbar__search position-relative" ref={searchRef}>
        <SearchInput
          id="global-search"
          value={query}
          onChange={setQuery}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
          placeholder={t('topbar.search')}
        />

        {searchOpen ? (
          <div className="dropdown-menu show p-0 shadow border-0 mt-2 mw-searchpanel">
            {!searchEnabled ? (
              <p className="mw-fs-13 mw-text-muted px-3 py-3 mb-0">{t('topbar.searchTypeMore')}</p>
            ) : searchCall.loading && !searchResults ? (
              <p className="mw-fs-13 mw-text-muted px-3 py-3 mb-0">
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                {t('common.loading')}
              </p>
            ) : !hasAnyResults ? (
              <p className="mw-fs-13 mw-text-muted px-3 py-3 mb-0">{t('topbar.searchNoResults', { query })}</p>
            ) : (
              <>
                <SearchGroup titleKey="nav.campaigns" t={t} items={searchResults.campaigns} onPick={clearAndCloseSearch} />
                <SearchGroup titleKey="nav.contacts" t={t} items={searchResults.contacts} onPick={clearAndCloseSearch} />
                <SearchGroup titleKey="nav.templates" t={t} items={searchResults.templates} onPick={clearAndCloseSearch} />
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mw-topbar__actions">
        <ThemeToggle />
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
            {unreadCount > 0 ? (
              <span className="mw-iconbtn__badge" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>

          {openPanel === 'notifications' ? (
            <div className="dropdown-menu dropdown-menu-end show p-0 shadow border-0 mt-2 mw-notifpanel">
              <div className="px-3 py-3 border-bottom">
                <span className="mw-fs-14 mw-fw-700">{t('topbar.notifications')}</span>
              </div>
              {panelSnapshot.length === 0 ? (
                <p className="mw-fs-13 mw-text-muted px-3 py-4 mb-0 text-center">{t('topbar.noNotifications')}</p>
              ) : (
                <ul className="list-unstyled m-0 p-0 mw-notifpanel__list">
                  {panelSnapshot.map((item) => {
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

import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { pageTitleKeys, tabBarItems } from './navItems';
import PageLoader from '../ui/PageLoader';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { appConfig } from '../../config/appConfig';

function tabClass({ isActive }) {
  return `mw-tabbar__item ${isActive ? 'is-active' : ''}`.trim();
}

export default function AppLayout() {
  const t = useT();
  const { can } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // The phone tab bar follows the same permissions as the sidebar, otherwise a
  // role would be shown a shortcut to a page it is not allowed to open.
  const tabs = tabBarItems.filter((item) => !item.module || can(item.module, 'view'));
  const canCreateCampaign = can('campaigns', 'create');

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function goToNewCampaign() {
    navigate('/campaigns/new');
  }

  const section = `/${location.pathname.split('/')[1]}`;
  const titleKey = pageTitleKeys[location.pathname] || pageTitleKeys[section];
  const title = titleKey ? t(titleKey) : appConfig.name;

  return (
    <div className="mw-shell">
      <Sidebar open={menuOpen} onClose={closeMenu} />

      {menuOpen ? (
        <button type="button" className="mw-backdrop d-md-none" onClick={closeMenu} aria-label={t('topbar.closeMenu')} />
      ) : null}

      <div className="mw-content">
        <Topbar title={title} onOpenMenu={openMenu} />

        <main className="mw-main">
          <div className="mw-main__inner">
            {/* Its own boundary, so loading a page keeps the shell on screen. */}
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {canCreateCampaign ? (
        <button type="button" className="mw-fab" onClick={goToNewCampaign} aria-label={t('dash.createCampaign')}>
          <i className="bi bi-plus-lg" />
        </button>
      ) : null}

      <nav className="mw-tabbar" aria-label={t('nav.quickNav')}>
        {tabs.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={tabClass}>
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
        <button type="button" className="mw-tabbar__item" onClick={openMenu}>
          <i className="bi bi-three-dots" aria-hidden="true" />
          <span>{t('nav.more')}</span>
        </button>
      </nav>
    </div>
  );
}

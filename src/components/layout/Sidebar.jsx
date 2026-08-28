import { NavLink } from 'react-router-dom';

import { navSections } from './navItems';
import ProgressBar from '../ui/ProgressBar';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { appConfig } from '../../config/appConfig';
import { campaigns, contacts, emailAccounts, segments } from '../../data/mockData';
import { formatCompact } from '../../utils/format';

function linkClass({ isActive }) {
  return `mw-navlink ${isActive ? 'is-active' : ''}`.trim();
}

export default function Sidebar({ open, onClose }) {
  const t = useT();
  const { can, templates, subscribers, users } = useWorkspace();

  // Real counts, taken from the same data the pages show. Nothing is typed in
  // by hand, so a badge can never disagree with the list it points at.
  const counts = {
    campaigns: campaigns.length,
    contacts: contacts.length,
    subscribers: subscribers.length,
    templates: templates.length,
    segments: segments.length,
    accounts: emailAccounts.length,
    users: users.length,
  };

  function countFor(item) {
    if (!item.countKey) return null;
    const value = counts[item.countKey];
    if (value === undefined || value === 0) return null;
    return formatCompact(value);
  }

  // A section disappears completely if the role cannot see anything inside it.
  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.module || can(item.module, 'view')),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className={`mw-sidebar ${open ? 'is-open' : ''}`.trim()} aria-label={t('nav.mainNav')}>
      <div className="mw-sidebar__brand">
        <span className="mw-sidebar__logo" aria-hidden="true">
          <i className={`bi ${appConfig.logoIcon}`} />
        </span>
        <span className="mw-sidebar__text">
          <span className="mw-sidebar__name">{appConfig.name}</span>
          <span className="mw-sidebar__tagline">{appConfig.tagline}</span>
        </span>
        <button type="button" className="mw-iconbtn mw-sidebar__close" onClick={onClose} aria-label={t('topbar.closeMenu')}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <nav className="mw-sidebar__nav">
        {sections.map((section) => (
          <div key={section.titleKey}>
            <p className="mw-sidebar__section">{t(section.titleKey)}</p>
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onClose}>
                <span className="mw-navlink__icon" aria-hidden="true">
                  <i className={`bi ${item.icon}`} />
                </span>
                <span className="mw-navlink__label">{t(item.labelKey)}</span>
                {countFor(item) ? <span className="mw-navlink__count">{countFor(item)}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="mw-sidebar__footer">
        <div className="mw-quota">
          <div className="mw-row mw-row--between">
            <span className="mw-quota__title">{t('topbar.quota')}</span>
            <span className="mw-quota__meta mw-num">2,460 / 8,000</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={30.75} label={t('topbar.quota')} />
          </div>
          <p className="mw-quota__meta mt-2 mb-0">{t('topbar.quotaNote')}</p>
        </div>
      </div>
    </aside>
  );
}

import { NavLink } from 'react-router-dom';

import { navSections } from './navItems';
import ProgressBar from '../ui/ProgressBar';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { appConfig } from '../../config/appConfig';
import { useApi } from '../../api/useApi';
import { formatCompact, formatNumber, percentValue } from '../../utils/format';

function linkClass({ isActive }) {
  return `mw-navlink ${isActive ? 'is-active' : ''}`.trim();
}

export default function Sidebar({ open, onClose }) {
  const t = useT();
  const { can, templates, subscribers, users } = useWorkspace();

  // Saari ginti EK request me. Pehle har number ke liye alag request jaati
  // thi — har page khulne par chaar bekaar call, aur jaldi-jaldi page kholne
  // par server ki rate-limit lag jati thi.
  const countsCall = useApi('/api/stats/counts');
  const fromServer = countsCall.data?.counts ?? {};

  const quotaCall = useApi('/api/stats/quota');
  const sentToday = quotaCall.data?.sentToday ?? 0;
  const dailyLimit = quotaCall.data?.dailyLimit ?? 0;
  const quotaPct = percentValue(sentToday, dailyLimit);

  const counts = {
    campaigns: fromServer.campaigns ?? 0,
    contacts: fromServer.contacts ?? 0,
    // Yeh teen pehle se app ke paas hain, inke liye server ko poochna bekaar
    // hai.
    subscribers: subscribers.length,
    templates: templates.length,
    users: users.length,
    segments: fromServer.segments ?? 0,
    accounts: fromServer.accounts ?? 0,
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
            <span className="mw-quota__meta mw-num">
              {formatNumber(sentToday)} / {dailyLimit > 0 ? formatNumber(dailyLimit) : '—'}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar value={quotaPct} label={t('topbar.quota')} />
          </div>
          <p className="mw-quota__meta mt-2 mb-0">
            {dailyLimit > 0 ? t('topbar.quotaNote') : t('topbar.quotaNoAccount')}
          </p>
        </div>
      </div>
    </aside>
  );
}

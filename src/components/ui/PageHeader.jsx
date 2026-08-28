import { Link } from 'react-router-dom';

import HelpButton from './HelpButton';
import { useT } from '../../i18n/I18nProvider';

export default function PageHeader({ title, subtitle, breadcrumb, actions, helpTopic }) {
  const t = useT();

  return (
    <header className="mw-pagehead">
      <div className="mw-pagehead__text">
        {breadcrumb ? (
          <nav className="mw-breadcrumb" aria-label={t('common.breadcrumb')}>
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.label} className="mw-row">
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                {index < breadcrumb.length - 1 ? <i className="bi bi-chevron-right mw-fs-11" /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="mw-row">
          <h1 className="mw-pagehead__title mb-0">{title}</h1>
          {helpTopic ? <HelpButton topic={helpTopic} /> : null}
        </div>
        {subtitle ? <p className="mw-pagehead__sub mt-1">{subtitle}</p> : null}
      </div>
      {actions ? <div className="mw-pagehead__actions">{actions}</div> : null}
    </header>
  );
}

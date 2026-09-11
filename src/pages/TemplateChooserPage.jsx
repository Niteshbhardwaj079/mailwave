import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { useApi } from '../api/useApi';

const OPTIONS = [
  { key: 'custom', source: 'custom', icon: 'bi-code-square', to: '/templates/new/custom', titleKey: 'tpl.chooser.customTitle', descKey: 'tpl.chooser.customDesc' },
  { key: 'upload', source: 'html_upload', icon: 'bi-file-earmark-arrow-up', to: '/templates/new/upload', titleKey: 'tpl.chooser.uploadTitle', descKey: 'tpl.chooser.uploadDesc' },
  { key: 'builder', source: 'builder', icon: 'bi-columns-gap', to: '/templates/new/builder', titleKey: 'tpl.chooser.builderTitle', descKey: 'tpl.chooser.builderDesc' },
];

/** Naya template banate waqt 3 tareeke choose karne ka pehla step. Settings me disabled kiya gaya tareeka yahan dikhta hi nahi. */
export default function TemplateChooserPage() {
  const t = useT();
  const navigate = useNavigate();
  const settingsCall = useApi('/api/settings');
  const templateSources = settingsCall.data?.settings?.templateSources;
  const visibleOptions = OPTIONS.filter((option) => templateSources?.[option.source] !== false);

  function handleChoose(event) {
    const option = OPTIONS.find((item) => item.key === event.currentTarget.dataset.key);
    if (option) navigate(option.to);
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('tpl.chooser.title')}
        subtitle={t('tpl.chooser.subtitle')}
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: t('tpl.chooser.title') }]}
        actions={
          <Link to="/templates" className="btn btn-outline-secondary mw-btn-block-mobile">
            <i className="bi bi-arrow-left me-2" />
            {t('common.back')}
          </Link>
        }
      />

      <div className="mw-optiongrid">
        {visibleOptions.map((option) => (
          <button key={option.key} type="button" data-key={option.key} onClick={handleChoose} className="mw-option">
            <span className="mw-option__icon" aria-hidden="true">
              <i className={`bi ${option.icon}`} />
            </span>
            <span>
              <span className="d-block mw-option__title">{t(option.titleKey)}</span>
              <span className="d-block mw-option__desc">{t(option.descKey)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

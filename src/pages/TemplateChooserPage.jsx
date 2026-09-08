import { useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useT } from '../i18n/I18nProvider';

const OPTIONS = [
  { key: 'custom', icon: 'bi-code-square', to: '/templates/new/custom', titleKey: 'tpl.chooser.customTitle', descKey: 'tpl.chooser.customDesc' },
  { key: 'upload', icon: 'bi-file-earmark-arrow-up', to: '/templates/new/upload', titleKey: 'tpl.chooser.uploadTitle', descKey: 'tpl.chooser.uploadDesc' },
  { key: 'builder', icon: 'bi-columns-gap', to: '/templates/new/builder', titleKey: 'tpl.chooser.builderTitle', descKey: 'tpl.chooser.builderDesc', disabled: true },
];

/** Naya template banate waqt 3 tareeke choose karne ka pehla step. Builder abhi disabled hai — Phase B me enable hoga. */
export default function TemplateChooserPage() {
  const t = useT();
  const navigate = useNavigate();

  function handleChoose(event) {
    const option = OPTIONS.find((item) => item.key === event.currentTarget.dataset.key);
    if (option && !option.disabled) navigate(option.to);
  }

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('tpl.chooser.title')}
        subtitle={t('tpl.chooser.subtitle')}
        breadcrumb={[{ label: t('nav.templates'), to: '/templates' }, { label: t('tpl.chooser.title') }]}
      />

      <div className="mw-optiongrid">
        {OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            data-key={option.key}
            disabled={option.disabled}
            onClick={handleChoose}
            className="mw-option"
          >
            <span className="mw-option__icon" aria-hidden="true">
              <i className={`bi ${option.icon}`} />
            </span>
            <span>
              <span className="d-block mw-option__title">
                {t(option.titleKey)}
                {option.disabled ? <span className="badge bg-secondary ms-2">{t('tpl.chooser.comingSoon')}</span> : null}
              </span>
              <span className="d-block mw-option__desc">{t(option.descKey)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

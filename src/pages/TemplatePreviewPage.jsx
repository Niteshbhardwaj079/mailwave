import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import HtmlPreview from '../components/templates/HtmlPreview';
import { Segmented } from '../components/ui/Controls';
import EmptyState from '../components/ui/EmptyState';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';

/**
 * A standalone page, on purpose. The link can be shared with a colleague to
 * approve a design without giving them the whole app.
 */
export default function TemplatePreviewPage() {
  const t = useT();
  const { templateId } = useParams();
  const { getTemplate } = useWorkspace();
  const [device, setDevice] = useState('desktop');
  const template = getTemplate(templateId);

  const DEVICES = [
    { value: 'desktop', label: t('common.desktop') },
    { value: 'mobile', label: t('common.mobile') },
  ];

  if (!template) {
    return (
      <div className="mw-shell">
        <div className="mw-main">
          <div className="mw-card">
            <EmptyState
              icon="bi-file-earmark-x"
              title={t('tpl.empty')}
              text={t('tpl.emptyText')}
              action={
                <Link to="/templates" className="btn btn-primary">
                  {t('nav.templates')}
                </Link>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mw-shell">
      <header className="mw-topbar">
        <Link to="/templates" className="mw-iconbtn" aria-label={t('nav.templates')}>
          <i className="bi bi-arrow-left" />
        </Link>
        <h1 className="mw-topbar__title">{template.name}</h1>
        <div className="mw-topbar__actions">
          <Segmented items={DEVICES} value={device} onChange={setDevice} ariaLabel={t('common.preview')} />
          <Link to={`/templates/${template.id}/edit`} className="btn btn-sm btn-outline-primary mw-hide-mobile">
            <i className="bi bi-pencil me-2" />
            {t('common.edit')}
          </Link>
        </div>
      </header>

      <main className="mw-main">
        <div className="mw-main__inner">
          <p className="mw-fs-12 mw-text-muted text-center mb-3">
            {template.category} · {t('common.updated')} {template.updated} · {t('tpl.previewOnly')}
          </p>
          <HtmlPreview html={template.html} device={device} title={template.name} />
        </div>
      </main>
    </div>
  );
}

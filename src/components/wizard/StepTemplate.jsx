import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import FilterSelect from '../ui/FilterSelect';
import EmptyState from '../ui/EmptyState';
import { useT } from '../../i18n/I18nProvider';
import { useWorkspace } from '../../store/WorkspaceProvider';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';
import { findLanguage } from '../../i18n/languages';

export default function StepTemplate({ draft, onChange, category, onCategoryChange }) {
  const t = useT();
  const { templates } = useWorkspace();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get('/api/templates/categories')
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  function handleSelect(event) {
    const chosen = templates.find((item) => item.id === event.currentTarget.dataset.id);
    if (!chosen) return;
    onChange({
      templateId: chosen.id,
      templateName: chosen.name,
      templateHtml: chosen.html,
      subject: draft.subject || chosen.subject || '',
      language: chosen.language || 'en',
    });
  }

  const visible = category === 'All' ? templates : templates.filter((item) => item.category === category);

  return (
    <div className="mw-stack">
      <div>
        <h2 className="mw-fs-18 mw-fw-700 mb-1">{t('tpl.title')}</h2>
        <p className="mw-fs-13 mw-text-muted mb-0">{t('tpl.subtitle')}</p>
      </div>

      <div className="mw-row mw-row--wrap align-items-end">
        <FilterSelect
          id="wizard-tpl-category"
          label={t('filter.category')}
          icon="bi-collection"
          value={category}
          onChange={onCategoryChange}
          options={[{ value: 'All', label: t('filter.allCategories') }, ...categories.map((name) => ({ value: name, label: name }))]}
        />
        <Link to="/templates/new" className="btn btn-outline-primary">
          <i className="bi bi-plus-lg me-2" />
          {t('tpl.create')}
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="bi-layout-wtf"
          title={t('tpl.empty')}
          text={t('tpl.emptyText')}
          action={
            <Link to="/templates/new" className="btn btn-primary">
              {t('tpl.create')}
            </Link>
          }
        />
      ) : (
        <div className="mw-tplgrid">
          {visible.map((template) => (
            <article
              key={template.id}
              className={`mw-tpl ${draft.templateId === template.id ? 'is-selected' : ''}`.trim()}
            >
              <div className="mw-tpl__thumb mw-tpl__thumb--frame">
                <iframe className="mw-tplframe" title={template.name} srcDoc={template.html} sandbox="" tabIndex={-1} />
                <button
                  type="button"
                  className="mw-tpl__thumbcover"
                  data-id={template.id}
                  onClick={handleSelect}
                  aria-label={`${t('tpl.useInCampaign')} — ${template.name}`}
                />
              </div>

              <div className="mw-tpl__body">
                <h3 className="mw-tpl__name">{template.name}</h3>
                <p className="mw-tpl__meta mb-0">
                  {template.category} · {findLanguage(template.language).flag} · {t('common.updated')}{' '}
                  {formatDate(template.updated)}
                </p>
              </div>

              <div className="mw-tpl__foot">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary w-100"
                  data-id={template.id}
                  onClick={handleSelect}
                >
                  {draft.templateId === template.id ? (
                    <>
                      <i className="bi bi-check-lg me-1" />
                      {t('common.yes')}
                    </>
                  ) : (
                    t('tpl.useInCampaign')
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

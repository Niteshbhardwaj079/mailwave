import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageHeader from '../components/ui/PageHeader';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { Card, CardFoot } from '../components/ui/Card';
import { SearchInput } from '../components/ui/Controls';
import FilterSelect, { FilterBar } from '../components/ui/FilterSelect';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { useT } from '../i18n/I18nProvider';
import { useWorkspace } from '../store/WorkspaceProvider';
import { templateCategories } from '../data/mockData';
import { formatDate } from '../utils/format';

export default function TemplatesPage() {
  const t = useT();
  const navigate = useNavigate();
  const { templates, deleteTemplate, duplicateTemplate } = useWorkspace();
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  // Box me turant, chhantai 200ms ruk kar — type karte waqt atakta nahi.
  const search = useDebouncedValue(query, 200);
  const [confirmFor, setConfirmFor] = useState(null);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    const list = templates.filter((template) => {
      const categoryOk = category === 'All' || template.category === category;
      const textOk = !text || template.name.toLowerCase().includes(text);
      return categoryOk && textOk;
    });

    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return String(b.updated).localeCompare(String(a.updated));
    });
  }, [templates, category, sort, search]);

  function goToNew() {
    navigate('/templates/new');
  }

  function handleDuplicate(event) {
    duplicateTemplate(event.currentTarget.dataset.id);
  }

  function askDelete(event) {
    setConfirmFor(templates.find((item) => item.id === event.currentTarget.dataset.id) || null);
  }

  function closeConfirm() {
    setConfirmFor(null);
  }

  function confirmDelete() {
    if (confirmFor) deleteTemplate(confirmFor.id);
    setConfirmFor(null);
  }

  function clearFilters() {
    setCategory('All');
    setSort('recent');
    setQuery('');
  }

  const categoryOptions = templateCategories.map((name) => ({
    value: name,
    label: name === 'All' ? t('filter.allCategories') : name,
  }));

  const sortOptions = [
    { value: 'recent', label: t('common.updated') },
    { value: 'name', label: t('common.name') },
  ];

  return (
    <div className="mw-stack">
      <PageHeader
        title={t('tpl.title')}
        subtitle={t('tpl.subtitle')}
        helpTopic="templates"
        actions={
          <button type="button" className="btn btn-primary mw-btn-block-mobile" onClick={goToNew}>
            <i className="bi bi-plus-lg me-2" />
            {t('tpl.create')}
          </button>
        }
      />

      <Card flush>
        <FilterBar onClear={clearFilters} clearLabel={t('common.clear')}>
          <div className="mw-filterbar__search">
            <SearchInput value={query} onChange={setQuery} placeholder={t('tpl.searchPlaceholder')} />
          </div>
          <FilterSelect
            id="tpl-filter-category"
            label={t('filter.category')}
            icon="bi-collection"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          <FilterSelect
            id="tpl-filter-sort"
            label={t('common.filter')}
            icon="bi-sort-down"
            value={sort}
            onChange={setSort}
            options={sortOptions}
          />
        </FilterBar>

        <div className="mw-card__body">
          {visible.length === 0 ? (
            <EmptyState
              icon="bi-layout-wtf"
              title={t('tpl.empty')}
              text={t('tpl.emptyText')}
              action={
                <button type="button" className="btn btn-primary" onClick={goToNew}>
                  {t('tpl.create')}
                </button>
              }
            />
          ) : (
            <div className="mw-tplgrid">
              {visible.map((template) => (
                <article key={template.id} className="mw-tpl">
                  <div className="mw-tpl__thumb mw-tpl__thumb--frame">
                    <iframe
                      className="mw-tplframe"
                      title={template.name}
                      srcDoc={template.html}
                      sandbox=""
                      tabIndex={-1}
                    />
                    <Link
                      to={`/templates/${template.id}/preview`}
                      className="mw-tpl__thumbcover"
                      aria-label={`${t('common.preview')} ${template.name}`}
                    />
                  </div>

                  <div className="mw-tpl__body">
                    <h3 className="mw-tpl__name">{template.name}</h3>
                    <p className="mw-tpl__meta mb-0">
                      {template.category} · {t('common.updated')} {formatDate(template.updated)}
                    </p>
                  </div>

                  <div className="mw-tpl__foot">
                    <Link to={`/templates/${template.id}/preview`} className="btn btn-sm btn-outline-secondary flex-fill">
                      <i className="bi bi-eye me-1" />
                      {t('common.preview')}
                    </Link>
                    <Link to={`/templates/${template.id}/edit`} className="btn btn-sm btn-outline-primary flex-fill">
                      <i className="bi bi-pencil me-1" />
                      {t('common.edit')}
                    </Link>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      data-id={template.id}
                      onClick={handleDuplicate}
                      aria-label={t('common.duplicate')}
                    >
                      <i className="bi bi-files" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      data-id={template.id}
                      onClick={askDelete}
                      aria-label={t('common.delete')}
                    >
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <CardFoot>
          <span className="mw-fs-12 mw-text-muted">
            {t('common.showing')} {visible.length} {t('common.of')} {templates.length}
          </span>
        </CardFoot>
      </Card>

      <Sheet
        open={Boolean(confirmFor)}
        title={t('tpl.deleteConfirm')}
        onClose={closeConfirm}
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={closeConfirm}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger flex-fill" onClick={confirmDelete}>
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="mw-fs-14 mb-0">
          <strong>{confirmFor?.name}</strong> — {t('tpl.deleteConfirmText')}
        </p>
      </Sheet>
    </div>
  );
}

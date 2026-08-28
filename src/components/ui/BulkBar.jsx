import { useT } from '../../i18n/I18nProvider';

/**
 * The strip that appears once rows are ticked.
 * It always says how many are selected, so nobody deletes 4,000 people by
 * mistake after using "select all".
 */
export default function BulkBar({ count, total, onSelectAll, onClear, actions }) {
  const t = useT();

  if (count === 0) return null;

  return (
    <div className="mw-bulkbar" role="status">
      <span className="mw-bulkbar__count">
        <i className="bi bi-check2-square me-2" aria-hidden="true" />
        {t('bulk.selected', { count })}
      </span>

      {count < total ? (
        <button type="button" className="mw-linkbtn" onClick={onSelectAll}>
          {t('bulk.selectAll', { total })}
        </button>
      ) : null}

      <button type="button" className="mw-linkbtn" onClick={onClear}>
        {t('bulk.clear')}
      </button>

      <div className="mw-bulkbar__actions">{actions}</div>
    </div>
  );
}

/** Header checkbox that shows a dash when only some rows are ticked. */
export function SelectAllCheckbox({ checked, indeterminate, onChange, label }) {
  function handleRef(node) {
    if (node) node.indeterminate = indeterminate;
  }

  return (
    <input
      ref={handleRef}
      type="checkbox"
      className="form-check-input mw-rowcheck"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  );
}

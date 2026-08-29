import { useT } from '../../i18n/I18nProvider';
import { formatNumber } from '../../utils/format';

/**
 * Rows tick karte hi upar aane wali patti.
 *
 * Iska ek hi kaam hai: SAAF batana ki kitne chune hain. "Select all" dabakar
 * mail bhejna ya delete karna wapas nahi hota, isliye yahan andaza nahi lagne
 * dena chahiye.
 *
 * Teen halat hote hain:
 *   1. Kuch rows chuni hain          -> "12 selected"
 *   2. Poora page chuna hai, aur aage bhi hai -> "50 selected  |  Select all 300"
 *   3. Sab chune hain                -> "All 300 selected  |  Clear"
 */
export default function BulkBar({ count, total, pageCount, onSelectAll, onClear, actions }) {
  const t = useT();

  if (count === 0) return null;

  const allSelected = count >= total;

  // Poora page chuna hai par list usse badi hai — tabhi "sab chuno" dikhana
  // kaam ka hai.
  const canSelectAll = !allSelected && pageCount !== undefined && count >= pageCount && total > pageCount;

  return (
    <div className="mw-bulkbar" role="status">
      <span className="mw-bulkbar__count">
        <i className="bi bi-check2-square me-2" aria-hidden="true" />
        {allSelected
          ? t('bulk.allSelected', { count: formatNumber(count) })
          : t('bulk.selected', { count: formatNumber(count) })}
      </span>

      {canSelectAll ? (
        <button type="button" className="mw-linkbtn mw-bulkbar__selectall" onClick={onSelectAll}>
          {t('bulk.selectAll', { total: formatNumber(total) })}
        </button>
      ) : null}

      <button type="button" className="mw-linkbtn" onClick={onClear}>
        {t('bulk.clear')}
      </button>

      <div className="mw-bulkbar__actions">{actions}</div>
    </div>
  );
}

/**
 * Header ka tick-box. Kuch rows chuni hon to dash dikhata hai (poora tick nahi),
 * taki farq pata chale.
 */
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

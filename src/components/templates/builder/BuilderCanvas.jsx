import { useState } from 'react';

import BuilderRow from './BuilderRow';
import { useT } from '../../../i18n/I18nProvider';

const LAYOUTS = [
  { columns: 1, key: 'tpl.builder.layout1', cols: [1] },
  { columns: 2, key: 'tpl.builder.layout2', cols: [1, 1] },
  { columns: 3, key: 'tpl.builder.layout3', cols: [1, 1, 1] },
];

function LayoutPicker({ onPick }) {
  const t = useT();
  return (
    <div className="mw-tplbuilder-layout">
      {LAYOUTS.map((layout) => (
        <button key={layout.columns} type="button" className="mw-tplbuilder-layout__item" onClick={() => onPick(layout.columns)} aria-label={t(layout.key)} title={t(layout.key)}>
          {layout.cols.map((_, i) => (
            <span key={i} aria-hidden="true" />
          ))}
        </button>
      ))}
    </div>
  );
}

/**
 * Top-level canvas: rows top-to-bottom, "Add row" ke saath 1/2/3-column
 * layout picker. Har page-level handler (onMoveRow, onDeleteRow, ...) yahan
 * har row/column/block ke liye curry ho kar BuilderRow/BuilderColumn tak
 * jaata hai — un components ko khud kabhi rowId/colId thaamne ki zaroorat
 * nahi padti.
 */
export default function BuilderCanvas({
  schema,
  onAddRow,
  onMoveRow,
  onDeleteRow,
  onUpdateRow,
  onAddBlock,
  onEditBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlock,
  onReorderBlock,
}) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);

  function handlePick(columns) {
    onAddRow(columns);
    setPickerOpen(false);
  }

  return (
    <div className="mw-tplbuilder__canvas">
      {schema.rows.map((row, index) => (
        <BuilderRow
          key={row.id}
          row={row}
          canMoveUp={index > 0}
          canMoveDown={index < schema.rows.length - 1}
          onMoveUp={() => onMoveRow(row.id, -1)}
          onMoveDown={() => onMoveRow(row.id, 1)}
          onDelete={() => onDeleteRow(row.id)}
          onChange={(patch) => onUpdateRow(row.id, patch)}
          onAddBlock={onAddBlock}
          onEditBlock={onEditBlock}
          onDuplicateBlock={onDuplicateBlock}
          onDeleteBlock={onDeleteBlock}
          onMoveBlock={onMoveBlock}
          onReorderBlock={onReorderBlock}
        />
      ))}

      {pickerOpen ? (
        <div className="mw-stack--sm">
          <p className="mw-fs-13 mw-fw-700 mb-1">{t('tpl.builder.chooseLayout')}</p>
          <LayoutPicker onPick={handlePick} />
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setPickerOpen(true)}>
          <i className="bi bi-plus-lg me-2" />
          {t('tpl.builder.addRow')}
        </button>
      )}
    </div>
  );
}

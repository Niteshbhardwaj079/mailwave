import { useState } from 'react';

import Sheet from '../../ui/Sheet';
import BuilderColumn from './BuilderColumn';
import { useT } from '../../../i18n/I18nProvider';

function RowSettings({ row, open, onClose, onChange }) {
  const t = useT();
  if (!row) return null;

  function set(patch) {
    onChange({ ...row, ...patch });
  }

  function setPadding(side, value) {
    set({ padding: { ...row.padding, [side]: Number(value) || 0 } });
  }

  return (
    <Sheet open={open} title={t('tpl.builder.rowSettings')} onClose={onClose}>
      <div className="mb-3">
        <label className="form-label">{t('tpl.builder.rowBackground')}</label>
        <input type="color" className="form-control form-control-color" value={row.backgroundColor || '#ffffff'} onChange={(e) => set({ backgroundColor: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="form-label">{t('tpl.builder.rowPadding')}</label>
        <div className="row g-2">
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <div className="col-6" key={side}>
              <input type="number" min="0" max="80" className="form-control" value={row.padding?.[side] ?? 24} onChange={(e) => setPadding(side, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** Ek row: apni columns side-by-side render karta hai, upar move/delete/settings toolbar. */
export default function BuilderRow({ row, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onDelete, onChange, ...columnProps }) {
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="mw-builder-row">
      <div className="mw-builder-row__toolbar">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSettingsOpen(true)} aria-label={t('tpl.builder.rowSettings')}>
          <i className="bi bi-sliders" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t('tpl.builder.moveUp')}>
          <i className="bi bi-arrow-up" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t('tpl.builder.moveDown')}>
          <i className="bi bi-arrow-down" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} aria-label={t('common.delete')}>
          <i className="bi bi-trash3" />
        </button>
      </div>
      <div className="mw-builder-row__cols">
        {row.columns.map((col) => (
          <BuilderColumn key={col.id} rowId={row.id} col={col} {...columnProps} />
        ))}
      </div>
      <RowSettings row={row} open={settingsOpen} onClose={() => setSettingsOpen(false)} onChange={onChange} />
    </div>
  );
}

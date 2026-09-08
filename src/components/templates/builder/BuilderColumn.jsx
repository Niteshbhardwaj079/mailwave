import { useState } from 'react';

import BuilderBlock from './BuilderBlock';
import BuilderBlockPalette from './BuilderBlockPalette';
import { useT } from '../../../i18n/I18nProvider';

/**
 * Ek column: apne blocks stack karta hai, "+ Add block" dikhata hai. Drag se
 * reorder isi column ke andar hota hai — native HTML5 draggable, koi library
 * nahi (chhoti list, professional feel ke liye kaafi).
 */
export default function BuilderColumn({ rowId, col, onAddBlock, onEditBlock, onDuplicateBlock, onDeleteBlock, onMoveBlock, onReorderBlock }) {
  const t = useT();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);

  return (
    <div className="mw-builder-col">
      {col.blocks.length ? (
        col.blocks.map((block, index) => (
          <BuilderBlock
            key={block.id}
            block={block}
            onEdit={() => onEditBlock(rowId, col.id, block.id)}
            onDuplicate={() => onDuplicateBlock(rowId, col.id, block.id)}
            onDelete={() => onDeleteBlock(rowId, col.id, block.id)}
            onMoveUp={() => onMoveBlock(rowId, col.id, block.id, -1)}
            onMoveDown={() => onMoveBlock(rowId, col.id, block.id, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < col.blocks.length - 1}
            dragProps={{
              draggable: true,
              onDragStart: () => setDraggingId(block.id),
              onDragEnd: () => setDraggingId(null),
              onDragOver: (e) => e.preventDefault(),
              onDrop: (e) => {
                e.preventDefault();
                if (draggingId && draggingId !== block.id) onReorderBlock(rowId, col.id, draggingId, block.id);
                setDraggingId(null);
              },
            }}
          />
        ))
      ) : (
        <div className="mw-builder-col__empty">{t('tpl.builder.emptyColumn')}</div>
      )}

      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setPaletteOpen(true)}>
        <i className="bi bi-plus-lg me-1" />
        {t('tpl.builder.addBlock')}
      </button>

      <BuilderBlockPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={(type) => onAddBlock(rowId, col.id, type)} />
    </div>
  );
}

import { compileBlockForPreview } from '../../../data/builderCompiler';
import { useT } from '../../../i18n/I18nProvider';

/**
 * Ek block canvas me — asli compiled HTML fragment hi preview ke roop me
 * dikhata hai (WYSIWYG: canvas me jo dikhta hai wahi bhejne wali email me
 * bhi hota hai), upar hover par edit/duplicate/delete/move/drag toolbar.
 */
export default function BuilderBlock({ block, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, dragProps }) {
  const t = useT();
  const html = compileBlockForPreview(block);

  return (
    <div className="mw-tplbuilder-block" {...dragProps}>
      <div className="mw-tplbuilder-block__toolbar">
        <button type="button" onClick={onEdit} aria-label={t('tpl.builder.editBlock')} title={t('tpl.builder.editBlock')}>
          <i className="bi bi-pencil" />
        </button>
        <button type="button" onClick={onDuplicate} aria-label={t('common.duplicate')} title={t('common.duplicate')}>
          <i className="bi bi-files" />
        </button>
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t('tpl.builder.moveUp')} title={t('tpl.builder.moveUp')}>
          <i className="bi bi-arrow-up" />
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t('tpl.builder.moveDown')} title={t('tpl.builder.moveDown')}>
          <i className="bi bi-arrow-down" />
        </button>
        <button type="button" aria-label={t('tpl.builder.dragHandle')} title={t('tpl.builder.dragHandle')} style={{ cursor: 'grab' }}>
          <i className="bi bi-grip-vertical" />
        </button>
        <button type="button" onClick={onDelete} aria-label={t('common.delete')} title={t('common.delete')}>
          <i className="bi bi-trash3" />
        </button>
      </div>
      {html ? (
        <div className="mw-tplbuilder-block__preview" onClick={onEdit} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="mw-tplbuilder-block__preview mw-text-muted" onClick={onEdit}>
          {t(`tpl.builder.block.${block.type}`)}…
        </div>
      )}
    </div>
  );
}

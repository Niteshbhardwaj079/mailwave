import Sheet from '../../ui/Sheet';
import { BLOCK_TYPES } from '../../../data/builderCompiler';
import { useT } from '../../../i18n/I18nProvider';

const ICONS = {
  heading: 'bi-type-h1',
  text: 'bi-text-paragraph',
  image: 'bi-image',
  button: 'bi-hand-index-thumb',
  divider: 'bi-hr',
  spacer: 'bi-arrows-vertical',
  logo: 'bi-award',
  social: 'bi-share',
  websiteLink: 'bi-globe',
  phone: 'bi-telephone',
  customLink: 'bi-link-45deg',
  footerText: 'bi-card-text',
  unsubscribe: 'bi-envelope-slash',
};

/** Block-type picker — column me "Add block" dabane par khulta hai. */
export default function BuilderBlockPalette({ open, onClose, onPick }) {
  const t = useT();

  return (
    <Sheet open={open} title={t('tpl.builder.addBlock')} onClose={onClose}>
      <div className="mw-builder-palette">
        {BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="mw-builder-palette__item"
            onClick={() => {
              onPick(type);
              onClose();
            }}
          >
            <i className={`bi ${ICONS[type] || 'bi-square'}`} />
            <span>{t(`tpl.builder.block.${type}`)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

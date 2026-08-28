import { useT } from '../../i18n/I18nProvider';

/**
 * Shown while a route's chunk is downloading. Pages are code-split, so the
 * first visit to a screen fetches it — usually fast enough that this never
 * appears, but on a slow connection it has to be something, not a blank area.
 */
export default function PageLoader() {
  const t = useT();

  return (
    <div className="mw-pageloader" role="status" aria-live="polite">
      <span className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">{t('common.loading')}</span>
    </div>
  );
}

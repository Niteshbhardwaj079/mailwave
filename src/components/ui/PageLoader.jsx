import { useT } from '../../i18n/I18nProvider';
import { appConfig } from '../../config/appConfig';

/**
 * Shown while a route's chunk is downloading, or while the session is being
 * checked on first load. Pages are code-split, so the first visit to a
 * screen fetches it — usually fast enough that this never appears, but on a
 * slow connection it has to be something, not a blank area.
 *
 * `fullScreen`: true jab abhi sidebar/topbar bhi nahi bane (app ka bilkul
 * pehla load, ya session check ke waqt) — tab poori screen ke beech me hona
 * chahiye. AppLayout ke andar (sidebar/topbar pehle se dikh rahe hain) false
 * hi rehta hai, taaki content area ke andar hi confined rahe.
 */
export default function PageLoader({ fullScreen = false }) {
  const t = useT();

  return (
    <div className={`mw-pageloader ${fullScreen ? 'mw-pageloader--full' : ''}`.trim()} role="status" aria-live="polite">
      <span className="mw-pageloader__mark" aria-hidden="true">
        <i className={`bi ${appConfig.logoIcon}`} />
      </span>
      <span className="visually-hidden">{t('common.loading')}</span>
    </div>
  );
}

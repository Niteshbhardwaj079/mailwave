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
 *
 * `label`: default me sirf ek chhota spinner hota hai (text screen-reader ke
 * liye hi hai) — jab ye kuch second se zyada chal sakta hai (jaise session
 * check backoff retry kar rahi ho), ek chhota, dikhta hua caption diya ja
 * sakta hai taaki "atak gaya" jaisa na lage.
 */
export default function PageLoader({ fullScreen = false, label }) {
  const t = useT();

  return (
    <div className={`mw-pageloader ${fullScreen ? 'mw-pageloader--full' : ''}`.trim()} role="status" aria-live="polite">
      <span className="mw-pageloader__mark" aria-hidden="true">
        <i className={`bi ${appConfig.logoIcon}`} />
      </span>
      {label ? <span className="mw-fs-13 mw-text-muted mt-3">{label}</span> : <span className="visually-hidden">{t('common.loading')}</span>}
    </div>
  );
}

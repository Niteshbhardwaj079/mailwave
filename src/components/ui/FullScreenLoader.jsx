import { appConfig } from '../../config/appConfig';

/**
 * Screen ke beech mein ek branded loading overlay — jab koi lambi background
 * cheez (jaise campaign report generate hona) chal rahi ho aur user ko turant,
 * bina confusion ke pata chalna chahiye ki app kaam kar rahi hai.
 */
export default function FullScreenLoader({ message, subtext }) {
  return (
    <div className="mw-fullloader" role="status" aria-live="polite">
      <div className="mw-fullloader__card">
        <span className="mw-fullloader__mark" aria-hidden="true">
          <i className={`bi ${appConfig.logoIcon}`} />
        </span>
        <p className="mw-fullloader__text">{message}</p>
        {subtext ? <p className="mw-fullloader__subtext">{subtext}</p> : null}
      </div>
    </div>
  );
}

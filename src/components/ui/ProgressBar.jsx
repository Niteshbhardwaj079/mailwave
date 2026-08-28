import { widthClass } from '../../utils/format';

/**
 * Width comes from a generated utility class (mw-w-0 ... mw-w-100),
 * so no inline style attribute is needed anywhere in the app.
 */
export default function ProgressBar({ value, tone = 'primary', size = 'md', label }) {
  const trackClass = ['mw-progress', size === 'lg' ? 'mw-progress--lg' : ''].filter(Boolean).join(' ');
  const barClass = ['mw-progress__bar', tone === 'primary' ? '' : `mw-progress__bar--${tone}`, widthClass(value)]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={trackClass}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
    >
      <div className={barClass} />
    </div>
  );
}

export function Meter({ value, tone = 'primary', display }) {
  return (
    <div className="mw-meter">
      <div className="mw-meter__track">
        <ProgressBar value={value} tone={tone} />
      </div>
      <span className="mw-meter__value">{display}</span>
    </div>
  );
}

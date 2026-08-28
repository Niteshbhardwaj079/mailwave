import { formatNumber } from '../../utils/format';

const TREND_ICON = {
  up: 'bi-arrow-up-right',
  down: 'bi-arrow-down-right',
  flat: 'bi-dash',
};

export default function KpiCard({ label, value, icon, tone = 'primary', delta, trend = 'flat', hint }) {
  return (
    <article className="mw-kpi">
      <span className={`mw-kpi__icon mw-kpi__icon--${tone}`} aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div className="mw-kpi__body">
        <p className="mw-kpi__label">{label}</p>
        <div className="mw-kpi__value">{formatNumber(value)}</div>
        {delta ? (
          <span className={`mw-kpi__delta mw-kpi__delta--${trend}`}>
            <i className={`bi ${TREND_ICON[trend]}`} />
            {delta}
            {hint ? <span className="mw-kpi__hint">· {hint}</span> : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

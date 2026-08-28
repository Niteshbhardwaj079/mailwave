import { formatNumber } from '../../utils/format';

export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="mw-tooltip">
      <p className="mw-tooltip__label">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="mw-tooltip__row">
          <span className={`mw-tooltip__swatch mw-legend__swatch--${entry.dataKey || 'sent'}`} aria-hidden="true" />
          <span className="mw-tooltip__name">{entry.name}</span>
          <span className="mw-tooltip__value">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];

  return (
    <div className="mw-tooltip">
      <div className="mw-tooltip__row">
        <span className={`mw-tooltip__swatch mw-legend__swatch--${item.payload.key}`} aria-hidden="true" />
        <span className="mw-tooltip__name">{item.name}</span>
        <span className="mw-tooltip__value">{formatNumber(item.value)}</span>
      </div>
    </div>
  );
}

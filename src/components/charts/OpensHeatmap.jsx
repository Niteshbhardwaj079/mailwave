import { useT } from '../../i18n/I18nProvider';

const HOUR_LABELS = ['12a', '', '2', '', '4', '', '6', '', '8', '', '10', '', '12p', '', '2', '', '4', '', '6', '', '8', '', '10', ''];
const SCALE_LEVELS = [0, 1, 2, 3, 4, 5];

export default function OpensHeatmap({ data, days }) {
  const t = useT();
  return (
    <div>
      <div className="mw-heatmap">
        {data.map((row, rowIndex) => (
          <div key={days[rowIndex]} className="mw-heatmap__row">
            <span className="mw-heatmap__daylabel">{days[rowIndex]}</span>
            {row.map((cell) => (
              <button
                key={`${cell.day}-${cell.hour}`}
                type="button"
                className={`mw-heatmap__cell mw-heatmap__cell--l${cell.level}`}
                title={`${cell.day} ${cell.hour}:00 — about ${cell.opens} opens`}
                aria-label={`${cell.day} ${cell.hour} hundred hours, about ${cell.opens} opens`}
              />
            ))}
          </div>
        ))}

        <div className="mw-heatmap__hours" aria-hidden="true">
          {HOUR_LABELS.map((label, index) => (
            <span key={`hour-${index}`} className="mw-heatmap__hour">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mw-row mw-row--between mt-3">
        <span className="mw-fs-12 mw-text-muted">{t('dash.bestWindow')}</span>
        <span className="mw-heatmap__scale">
          Less
          {SCALE_LEVELS.map((level) => (
            <span key={level} className={`mw-heatmap__swatch mw-heatmap__cell--l${level}`} aria-hidden="true" />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

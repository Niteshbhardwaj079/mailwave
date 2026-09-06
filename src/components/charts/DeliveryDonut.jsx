import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { DonutTooltip } from './ChartTooltip';
import { formatCompact, formatNumber, percent } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';
import { useT } from '../../i18n/I18nProvider';

export default function DeliveryDonut({ data: raw }) {
  const t = useT();
  const { accentHex } = useTheme();
  const data = raw.map((item) => (item.key === 'sent' ? { ...item, color: accentHex } : item));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      <div className="mw-donut mw-chart mw-chart--sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="mw-donut__center">
          <span className="mw-donut__value">{formatCompact(total)}</span>
          <span className="mw-donut__label">{t('dash.totalSent')}</span>
        </div>
      </div>

      <div className="mw-breakdown">
        {data.map((item) => (
          <div key={item.key} className="mw-breakdown__row">
            <span className={`mw-legend__swatch mw-legend__swatch--${item.key === 'unsubscribed' ? 'unsub' : item.key}`} aria-hidden="true" />
            <span className="mw-breakdown__name">{item.name}</span>
            <span className="mw-breakdown__value">{formatNumber(item.value)}</span>
            <span className="mw-breakdown__pct">{percent(item.value, total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

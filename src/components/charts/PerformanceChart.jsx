import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import ChartTooltip from './ChartTooltip';
import { formatCompact } from '../../utils/format';
import { useTheme } from '../../theme/ThemeProvider';

const BASE_SERIES = [
  { key: 'sent', name: 'Sent', color: '#4f46e5' },
  { key: 'opened', name: 'Opened', color: '#0891b2' },
  { key: 'clicked', name: 'Clicked', color: '#16a34a' },
];

export default function PerformanceChart({ data, height = 'md' }) {
  const { accentHex } = useTheme();
  // 'Sent' is the brand series, so it follows whichever accent colour is chosen
  const SERIES = BASE_SERIES.map((s) => (s.key === 'sent' ? { ...s, color: accentHex } : s));
  const heightClass = height === 'sm' ? 'mw-chart mw-chart--sm' : 'mw-chart';

  return (
    <div className={heightClass}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`mw-grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} dy={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={formatCompact} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#c7cbd9', strokeDasharray: '4 4' }} />

          {SERIES.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              stroke={series.color}
              strokeWidth={2.5}
              fill={`url(#mw-grad-${series.key})`}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_AXIS_TICK,
  CHART_TOOLTIP_STYLE,
  formatCompactNumber,
  seriesColor,
} from '#/components/charts/chart-theme'
import type { ChartDatum, ChartSeries } from '#/components/charts/chart-theme'

// Thin recharts wrapper for time-series trends (e.g. daily movement in/out).
export function SimpleLineChart({
  data,
  xKey,
  series,
  height = 280,
}: {
  data: Array<ChartDatum>
  xKey: string
  series: Array<ChartSeries>
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            stroke="var(--ops-line)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey={xKey}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={CHART_AXIS_TICK}
            tickFormatter={formatCompactNumber}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            cursor={{ stroke: 'var(--ops-line)' }}
            formatter={(value: number | string, name: string) => [
              formatCompactNumber(value),
              name,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.72rem', color: 'var(--ops-muted)' }}
            iconType="plainline"
          />
          {series.map((entry, index) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={seriesColor(entry, index)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

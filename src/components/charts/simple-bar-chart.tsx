'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
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

// Thin recharts wrapper for categorical bars. `horizontal` flips the layout so
// long category labels (e.g. product names) read left-to-right.
export function SimpleBarChart({
  data,
  xKey,
  series,
  height = 280,
  horizontal = false,
}: {
  data: Array<ChartDatum>
  xKey: string
  series: Array<ChartSeries>
  height?: number
  horizontal?: boolean
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : 0 }}
        >
          <CartesianGrid
            stroke="var(--ops-line)"
            strokeDasharray="3 3"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={CHART_AXIS_TICK}
                tickFormatter={formatCompactNumber}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                width={140}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={CHART_AXIS_TICK}
                tickFormatter={formatCompactNumber}
                axisLine={false}
                tickLine={false}
                width={48}
              />
            </>
          )}
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            cursor={{ fill: 'var(--ops-teal-soft)' }}
            formatter={(value, name) => [
              formatCompactNumber(Array.isArray(value) ? value[0] : value),
              String(name),
            ]}
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              fill={seriesColor(entry, index)}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 18 : 42}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

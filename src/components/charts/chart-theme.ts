import type { CSSProperties } from 'react'

// Shared look-and-feel for the recharts wrappers. All recharts usage stays
// inside src/components/charts so the library remains swappable.

export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: 'var(--ops-paper-strong)',
  border: '1px solid var(--ops-line)',
  borderRadius: '0.75rem',
  fontSize: '0.75rem',
  color: 'var(--ops-ink)',
  boxShadow: 'var(--ops-shadow)',
}

export const CHART_AXIS_TICK = {
  fill: 'var(--ops-muted)',
  fontSize: 11,
} as const

const compactFormat = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCompactNumber(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numeric)
    ? compactFormat.format(numeric)
    : String(value)
}

export interface ChartSeries {
  key: string
  label: string
  color?: string
}

export type ChartDatum = Record<string, string | number | null>

export function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? CHART_COLORS[index % CHART_COLORS.length]
}

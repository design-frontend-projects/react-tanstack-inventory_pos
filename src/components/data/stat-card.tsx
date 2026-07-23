'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'
import { Skeleton } from '#/components/ui/skeleton'

// KPI tile shared by every module dashboard. Extracted from the inline markup
// in features/inventory/inventory-dashboard.tsx so dashboards stay consistent.

export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const toneClassName: Record<StatTone, string> = {
  neutral: 'border-border bg-card',
  primary: 'border-primary/25 bg-primary/[0.06]',
  success: 'border-emerald-300/50 bg-emerald-500/[0.07]',
  warning: 'border-amber-300/50 bg-amber-500/[0.07]',
  danger: 'border-destructive/30 bg-destructive/[0.06]',
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  isLoading = false,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: StatTone
  icon?: React.ReactNode
  isLoading?: boolean
  className?: string
}) {
  return (
    <article
      className={cn(
        'rounded-xl border px-4 py-4',
        toneClassName[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="ops-panel-label">{label}</p>
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        ) : null}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        {isLoading ? (
          <Skeleton className="h-8 w-24 rounded-md" />
        ) : (
          <strong className="text-[1.9rem] font-semibold tracking-tight tabular-nums">
            {value}
          </strong>
        )}
        {hint ? (
          <span className="max-w-40 text-end text-xs leading-5 text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export function KpiGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        columns === 4 && 'xl:grid-cols-4',
        columns === 3 && 'xl:grid-cols-3',
        columns === 2 && 'xl:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

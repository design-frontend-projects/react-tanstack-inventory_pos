'use client'

import * as React from 'react'

import { cn } from '#/lib/utils'

// Semantic status tone → chip styling. Extends the StatusPill pattern in
// features/restaurant/shared/format.tsx with a reusable, tone-driven chip.

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'warning'
  | 'success'
  | 'danger'
  | 'primary'

const toneClassName: Record<StatusTone, string> = {
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  info: 'border-sky-300/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  warning:
    'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  success:
    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  primary: 'border-primary/40 bg-primary/10 text-primary',
}

export function StatusChip({
  tone = 'neutral',
  children,
  className,
  dot = false,
}: {
  tone?: StatusTone
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClassName[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-80"
        />
      ) : null}
      {children}
    </span>
  )
}

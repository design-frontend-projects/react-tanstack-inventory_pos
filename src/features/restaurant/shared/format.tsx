'use client'

import * as React from 'react'

// Small display helpers shared by the restaurant screens.

export function formatMoney(amount: string | number, currencyCode?: string) {
  const value = Number(amount)
  if (Number.isNaN(value)) {
    return String(amount)
  }

  if (currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
      }).format(value)
    } catch {
      // Unknown currency code — fall through to the plain format.
    }
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatElapsed(fromIso: string, nowMs: number): string {
  const elapsedMs = Math.max(0, nowMs - new Date(fromIso).getTime())
  const totalMinutes = Math.floor(elapsedMs / 60_000)

  if (totalMinutes < 1) {
    return '<1m'
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes}m`
}

export function elapsedMinutes(fromIso: string, nowMs: number): number {
  return Math.floor(Math.max(0, nowMs - new Date(fromIso).getTime()) / 60_000)
}

// Re-renders consumers on a fixed cadence so elapsed timers tick.
export function useNowTick(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(handle)
  }, [intervalMs])

  return now
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}

// Status → pill styling shared across screens.

export const ORDER_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'border-border bg-muted/60 text-foreground',
  OPEN: 'border-border bg-muted/60 text-foreground',
  CONFIRMED: 'border-sky-300/60 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  PREPARING:
    'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  COOKING:
    'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  READY:
    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  SERVED:
    'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  COMPLETED: 'border-border bg-muted/60 text-muted-foreground',
  CANCELLED: 'border-destructive/40 bg-destructive/10 text-destructive',
  REFUNDED: 'border-destructive/40 bg-destructive/10 text-destructive',
  VOIDED: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export const TABLE_STATUS_STYLES: Record<
  string,
  { card: string; badge: string; label: string }
> = {
  AVAILABLE: {
    card: 'border-emerald-300/60 hover:border-emerald-400',
    badge:
      'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    label: 'Available',
  },
  OCCUPIED: {
    card: 'border-primary/50 bg-primary/[0.05] hover:border-primary',
    badge: 'border-primary/40 bg-primary/10 text-primary',
    label: 'Occupied',
  },
  RESERVED: {
    card: 'border-amber-300/70 hover:border-amber-400',
    badge:
      'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    label: 'Reserved',
  },
  BLOCKED: {
    card: 'border-border opacity-60 hover:opacity-80',
    badge: 'border-border bg-muted/60 text-muted-foreground',
    label: 'Blocked',
  },
}

export function StatusPill({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const tone = ORDER_STATUS_BADGE[status] ?? 'border-border bg-muted/60'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tone} ${className ?? ''}`}
    >
      {titleCase(status)}
    </span>
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

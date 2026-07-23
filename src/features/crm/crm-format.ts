import type { StatusTone } from '#/components/board/status-chip'

// Display helpers shared by the CRM screens: lifecycle/RFM tone maps and
// compact formatting for projection values (Decimals arrive as strings).

export const LIFECYCLE_STATUSES = [
  'PROSPECT',
  'ACTIVE',
  'AT_RISK',
  'INACTIVE',
  'BLOCKED',
] as const

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number]

export const lifecycleTone: Record<LifecycleStatus, StatusTone> = {
  PROSPECT: 'info',
  ACTIVE: 'success',
  AT_RISK: 'warning',
  INACTIVE: 'neutral',
  BLOCKED: 'danger',
}

export function formatLifecycle(status: string | null): string {
  if (!status) {
    return 'No profile'
  }
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
}

// RFM segment codes come from rfm-scoring.labelRfmSegment.
export const rfmTone: Record<string, StatusTone> = {
  champion: 'success',
  loyal: 'primary',
  new: 'info',
  potential_loyalist: 'info',
  needs_attention: 'warning',
  at_risk: 'warning',
  about_to_sleep: 'warning',
  cant_lose: 'danger',
  hibernating: 'neutral',
}

export function formatRfmSegment(segment: string | null): string {
  if (!segment) {
    return 'Unscored'
  }
  return segment.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function formatMoney(
  amount: string | number | null | undefined,
): string {
  if (amount === null || amount === undefined) {
    return '—'
  }
  const value = Number(amount)
  if (Number.isNaN(value)) {
    return String(amount)
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatNumber(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  return Number.isNaN(numeric) ? String(value) : numeric.toLocaleString()
}

export function formatPercent(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '—'
  }
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return String(value)
  }
  return `${Math.round(numeric * 100)}%`
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleDateString()
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return '—'
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Churn score buckets for tone + label rendering.
export function churnRisk(score: string | number | null | undefined): {
  label: string
  tone: StatusTone
} {
  if (score === null || score === undefined) {
    return { label: 'No signal', tone: 'neutral' }
  }
  const numeric = Number(score)
  if (Number.isNaN(numeric)) {
    return { label: 'No signal', tone: 'neutral' }
  }
  if (numeric >= 0.7) {
    return { label: `High ${formatPercent(numeric)}`, tone: 'danger' }
  }
  if (numeric >= 0.4) {
    return { label: `Medium ${formatPercent(numeric)}`, tone: 'warning' }
  }
  return { label: `Low ${formatPercent(numeric)}`, tone: 'success' }
}

// Timeline entry types written by timeline-mapper (ENTRY_TYPE_BY_PREFIX) plus
// the manual 'note' type from addManualNote.
export const timelineEntryMeta: Record<
  string,
  { label: string; tone: StatusTone }
> = {
  note: { label: 'Note', tone: 'primary' },
  customer: { label: 'Profile', tone: 'info' },
  sale: { label: 'Sale', tone: 'success' },
  order: { label: 'Order', tone: 'success' },
  invoice: { label: 'Invoice', tone: 'info' },
  return: { label: 'Return', tone: 'warning' },
  note_doc: { label: 'Financial note', tone: 'warning' },
  loyalty: { label: 'Loyalty', tone: 'primary' },
  consent: { label: 'Consent', tone: 'neutral' },
  segment: { label: 'Segment', tone: 'info' },
  reservation: { label: 'Reservation', tone: 'info' },
  delivery: { label: 'Delivery', tone: 'info' },
  gift_card: { label: 'Gift card', tone: 'primary' },
  promotion: { label: 'Promotion', tone: 'primary' },
  event: { label: 'Event', tone: 'info' },
  catering: { label: 'Catering', tone: 'info' },
  activity: { label: 'Activity', tone: 'neutral' },
}

export function timelineMeta(entryType: string): {
  label: string
  tone: StatusTone
} {
  return (
    timelineEntryMeta[entryType] ?? {
      label: entryType.replace(/_/g, ' '),
      tone: 'neutral',
    }
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

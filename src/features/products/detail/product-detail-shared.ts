import type { StatusTone } from '#/components/board/status-chip'
import type { useProduct } from '#/features/products/use-products'

// Shared types + formatting helpers for the product detail surface. Decimal
// columns cross the server-function boundary as strings (see
// server/inventory/catalog-dto.ts), so every numeric formatter parses defensively
// and falls back to an em dash.

export type ProductDetail = NonNullable<ReturnType<typeof useProduct>['data']>
export type ProductVariantRow = ProductDetail['variants'][number]

const quantityFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function parseNumeric(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  return Number.isNaN(parsed) ? null : parsed
}

export function formatQuantity(
  value: string | number | null | undefined,
): string {
  const parsed = parseNumeric(value)

  return parsed === null ? '—' : quantityFormat.format(parsed)
}

export function formatMoney(value: string | number | null | undefined): string {
  const parsed = parseNumeric(value)

  return parsed === null ? '—' : moneyFormat.format(parsed)
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return '—'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

// 'WEIGHTED_AVERAGE' → 'Weighted Average'
export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const productStatusTones: Record<string, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'neutral',
}

export function productStatusTone(status: string): StatusTone {
  return productStatusTones[status] ?? 'neutral'
}

const lotStatusTones: Record<string, StatusTone> = {
  ACTIVE: 'success',
  QUARANTINE: 'warning',
  EXPIRED: 'danger',
  RECALLED: 'danger',
  DEPLETED: 'neutral',
}

export function lotStatusTone(status: string): StatusTone {
  return lotStatusTones[status] ?? 'neutral'
}

const serialStatusTones: Record<string, StatusTone> = {
  IN_STOCK: 'success',
  RESERVED: 'info',
  SOLD: 'neutral',
  IN_TRANSIT: 'info',
  RETURNED: 'warning',
  SCRAPPED: 'danger',
  IN_REPAIR: 'warning',
}

export function serialStatusTone(status: string): StatusTone {
  return serialStatusTones[status] ?? 'neutral'
}

const documentStatusTones: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  CONFIRMED: 'primary',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  COMPLETED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
  REJECTED: 'danger',
}

export function documentStatusTone(status: string): StatusTone {
  return documentStatusTones[status] ?? 'neutral'
}

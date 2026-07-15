import { Prisma } from '#/server/db/generated/prisma/client'

// Pure incremental fold of domain events into per-customer metrics facts.
// Kept free of I/O so the fold is unit-testable; the metrics projection owns
// persistence and the lastEventSequence idempotency guard.

export interface FavoriteCounters {
  products: Record<string, number>
  warehouses: Record<string, number>
  paymentMethods: Record<string, number>
}

export interface MetricsFacts {
  firstPurchaseAt: Date | null
  lastPurchaseAt: Date | null
  ordersCount: number
  totalSpend: Prisma.Decimal
  returnsCount: number
  returnsValue: Prisma.Decimal
  visitCount: number
  favorites: FavoriteCounters
}

export interface FoldableEvent {
  eventType: string
  payloadJson: unknown
  occurredAt: Date
}

export function emptyMetricsFacts(): MetricsFacts {
  return {
    firstPurchaseAt: null,
    lastPurchaseAt: null,
    ordersCount: 0,
    totalSpend: new Prisma.Decimal(0),
    returnsCount: 0,
    returnsValue: new Prisma.Decimal(0),
    visitCount: 0,
    favorites: { products: {}, warehouses: {}, paymentMethods: {} },
  }
}

interface SalePayload {
  grandTotal?: string
  warehouseId?: string
  paymentMethods?: Array<string>
  lines?: Array<{ productId?: string }>
}

interface RefundPayload {
  amount?: string
  refundTotal?: string
}

function bump(counter: Record<string, number>, key: string | undefined, by = 1) {
  if (!key) {
    return counter
  }

  return { ...counter, [key]: (counter[key] ?? 0) + by }
}

// Returns the next facts, or null when the event does not affect metrics.
export function foldEvent(facts: MetricsFacts, event: FoldableEvent): MetricsFacts | null {
  switch (event.eventType) {
    case 'pos_sale.completed':
    case 'sales_order.fulfilled': {
      const payload = event.payloadJson as SalePayload
      const total = new Prisma.Decimal(payload.grandTotal ?? 0)

      let products = facts.favorites.products

      for (const line of payload.lines ?? []) {
        products = bump(products, line.productId)
      }

      return {
        ...facts,
        firstPurchaseAt: facts.firstPurchaseAt ?? event.occurredAt,
        lastPurchaseAt:
          !facts.lastPurchaseAt || event.occurredAt > facts.lastPurchaseAt
            ? event.occurredAt
            : facts.lastPurchaseAt,
        ordersCount: facts.ordersCount + 1,
        totalSpend: facts.totalSpend.plus(total),
        visitCount: facts.visitCount + 1,
        favorites: {
          products,
          warehouses: bump(facts.favorites.warehouses, payload.warehouseId),
          paymentMethods: (payload.paymentMethods ?? []).reduce(
            (counters, method) => bump(counters, method),
            facts.favorites.paymentMethods
          ),
        },
      }
    }
    case 'pos_sale.refunded':
    case 'sales_return.credited': {
      const payload = event.payloadJson as RefundPayload
      const amount = new Prisma.Decimal(payload.amount ?? payload.refundTotal ?? 0)

      return {
        ...facts,
        returnsCount: facts.returnsCount + 1,
        returnsValue: facts.returnsValue.plus(amount),
      }
    }
    default:
      return null
  }
}

export function averageOrderValue(facts: MetricsFacts): Prisma.Decimal {
  if (facts.ordersCount === 0) {
    return new Prisma.Decimal(0)
  }

  return facts.totalSpend.dividedBy(facts.ordersCount).toDecimalPlaces(4)
}

export function topKey(counter: Record<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0

  for (const [key, count] of Object.entries(counter)) {
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }

  return best
}

// Simple CLV heuristic: annualized spend rate over the observed lifetime,
// projected over a 3-year horizon (documented in specs/003-crm/plan.md).
export function estimateClv(facts: MetricsFacts, now: Date): Prisma.Decimal {
  if (!facts.firstPurchaseAt || facts.ordersCount === 0) {
    return new Prisma.Decimal(0)
  }

  const lifetimeDays = Math.max(
    1,
    (now.getTime() - facts.firstPurchaseAt.getTime()) / 86_400_000
  )
  const dailyRate = facts.totalSpend.dividedBy(lifetimeDays)

  return dailyRate.times(365 * 3).toDecimalPlaces(4)
}

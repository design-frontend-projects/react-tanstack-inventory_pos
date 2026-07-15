// Pure RFM (recency / frequency / monetary) scoring. v1 uses static
// per-tenant-agnostic thresholds (documented in specs/003-crm/plan.md); a
// tenant-distribution-based quintile refresh is the documented upgrade path.

export interface RfmThresholds {
  // Days-since-last-purchase upper bounds for scores 5..2 (beyond last = 1).
  recencyDays: [number, number, number, number]
  // Order-count lower bounds for scores 5..2 (below last = 1).
  frequency: [number, number, number, number]
  // Total-spend lower bounds for scores 5..2 (below last = 1).
  monetary: [number, number, number, number]
}

export const DEFAULT_RFM_THRESHOLDS: RfmThresholds = {
  recencyDays: [14, 45, 90, 180],
  frequency: [20, 10, 4, 2],
  monetary: [5000, 2000, 500, 100],
}

export interface RfmInput {
  lastPurchaseAt: Date | null
  ordersCount: number
  totalSpend: number
  now: Date
}

export interface RfmScore {
  recency: number
  frequency: number
  monetary: number
  segment: string
}

function scoreRecency(days: number, bounds: RfmThresholds['recencyDays']): number {
  if (days <= bounds[0]) return 5
  if (days <= bounds[1]) return 4
  if (days <= bounds[2]) return 3
  if (days <= bounds[3]) return 2

  return 1
}

function scoreByFloor(value: number, floors: [number, number, number, number]): number {
  if (value >= floors[0]) return 5
  if (value >= floors[1]) return 4
  if (value >= floors[2]) return 3
  if (value >= floors[3]) return 2

  return 1
}

export function labelRfmSegment(recency: number, frequency: number, monetary: number): string {
  const value = Math.max(frequency, monetary)

  if (recency >= 4 && value >= 4) return 'champion'
  if (recency >= 4 && value >= 2) return 'loyal'
  if (recency >= 4) return 'new'
  if (recency === 3 && value >= 3) return 'potential_loyalist'
  if (recency === 3) return 'needs_attention'
  if (recency === 2 && value >= 3) return 'at_risk'
  if (recency === 2) return 'about_to_sleep'
  if (value >= 4) return 'cant_lose'

  return 'hibernating'
}

export function scoreRfm(
  input: RfmInput,
  thresholds: RfmThresholds = DEFAULT_RFM_THRESHOLDS
): RfmScore | null {
  if (!input.lastPurchaseAt || input.ordersCount === 0) {
    return null
  }

  const days = (input.now.getTime() - input.lastPurchaseAt.getTime()) / 86_400_000
  const recency = scoreRecency(days, thresholds.recencyDays)
  const frequency = scoreByFloor(input.ordersCount, thresholds.frequency)
  const monetary = scoreByFloor(input.totalSpend, thresholds.monetary)

  return {
    recency,
    frequency,
    monetary,
    segment: labelRfmSegment(recency, frequency, monetary),
  }
}

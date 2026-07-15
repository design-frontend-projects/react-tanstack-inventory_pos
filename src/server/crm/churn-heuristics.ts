// Deterministic churn-risk heuristic ('heuristic-v1'): compares the days since
// the last purchase to the customer's own expected purchase interval and
// squashes the ratio into [0, 1). Pure — the first producer for the AI-ready
// crm_customer_scores contract (real models replace it without schema change).

export const CHURN_MODEL_NAME = 'heuristic-v1'

export interface ChurnInput {
  firstPurchaseAt: Date | null
  lastPurchaseAt: Date | null
  ordersCount: number
  now: Date
}

const DEFAULT_INTERVAL_DAYS = 90

export function computeChurnScore(input: ChurnInput): number | null {
  if (!input.lastPurchaseAt || input.ordersCount === 0) {
    return null
  }

  const daysSinceLast =
    (input.now.getTime() - input.lastPurchaseAt.getTime()) / 86_400_000

  // Expected interval: observed average gap between purchases, floored at a
  // week; single-purchase customers fall back to the default window.
  let expectedInterval = DEFAULT_INTERVAL_DAYS

  if (input.firstPurchaseAt && input.ordersCount > 1) {
    const lifetimeDays =
      (input.lastPurchaseAt.getTime() - input.firstPurchaseAt.getTime()) / 86_400_000
    expectedInterval = Math.max(7, lifetimeDays / (input.ordersCount - 1))
  }

  const ratio = daysSinceLast / expectedInterval

  // ratio 0 → 0 risk; ratio 1 (right on schedule) → 0.5; grows asymptotically to 1.
  const score = ratio / (ratio + 1)

  return Math.round(score * 1_000_000) / 1_000_000
}

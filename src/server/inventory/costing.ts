import { Prisma } from '#/server/db/generated/prisma/client'

// Moving Weighted Average costing — pure functions over Prisma.Decimal so they
// are trivially unit-testable and free of I/O. The maintained invariant is
// `totalValue == onHand * avgUnitCost`. Receipts change the average; issues never
// do (they leave at the current average and the value follows on-hand).

export type Decimalish = Prisma.Decimal | string | number

export interface CostState {
  onHand: Prisma.Decimal
  avgUnitCost: Prisma.Decimal
  totalValue: Prisma.Decimal
}

export function toDecimal(value: Decimalish): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

const ZERO = new Prisma.Decimal(0)

// Receipt of `qty` at `unitCost`: recompute the weighted-average unit cost.
export function applyReceipt(
  state: CostState,
  qty: Decimalish,
  unitCost: Decimalish
): CostState {
  const q = toDecimal(qty)
  const c = toDecimal(unitCost)
  const newOnHand = state.onHand.plus(q)
  const newTotalValue = state.totalValue.plus(q.times(c))
  const newAvg = newOnHand.gt(ZERO) ? newTotalValue.div(newOnHand) : ZERO

  return { onHand: newOnHand, avgUnitCost: newAvg, totalValue: newTotalValue }
}

// Issue of `qty`: the average is unchanged; the issue is costed at that average.
// Value tracks on-hand so the invariant holds; at exactly zero on-hand the
// average resets to avoid carrying a stale cost into an empty balance.
export function applyIssue(
  state: CostState,
  qty: Decimalish
): { state: CostState; issueUnitCost: Prisma.Decimal } {
  const q = toDecimal(qty)
  const issueUnitCost = state.avgUnitCost
  const newOnHand = state.onHand.minus(q)

  if (newOnHand.eq(ZERO)) {
    return {
      state: { onHand: ZERO, avgUnitCost: ZERO, totalValue: ZERO },
      issueUnitCost,
    }
  }

  return {
    state: {
      onHand: newOnHand,
      avgUnitCost: state.avgUnitCost,
      totalValue: newOnHand.times(state.avgUnitCost),
    },
    issueUnitCost,
  }
}

// Signed application used by the engine: `direction` decides receipt vs issue.
// Returns the resulting state plus the unit cost to stamp on the movement
// (receipt cost for IN, average cost for OUT).
export function applyMovement(
  state: CostState,
  direction: 'IN' | 'OUT',
  qty: Decimalish,
  unitCost: Decimalish | null
): { state: CostState; movementUnitCost: Prisma.Decimal } {
  if (direction === 'IN') {
    const cost = toDecimal(unitCost ?? state.avgUnitCost)

    return { state: applyReceipt(state, qty, cost), movementUnitCost: cost }
  }

  const issued = applyIssue(state, qty)

  return { state: issued.state, movementUnitCost: issued.issueUnitCost }
}

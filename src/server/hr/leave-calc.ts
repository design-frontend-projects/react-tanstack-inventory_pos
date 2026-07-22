// Pure leave-day computation — no I/O — so it is unit-testable. Leave duration
// is inclusive of both endpoints; a half-day request is always 0.5 days.

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function computeLeaveDays(
  start: Date,
  end: Date,
  isHalfDay = false,
): number {
  if (isHalfDay) {
    return 0.5
  }

  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  )
  const endUtc = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  )
  const diff = Math.round((endUtc - startUtc) / MS_PER_DAY)
  return diff < 0 ? 0 : diff + 1
}

// Available balance = current balance minus already-pending holds. Used to gate
// paid leave so an employee cannot over-draw (BR-LEAVE).
export function availableBalance(balance: {
  balanceDays: number | string
  pendingDays: number | string
}): number {
  return Number(balance.balanceDays) - Number(balance.pendingDays)
}

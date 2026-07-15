import type {
  InventoryMovement,
  StockAdjustment,
  StockAdjustmentLine,
  StockBalance,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns so ledger reads are JSON-serializable across the
// server-function boundary (see catalog-dto.ts for the rationale).

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeBalance(balance: StockBalance) {
  return {
    ...balance,
    onHand: balance.onHand.toString(),
    reserved: balance.reserved.toString(),
    allocated: balance.allocated.toString(),
    damaged: balance.damaged.toString(),
    expired: balance.expired.toString(),
    inTransit: balance.inTransit.toString(),
    returned: balance.returned.toString(),
    avgUnitCost: balance.avgUnitCost.toString(),
    totalValue: balance.totalValue.toString(),
    available: balance.onHand
      .minus(balance.reserved)
      .minus(balance.allocated)
      .toString(),
  }
}

export function serializeMovement(movement: InventoryMovement) {
  return {
    ...movement,
    qtyDelta: movement.qtyDelta.toString(),
    qtyInBaseUom: movement.qtyInBaseUom.toString(),
    unitCost: movement.unitCost.toString(),
    totalCost: movement.totalCost.toString(),
    runningOnHand: movement.runningOnHand.toString(),
    runningAvgCost: movement.runningAvgCost.toString(),
  }
}

function serializeAdjustmentLine(line: StockAdjustmentLine) {
  return {
    ...line,
    systemQty: line.systemQty.toString(),
    adjustedQty: line.adjustedQty.toString(),
    qtyDelta: line.qtyDelta.toString(),
    unitCost: dec(line.unitCost),
  }
}

export function serializeAdjustment(
  adjustment: StockAdjustment & { lines: Array<StockAdjustmentLine> }
) {
  return {
    ...adjustment,
    lines: adjustment.lines.map(serializeAdjustmentLine),
  }
}

import {
  serializeBalance,
  serializeMovement,
} from '#/server/inventory/inventory-dto'
import * as balanceRepo from '#/server/repos/stock-balance-repo'
import * as movementRepo from '#/server/repos/movement-repo'
import type { CurrentUserContext } from '#/types/auth'

// Read side of the ledger: current balances, movement history, and product-level
// stock summaries. Writes only ever happen through the movement engine.

export async function listStock(
  _context: CurrentUserContext,
  tenantId: string,
  filters: balanceRepo.ListBalanceFilters
) {
  const balances = await balanceRepo.listBalances(tenantId, filters)

  return balances.map(serializeBalance)
}

export async function listMovements(
  _context: CurrentUserContext,
  tenantId: string,
  filters: movementRepo.ListMovementFilters
) {
  const movements = await movementRepo.listMovements(tenantId, filters)

  return movements.map(serializeMovement)
}

export async function getProductStockSummary(
  _context: CurrentUserContext,
  tenantId: string,
  productId: string
) {
  const summary = await balanceRepo.summarizeProductStock(tenantId, productId)

  return {
    productId,
    onHand: summary.onHand.toString(),
    reserved: summary.reserved.toString(),
    allocated: summary.allocated.toString(),
    available: summary.onHand
      .minus(summary.reserved)
      .minus(summary.allocated)
      .toString(),
    totalValue: summary.totalValue.toString(),
  }
}

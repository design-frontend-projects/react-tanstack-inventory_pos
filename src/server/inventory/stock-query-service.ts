import {
  serializeBalance,
  serializeMovement,
} from '#/server/inventory/inventory-dto'
import { prisma } from '#/server/db/client'
import * as balanceRepo from '#/server/repos/stock-balance-repo'
import * as movementRepo from '#/server/repos/movement-repo'
import type { CurrentUserContext } from '#/types/auth'

// Read side of the ledger: current balances, movement history, and product-level
// stock summaries. Writes only ever happen through the movement engine.

interface NameRef {
  productIds: Array<string>
  warehouseIds: Array<string>
  locationIds?: Array<string>
}

// The ledger tables reference catalog rows by soft UUID FKs (no Prisma
// relations by design), so list reads batch-resolve display names here instead
// of forcing the client into N follow-up lookups.
async function resolveNames(tenantId: string, refs: NameRef) {
  const [products, warehouses, locations] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, id: { in: [...new Set(refs.productIds)] } },
      select: { id: true, sku: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { tenantId, id: { in: [...new Set(refs.warehouseIds)] } },
      select: { id: true, code: true, name: true },
    }),
    refs.locationIds
      ? prisma.warehouseLocation.findMany({
          where: { tenantId, id: { in: [...new Set(refs.locationIds)] } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
  ])

  return {
    products: new Map(products.map((product) => [product.id, product])),
    warehouses: new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse]),
    ),
    locations: new Map(locations.map((location) => [location.id, location])),
  }
}

export async function listStock(
  _context: CurrentUserContext,
  tenantId: string,
  filters: balanceRepo.ListBalanceFilters,
) {
  const balances = await balanceRepo.listBalances(tenantId, filters)
  const names = await resolveNames(tenantId, {
    productIds: balances.map((balance) => balance.productId),
    warehouseIds: balances.map((balance) => balance.warehouseId),
    locationIds: balances.map((balance) => balance.locationId),
  })

  return balances.map((balance) => ({
    ...serializeBalance(balance),
    product: names.products.get(balance.productId) ?? null,
    warehouse: names.warehouses.get(balance.warehouseId) ?? null,
    location: names.locations.get(balance.locationId) ?? null,
  }))
}

export async function listMovements(
  _context: CurrentUserContext,
  tenantId: string,
  filters: movementRepo.ListMovementFilters,
) {
  const movements = await movementRepo.listMovements(tenantId, filters)
  const names = await resolveNames(tenantId, {
    productIds: movements.map((movement) => movement.productId),
    warehouseIds: movements.map((movement) => movement.warehouseId),
  })

  return movements.map((movement) => ({
    ...serializeMovement(movement),
    product: names.products.get(movement.productId) ?? null,
    warehouse: names.warehouses.get(movement.warehouseId) ?? null,
  }))
}

export async function getProductStockSummary(
  _context: CurrentUserContext,
  tenantId: string,
  productId: string,
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

import { Prisma } from '#/server/db/generated/prisma/client'
import { postMovement } from '#/server/inventory/movement-engine'
import * as recipeRepo from '#/server/repos/res-recipe-repo'

// Explodes an order's items into inventory OUT movements via their recipes.
// Menu items never own stock — consumption flows menu item -> recipe -> product.
//
// Scope note: LOT/SERIAL-tracked ingredients require an explicit lot/serial pick
// (FEFO auto-allocation is a planned enhancement), so they are skipped here and
// reported in `skipped`; NONE-tracked ingredients are consumed automatically.
// Requires the order to carry a warehouseId + locationId (its branch's stock
// source); otherwise nothing is consumed (a non-stock-tracked branch).

export interface ConsumeOrderInput {
  tenantId: string
  order: {
    id: string
    orderNumber: string
    warehouseId: string | null
    locationId: string | null
  }
  items: ReadonlyArray<{
    id: string
    menuItemId: string
    quantity: Prisma.Decimal | string
  }>
  performedByProfileId: string
}

export interface ConsumeResult {
  movements: Array<{ productId: string; quantity: string; movementId: string }>
  skipped: Array<{ productId: string; reason: string }>
}

const ONE = new Prisma.Decimal(1)

export async function consumeOrderInventory(
  tx: Prisma.TransactionClient,
  input: ConsumeOrderInput,
): Promise<ConsumeResult> {
  const result: ConsumeResult = { movements: [], skipped: [] }

  if (!input.order.warehouseId || !input.order.locationId) {
    return result
  }

  for (const item of input.items) {
    const itemQty = new Prisma.Decimal(item.quantity)

    // Resolve the item's approved recipe and its current version's lines.
    const recipes = await recipeRepo.listRecipes(
      input.tenantId,
      { menuItemId: item.menuItemId, status: 'APPROVED' },
      tx,
    )
    if (recipes.length === 0) {
      continue // no recipe -> nothing to consume (e.g. a non-stock menu item)
    }
    const active = recipes[0]
    if (!active.currentVersionId) {
      continue
    }

    const lines = await recipeRepo.listLines(
      input.tenantId,
      active.currentVersionId,
      tx,
    )
    if (lines.length === 0) {
      continue
    }

    const productIds = [...new Set(lines.map((l) => l.productId))]
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId: input.tenantId },
      select: {
        id: true,
        baseUomId: true,
        trackingPolicy: true,
        isStockTracked: true,
      },
    })
    const productById = new Map(products.map((p) => [p.id, p]))

    for (const line of lines) {
      if (line.isOptional) {
        continue
      }
      const product = productById.get(line.productId)
      if (!product || !product.isStockTracked) {
        continue
      }
      if (product.trackingPolicy !== 'NONE') {
        result.skipped.push({
          productId: line.productId,
          reason: `tracking policy ${product.trackingPolicy} requires explicit lot/serial pick`,
        })
        continue
      }

      const waste = new Prisma.Decimal(line.wastePercent)
      const consumeQty = itemQty.times(line.quantity).times(ONE.plus(waste))
      if (consumeQty.lte(0)) {
        continue
      }

      const movement = await postMovement(tx, {
        tenantId: input.tenantId,
        productId: line.productId,
        variantId: line.variantId ?? null,
        movementType: 'SALE',
        direction: 'OUT',
        quantity: consumeQty,
        uomId: line.uomId ?? product.baseUomId,
        warehouseId: input.order.warehouseId,
        locationId: input.order.locationId,
        sourceDocType: 'RESTAURANT_ORDER',
        sourceDocId: input.order.id,
        sourceDocLineId: item.id,
        sourceDocNumber: input.order.orderNumber,
        performedByProfileId: input.performedByProfileId,
        trackingPolicy: product.trackingPolicy,
        allowNegative: true,
      })

      result.movements.push({
        productId: line.productId,
        quantity: consumeQty.toString(),
        movementId: movement.movementId,
      })
    }
  }

  return result
}

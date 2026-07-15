import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface CostLayerCreateInput {
  tenantId: string
  productId: string
  variantId?: string | null
  locationId: string
  lotId?: string | null
  sourceMovementId: string
  receivedAt: Date
  originalQty: Prisma.Decimal
  unitCost: Prisma.Decimal
  landedCostPerUnit?: Prisma.Decimal
}

// A cost layer is written on every receipt. Under Moving Weighted Average the
// layers are recorded but not consumed; they make a future switch to FIFO/landed
// costing a data-ready change rather than a backfill.
export function createCostLayer(
  input: CostLayerCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.costLayer.create({
    data: {
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      locationId: input.locationId,
      lotId: input.lotId ?? null,
      sourceMovementId: input.sourceMovementId,
      receivedAt: input.receivedAt,
      originalQty: input.originalQty,
      remainingQty: input.originalQty,
      unitCost: input.unitCost,
      ...(input.landedCostPerUnit ? { landedCostPerUnit: input.landedCostPerUnit } : {}),
    },
  })
}

export function listCostLayers(
  tenantId: string,
  productId: string,
  locationId: string,
  client: PrismaClientLike = prisma
) {
  return client.costLayer.findMany({
    where: { tenantId, productId, locationId, isDepleted: false },
    orderBy: { receivedAt: 'asc' },
  })
}

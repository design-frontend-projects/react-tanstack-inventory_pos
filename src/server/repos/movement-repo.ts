import { prisma } from '#/server/db/client'
import type {
  MovementType,
  Prisma,
  SourceDocType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface MovementCreateInput {
  tenantId: string
  movementType: MovementType
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  counterpartyLocationId?: string | null
  lotId?: string | null
  serialId?: string | null
  qtyDelta: Prisma.Decimal
  uomId: string
  qtyInBaseUom: Prisma.Decimal
  unitCost: Prisma.Decimal
  totalCost: Prisma.Decimal
  runningOnHand: Prisma.Decimal
  runningAvgCost: Prisma.Decimal
  sourceDocType: SourceDocType
  sourceDocId?: string | null
  sourceDocLineId?: string | null
  sourceDocNumber?: string | null
  performedByProfileId: string
  occurredAt?: Date
  correlationId?: string | null
  notes?: string | null
}

// Append-only: movements are inserted, never updated or deleted. Corrections are
// new (reversal) rows.
export function createMovement(
  input: MovementCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.inventoryMovement.create({
    data: {
      tenantId: input.tenantId,
      movementType: input.movementType,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      counterpartyLocationId: input.counterpartyLocationId ?? null,
      lotId: input.lotId ?? null,
      serialId: input.serialId ?? null,
      qtyDelta: input.qtyDelta,
      uomId: input.uomId,
      qtyInBaseUom: input.qtyInBaseUom,
      unitCost: input.unitCost,
      totalCost: input.totalCost,
      runningOnHand: input.runningOnHand,
      runningAvgCost: input.runningAvgCost,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId ?? null,
      sourceDocLineId: input.sourceDocLineId ?? null,
      sourceDocNumber: input.sourceDocNumber ?? null,
      performedByProfileId: input.performedByProfileId,
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      correlationId: input.correlationId ?? null,
      notes: input.notes ?? null,
    },
  })
}

export interface ListMovementFilters {
  productId?: string
  warehouseId?: string
  movementType?: MovementType
  sourceDocType?: SourceDocType
  sourceDocId?: string
  take?: number
  skip?: number
}

export function listMovements(
  tenantId: string,
  filters: ListMovementFilters = {},
  client: PrismaClientLike = prisma
) {
  return client.inventoryMovement.findMany({
    where: {
      tenantId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      ...(filters.movementType ? { movementType: filters.movementType } : {}),
      ...(filters.sourceDocType ? { sourceDocType: filters.sourceDocType } : {}),
      ...(filters.sourceDocId ? { sourceDocId: filters.sourceDocId } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    take: filters.take ?? 100,
    skip: filters.skip ?? 0,
  })
}

// Reconciliation helper: the ledger sum for a grain must equal the balance.
export async function sumQtyDelta(
  tenantId: string,
  productId: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.inventoryMovement.aggregate({
    where: { tenantId, productId },
    _sum: { qtyDelta: true },
  })

  return result._sum.qtyDelta ?? null
}

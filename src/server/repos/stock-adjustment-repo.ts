import { prisma } from '#/server/db/client'
import type {
  AdjustmentReason,
  AdjustmentStatus,
  Prisma,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface AdjustmentLineInput {
  productId: string
  variantId?: string | null
  locationId: string
  lotId?: string | null
  serialId?: string | null
  uomId: string
  systemQty?: Prisma.Decimal | string | number
  adjustedQty: Prisma.Decimal | string | number
  qtyDelta: Prisma.Decimal | string | number
  unitCost?: Prisma.Decimal | string | number | null
  reason?: string | null
}

export interface AdjustmentCreateInput {
  documentNumber: string
  warehouseId: string
  reasonCode: AdjustmentReason
  notes?: string | null
  createdByProfileId?: string | null
  correlationId?: string | null
  lines: Array<AdjustmentLineInput>
}

const adjustmentWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.StockAdjustmentInclude

export type AdjustmentWithLines = Prisma.StockAdjustmentGetPayload<{
  include: typeof adjustmentWithLines
}>

export function findAdjustmentById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<AdjustmentWithLines | null> {
  return client.stockAdjustment.findFirst({
    where: { id, tenantId },
    include: adjustmentWithLines,
  })
}

export function listAdjustments(
  tenantId: string,
  filters: { status?: AdjustmentStatus; warehouseId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.stockAdjustment.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createAdjustment(
  tenantId: string,
  input: AdjustmentCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.stockAdjustment.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      warehouseId: input.warehouseId,
      reasonCode: input.reasonCode,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      correlationId: input.correlationId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          locationId: line.locationId,
          lotId: line.lotId ?? null,
          serialId: line.serialId ?? null,
          uomId: line.uomId,
          systemQty: line.systemQty ?? 0,
          adjustedQty: line.adjustedQty,
          qtyDelta: line.qtyDelta,
          unitCost: line.unitCost ?? null,
          reason: line.reason ?? null,
        })),
      },
    },
    include: adjustmentWithLines,
  })
}

export async function updateAdjustmentStatus(
  tenantId: string,
  id: string,
  status: AdjustmentStatus,
  extra: Partial<{
    approvedByProfileId: string
    isPosted: boolean
    postedAt: Date
    postedByProfileId: string
  }> = {},
  client: PrismaClientLike = prisma
) {
  const result = await client.stockAdjustment.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })

  return result.count > 0
}

import { prisma } from '#/server/db/client'
import type {
  Prisma,
  PurchaseReturnStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface PurchaseReturnLineInput {
  productId: string
  variantId?: string | null
  fromLocationId: string
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitCost?: Prisma.Decimal | string | number | null
  lotId?: string | null
  serialId?: string | null
}

export interface PurchaseReturnCreateInput {
  documentNumber: string
  supplierId: string
  warehouseId: string
  purchaseOrderId?: string | null
  reason?: string | null
  createdByProfileId?: string | null
  lines: Array<PurchaseReturnLineInput>
}

const returnWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.PurchaseReturnInclude

export type PurchaseReturnWithLines = Prisma.PurchaseReturnGetPayload<{
  include: typeof returnWithLines
}>

export function findPurchaseReturnById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<PurchaseReturnWithLines | null> {
  return client.purchaseReturn.findFirst({
    where: { id, tenantId },
    include: returnWithLines,
  })
}

export function listPurchaseReturns(
  tenantId: string,
  filters: { status?: PurchaseReturnStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.purchaseReturn.findMany({
    where: { tenantId, ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createPurchaseReturn(
  tenantId: string,
  input: PurchaseReturnCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.purchaseReturn.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      reason: input.reason ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          fromLocationId: line.fromLocationId,
          uomId: line.uomId,
          quantity: line.quantity,
          unitCost: line.unitCost ?? null,
          lotId: line.lotId ?? null,
          serialId: line.serialId ?? null,
        })),
      },
    },
    include: returnWithLines,
  })
}

export async function markReturnPosted(
  tenantId: string,
  id: string,
  postedByProfileId: string,
  status: PurchaseReturnStatus = 'SHIPPED',
  client: PrismaClientLike = prisma
) {
  const result = await client.purchaseReturn.updateMany({
    where: { id, tenantId },
    data: { status, isPosted: true, postedAt: new Date(), postedByProfileId },
  })

  return result.count > 0
}

import { prisma } from '#/server/db/client'
import type {
  Prisma,
  RequisitionStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface RequisitionLineInput {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  notes?: string | null
}

export interface RequisitionCreateInput {
  documentNumber: string
  warehouseId?: string | null
  notes?: string | null
  requestedByProfileId?: string | null
  lines: Array<RequisitionLineInput>
}

const requisitionWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.PurchaseRequisitionInclude

export type RequisitionWithLines = Prisma.PurchaseRequisitionGetPayload<{
  include: typeof requisitionWithLines
}>

export function findRequisitionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<RequisitionWithLines | null> {
  return client.purchaseRequisition.findFirst({
    where: { id, tenantId },
    include: requisitionWithLines,
  })
}

export function listRequisitions(
  tenantId: string,
  filters: { status?: RequisitionStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.purchaseRequisition.findMany({
    where: { tenantId, ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createRequisition(
  tenantId: string,
  input: RequisitionCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.purchaseRequisition.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      warehouseId: input.warehouseId ?? null,
      notes: input.notes ?? null,
      requestedByProfileId: input.requestedByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          uomId: line.uomId,
          quantity: line.quantity,
          notes: line.notes ?? null,
        })),
      },
    },
    include: requisitionWithLines,
  })
}

export async function updateRequisitionStatus(
  tenantId: string,
  id: string,
  status: RequisitionStatus,
  extra: Partial<{ approvedByProfileId: string; convertedToPoId: string }> = {},
  client: PrismaClientLike = prisma
) {
  const result = await client.purchaseRequisition.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })

  return result.count > 0
}

import { prisma } from '#/server/db/client'
import type { Prisma, ReceiptStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface GoodsReceiptLineInput {
  purchaseOrderLineId?: string | null
  productId: string
  variantId?: string | null
  toLocationId: string
  uomId: string
  receivedQty: Prisma.Decimal | string | number
  acceptedQty: Prisma.Decimal | string | number
  rejectedQty?: Prisma.Decimal | string | number
  unitCost: Prisma.Decimal | string | number
  lotNumber?: string | null
  expiryDate?: Date | null
  serialNumbers?: Array<string>
}

export interface GoodsReceiptCreateInput {
  documentNumber: string
  purchaseOrderId?: string | null
  supplierId: string
  warehouseId: string
  receiptDate?: Date
  supplierDeliveryNote?: string | null
  createdByProfileId?: string | null
  lines: Array<GoodsReceiptLineInput>
}

const receiptWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.GoodsReceiptInclude

export type GoodsReceiptWithLines = Prisma.GoodsReceiptGetPayload<{
  include: typeof receiptWithLines
}>

export function findGoodsReceiptById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<GoodsReceiptWithLines | null> {
  return client.goodsReceipt.findFirst({
    where: { id, tenantId },
    include: receiptWithLines,
  })
}

export function listGoodsReceipts(
  tenantId: string,
  filters: { status?: ReceiptStatus; purchaseOrderId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.goodsReceipt.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.purchaseOrderId ? { purchaseOrderId: filters.purchaseOrderId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createGoodsReceipt(
  tenantId: string,
  input: GoodsReceiptCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.goodsReceipt.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      purchaseOrderId: input.purchaseOrderId ?? null,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      ...(input.receiptDate ? { receiptDate: input.receiptDate } : {}),
      supplierDeliveryNote: input.supplierDeliveryNote ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          productId: line.productId,
          variantId: line.variantId ?? null,
          toLocationId: line.toLocationId,
          uomId: line.uomId,
          receivedQty: line.receivedQty,
          acceptedQty: line.acceptedQty,
          rejectedQty: line.rejectedQty ?? 0,
          unitCost: line.unitCost,
          lotNumber: line.lotNumber ?? null,
          expiryDate: line.expiryDate ?? null,
          serialNumbers: line.serialNumbers ?? [],
        })),
      },
    },
    include: receiptWithLines,
  })
}

export async function markReceiptPosted(
  tenantId: string,
  id: string,
  postedByProfileId: string,
  status: ReceiptStatus = 'COMPLETED',
  client: PrismaClientLike = prisma
) {
  const result = await client.goodsReceipt.updateMany({
    where: { id, tenantId },
    data: { status, isPosted: true, postedAt: new Date(), postedByProfileId },
  })

  return result.count > 0
}

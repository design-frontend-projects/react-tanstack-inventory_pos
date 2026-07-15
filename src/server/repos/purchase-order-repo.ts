import { prisma } from '#/server/db/client'
import type {
  Prisma,
  PurchaseOrderStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface PurchaseOrderLineInput {
  productId: string
  variantId?: string | null
  uomId: string
  orderedQty: Prisma.Decimal | string | number
  unitCost: Prisma.Decimal | string | number
  taxRateId?: string | null
  taxAmount?: Prisma.Decimal | string | number
  lineTotal: Prisma.Decimal | string | number
  expectedDate?: Date | null
}

export interface PurchaseOrderCreateInput {
  documentNumber: string
  supplierId: string
  warehouseId: string
  orderDate?: Date
  expectedDate?: Date | null
  currencyCode?: string
  subtotal: Prisma.Decimal | string | number
  taxTotal: Prisma.Decimal | string | number
  grandTotal: Prisma.Decimal | string | number
  notes?: string | null
  paymentTerms?: string | null
  requisitionId?: string | null
  createdByProfileId?: string | null
  lines: Array<PurchaseOrderLineInput>
}

const poWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.PurchaseOrderInclude

export type PurchaseOrderWithLines = Prisma.PurchaseOrderGetPayload<{
  include: typeof poWithLines
}>

export function findPurchaseOrderById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<PurchaseOrderWithLines | null> {
  return client.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: poWithLines,
  })
}

export function listPurchaseOrders(
  tenantId: string,
  filters: { status?: PurchaseOrderStatus; supplierId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.purchaseOrder.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    },
    orderBy: { orderDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createPurchaseOrder(
  tenantId: string,
  input: PurchaseOrderCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.purchaseOrder.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      ...(input.orderDate ? { orderDate: input.orderDate } : {}),
      expectedDate: input.expectedDate ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      subtotal: input.subtotal,
      taxTotal: input.taxTotal,
      grandTotal: input.grandTotal,
      notes: input.notes ?? null,
      paymentTerms: input.paymentTerms ?? null,
      requisitionId: input.requisitionId ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          uomId: line.uomId,
          orderedQty: line.orderedQty,
          unitCost: line.unitCost,
          taxRateId: line.taxRateId ?? null,
          taxAmount: line.taxAmount ?? 0,
          lineTotal: line.lineTotal,
          expectedDate: line.expectedDate ?? null,
        })),
      },
    },
    include: poWithLines,
  })
}

export async function updatePurchaseOrderStatus(
  tenantId: string,
  id: string,
  status: PurchaseOrderStatus,
  extra: Partial<{ approvedByProfileId: string }> = {},
  client: PrismaClientLike = prisma
) {
  const result = await client.purchaseOrder.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })

  return result.count > 0
}

export function incrementLineReceivedQty(
  lineId: string,
  delta: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.purchaseOrderLine.update({
    where: { id: lineId },
    data: { receivedQty: { increment: delta } },
  })
}

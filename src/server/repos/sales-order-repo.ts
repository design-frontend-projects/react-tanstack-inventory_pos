import { prisma } from '#/server/db/client'
import type { Prisma, SalesOrderStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SalesOrderLineInput {
  productId: string
  variantId?: string | null
  locationId: string
  uomId: string
  orderedQty: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  lineTotal: Prisma.Decimal | string | number
}

export interface SalesOrderCreateInput {
  documentNumber: string
  customerId?: string | null
  warehouseId: string
  requestedDeliveryDate?: Date | null
  currencyCode?: string
  subtotal: Prisma.Decimal | string | number
  discountTotal: Prisma.Decimal | string | number
  taxTotal: Prisma.Decimal | string | number
  grandTotal: Prisma.Decimal | string | number
  notes?: string | null
  priceListId?: string | null
  salesRepProfileId?: string | null
  createdByProfileId?: string | null
  lines: Array<SalesOrderLineInput>
}

const orderWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.SalesOrderInclude

export type SalesOrderWithLines = Prisma.SalesOrderGetPayload<{
  include: typeof orderWithLines
}>

export function findSalesOrderById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<SalesOrderWithLines | null> {
  return client.salesOrder.findFirst({
    where: { id, tenantId },
    include: orderWithLines,
  })
}

export function listSalesOrders(
  tenantId: string,
  filters: { status?: SalesOrderStatus; customerId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.salesOrder.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { orderDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createSalesOrder(
  tenantId: string,
  input: SalesOrderCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.salesOrder.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      customerId: input.customerId ?? null,
      warehouseId: input.warehouseId,
      requestedDeliveryDate: input.requestedDeliveryDate ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      grandTotal: input.grandTotal,
      notes: input.notes ?? null,
      priceListId: input.priceListId ?? null,
      salesRepProfileId: input.salesRepProfileId ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          locationId: line.locationId,
          uomId: line.uomId,
          orderedQty: line.orderedQty,
          unitPrice: line.unitPrice,
          discount: line.discount ?? 0,
          taxAmount: line.taxAmount ?? 0,
          lineTotal: line.lineTotal,
        })),
      },
    },
    include: orderWithLines,
  })
}

export async function updateSalesOrderStatus(
  tenantId: string,
  id: string,
  status: SalesOrderStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.salesOrder.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

export function setLineFulfilled(
  lineId: string,
  data: {
    fulfilledQty: Prisma.Decimal | string | number
    costAtSale: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  return client.salesOrderLine.update({
    where: { id: lineId },
    data: { fulfilledQty: data.fulfilledQty, costAtSale: data.costAtSale },
  })
}

export function setLineReserved(
  lineId: string,
  reservedQty: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.salesOrderLine.update({
    where: { id: lineId },
    data: { reservedQty },
  })
}

import { prisma } from '#/server/db/client'
import type {
  PaymentMethod,
  PosOrderType,
  PosSaleStatus,
  Prisma,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface PosSaleLineInput {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  lineTotal: Prisma.Decimal | string | number
  itemNameSnapshot?: string | null
  skuSnapshot?: string | null
}

export interface PosSaleCreateInput {
  documentNumber: string
  posSessionId?: string | null
  customerId?: string | null
  warehouseId: string
  locationId: string
  cashierProfileId: string
  orderType?: PosOrderType
  currencyCode?: string
  subtotal: Prisma.Decimal | string | number
  discountTotal: Prisma.Decimal | string | number
  taxTotal: Prisma.Decimal | string | number
  grandTotal: Prisma.Decimal | string | number
  notes?: string | null
  createdByProfileId?: string | null
  lines: Array<PosSaleLineInput>
}

const saleWithDetail = {
  lines: { orderBy: { lineNo: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PosSaleInclude

export type PosSaleWithDetail = Prisma.PosSaleGetPayload<{
  include: typeof saleWithDetail
}>

export function findSaleById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<PosSaleWithDetail | null> {
  return client.posSale.findFirst({
    where: { id, tenantId },
    include: saleWithDetail,
  })
}

export function listSales(
  tenantId: string,
  filters: { status?: PosSaleStatus; posSessionId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.posSale.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.posSessionId ? { posSessionId: filters.posSessionId } : {}),
    },
    orderBy: { saleDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createSale(
  tenantId: string,
  input: PosSaleCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.posSale.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      posSessionId: input.posSessionId ?? null,
      customerId: input.customerId ?? null,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      cashierProfileId: input.cashierProfileId,
      orderType: input.orderType ?? 'COUNTER',
      currencyCode: input.currencyCode ?? 'USD',
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      grandTotal: input.grandTotal,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          uomId: line.uomId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount ?? 0,
          taxAmount: line.taxAmount ?? 0,
          lineTotal: line.lineTotal,
          itemNameSnapshot: line.itemNameSnapshot ?? null,
          skuSnapshot: line.skuSnapshot ?? null,
        })),
      },
    },
    include: saleWithDetail,
  })
}

export function setLineCostAtSale(
  lineId: string,
  costAtSale: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.posSaleLine.update({
    where: { id: lineId },
    data: { costAtSale },
  })
}

// Accumulates the refunded quantity on a POS sale line as (partial) refunds post,
// so over-refunding past the sold quantity can be blocked.
export function incrementLineRefundedQty(
  lineId: string,
  quantity: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.posSaleLine.update({
    where: { id: lineId },
    data: { refundedQty: { increment: quantity } },
  })
}

export function addPayment(
  tenantId: string,
  posSaleId: string,
  payment: {
    method: PaymentMethod
    amount: Prisma.Decimal | string | number
    reference?: string | null
    cardLast4?: string | null
  },
  client: PrismaClientLike = prisma
) {
  return client.posPayment.create({
    data: {
      tenantId,
      posSaleId,
      method: payment.method,
      amount: payment.amount,
      reference: payment.reference ?? null,
      cardLast4: payment.cardLast4 ?? null,
    },
  })
}

export async function completeSale(
  tenantId: string,
  id: string,
  data: {
    amountPaid: Prisma.Decimal | string | number
    changeDue: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  const result = await client.posSale.updateMany({
    where: { id, tenantId, status: 'OPEN' },
    data: {
      status: 'COMPLETED',
      amountPaid: data.amountPaid,
      changeDue: data.changeDue,
      completedAt: new Date(),
    },
  })

  return result.count > 0
}

export async function updateSaleStatus(
  tenantId: string,
  id: string,
  status: PosSaleStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.posSale.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

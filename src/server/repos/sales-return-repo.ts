import { prisma } from '#/server/db/client'
import type {
  PaymentMethod,
  Prisma,
  SalesReturnReason,
  SalesReturnStatus,
  SourceDocType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SalesReturnLineInput {
  productId: string
  variantId?: string | null
  locationId: string
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  lineTotal: Prisma.Decimal | string | number
  costAtReturn?: Prisma.Decimal | string | number | null
  restock?: boolean
  originLineId?: string | null
  lotId?: string | null
  serialId?: string | null
}

export interface SalesReturnCreateInput {
  documentNumber: string
  customerId?: string | null
  warehouseId: string
  originType?: SourceDocType | null
  salesOrderId?: string | null
  posSaleId?: string | null
  reason?: SalesReturnReason
  status?: SalesReturnStatus
  currencyCode?: string
  subtotal: Prisma.Decimal | string | number
  discountTotal: Prisma.Decimal | string | number
  taxTotal: Prisma.Decimal | string | number
  grandTotal: Prisma.Decimal | string | number
  refundMethod?: PaymentMethod | null
  notes?: string | null
  createdByProfileId?: string | null
  lines: Array<SalesReturnLineInput>
}

const returnWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.SalesReturnInclude

export type SalesReturnWithLines = Prisma.SalesReturnGetPayload<{
  include: typeof returnWithLines
}>

export function findSalesReturnById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<SalesReturnWithLines | null> {
  return client.salesReturn.findFirst({
    where: { id, tenantId },
    include: returnWithLines,
  })
}

export function listSalesReturns(
  tenantId: string,
  filters: { status?: SalesReturnStatus; customerId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
): Promise<Array<SalesReturnWithLines>> {
  return client.salesReturn.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    include: returnWithLines,
    orderBy: { returnDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createSalesReturn(
  tenantId: string,
  input: SalesReturnCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.salesReturn.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      customerId: input.customerId ?? null,
      warehouseId: input.warehouseId,
      originType: input.originType ?? null,
      salesOrderId: input.salesOrderId ?? null,
      posSaleId: input.posSaleId ?? null,
      reason: input.reason ?? 'OTHER',
      status: input.status ?? 'DRAFT',
      currencyCode: input.currencyCode ?? 'USD',
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      grandTotal: input.grandTotal,
      refundMethod: input.refundMethod ?? null,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          locationId: line.locationId,
          uomId: line.uomId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount ?? 0,
          taxAmount: line.taxAmount ?? 0,
          lineTotal: line.lineTotal,
          costAtReturn: line.costAtReturn ?? null,
          restock: line.restock ?? true,
          originLineId: line.originLineId ?? null,
          lotId: line.lotId ?? null,
          serialId: line.serialId ?? null,
        })),
      },
    },
    include: returnWithLines,
  })
}

export async function updateSalesReturnStatus(
  tenantId: string,
  id: string,
  status: SalesReturnStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.salesReturn.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

// Marks the return posted (stock re-entered) and stamps the restock value.
export async function markReturnPosted(
  tenantId: string,
  id: string,
  data: {
    postedByProfileId: string
    status: SalesReturnStatus
    restockValue: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  const result = await client.salesReturn.updateMany({
    where: { id, tenantId, isPosted: false },
    data: {
      status: data.status,
      isPosted: true,
      postedAt: new Date(),
      postedByProfileId: data.postedByProfileId,
      restockValue: data.restockValue,
    },
  })

  return result.count > 0
}

export function setLineCostAtReturn(
  lineId: string,
  costAtReturn: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.salesReturnLine.update({
    where: { id: lineId },
    data: { costAtReturn },
  })
}

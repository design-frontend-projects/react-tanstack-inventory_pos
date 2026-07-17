import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface QuotationItemWriteInput {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discountPct?: Prisma.Decimal | string | number | null
  discountAmount?: Prisma.Decimal | string | number
  taxRateId?: string | null
  taxAmount?: Prisma.Decimal | string | number
  netAmount: Prisma.Decimal | string | number
  leadTimeDays?: number | null
  notes?: string | null
}

export interface QuotationCreateInput {
  documentNumber: string
  rfqId?: string | null
  supplierId: string
  quotationDate?: Date
  validUntil?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | string | number
  leadTimeDays?: number | null
  paymentTerms?: string | null
  freightAmount?: Prisma.Decimal | string | number
  insuranceAmount?: Prisma.Decimal | string | number
  remarks?: string | null
  createdBy?: string | null
  items: Array<QuotationItemWriteInput>
}

const quotationInclude = {
  items: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.PodSupplierQuotationInclude

export type QuotationWithItems = Prisma.PodSupplierQuotationGetPayload<{
  include: typeof quotationInclude
}>

export function findQuotationById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<QuotationWithItems | null> {
  return client.podSupplierQuotation.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: quotationInclude,
  })
}

export function listQuotations(
  tenantId: string,
  options: { statusCode?: string; supplierId?: string; rfqId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierQuotation.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options.rfqId ? { rfqId: options.rfqId } : {}),
    },
    include: quotationInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export function createQuotation(
  tenantId: string,
  input: QuotationCreateInput,
  client: PrismaClientLike = prisma,
): Promise<QuotationWithItems> {
  return client.podSupplierQuotation.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      rfqId: input.rfqId ?? null,
      supplierId: input.supplierId,
      quotationDate: input.quotationDate ?? new Date(),
      validUntil: input.validUntil ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      exchangeRate: input.exchangeRate ?? 1,
      leadTimeDays: input.leadTimeDays ?? null,
      paymentTerms: input.paymentTerms ?? null,
      freightAmount: input.freightAmount ?? 0,
      insuranceAmount: input.insuranceAmount ?? 0,
      remarks: input.remarks ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      items: {
        create: input.items.map((item, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: item.productId,
          variantId: item.variantId ?? null,
          uomId: item.uomId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPct: item.discountPct ?? null,
          discountAmount: item.discountAmount ?? 0,
          taxRateId: item.taxRateId ?? null,
          taxAmount: item.taxAmount ?? 0,
          netAmount: item.netAmount,
          leadTimeDays: item.leadTimeDays ?? null,
          notes: item.notes ?? null,
        })),
      },
    },
    include: quotationInclude,
  })
}

export async function updateQuotationStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  extra: {
    approvedByProfileId?: string | null
    updatedBy?: string | null
  } = {},
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierQuotation.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      ...(extra.approvedByProfileId !== undefined
        ? { approvedByProfileId: extra.approvedByProfileId }
        : {}),
      ...(extra.updatedBy !== undefined ? { updatedBy: extra.updatedBy } : {}),
    },
  })

  return result.count > 0
}

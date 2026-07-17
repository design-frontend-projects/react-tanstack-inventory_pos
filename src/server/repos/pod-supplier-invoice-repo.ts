import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierInvoiceItemInput {
  productId?: string | null
  variantId?: string | null
  description?: string | null
  purchaseOrderLineId?: string | null
  goodsReceiptLineId?: string | null
  uomId?: string | null
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discountAmount?: Prisma.Decimal | string | number
  taxRateId?: string | null
  taxAmount?: Prisma.Decimal | string | number
  netAmount: Prisma.Decimal | string | number
}

export interface SupplierInvoiceCreateInput {
  documentNumber: string
  supplierInvoiceNumber?: string | null
  supplierId: string
  purchaseOrderId?: string | null
  invoiceDate?: Date | null
  dueDate?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | string | number | null
  freightAmount?: Prisma.Decimal | string | number | null
  retentionAmount?: Prisma.Decimal | string | number | null
  withholdingTaxAmount?: Prisma.Decimal | string | number | null
  notes?: string | null
  createdBy?: string | null
  items: Array<SupplierInvoiceItemInput>
}

const invoiceInclude = {
  items: { orderBy: { lineNo: 'asc' } },
  matches: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PodSupplierInvoiceInclude

export type SupplierInvoiceWithRelations = Prisma.PodSupplierInvoiceGetPayload<{
  include: typeof invoiceInclude
}>

export function findInvoiceById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<SupplierInvoiceWithRelations | null> {
  return client.podSupplierInvoice.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: invoiceInclude,
  })
}

export function listInvoices(
  tenantId: string,
  options: {
    statusCode?: string
    matchStatusCode?: string
    paymentStatusCode?: string
    supplierId?: string
    purchaseOrderId?: string
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierInvoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.matchStatusCode
        ? { matchStatusCode: options.matchStatusCode }
        : {}),
      ...(options.paymentStatusCode
        ? { paymentStatusCode: options.paymentStatusCode }
        : {}),
      ...(options.supplierId ? { supplierId: options.supplierId } : {}),
      ...(options.purchaseOrderId
        ? { purchaseOrderId: options.purchaseOrderId }
        : {}),
    },
    include: invoiceInclude,
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 100,
  })
}

export function createInvoice(
  tenantId: string,
  input: SupplierInvoiceCreateInput,
  client: PrismaClientLike = prisma,
): Promise<SupplierInvoiceWithRelations> {
  return client.podSupplierInvoice.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      supplierInvoiceNumber: input.supplierInvoiceNumber ?? null,
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      ...(input.invoiceDate ? { invoiceDate: input.invoiceDate } : {}),
      dueDate: input.dueDate ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      exchangeRate: input.exchangeRate ?? 1,
      freightAmount: input.freightAmount ?? 0,
      retentionAmount: input.retentionAmount ?? 0,
      withholdingTaxAmount: input.withholdingTaxAmount ?? 0,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      items: {
        create: input.items.map((item, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          description: item.description ?? null,
          purchaseOrderLineId: item.purchaseOrderLineId ?? null,
          goodsReceiptLineId: item.goodsReceiptLineId ?? null,
          uomId: item.uomId ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount ?? 0,
          taxRateId: item.taxRateId ?? null,
          taxAmount: item.taxAmount ?? 0,
          netAmount: item.netAmount,
        })),
      },
    },
    include: invoiceInclude,
  })
}

export async function updateInvoiceStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  extra: {
    matchStatusCode?: string
    approvalRequestId?: string | null
    updatedBy?: string | null
  } = {},
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierInvoice.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      ...(extra.matchStatusCode
        ? { matchStatusCode: extra.matchStatusCode }
        : {}),
      ...(extra.approvalRequestId !== undefined
        ? { approvalRequestId: extra.approvalRequestId }
        : {}),
      ...(extra.updatedBy !== undefined ? { updatedBy: extra.updatedBy } : {}),
    },
  })

  return result.count > 0
}

export async function updateInvoiceMatchStatus(
  tenantId: string,
  id: string,
  matchStatusCode: string,
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierInvoice.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { matchStatusCode, updatedBy },
  })

  return result.count > 0
}

// Posting freezes the invoice into the AP subledger: status -> posted, the
// posted-* audit stamps are set, and outstanding = grand - paid.
export async function markInvoicePosted(
  tenantId: string,
  id: string,
  postedByProfileId: string,
  client: PrismaClientLike = prisma,
) {
  const invoice = await client.podSupplierInvoice.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { grandTotal: true, paidAmount: true },
  })

  if (!invoice) {
    return false
  }

  const result = await client.podSupplierInvoice.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode: 'posted',
      isPosted: true,
      postedAt: new Date(),
      postedByProfileId,
      updatedBy: postedByProfileId,
      outstandingAmount: invoice.grandTotal.minus(invoice.paidAmount),
    },
  })

  return result.count > 0
}

// Qty already billed per PO line by OTHER non-cancelled invoices — the
// "previously invoiced" leg of the 3-way match.
export async function sumInvoicedQtyByPoLine(
  tenantId: string,
  purchaseOrderLineIds: Array<string>,
  excludeInvoiceId: string | null = null,
  client: PrismaClientLike = prisma,
): Promise<Map<string, Prisma.Decimal>> {
  if (purchaseOrderLineIds.length === 0) {
    return new Map()
  }

  const rows = await client.podSupplierInvoiceItem.groupBy({
    by: ['purchaseOrderLineId'],
    where: {
      tenantId,
      purchaseOrderLineId: { in: purchaseOrderLineIds },
      ...(excludeInvoiceId ? { invoiceId: { not: excludeInvoiceId } } : {}),
      invoice: { statusCode: { not: 'cancelled' }, deletedAt: null },
    },
    _sum: { quantity: true },
  })

  return new Map(
    rows
      .filter((row) => row.purchaseOrderLineId !== null)
      .map((row) => [
        row.purchaseOrderLineId as string,
        row._sum.quantity ?? new Prisma.Decimal(0),
      ]),
  )
}

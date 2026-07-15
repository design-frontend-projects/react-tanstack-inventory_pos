import { prisma } from '#/server/db/client'
import type { InvoiceStatus, Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SalesInvoiceLineInput {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  unitPrice: Prisma.Decimal | string | number
  discount?: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number
  lineTotal: Prisma.Decimal | string | number
  descriptionSnapshot?: string | null
  skuSnapshot?: string | null
}

export interface SalesInvoiceCreateInput {
  documentNumber: string
  salesOrderId?: string | null
  customerId?: string | null
  dueDate?: Date | null
  currencyCode?: string
  subtotal: Prisma.Decimal | string | number
  discountTotal: Prisma.Decimal | string | number
  taxTotal: Prisma.Decimal | string | number
  grandTotal: Prisma.Decimal | string | number
  notes?: string | null
  createdByProfileId?: string | null
  lines: Array<SalesInvoiceLineInput>
}

const invoiceWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.SalesInvoiceInclude

export type SalesInvoiceWithLines = Prisma.SalesInvoiceGetPayload<{
  include: typeof invoiceWithLines
}>

export function findInvoiceById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<SalesInvoiceWithLines | null> {
  return client.salesInvoice.findFirst({
    where: { id, tenantId },
    include: invoiceWithLines,
  })
}

export function listInvoices(
  tenantId: string,
  filters: { status?: InvoiceStatus; customerId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.salesInvoice.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { invoiceDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createInvoice(
  tenantId: string,
  input: SalesInvoiceCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.salesInvoice.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      salesOrderId: input.salesOrderId ?? null,
      customerId: input.customerId ?? null,
      dueDate: input.dueDate ?? null,
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
          descriptionSnapshot: line.descriptionSnapshot ?? null,
          skuSnapshot: line.skuSnapshot ?? null,
        })),
      },
    },
    include: invoiceWithLines,
  })
}

export async function updateInvoiceStatus(
  tenantId: string,
  id: string,
  status: InvoiceStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.salesInvoice.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

export async function applyInvoicePayment(
  tenantId: string,
  id: string,
  amountPaid: Prisma.Decimal | string | number,
  status: InvoiceStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.salesInvoice.updateMany({
    where: { id, tenantId },
    data: { amountPaid, status },
  })

  return result.count > 0
}

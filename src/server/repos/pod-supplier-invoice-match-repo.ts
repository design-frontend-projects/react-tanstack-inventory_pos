import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface InvoiceMatchRowInput {
  invoiceItemId?: string | null
  purchaseOrderLineId?: string | null
  goodsReceiptLineId?: string | null
  matchedQty: Prisma.Decimal | string | number
  matchedAmount: Prisma.Decimal | string | number
  priceVariance: Prisma.Decimal | string | number
  qtyVariance: Prisma.Decimal | string | number
}

// A re-match replaces the full row set — match rows are derived data, so
// idempotent replacement keeps them consistent with the current items.
export async function replaceMatches(
  tenantId: string,
  invoiceId: string,
  rows: Array<InvoiceMatchRowInput>,
  client: PrismaClientLike = prisma,
) {
  await client.podSupplierInvoiceMatch.deleteMany({
    where: { tenantId, invoiceId },
  })

  if (rows.length === 0) {
    return
  }

  await client.podSupplierInvoiceMatch.createMany({
    data: rows.map((row) => ({
      tenantId,
      invoiceId,
      invoiceItemId: row.invoiceItemId ?? null,
      purchaseOrderLineId: row.purchaseOrderLineId ?? null,
      goodsReceiptLineId: row.goodsReceiptLineId ?? null,
      matchedQty: row.matchedQty,
      matchedAmount: row.matchedAmount,
      priceVariance: row.priceVariance,
      qtyVariance: row.qtyVariance,
    })),
  })
}

export function listMatches(
  tenantId: string,
  invoiceId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierInvoiceMatch.findMany({
    where: { tenantId, invoiceId },
    orderBy: { createdAt: 'asc' },
  })
}

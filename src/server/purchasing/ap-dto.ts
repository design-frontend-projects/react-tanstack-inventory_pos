import type { Prisma } from '#/server/db/generated/prisma/client'
import type { SupplierInvoiceWithRelations } from '#/server/repos/pod-supplier-invoice-repo'

// Stringify Decimal columns on AP documents for the network boundary.

export function serializeSupplierInvoice(
  invoice: SupplierInvoiceWithRelations,
) {
  return {
    ...invoice,
    exchangeRate: invoice.exchangeRate.toString(),
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    retentionAmount: invoice.retentionAmount.toString(),
    withholdingTaxAmount: invoice.withholdingTaxAmount.toString(),
    freightAmount: invoice.freightAmount.toString(),
    grandTotal: invoice.grandTotal.toString(),
    paidAmount: invoice.paidAmount.toString(),
    outstandingAmount: invoice.outstandingAmount.toString(),
    items: invoice.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      discountAmount: item.discountAmount.toString(),
      taxAmount: item.taxAmount.toString(),
      netAmount: item.netAmount.toString(),
    })),
    matches: invoice.matches.map((match) => ({
      ...match,
      matchedQty: match.matchedQty.toString(),
      matchedAmount: match.matchedAmount.toString(),
      priceVariance: match.priceVariance.toString(),
      qtyVariance: match.qtyVariance.toString(),
    })),
  }
}

export interface DebitNoteLineRecord {
  id: string
  tenantId: string
  financialNoteId: string
  lineNo: number
  reasonId: string | null
  productId: string | null
  description: string | null
  quantity: Prisma.Decimal | null
  unitCost: Prisma.Decimal | null
  amount: Prisma.Decimal
  taxAmount: Prisma.Decimal
  purchaseReturnId: string | null
  createdAt: Date
}

export function serializeDebitNoteLine(line: DebitNoteLineRecord) {
  return {
    ...line,
    quantity: line.quantity === null ? null : line.quantity.toString(),
    unitCost: line.unitCost === null ? null : line.unitCost.toString(),
    amount: line.amount.toString(),
    taxAmount: line.taxAmount.toString(),
  }
}

export type SupplierInvoiceDto = ReturnType<typeof serializeSupplierInvoice>
export type DebitNoteLineDto = ReturnType<typeof serializeDebitNoteLine>

import type { RfqWithRelations } from '#/server/repos/pod-rfq-repo'
import type { QuotationWithItems } from '#/server/repos/pod-supplier-quotation-repo'

// Stringify Decimal columns on sourcing documents for the network boundary.

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeRfq(rfq: RfqWithRelations) {
  return {
    ...rfq,
    items: rfq.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
    })),
    suppliers: rfq.suppliers,
  }
}

export function serializeQuotation(quotation: QuotationWithItems) {
  return {
    ...quotation,
    exchangeRate: quotation.exchangeRate.toString(),
    freightAmount: quotation.freightAmount.toString(),
    insuranceAmount: quotation.insuranceAmount.toString(),
    discountTotal: quotation.discountTotal.toString(),
    subtotal: quotation.subtotal.toString(),
    taxTotal: quotation.taxTotal.toString(),
    grandTotal: quotation.grandTotal.toString(),
    items: quotation.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      discountPct: dec(item.discountPct),
      discountAmount: item.discountAmount.toString(),
      taxAmount: item.taxAmount.toString(),
      netAmount: item.netAmount.toString(),
    })),
  }
}

export type RfqDto = ReturnType<typeof serializeRfq>
export type QuotationDto = ReturnType<typeof serializeQuotation>

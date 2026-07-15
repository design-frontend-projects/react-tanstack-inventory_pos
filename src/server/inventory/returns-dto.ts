import type {
  FinancialNote,
  SalesReturn,
  SalesReturnLine,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on Phase 7 return / credit-note documents for the
// server-function boundary (Prisma.Decimal is not JSON-serializable).

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeSalesReturn(
  salesReturn: SalesReturn & { lines: Array<SalesReturnLine> }
) {
  return {
    ...salesReturn,
    subtotal: salesReturn.subtotal.toString(),
    discountTotal: salesReturn.discountTotal.toString(),
    taxTotal: salesReturn.taxTotal.toString(),
    grandTotal: salesReturn.grandTotal.toString(),
    restockValue: salesReturn.restockValue.toString(),
    lines: salesReturn.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discount: line.discount.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
      costAtReturn: dec(line.costAtReturn),
    })),
  }
}

export function serializeFinancialNote(note: FinancialNote) {
  return {
    ...note,
    amount: note.amount.toString(),
    appliedAmount: note.appliedAmount.toString(),
  }
}

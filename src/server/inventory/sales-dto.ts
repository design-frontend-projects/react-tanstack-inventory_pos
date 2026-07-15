import type {
  PosPayment,
  PosSale,
  PosSaleLine,
  PosSession,
  SalesInvoice,
  SalesInvoiceLine,
  SalesOrder,
  SalesOrderLine,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on Phase 6 sales/POS documents for the server-function
// boundary.

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeSalesOrder(
  order: SalesOrder & { lines: Array<SalesOrderLine> }
) {
  return {
    ...order,
    subtotal: order.subtotal.toString(),
    discountTotal: order.discountTotal.toString(),
    taxTotal: order.taxTotal.toString(),
    grandTotal: order.grandTotal.toString(),
    lines: order.lines.map((line) => ({
      ...line,
      orderedQty: line.orderedQty.toString(),
      reservedQty: line.reservedQty.toString(),
      fulfilledQty: line.fulfilledQty.toString(),
      invoicedQty: line.invoicedQty.toString(),
      unitPrice: line.unitPrice.toString(),
      discount: line.discount.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
      costAtSale: dec(line.costAtSale),
    })),
  }
}

export function serializeSalesInvoice(
  invoice: SalesInvoice & { lines: Array<SalesInvoiceLine> }
) {
  return {
    ...invoice,
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    taxTotal: invoice.taxTotal.toString(),
    grandTotal: invoice.grandTotal.toString(),
    amountPaid: invoice.amountPaid.toString(),
    lines: invoice.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discount: line.discount.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
  }
}

export function serializePosSale(
  sale: PosSale & { lines: Array<PosSaleLine>; payments: Array<PosPayment> }
) {
  return {
    ...sale,
    subtotal: sale.subtotal.toString(),
    discountTotal: sale.discountTotal.toString(),
    taxTotal: sale.taxTotal.toString(),
    grandTotal: sale.grandTotal.toString(),
    amountPaid: sale.amountPaid.toString(),
    changeDue: sale.changeDue.toString(),
    lines: sale.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discount: line.discount.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
      costAtSale: dec(line.costAtSale),
      refundedQty: line.refundedQty.toString(),
    })),
    payments: sale.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
    })),
  }
}

export function serializePosSession(session: PosSession) {
  return {
    ...session,
    openingFloat: session.openingFloat.toString(),
    closingCash: dec(session.closingCash),
    expectedCash: dec(session.expectedCash),
    variance: dec(session.variance),
  }
}

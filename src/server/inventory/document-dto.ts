import type {
  GoodsReceipt,
  GoodsReceiptLine,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseRequisition,
  PurchaseRequisitionLine,
  PurchaseReturn,
  PurchaseReturnLine,
  StockTransfer,
  StockTransferLine,
} from '#/server/db/generated/prisma/client'

// Stringify Decimal columns on Phase 4/5 documents for the network boundary.

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeTransfer(
  transfer: StockTransfer & { lines: Array<StockTransferLine> },
) {
  return {
    ...transfer,
    lines: transfer.lines.map((line) => ({
      ...line,
      requestedQty: line.requestedQty.toString(),
      shippedQty: line.shippedQty.toString(),
      receivedQty: line.receivedQty.toString(),
    })),
  }
}

export function serializePurchaseOrder(
  po: PurchaseOrder & { lines: Array<PurchaseOrderLine> },
) {
  return {
    ...po,
    subtotal: po.subtotal.toString(),
    taxTotal: po.taxTotal.toString(),
    grandTotal: po.grandTotal.toString(),
    // Spec 005 header extensions (Decimal → string for the wire)
    exchangeRate: po.exchangeRate.toString(),
    discountTotal: po.discountTotal.toString(),
    lines: po.lines.map((line) => ({
      ...line,
      orderedQty: line.orderedQty.toString(),
      receivedQty: line.receivedQty.toString(),
      unitCost: line.unitCost.toString(),
      taxAmount: line.taxAmount.toString(),
      lineTotal: line.lineTotal.toString(),
      // Spec 005 line extensions
      rejectedQty: line.rejectedQty.toString(),
      returnedQty: line.returnedQty.toString(),
      cancelledQty: line.cancelledQty.toString(),
      discountPct: dec(line.discountPct),
      discountAmount: line.discountAmount.toString(),
      netAmount: line.netAmount.toString(),
      grossAmount: line.grossAmount.toString(),
      remainingQty: dec(line.remainingQty),
    })),
  }
}

export function serializeGoodsReceipt(
  receipt: GoodsReceipt & { lines: Array<GoodsReceiptLine> },
) {
  return {
    ...receipt,
    lines: receipt.lines.map((line) => ({
      ...line,
      receivedQty: line.receivedQty.toString(),
      acceptedQty: line.acceptedQty.toString(),
      rejectedQty: line.rejectedQty.toString(),
      unitCost: line.unitCost.toString(),
    })),
  }
}

export function serializePurchaseReturn(
  ret: PurchaseReturn & { lines: Array<PurchaseReturnLine> },
) {
  return {
    ...ret,
    lines: ret.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitCost: dec(line.unitCost),
    })),
  }
}

export function serializeRequisition(
  requisition: PurchaseRequisition & { lines: Array<PurchaseRequisitionLine> },
) {
  return {
    ...requisition,
    lines: requisition.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
    })),
  }
}

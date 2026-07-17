import { Prisma } from '#/server/db/generated/prisma/client'

// Pure 3-way-match math (unit-testable, no database). The three legs are:
//   PO line      — what was ordered, at the agreed unit cost
//   GRN lines    — what was actually received/accepted (posted receipts only)
//   Invoice item — what the supplier is billing
//
// Semantics mirror the DB function `pod_three_way_match` (tolerance 0.01):
//   unmatched          — nothing could be matched
//   variance           — |price variance| across lines exceeds the tolerance
//   matched            — matched amount covers the invoice grand total
//   partially_matched  — some, but not all, of the invoice is covered

export const MATCH_TOLERANCE = new Prisma.Decimal('0.01')

export interface MatchLineInput {
  invoiceItemId: string
  purchaseOrderLineId: string | null
  goodsReceiptLineId?: string | null
  /** Quantity billed on the invoice item. */
  invoicedQty: Prisma.Decimal | string | number
  /** Invoice item amount incl. tax (net + tax) — what "fully covered" means. */
  lineAmount: Prisma.Decimal | string | number
  /** Supplier's billed unit price. */
  invoiceUnitPrice: Prisma.Decimal | string | number
  /** Agreed PO unit cost; null when the item has no PO reference. */
  poUnitCost: Prisma.Decimal | string | number | null
  /** Accepted qty from POSTED goods receipts against the PO line. */
  receivedQty: Prisma.Decimal | string | number
  /** Qty already billed by OTHER (non-cancelled) invoices for the PO line. */
  previouslyInvoicedQty: Prisma.Decimal | string | number
}

export interface MatchLineResult {
  invoiceItemId: string
  purchaseOrderLineId: string | null
  goodsReceiptLineId: string | null
  matchedQty: Prisma.Decimal
  matchedAmount: Prisma.Decimal
  priceVariance: Prisma.Decimal
  qtyVariance: Prisma.Decimal
}

const ZERO = new Prisma.Decimal(0)

// One invoice item against its PO/GRN legs:
//   available      = max(received - previouslyInvoiced, 0)
//   matchedQty     = min(invoicedQty, available)
//   matchedAmount  = lineAmount * matchedQty / invoicedQty
//   priceVariance  = (invoicePrice - poCost) * matchedQty
//   qtyVariance    = invoicedQty - available   (positive = billed > received)
// An item with no PO reference cannot be matched at all (service charges etc.)
// and simply leaves the invoice partially matched.
export function computeLineMatch(input: MatchLineInput): MatchLineResult {
  const invoicedQty = new Prisma.Decimal(input.invoicedQty)
  const lineAmount = new Prisma.Decimal(input.lineAmount)

  if (!input.purchaseOrderLineId) {
    return {
      invoiceItemId: input.invoiceItemId,
      purchaseOrderLineId: null,
      goodsReceiptLineId: input.goodsReceiptLineId ?? null,
      matchedQty: ZERO,
      matchedAmount: ZERO,
      priceVariance: ZERO,
      qtyVariance: ZERO,
    }
  }

  const received = new Prisma.Decimal(input.receivedQty)
  const previouslyInvoiced = new Prisma.Decimal(input.previouslyInvoicedQty)
  const rawAvailable = received.minus(previouslyInvoiced)
  const available = rawAvailable.lessThan(ZERO) ? ZERO : rawAvailable

  const matchedQty = invoicedQty.lessThan(available) ? invoicedQty : available
  const matchedAmount =
    invoicedQty.isZero() || matchedQty.isZero()
      ? ZERO
      : lineAmount.times(matchedQty).dividedBy(invoicedQty).toDecimalPlaces(4)

  const priceVariance =
    input.poUnitCost === null
      ? ZERO
      : new Prisma.Decimal(input.invoiceUnitPrice)
          .minus(new Prisma.Decimal(input.poUnitCost))
          .times(matchedQty)
          .toDecimalPlaces(4)

  return {
    invoiceItemId: input.invoiceItemId,
    purchaseOrderLineId: input.purchaseOrderLineId,
    goodsReceiptLineId: input.goodsReceiptLineId ?? null,
    matchedQty,
    matchedAmount,
    priceVariance,
    qtyVariance: invoicedQty.minus(available),
  }
}

export type MatchStatusCode =
  | 'unmatched'
  | 'partially_matched'
  | 'matched'
  | 'variance'

// Header status from the match rows — same decision table as the SQL function:
// price variance dominates, then full coverage, then partial.
export function deriveMatchStatus(
  matches: Array<Pick<MatchLineResult, 'matchedAmount' | 'priceVariance'>>,
  grandTotal: Prisma.Decimal | string | number,
  tolerance: Prisma.Decimal = MATCH_TOLERANCE,
): MatchStatusCode {
  const totalMatched = matches.reduce(
    (sum, row) => sum.plus(row.matchedAmount),
    ZERO,
  )
  const totalAbsVariance = matches.reduce(
    (sum, row) => sum.plus(row.priceVariance.absoluteValue()),
    ZERO,
  )
  const grand = new Prisma.Decimal(grandTotal)

  if (totalMatched.isZero()) {
    return 'unmatched'
  }

  if (totalAbsVariance.greaterThan(tolerance)) {
    return 'variance'
  }

  if (totalMatched.greaterThanOrEqualTo(grand.minus(tolerance))) {
    return 'matched'
  }

  return 'partially_matched'
}

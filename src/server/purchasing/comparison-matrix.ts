// Pure comparison-matrix assembly for RFQ award decisions. Works on serialized
// (string) money values so it can run against DTOs on either side of the wire.

export interface MatrixRfqItem {
  productId: string
  variantId?: string | null
  quantity: string
}

export interface MatrixQuotationItem {
  productId: string
  variantId?: string | null
  quantity: string
  unitPrice: string
  netAmount: string
  leadTimeDays?: number | null
}

export interface MatrixQuotation {
  id: string
  supplierId: string
  statusCode: string
  currencyCode: string
  grandTotal: string
  leadTimeDays?: number | null
  items: Array<MatrixQuotationItem>
}

export interface MatrixCell {
  quotationId: string
  supplierId: string
  unitPrice: string
  netAmount: string
  leadTimeDays: number | null
  isBestPrice: boolean
}

export interface MatrixRow {
  productId: string
  variantId: string | null
  quantity: string
  cells: Array<MatrixCell>
}

export interface ComparisonMatrix {
  rows: Array<MatrixRow>
  totals: Array<{
    quotationId: string
    supplierId: string
    currencyCode: string
    grandTotal: string
    coveredLines: number
    isBestTotal: boolean
  }>
}

function key(productId: string, variantId?: string | null) {
  return `${productId}::${variantId ?? ''}`
}

export function buildComparisonMatrix(
  rfqItems: Array<MatrixRfqItem>,
  quotations: Array<MatrixQuotation>,
): ComparisonMatrix {
  const rows = rfqItems.map((rfqItem) => {
    const cells: Array<MatrixCell> = []

    for (const quotation of quotations) {
      const match = quotation.items.find(
        (item) =>
          key(item.productId, item.variantId) ===
          key(rfqItem.productId, rfqItem.variantId),
      )

      if (match) {
        cells.push({
          quotationId: quotation.id,
          supplierId: quotation.supplierId,
          unitPrice: match.unitPrice,
          netAmount: match.netAmount,
          leadTimeDays: match.leadTimeDays ?? quotation.leadTimeDays ?? null,
          isBestPrice: false,
        })
      }
    }

    const bestPrice = cells.reduce<number | null>((best, cell) => {
      const price = Number(cell.unitPrice)
      return best === null || price < best ? price : best
    }, null)

    return {
      productId: rfqItem.productId,
      variantId: rfqItem.variantId ?? null,
      quantity: rfqItem.quantity,
      cells: cells.map((cell) => ({
        ...cell,
        isBestPrice: bestPrice !== null && Number(cell.unitPrice) === bestPrice,
      })),
    }
  })

  const totalsRaw = quotations.map((quotation) => ({
    quotationId: quotation.id,
    supplierId: quotation.supplierId,
    currencyCode: quotation.currencyCode,
    grandTotal: quotation.grandTotal,
    coveredLines: rows.filter((row) =>
      row.cells.some((cell) => cell.quotationId === quotation.id),
    ).length,
    isBestTotal: false,
  }))

  // Best total only compares quotations that cover every requested line —
  // a cheap partial quote must not outrank a complete one.
  const fullCoverage = totalsRaw.filter(
    (total) => total.coveredLines === rows.length && rows.length > 0,
  )
  const bestTotal = fullCoverage.reduce<number | null>((best, total) => {
    const value = Number(total.grandTotal)
    return best === null || value < best ? value : best
  }, null)

  return {
    rows,
    totals: totalsRaw.map((total) => ({
      ...total,
      isBestTotal:
        bestTotal !== null &&
        total.coveredLines === rows.length &&
        Number(total.grandTotal) === bestTotal,
    })),
  }
}

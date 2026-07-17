import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import {
  computeLineMatch,
  deriveMatchStatus,
} from '#/server/purchasing/three-way-match'
import {
  invoiceCreateSchema,
  invoiceFromPoSchema,
  invoicePostSchema,
} from '#/features/purchasing/invoice-validation'

const UUID = '11111111-1111-4111-8111-111111111111'

function line(
  partial: Partial<Parameters<typeof computeLineMatch>[0]> = {},
): Parameters<typeof computeLineMatch>[0] {
  return {
    invoiceItemId: 'item-1',
    purchaseOrderLineId: 'po-line-1',
    invoicedQty: 10,
    lineAmount: '115',
    invoiceUnitPrice: 10,
    poUnitCost: 10,
    receivedQty: 10,
    previouslyInvoicedQty: 0,
    ...partial,
  }
}

describe('computeLineMatch', () => {
  it('fully matches when billed = received at PO cost', () => {
    const result = computeLineMatch(line())

    expect(result.matchedQty.toString()).toBe('10')
    expect(result.matchedAmount.toString()).toBe('115')
    expect(result.priceVariance.isZero()).toBe(true)
    expect(result.qtyVariance.isZero()).toBe(true)
  })

  it('clamps the match to what was received and prorates the amount', () => {
    const result = computeLineMatch(line({ receivedQty: 6 }))

    expect(result.matchedQty.toString()).toBe('6')
    expect(result.matchedAmount.toString()).toBe('69') // 115 * 6/10
    expect(result.qtyVariance.toString()).toBe('4') // billed 4 beyond received
  })

  it('subtracts quantities already billed by other invoices', () => {
    const result = computeLineMatch(
      line({ receivedQty: 10, previouslyInvoicedQty: 7 }),
    )

    expect(result.matchedQty.toString()).toBe('3')
    expect(result.qtyVariance.toString()).toBe('7')
  })

  it('never yields negative availability', () => {
    const result = computeLineMatch(
      line({ receivedQty: 5, previouslyInvoicedQty: 9 }),
    )

    expect(result.matchedQty.isZero()).toBe(true)
    expect(result.matchedAmount.isZero()).toBe(true)
  })

  it('computes the price variance on the matched quantity', () => {
    const result = computeLineMatch(
      line({ invoiceUnitPrice: 12, poUnitCost: 10 }),
    )

    expect(result.priceVariance.toString()).toBe('20') // (12-10) * 10
  })

  it('cannot match an item without a PO reference', () => {
    const result = computeLineMatch(line({ purchaseOrderLineId: null }))

    expect(result.matchedQty.isZero()).toBe(true)
    expect(result.matchedAmount.isZero()).toBe(true)
    expect(result.priceVariance.isZero()).toBe(true)
  })
})

describe('deriveMatchStatus', () => {
  const dec = (value: string | number) => new Prisma.Decimal(value)

  it('is unmatched when nothing matched', () => {
    expect(
      deriveMatchStatus(
        [{ matchedAmount: dec(0), priceVariance: dec(0) }],
        100,
      ),
    ).toBe('unmatched')
  })

  it('flags a price variance beyond the tolerance', () => {
    expect(
      deriveMatchStatus(
        [{ matchedAmount: dec(100), priceVariance: dec('0.02') }],
        100,
      ),
    ).toBe('variance')
  })

  it('treats variance within the tolerance as matched', () => {
    expect(
      deriveMatchStatus(
        [{ matchedAmount: dec('99.995'), priceVariance: dec('0.01') }],
        100,
      ),
    ).toBe('matched')
  })

  it('is partially matched when coverage falls short', () => {
    expect(
      deriveMatchStatus(
        [{ matchedAmount: dec(60), priceVariance: dec(0) }],
        100,
      ),
    ).toBe('partially_matched')
  })

  it('sums absolute variances across lines', () => {
    expect(
      deriveMatchStatus(
        [
          { matchedAmount: dec(50), priceVariance: dec('-0.03') },
          { matchedAmount: dec(50), priceVariance: dec('0.03') },
        ],
        100,
      ),
    ).toBe('variance')
  })
})

describe('invoice validation', () => {
  it('accepts a minimal invoice payload', () => {
    const parsed = invoiceCreateSchema.safeParse({
      supplierId: UUID,
      items: [{ quantity: 5, unitPrice: '12.50' }],
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects an invoice without items', () => {
    expect(
      invoiceCreateSchema.safeParse({ supplierId: UUID, items: [] }).success,
    ).toBe(false)
  })

  it('accepts an invoice-from-PO payload', () => {
    expect(
      invoiceFromPoSchema.safeParse({
        purchaseOrderId: UUID,
        supplierInvoiceNumber: 'SUP-42',
      }).success,
    ).toBe(true)
  })

  it('accepts a variance override on post', () => {
    expect(
      invoicePostSchema.safeParse({ overrideVariance: true }).success,
    ).toBe(true)
    expect(invoicePostSchema.safeParse({}).success).toBe(true)
  })
})

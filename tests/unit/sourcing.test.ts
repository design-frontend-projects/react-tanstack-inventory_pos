import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import { buildComparisonMatrix } from '#/server/purchasing/comparison-matrix'
import { isTransitionAllowed } from '#/server/purchasing/pod-status-service'
import { computeQuotationLine } from '#/server/purchasing/quotation-service'
import {
  serializeQuotation,
  serializeRfq,
} from '#/server/purchasing/sourcing-dto'
import {
  quotationCreateSchema,
  rfqCreateSchema,
} from '#/features/purchasing/sourcing-validation'

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const UUID_C = '33333333-3333-4333-8333-333333333333'

// Mirrors the globally seeded pod_status_transitions rows for these entities.
const RFQ_TRANSITIONS = [
  { fromCode: 'open', toCode: 'awarded' },
  { fromCode: 'open', toCode: 'expired' },
  { fromCode: 'open', toCode: 'cancelled' },
]

const QUOTATION_TRANSITIONS = [
  { fromCode: 'draft', toCode: 'submitted' },
  { fromCode: 'submitted', toCode: 'under_review' },
  { fromCode: 'under_review', toCode: 'approved' },
  { fromCode: 'under_review', toCode: 'rejected' },
  { fromCode: 'approved', toCode: 'awarded' },
]

describe('pod status transitions (lookup-table state machine)', () => {
  it('allows seeded transitions', () => {
    expect(isTransitionAllowed(RFQ_TRANSITIONS, 'open', 'awarded')).toBe(true)
    expect(
      isTransitionAllowed(QUOTATION_TRANSITIONS, 'draft', 'submitted'),
    ).toBe(true)
    expect(
      isTransitionAllowed(QUOTATION_TRANSITIONS, 'under_review', 'rejected'),
    ).toBe(true)
  })

  it('blocks unlisted jumps', () => {
    expect(isTransitionAllowed(RFQ_TRANSITIONS, 'awarded', 'open')).toBe(false)
    expect(isTransitionAllowed(QUOTATION_TRANSITIONS, 'draft', 'awarded')).toBe(
      false,
    )
    expect(
      isTransitionAllowed(QUOTATION_TRANSITIONS, 'submitted', 'approved'),
    ).toBe(false)
  })
})

describe('computeQuotationLine', () => {
  it('computes net and tax with a percentage discount', () => {
    const result = computeQuotationLine({
      quantity: 10,
      unitPrice: '100',
      discountPct: '0.1',
      taxRate: '0.15',
    })

    expect(result.gross.toString()).toBe('1000')
    expect(result.discountAmount.toString()).toBe('100')
    expect(result.netAmount.toString()).toBe('900')
    expect(result.taxAmount.toString()).toBe('135')
  })

  it('prefers an explicit discount amount over the percentage', () => {
    const result = computeQuotationLine({
      quantity: 2,
      unitPrice: '50',
      discountPct: '0.5',
      discountAmount: '10',
      taxRate: null,
    })

    expect(result.discountAmount.toString()).toBe('10')
    expect(result.netAmount.toString()).toBe('90')
    expect(result.taxAmount.toString()).toBe('0')
  })

  it('rejects discounts larger than the line amount', () => {
    expect(() =>
      computeQuotationLine({
        quantity: 1,
        unitPrice: '10',
        discountAmount: '11',
      }),
    ).toThrowError(/discount/i)
  })
})

describe('buildComparisonMatrix', () => {
  const rfqItems = [
    { productId: 'p1', variantId: null, quantity: '10' },
    { productId: 'p2', variantId: null, quantity: '5' },
  ]

  const quotations = [
    {
      id: 'q1',
      supplierId: 's1',
      statusCode: 'submitted',
      currencyCode: 'USD',
      grandTotal: '1500',
      leadTimeDays: 5,
      items: [
        {
          productId: 'p1',
          variantId: null,
          quantity: '10',
          unitPrice: '100',
          netAmount: '1000',
        },
        {
          productId: 'p2',
          variantId: null,
          quantity: '5',
          unitPrice: '100',
          netAmount: '500',
        },
      ],
    },
    {
      id: 'q2',
      supplierId: 's2',
      statusCode: 'submitted',
      currencyCode: 'USD',
      grandTotal: '800',
      leadTimeDays: 12,
      items: [
        {
          productId: 'p1',
          variantId: null,
          quantity: '10',
          unitPrice: '80',
          netAmount: '800',
        },
      ],
    },
  ]

  it('flags the best unit price per line', () => {
    const matrix = buildComparisonMatrix(rfqItems, quotations)
    const p1Cells = matrix.rows[0].cells

    expect(p1Cells).toHaveLength(2)
    expect(p1Cells.find((cell) => cell.quotationId === 'q2')?.isBestPrice).toBe(
      true,
    )
    expect(p1Cells.find((cell) => cell.quotationId === 'q1')?.isBestPrice).toBe(
      false,
    )
  })

  it('only awards best total to quotations covering every line', () => {
    const matrix = buildComparisonMatrix(rfqItems, quotations)
    const q1 = matrix.totals.find((total) => total.quotationId === 'q1')
    const q2 = matrix.totals.find((total) => total.quotationId === 'q2')

    // q2 is cheaper but only covers 1 of 2 lines — it must not win.
    expect(q2?.coveredLines).toBe(1)
    expect(q2?.isBestTotal).toBe(false)
    expect(q1?.coveredLines).toBe(2)
    expect(q1?.isBestTotal).toBe(true)
  })
})

describe('sourcing validation', () => {
  it('accepts a well-formed RFQ payload', () => {
    const parsed = rfqCreateSchema.safeParse({
      title: 'Q3 produce restock',
      currencyCode: 'USD',
      items: [{ productId: UUID_A, uomId: UUID_B, quantity: '10' }],
      supplierIds: [UUID_C],
    })

    expect(parsed.success).toBe(true)
  })

  it('rejects an RFQ without items or suppliers', () => {
    expect(
      rfqCreateSchema.safeParse({ items: [], supplierIds: [UUID_C] }).success,
    ).toBe(false)
    expect(
      rfqCreateSchema.safeParse({
        items: [{ productId: UUID_A, uomId: UUID_B, quantity: 1 }],
        supplierIds: [],
      }).success,
    ).toBe(false)
  })

  it('accepts a quotation with typed lines', () => {
    const parsed = quotationCreateSchema.safeParse({
      supplierId: UUID_A,
      rfqId: UUID_B,
      exchangeRate: '1',
      lines: [
        {
          productId: UUID_A,
          uomId: UUID_B,
          quantity: 10,
          unitPrice: '99.50',
          discountPct: '0.05',
        },
      ],
    })

    expect(parsed.success).toBe(true)
  })
})

describe('sourcing DTO serialization', () => {
  const decimal = (value: string) => new Prisma.Decimal(value)

  it('stringifies RFQ item quantities', () => {
    const rfq = serializeRfq({
      id: 'r1',
      items: [{ id: 'i1', quantity: decimal('12.5') }],
      suppliers: [],
    } as never)

    expect(rfq.items[0].quantity).toBe('12.5')
  })

  it('stringifies quotation money fields', () => {
    const quotation = serializeQuotation({
      id: 'q1',
      exchangeRate: decimal('1'),
      freightAmount: decimal('25'),
      insuranceAmount: decimal('0'),
      discountTotal: decimal('100'),
      subtotal: decimal('900'),
      taxTotal: decimal('135'),
      grandTotal: decimal('1060'),
      items: [
        {
          id: 'i1',
          quantity: decimal('10'),
          unitPrice: decimal('100'),
          discountPct: decimal('0.1'),
          discountAmount: decimal('100'),
          taxAmount: decimal('135'),
          netAmount: decimal('900'),
        },
      ],
    } as never)

    expect(quotation.grandTotal).toBe('1060')
    expect(quotation.items[0].discountPct).toBe('0.1')
    expect(quotation.items[0].netAmount).toBe('900')
  })
})

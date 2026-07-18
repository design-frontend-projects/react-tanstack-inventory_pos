import { describe, expect, it } from 'vitest'
import { ConflictError } from '#/server/auth/errors'
import {
  derivePaymentStatus,
  summarizeAllocations,
} from '#/server/purchasing/supplier-payment-service'
import {
  paymentAllocateSchema,
  paymentCreateSchema,
} from '#/features/purchasing/payment-validation'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('derivePaymentStatus', () => {
  it('is unpaid at zero', () => {
    expect(derivePaymentStatus(100, 0)).toBe('unpaid')
  })

  it('is partially paid below the total', () => {
    expect(derivePaymentStatus(100, 40)).toBe('partially_paid')
  })

  it('is paid at (or within tolerance of) the total', () => {
    expect(derivePaymentStatus(100, 100)).toBe('paid')
    expect(derivePaymentStatus(100, '99.995')).toBe('paid')
  })
})

describe('summarizeAllocations', () => {
  it('computes allocated and unallocated totals', () => {
    const totals = summarizeAllocations(100, [
      { allocatedAmount: 60 },
      { allocatedAmount: '15.5' },
    ])

    expect(totals.allocatedAmount.toString()).toBe('75.5')
    expect(totals.unallocatedAmount.toString()).toBe('24.5')
  })

  it('treats a fully unallocated payment as an advance', () => {
    const totals = summarizeAllocations(250, [])

    expect(totals.allocatedAmount.isZero()).toBe(true)
    expect(totals.unallocatedAmount.toString()).toBe('250')
  })

  it('guards against over-allocation', () => {
    expect(() =>
      summarizeAllocations(100, [
        { allocatedAmount: 80 },
        { allocatedAmount: 30 },
      ]),
    ).toThrow(ConflictError)
  })

  it('rejects non-positive allocation rows', () => {
    expect(() => summarizeAllocations(100, [{ allocatedAmount: 0 }])).toThrow(
      ConflictError,
    )
    expect(() => summarizeAllocations(100, [{ allocatedAmount: -5 }])).toThrow(
      ConflictError,
    )
  })
})

describe('payment validation', () => {
  it('accepts a payment payload', () => {
    expect(
      paymentCreateSchema.safeParse({
        supplierId: UUID,
        amount: '500.00',
        isAdvance: true,
      }).success,
    ).toBe(true)
  })

  it('rejects a payment without a supplier', () => {
    expect(paymentCreateSchema.safeParse({ amount: 100 }).success).toBe(false)
  })

  it('accepts an allocation payload and rejects an empty one', () => {
    expect(
      paymentAllocateSchema.safeParse({
        allocations: [{ supplierInvoiceId: UUID, amount: '25' }],
      }).success,
    ).toBe(true)
    expect(paymentAllocateSchema.safeParse({ allocations: [] }).success).toBe(
      false,
    )
  })
})

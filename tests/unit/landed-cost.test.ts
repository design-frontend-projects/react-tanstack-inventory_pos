import { describe, expect, it } from 'vitest'
import { Prisma } from '#/server/db/generated/prisma/client'
import { ConflictError } from '#/server/auth/errors'
import {
  allocateLandedCost,
  allocateProRata,
  deriveBasisValue,
} from '#/server/purchasing/landed-cost-allocation'
import {
  landedCostAllocateSchema,
  landedCostCreateSchema,
} from '#/features/purchasing/landed-cost-validation'

const UUID = '11111111-1111-4111-8111-111111111111'

const dec = (value: string | number) => new Prisma.Decimal(value)

describe('deriveBasisValue', () => {
  const target = {
    key: 'l1',
    quantity: 10,
    unitCost: '2.5',
    weightPerUnit: '0.75',
  }

  it('derives quantity, value, and weight bases', () => {
    expect(deriveBasisValue('quantity', target).toString()).toBe('10')
    expect(deriveBasisValue('value', target).toString()).toBe('25')
    expect(deriveBasisValue('weight', target).toString()).toBe('7.5')
  })

  it('uses explicit values for the manual basis', () => {
    expect(
      deriveBasisValue('manual', {
        ...target,
        manualBasisValue: 42,
      }).toString(),
    ).toBe('42')
  })

  it('rejects manual/volume bases without explicit values', () => {
    expect(() => deriveBasisValue('manual', target)).toThrow(ConflictError)
    expect(() => deriveBasisValue('volume', target)).toThrow(ConflictError)
  })
})

describe('allocateProRata', () => {
  it('distributes proportionally to the basis', () => {
    const rows = allocateProRata(100, [
      { key: 'a', basisValue: dec(3) },
      { key: 'b', basisValue: dec(1) },
    ])

    expect(
      rows.find((row) => row.key === 'a')?.allocatedAmount.toString(),
    ).toBe('75')
    expect(
      rows.find((row) => row.key === 'b')?.allocatedAmount.toString(),
    ).toBe('25')
  })

  it('always sums exactly to the total (residual to the largest share)', () => {
    const rows = allocateProRata(100, [
      { key: 'a', basisValue: dec(1) },
      { key: 'b', basisValue: dec(1) },
      { key: 'c', basisValue: dec(1) },
    ])

    const sum = rows.reduce((acc, row) => acc.plus(row.allocatedAmount), dec(0))

    expect(sum.toString()).toBe('100')
    // 100/3 rounds to 33.3333 each; the 0.0001 residual lands on one row.
    expect(
      rows.filter((row) => row.allocatedAmount.toString() === '33.3333').length,
    ).toBe(2)
    expect(
      rows.filter((row) => row.allocatedAmount.toString() === '33.3334').length,
    ).toBe(1)
  })

  it('rejects an empty or zero basis', () => {
    expect(() => allocateProRata(100, [])).toThrow(ConflictError)
    expect(() =>
      allocateProRata(100, [{ key: 'a', basisValue: dec(0) }]),
    ).toThrow(ConflictError)
  })
})

describe('allocateLandedCost', () => {
  it('allocates freight by value across receipt lines', () => {
    const rows = allocateLandedCost('value', '90', [
      { key: 'cheap', quantity: 10, unitCost: 1 }, // basis 10
      { key: 'dear', quantity: 4, unitCost: 5 }, // basis 20
    ])

    expect(
      rows.find((row) => row.key === 'cheap')?.allocatedAmount.toString(),
    ).toBe('30')
    expect(
      rows.find((row) => row.key === 'dear')?.allocatedAmount.toString(),
    ).toBe('60')
  })

  it('treats missing weights as zero basis for that line', () => {
    const rows = allocateLandedCost('weight', '50', [
      { key: 'heavy', quantity: 2, unitCost: 1, weightPerUnit: 5 },
      { key: 'weightless', quantity: 8, unitCost: 1, weightPerUnit: null },
    ])

    expect(
      rows.find((row) => row.key === 'heavy')?.allocatedAmount.toString(),
    ).toBe('50')
    expect(
      rows.find((row) => row.key === 'weightless')?.allocatedAmount.isZero(),
    ).toBe(true)
  })
})

describe('landed-cost validation', () => {
  it('accepts a voucher payload', () => {
    expect(
      landedCostCreateSchema.safeParse({
        goodsReceiptId: UUID,
        allocationBasis: 'weight',
        charges: [{ amount: '120.50', description: 'Sea freight' }],
      }).success,
    ).toBe(true)
  })

  it('rejects a voucher without charges', () => {
    expect(
      landedCostCreateSchema.safeParse({ goodsReceiptId: UUID, charges: [] })
        .success,
    ).toBe(false)
  })

  it('accepts manual basis rows on allocate', () => {
    expect(
      landedCostAllocateSchema.safeParse({
        manualBasis: [{ goodsReceiptLineId: UUID, basisValue: 12 }],
      }).success,
    ).toBe(true)
  })
})

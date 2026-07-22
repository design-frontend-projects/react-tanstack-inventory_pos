import { describe, expect, it } from 'vitest'
import {
  priceListWriteSchema,
  productPriceWriteSchema,
} from '#/features/pricing/validation'

const UUID = '3f9f1d2e-7c4a-4b8e-9a1d-2e7c4a4b8e9a'

describe('priceListWriteSchema', () => {
  it('accepts a minimal valid price list', () => {
    const result = priceListWriteSchema.safeParse({
      code: 'RETAIL',
      name: 'Retail prices',
    })

    expect(result.success).toBe(true)
  })

  it('coerces ISO date strings for validity windows', () => {
    const result = priceListWriteSchema.safeParse({
      code: 'SEASON',
      name: 'Seasonal',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2026-03-31T00:00:00.000Z',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.validFrom).toBeInstanceOf(Date)
      expect(result.data.validTo).toBeInstanceOf(Date)
    }
  })

  it('rejects an invalid type', () => {
    const result = priceListWriteSchema.safeParse({
      code: 'X',
      name: 'X',
      type: 'INTERNAL',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a currency code that is not 3 characters', () => {
    const result = priceListWriteSchema.safeParse({
      code: 'X',
      name: 'X',
      currencyCode: 'USDT',
    })

    expect(result.success).toBe(false)
  })

  it('rejects an empty code', () => {
    const result = priceListWriteSchema.safeParse({ code: '', name: 'X' })

    expect(result.success).toBe(false)
  })
})

describe('productPriceWriteSchema', () => {
  const base = {
    priceListId: UUID,
    productId: UUID,
    uomId: UUID,
  }

  it('accepts a numeric unit price', () => {
    const result = productPriceWriteSchema.safeParse({
      ...base,
      unitPrice: 12.5,
    })

    expect(result.success).toBe(true)
  })

  it('accepts a numeric-string unit price and minQty tier', () => {
    const result = productPriceWriteSchema.safeParse({
      ...base,
      unitPrice: '12.50',
      minQty: '10',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a negative unit price', () => {
    const result = productPriceWriteSchema.safeParse({
      ...base,
      unitPrice: -1,
    })

    expect(result.success).toBe(false)
  })

  it('rejects a non-numeric unit price string', () => {
    const result = productPriceWriteSchema.safeParse({
      ...base,
      unitPrice: 'twelve',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a missing uomId', () => {
    const result = productPriceWriteSchema.safeParse({
      priceListId: UUID,
      productId: UUID,
      unitPrice: 5,
    })

    expect(result.success).toBe(false)
  })

  it('allows a nullable variantId', () => {
    const result = productPriceWriteSchema.safeParse({
      ...base,
      unitPrice: 5,
      variantId: null,
    })

    expect(result.success).toBe(true)
  })
})

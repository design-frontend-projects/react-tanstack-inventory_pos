import { describe, expect, it } from 'vitest'
import {
  autoMapHeaders,
  buildImportTemplateCsv,
  normalizeHeader,
  productImportRowSchema,
} from '#/features/products/import/import-schema'
import { parseCsvTable } from '#/lib/csv/parse-csv'

describe('productImportRowSchema', () => {
  it('accepts a minimal row and trims text', () => {
    const parsed = productImportRowSchema.parse({
      sku: ' SKU-1 ',
      name: ' Espresso ',
      baseUomCode: 'PCS',
    })
    expect(parsed.sku).toBe('SKU-1')
    expect(parsed.name).toBe('Espresso')
    expect(parsed.description).toBeUndefined()
  })

  it('coerces spreadsheet-style booleans, enums, and comma decimals', () => {
    const parsed = productImportRowSchema.parse({
      sku: 'SKU-2',
      name: 'Milk',
      baseUomCode: 'LTR',
      isStockTracked: 'Yes',
      hasExpiry: '0',
      costingMethod: 'weighted average',
      status: 'active',
      defaultPrice: '12,50',
      leadTimeDays: '7',
    })
    expect(parsed.isStockTracked).toBe(true)
    expect(parsed.hasExpiry).toBe(false)
    expect(parsed.costingMethod).toBe('WEIGHTED_AVERAGE')
    expect(parsed.status).toBe('ACTIVE')
    expect(parsed.defaultPrice).toBe('12.50')
    expect(parsed.leadTimeDays).toBe(7)
  })

  it('rejects rows missing required fields or with bad numbers', () => {
    expect(
      productImportRowSchema.safeParse({ name: 'No SKU', baseUomCode: 'PCS' })
        .success,
    ).toBe(false)
    expect(
      productImportRowSchema.safeParse({
        sku: 'SKU-3',
        name: 'Bad price',
        baseUomCode: 'PCS',
        defaultPrice: 'abc',
      }).success,
    ).toBe(false)
  })

  it('treats empty strings as absent optional values', () => {
    const parsed = productImportRowSchema.parse({
      sku: 'SKU-4',
      name: 'Sparse',
      baseUomCode: 'PCS',
      barcode: '',
      standardCost: '',
      isStockTracked: '',
    })
    expect(parsed.barcode).toBeUndefined()
    expect(parsed.standardCost).toBeUndefined()
    expect(parsed.isStockTracked).toBeUndefined()
  })
})

describe('autoMapHeaders', () => {
  it('maps common header spellings onto import fields', () => {
    const mapping = autoMapHeaders([
      'SKU',
      'Product Name',
      'EAN',
      'Unit of Measure',
      'Sale Price',
    ])
    expect(mapping.sku).toBe('SKU')
    expect(mapping.name).toBe('Product Name')
    expect(mapping.barcode).toBe('EAN')
    expect(mapping.baseUomCode).toBe('Unit of Measure')
    expect(mapping.defaultPrice).toBe('Sale Price')
  })

  it('leaves unknown headers unmapped', () => {
    expect(autoMapHeaders(['Mystery Column'])).toEqual({})
  })
})

describe('buildImportTemplateCsv', () => {
  it('round-trips through the parser and auto-maps every required field', () => {
    const table = parseCsvTable(buildImportTemplateCsv())
    const mapping = autoMapHeaders(table.headers)
    expect(mapping.sku).toBeDefined()
    expect(mapping.name).toBeDefined()
    expect(mapping.baseUomCode).toBeDefined()
    expect(table.records).toHaveLength(1)
  })
})

describe('normalizeHeader', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeHeader('Lead Time (Days)')).toBe('lead time days')
    expect(normalizeHeader('  Base_UoM-Code ')).toBe('base uom code')
  })
})

import { describe, expect, it } from 'vitest'
import { formatDocumentNumber } from '#/server/inventory/document-number-service'

describe('formatDocumentNumber', () => {
  it('zero-pads the sequence to the configured width', () => {
    expect(
      formatDocumentNumber({
        prefix: 'PO',
        scope: 'default',
        periodKey: 'all',
        consumed: 42,
        padding: 6,
      })
    ).toBe('PO-000042')
  })

  it('includes a non-default scope segment', () => {
    expect(
      formatDocumentNumber({
        prefix: 'GRN',
        scope: 'WH1',
        periodKey: 'all',
        consumed: 7,
        padding: 5,
      })
    ).toBe('GRN-WH1-00007')
  })

  it('includes a period segment when scoped to a period', () => {
    expect(
      formatDocumentNumber({
        prefix: 'INV',
        scope: 'default',
        periodKey: '2026',
        consumed: 1,
        padding: 4,
      })
    ).toBe('INV-2026-0001')
  })

  it('orders prefix, period, then scope segments', () => {
    expect(
      formatDocumentNumber({
        prefix: 'SO',
        scope: 'STORE7',
        periodKey: '2026',
        consumed: 128,
        padding: 6,
      })
    ).toBe('SO-2026-STORE7-000128')
  })
})

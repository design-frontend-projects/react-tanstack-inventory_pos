import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COA_TEMPLATE,
  templateLevel,
  templatePath,
  validateCoaTemplate,
} from '#/server/finance/coa-template'

const byCode = new Map(DEFAULT_COA_TEMPLATE.map((entry) => [entry.code, entry]))

describe('DEFAULT_COA_TEMPLATE', () => {
  it('passes its own integrity validation', () => {
    expect(() => validateCoaTemplate(DEFAULT_COA_TEMPLATE)).not.toThrow()
  })

  it('declares parents before children', () => {
    const seen = new Set<string>()

    for (const entry of DEFAULT_COA_TEMPLATE) {
      if (entry.parentCode) {
        expect(seen.has(entry.parentCode)).toBe(true)
      }

      seen.add(entry.code)
    }
  })

  it('provides Arabic names for every account', () => {
    for (const entry of DEFAULT_COA_TEMPLATE) {
      expect(entry.nameAr.length).toBeGreaterThan(0)
    }
  })

  it('wires every required settings role exactly once', () => {
    const roles = DEFAULT_COA_TEMPLATE.flatMap((entry) =>
      entry.settingsRole ? [entry.settingsRole] : [],
    )

    expect(new Set(roles).size).toBe(roles.length)

    for (const required of [
      'retainedEarningsAccountId',
      'suspenseAccountId',
      'roundingAccountId',
      'defaultArControlAccountId',
      'defaultApControlAccountId',
      'grniAccountId',
      'inventoryAccountId',
      'cogsAccountId',
      'salesRevenueAccountId',
      'bankClearingAccountId',
      'fxRealizedGainAccountId',
      'fxRealizedLossAccountId',
      'fxUnrealizedGainAccountId',
      'fxUnrealizedLossAccountId',
    ]) {
      expect(roles).toContain(required)
    }
  })

  it('marks control accounts with their subledger domain', () => {
    const arControl = byCode.get('1200')
    const apControl = byCode.get('2100')

    expect(arControl?.isControlAccount).toBe(true)
    expect(arControl?.controlDomain).toBe('ar')
    expect(arControl?.allowManualJournal).toBe(false)
    expect(apControl?.controlDomain).toBe('ap')
  })

  it('rejects duplicate codes and dangling parents', () => {
    expect(() =>
      validateCoaTemplate([
        ...DEFAULT_COA_TEMPLATE,
        { ...DEFAULT_COA_TEMPLATE[0] },
      ]),
    ).toThrow(/duplicate/)

    expect(() =>
      validateCoaTemplate([
        {
          code: 'X1',
          name: 'X',
          nameAr: 'س',
          accountTypeCode: 'cash',
          parentCode: 'missing',
        },
      ]),
    ).toThrow(/missing parent/)
  })
})

describe('templateLevel / templatePath', () => {
  it('computes hierarchy depth and materialized path', () => {
    const cashbox = byCode.get('1110')!

    expect(templateLevel(cashbox, byCode)).toBe(3)
    expect(templatePath(cashbox, byCode)).toBe('1000/1100/1110')
  })

  it('roots have level 1 and self path', () => {
    const root = byCode.get('1000')!

    expect(templateLevel(root, byCode)).toBe(1)
    expect(templatePath(root, byCode)).toBe('1000')
  })
})

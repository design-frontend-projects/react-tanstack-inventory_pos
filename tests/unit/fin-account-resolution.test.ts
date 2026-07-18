import { describe, expect, it } from 'vitest'
import {
  PostingAccountUnresolvedError,
  resolveAccount,
  resolveMappedAccount,
  selectAmount,
  selectRule
  
  
} from '#/server/finance/account-resolution'
import type {AccountResolutionContext, MappingRecord} from '#/server/finance/account-resolution';

const mappings: Array<MappingRecord> = [
  {
    entityType: 'product',
    entityId: 'prod-1',
    entityCode: null,
    mappingRole: 'sales_revenue',
    accountId: 'acc-product',
  },
  {
    entityType: 'product_category',
    entityId: 'cat-1',
    entityCode: null,
    mappingRole: 'sales_revenue',
    accountId: 'acc-category',
  },
  {
    entityType: 'payment_method',
    entityId: null,
    entityCode: 'cash',
    mappingRole: 'settlement',
    accountId: 'acc-cash',
  },
]

const context = (
  overrides: Partial<AccountResolutionContext> = {},
): AccountResolutionContext => ({
  mappingCandidates: [
    { entityType: 'product', entityId: 'prod-1' },
    { entityType: 'product_category', entityId: 'cat-1' },
    { entityType: 'payment_method', entityCode: 'cash' },
  ],
  mappings,
  settings: { salesRevenueAccountId: 'acc-settings' },
  strictAccountResolution: true,
  suspenseAccountId: 'acc-suspense',
  ...overrides,
})

describe('resolveMappedAccount', () => {
  it('prefers the most specific candidate', () => {
    expect(
      resolveMappedAccount(
        mappings,
        context().mappingCandidates,
        null,
        'sales_revenue',
      ),
    ).toBe('acc-product')
  })

  it('falls through to category when product has no mapping', () => {
    const withoutProduct = mappings.filter((m) => m.entityType !== 'product')

    expect(
      resolveMappedAccount(
        withoutProduct,
        context().mappingCandidates,
        null,
        'sales_revenue',
      ),
    ).toBe('acc-category')
  })

  it('matches code-keyed entities like payment methods', () => {
    expect(
      resolveMappedAccount(
        mappings,
        context().mappingCandidates,
        'payment_method',
        'settlement',
      ),
    ).toBe('acc-cash')
  })

  it('returns null when nothing matches', () => {
    expect(
      resolveMappedAccount(mappings, [], null, 'sales_revenue'),
    ).toBeNull()
  })
})

describe('resolveAccount', () => {
  it('uses a fixed account directly', () => {
    const resolved = resolveAccount(
      {
        lineRole: 'x',
        side: 'debit',
        accountSource: 'fixed',
        accountId: 'acc-fixed',
      },
      context(),
    )

    expect(resolved).toEqual({ accountId: 'acc-fixed', usedSuspense: false })
  })

  it('resolves through mappings', () => {
    const resolved = resolveAccount(
      {
        lineRole: 'sales_revenue',
        side: 'credit',
        accountSource: 'mapping',
        mappingRole: 'sales_revenue',
      },
      context(),
    )

    expect(resolved.accountId).toBe('acc-product')
  })

  it('resolves from settings defaults', () => {
    const resolved = resolveAccount(
      {
        lineRole: 'sales_revenue',
        side: 'credit',
        accountSource: 'settings_default',
        settingsField: 'salesRevenueAccountId',
      },
      context(),
    )

    expect(resolved.accountId).toBe('acc-settings')
  })

  it('throws in strict mode when unresolvable', () => {
    expect(() =>
      resolveAccount(
        {
          lineRole: 'missing',
          side: 'debit',
          accountSource: 'mapping',
          mappingRole: 'missing_role',
        },
        context(),
      ),
    ).toThrow(PostingAccountUnresolvedError)
  })

  it('falls back to suspense in lenient mode', () => {
    const resolved = resolveAccount(
      {
        lineRole: 'missing',
        side: 'debit',
        accountSource: 'mapping',
        mappingRole: 'missing_role',
      },
      context({ strictAccountResolution: false }),
    )

    expect(resolved).toEqual({ accountId: 'acc-suspense', usedSuspense: true })
  })
})

describe('selectRule', () => {
  const rules = [
    { tenantId: null, eventType: 'pos_sale.completed', priority: 100, isActive: true, id: 'system' },
    { tenantId: 't1', eventType: 'pos_sale.completed', priority: 50, isActive: true, id: 'tenant-low' },
    { tenantId: 't1', eventType: 'pos_sale.completed', priority: 200, isActive: true, id: 'tenant-high' },
    { tenantId: 't1', eventType: 'pos_sale.completed', priority: 999, isActive: false, id: 'inactive' },
  ]

  it('tenant rules shadow system rules; highest priority wins', () => {
    expect(selectRule(rules, 'pos_sale.completed')?.id).toBe('tenant-high')
  })

  it('falls back to the system rule when no tenant rule exists', () => {
    const systemOnly = rules.filter((rule) => rule.tenantId === null)

    expect(selectRule(systemOnly, 'pos_sale.completed')?.id).toBe('system')
  })

  it('ignores inactive rules and unknown events', () => {
    expect(selectRule(rules, 'unknown.event')).toBeNull()
  })
})

describe('selectAmount', () => {
  it('reads the selector from the amount pool', () => {
    expect(selectAmount({ net_total: '95.5' }, 'net_total')).toBe('95.5')
  })

  it('throws for a missing selector', () => {
    expect(() => selectAmount({}, 'tax_total')).toThrow(/does not provide/)
  })
})

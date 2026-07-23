import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as customerRepo from '#/server/repos/customer-repo'
import * as profileRepo from '#/server/repos/crm-customer-profile-repo'
import * as metricsRepo from '#/server/repos/crm-metrics-repo'
import * as loyaltyRepo from '#/server/repos/crm-loyalty-repo'
import * as tagRepo from '#/server/repos/crm-tag-repo'
import * as metricsService from '#/server/crm/metrics-service'
import {
  getCrmCustomerSummary,
  getCrmDashboardWithNames,
  listCrmCustomers,
} from '#/server/crm/customer-directory-service'
import type { CurrentUserContext } from '#/types/auth'

// The directory service composes the customer master page with its CRM
// satellites via batched reads. Repos are mocked (vi.mock hoists above the
// imports); these tests pin the filter intersection, enrichment merge, and
// Decimal→string serialization contract.

vi.mock('#/server/repos/customer-repo', () => ({
  listCustomersPage: vi.fn(),
  countCustomersPage: vi.fn(),
  listCustomersByIds: vi.fn(),
}))
vi.mock('#/server/repos/crm-customer-profile-repo', () => ({
  listProfilesByCustomerIds: vi.fn(),
  listCustomerIdsByLifecycle: vi.fn(),
  countProfilesByLifecycle: vi.fn(),
}))
vi.mock('#/server/repos/crm-metrics-repo', () => ({
  listMetricsByCustomerIds: vi.fn(),
}))
vi.mock('#/server/repos/crm-loyalty-repo', () => ({
  listAccountsByCustomerIds: vi.fn(),
  listTiers: vi.fn(),
}))
vi.mock('#/server/repos/crm-tag-repo', () => ({
  listTagsForCustomers: vi.fn(),
  listCustomerIdsByTag: vi.fn(),
}))
vi.mock('#/server/crm/metrics-service', () => ({
  getCrmDashboard: vi.fn(),
}))
vi.mock('#/server/inventory/catalog-dto', () => ({
  serializeCustomer: (customer: Record<string, unknown>) => ({ ...customer }),
}))

const context = {} as CurrentUserContext
const TENANT = 'tenant-1'

function decimal(value: string) {
  return { toString: () => value }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(customerRepo.listCustomersPage).mockResolvedValue([])
  vi.mocked(customerRepo.countCustomersPage).mockResolvedValue(0)
  vi.mocked(profileRepo.listProfilesByCustomerIds).mockResolvedValue([])
  vi.mocked(metricsRepo.listMetricsByCustomerIds).mockResolvedValue([])
  vi.mocked(loyaltyRepo.listAccountsByCustomerIds).mockResolvedValue([])
  vi.mocked(loyaltyRepo.listTiers).mockResolvedValue([])
  vi.mocked(tagRepo.listTagsForCustomers).mockResolvedValue([])
})

describe('listCrmCustomers', () => {
  it('merges profile, metrics, loyalty, and tags onto the customer row', async () => {
    vi.mocked(customerRepo.listCustomersPage).mockResolvedValue([
      { id: 'c1', name: 'Ada', code: 'CUST-1' },
    ] as never)
    vi.mocked(customerRepo.countCustomersPage).mockResolvedValue(1)
    vi.mocked(profileRepo.listProfilesByCustomerIds).mockResolvedValue([
      {
        customerId: 'c1',
        lifecycleStatus: 'ACTIVE',
        vipLevel: 3,
        isCorporate: false,
        companyName: null,
        acquisitionChannel: 'referral',
      },
    ] as never)
    vi.mocked(metricsRepo.listMetricsByCustomerIds).mockResolvedValue([
      {
        customerId: 'c1',
        ordersCount: 7,
        totalSpend: decimal('120.5000'),
        avgOrderValue: decimal('17.2143'),
        lastPurchaseAt: new Date('2026-07-01'),
        rfmSegment: 'loyal',
        churnScore: decimal('0.25'),
        clvEstimate: decimal('900.0000'),
      },
    ] as never)
    vi.mocked(loyaltyRepo.listAccountsByCustomerIds).mockResolvedValue([
      { customerId: 'c1', tierId: 't1', pointsBalance: 420 },
    ] as never)
    vi.mocked(loyaltyRepo.listTiers).mockResolvedValue([
      { id: 't1', name: 'Gold' },
    ] as never)
    vi.mocked(tagRepo.listTagsForCustomers).mockResolvedValue([
      { customerId: 'c1', tag: { id: 'tag1', name: 'VIP', color: '#e60023' } },
    ] as never)

    const result = await listCrmCustomers(context, TENANT, {})

    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    const row = result.items[0]
    expect(row.lifecycleStatus).toBe('ACTIVE')
    expect(row.vipLevel).toBe(3)
    expect(row.ordersCount).toBe(7)
    expect(row.totalSpend).toBe('120.5000')
    expect(row.churnScore).toBe('0.25')
    expect(row.pointsBalance).toBe(420)
    expect(row.tierName).toBe('Gold')
    expect(row.tags).toEqual([{ id: 'tag1', name: 'VIP', color: '#e60023' }])
  })

  it('defaults satellite values when no CRM rows exist', async () => {
    vi.mocked(customerRepo.listCustomersPage).mockResolvedValue([
      { id: 'c2', name: 'Blank', code: 'CUST-2' },
    ] as never)
    vi.mocked(customerRepo.countCustomersPage).mockResolvedValue(1)

    const result = await listCrmCustomers(context, TENANT, {})
    const row = result.items[0]

    expect(row.lifecycleStatus).toBeNull()
    expect(row.vipLevel).toBe(0)
    expect(row.ordersCount).toBe(0)
    expect(row.totalSpend).toBe('0')
    expect(row.pointsBalance).toBe(0)
    expect(row.tierName).toBeNull()
    expect(row.tags).toEqual([])
  })

  it('intersects lifecycle and tag id filters before querying the master', async () => {
    vi.mocked(profileRepo.listCustomerIdsByLifecycle).mockResolvedValue([
      'c1',
      'c2',
    ])
    vi.mocked(tagRepo.listCustomerIdsByTag).mockResolvedValue(['c2', 'c3'])
    vi.mocked(customerRepo.listCustomersPage).mockResolvedValue([])
    vi.mocked(customerRepo.countCustomersPage).mockResolvedValue(0)

    await listCrmCustomers(context, TENANT, {
      lifecycleStatus: 'ACTIVE',
      tagId: 'tag-1',
    })

    expect(customerRepo.listCustomersPage).toHaveBeenCalledWith(
      TENANT,
      expect.objectContaining({ ids: ['c2'] }),
      0,
      25,
    )
  })

  it('short-circuits to an empty page when the satellite filter matches nobody', async () => {
    vi.mocked(profileRepo.listCustomerIdsByLifecycle).mockResolvedValue([])

    const result = await listCrmCustomers(context, TENANT, {
      lifecycleStatus: 'BLOCKED',
    })

    expect(result).toEqual({ items: [], total: 0, page: 0, pageSize: 25 })
    expect(customerRepo.listCustomersPage).not.toHaveBeenCalled()
  })
})

describe('getCrmCustomerSummary', () => {
  it('folds lifecycle groupBy buckets into a record', async () => {
    vi.mocked(customerRepo.countCustomersPage).mockResolvedValue(10)
    vi.mocked(profileRepo.countProfilesByLifecycle).mockResolvedValue([
      { lifecycleStatus: 'ACTIVE', _count: { _all: 6 } },
      { lifecycleStatus: 'AT_RISK', _count: { _all: 2 } },
    ] as never)

    const summary = await getCrmCustomerSummary(context, TENANT)

    expect(summary.total).toBe(10)
    expect(summary.byLifecycle).toEqual({ ACTIVE: 6, AT_RISK: 2 })
  })
})

describe('getCrmDashboardWithNames', () => {
  it('joins customer names onto top-spend and churn rows', async () => {
    vi.mocked(metricsService.getCrmDashboard).mockResolvedValue({
      customerCount: 2,
      totalSpend: '100',
      totalOrders: 5,
      totalReturnsValue: '0',
      avgOrderValue: '20',
      rfmDistribution: [],
      topCustomers: [{ customerId: 'c1' }],
      churnRisk: [{ customerId: 'c9' }],
    } as never)
    vi.mocked(customerRepo.listCustomersByIds).mockResolvedValue([
      { id: 'c1', name: 'Ada', code: 'CUST-1' },
    ] as never)

    const dashboard = await getCrmDashboardWithNames(context, TENANT)

    expect(customerRepo.listCustomersByIds).toHaveBeenCalledWith(TENANT, [
      'c1',
      'c9',
    ])
    expect(dashboard.topCustomers[0]).toMatchObject({
      customerName: 'Ada',
      customerCode: 'CUST-1',
    })
    expect(dashboard.churnRisk[0]).toMatchObject({
      customerName: 'Unknown customer',
      customerCode: null,
    })
  })
})

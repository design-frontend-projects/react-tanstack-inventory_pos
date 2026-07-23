import type {
  CrmCustomerMetrics,
  CrmLifecycleStatus,
} from '#/server/db/generated/prisma/client'
import { serializeCustomer } from '#/server/inventory/catalog-dto'
import * as customerRepo from '#/server/repos/customer-repo'
import * as loyaltyRepo from '#/server/repos/crm-loyalty-repo'
import * as metricsRepo from '#/server/repos/crm-metrics-repo'
import * as profileRepo from '#/server/repos/crm-customer-profile-repo'
import * as tagRepo from '#/server/repos/crm-tag-repo'
import * as metricsService from '#/server/crm/metrics-service'
import type { CurrentUserContext } from '#/types/auth'

// CRM directory reads: one paginated surface joining the `customers` master
// with its CRM satellites (profile, metrics, loyalty, tags) via batched `in`
// queries — customerId is a bare scalar, so there are no Prisma relations to
// include. Read-only; all writes stay in the profile/loyalty services.

export interface DirectoryFilters {
  search?: string
  lifecycleStatus?: CrmLifecycleStatus
  tagId?: string
  includeInactive?: boolean
  page?: number
  pageSize?: number
}

function metricsSummary(metrics: CrmCustomerMetrics | undefined) {
  if (!metrics) {
    return {
      ordersCount: 0,
      totalSpend: '0',
      avgOrderValue: '0',
      lastPurchaseAt: null as Date | null,
      rfmSegment: null as string | null,
      churnScore: null as string | null,
      clvEstimate: null as string | null,
    }
  }

  return {
    ordersCount: metrics.ordersCount,
    totalSpend: metrics.totalSpend.toString(),
    avgOrderValue: metrics.avgOrderValue.toString(),
    lastPurchaseAt: metrics.lastPurchaseAt,
    rfmSegment: metrics.rfmSegment,
    churnScore: metrics.churnScore?.toString() ?? null,
    clvEstimate: metrics.clvEstimate?.toString() ?? null,
  }
}

export async function listCrmCustomers(
  _context: CurrentUserContext,
  tenantId: string,
  filters: DirectoryFilters = {},
) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 25

  // Satellite filters narrow the master query to a pre-resolved id set.
  let ids: Array<string> | undefined

  if (filters.lifecycleStatus) {
    ids = await profileRepo.listCustomerIdsByLifecycle(
      tenantId,
      filters.lifecycleStatus,
    )
  }

  if (filters.tagId) {
    const tagged = await tagRepo.listCustomerIdsByTag(tenantId, filters.tagId)
    ids = ids ? tagged.filter((id) => ids?.includes(id)) : tagged
  }

  if (ids && ids.length === 0) {
    return { items: [], total: 0, page, pageSize }
  }

  const pageFilters: customerRepo.CustomerPageFilters = {
    search: filters.search,
    includeInactive: filters.includeInactive,
    ids,
  }

  const [customers, total] = await Promise.all([
    customerRepo.listCustomersPage(
      tenantId,
      pageFilters,
      page * pageSize,
      pageSize,
    ),
    customerRepo.countCustomersPage(tenantId, pageFilters),
  ])

  const customerIds = customers.map((customer) => customer.id)

  const [profiles, metrics, accounts, tiers, tagLinks] = await Promise.all([
    profileRepo.listProfilesByCustomerIds(tenantId, customerIds),
    metricsRepo.listMetricsByCustomerIds(tenantId, customerIds),
    loyaltyRepo.listAccountsByCustomerIds(tenantId, customerIds),
    loyaltyRepo.listTiers(tenantId),
    tagRepo.listTagsForCustomers(tenantId, customerIds),
  ])

  const profileByCustomer = new Map(
    profiles.map((profile) => [profile.customerId, profile]),
  )
  const metricsByCustomer = new Map(metrics.map((row) => [row.customerId, row]))
  const accountByCustomer = new Map(
    accounts.map((account) => [account.customerId, account]),
  )
  const tierById = new Map(tiers.map((tier) => [tier.id, tier]))
  const tagsByCustomer = new Map<
    string,
    Array<{ id: string; name: string; color: string | null }>
  >()

  for (const link of tagLinks) {
    const existing = tagsByCustomer.get(link.customerId) ?? []
    tagsByCustomer.set(link.customerId, [
      ...existing,
      { id: link.tag.id, name: link.tag.name, color: link.tag.color },
    ])
  }

  const items = customers.map((customer) => {
    const profile = profileByCustomer.get(customer.id)
    const account = accountByCustomer.get(customer.id)
    const tier = account?.tierId ? tierById.get(account.tierId) : undefined

    return {
      ...serializeCustomer(customer),
      lifecycleStatus: profile?.lifecycleStatus ?? null,
      vipLevel: profile?.vipLevel ?? 0,
      isCorporate: profile?.isCorporate ?? false,
      companyName: profile?.companyName ?? null,
      acquisitionChannel: profile?.acquisitionChannel ?? null,
      ...metricsSummary(metricsByCustomer.get(customer.id)),
      pointsBalance: account?.pointsBalance ?? 0,
      tierName: tier?.name ?? null,
      tags: tagsByCustomer.get(customer.id) ?? [],
    }
  })

  return { items, total, page, pageSize }
}

export type CrmDirectoryRow = Awaited<
  ReturnType<typeof listCrmCustomers>
>['items'][number]

export async function getCrmCustomerSummary(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const [total, lifecycleCounts] = await Promise.all([
    customerRepo.countCustomersPage(tenantId, { includeInactive: true }),
    profileRepo.countProfilesByLifecycle(tenantId),
  ])

  const byLifecycle: Record<string, number> = {}
  for (const bucket of lifecycleCounts) {
    byLifecycle[bucket.lifecycleStatus] = bucket._count._all
  }

  return { total, byLifecycle }
}

// Dashboard read with customer names folded into the metrics-projection rows —
// the projection stores only customerId, but the dashboard renders names.
export async function getCrmDashboardWithNames(
  context: CurrentUserContext,
  tenantId: string,
  options: { churnThreshold?: number } = {},
) {
  const dashboard = await metricsService.getCrmDashboard(
    context,
    tenantId,
    options,
  )

  const customerIds = [
    ...new Set(
      [...dashboard.topCustomers, ...dashboard.churnRisk].map(
        (row) => row.customerId,
      ),
    ),
  ]
  const customers = await customerRepo.listCustomersByIds(tenantId, customerIds)
  const nameById = new Map(
    customers.map((customer) => [
      customer.id,
      { name: customer.name, code: customer.code },
    ]),
  )

  const withNames = <T extends { customerId: string }>(rows: Array<T>) =>
    rows.map((row) => ({
      ...row,
      customerName: nameById.get(row.customerId)?.name ?? 'Unknown customer',
      customerCode: nameById.get(row.customerId)?.code ?? null,
    }))

  return {
    ...dashboard,
    topCustomers: withNames(dashboard.topCustomers),
    churnRisk: withNames(dashboard.churnRisk),
  }
}

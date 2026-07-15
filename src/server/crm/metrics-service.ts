import type { CrmCustomerMetrics } from '#/server/db/generated/prisma/client'
import * as metricsRepo from '#/server/repos/crm-metrics-repo'
import type { CurrentUserContext } from '#/types/auth'

// Dashboard/360 reads over the metrics projection. Never recomputes — the
// projector maintains these rows incrementally.

function serializeMetrics(row: CrmCustomerMetrics) {
  return {
    ...row,
    totalSpend: row.totalSpend.toString(),
    avgOrderValue: row.avgOrderValue.toString(),
    returnsValue: row.returnsValue.toString(),
    churnScore: row.churnScore?.toString() ?? null,
    clvEstimate: row.clvEstimate?.toString() ?? null,
    lastEventSequence: row.lastEventSequence.toString(),
  }
}

export async function getCustomerMetrics(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string
) {
  const [metrics, monthly] = await Promise.all([
    metricsRepo.findMetrics(tenantId, customerId),
    metricsRepo.listMonthly(tenantId, customerId),
  ])

  return {
    metrics: metrics ? serializeMetrics(metrics) : null,
    monthly: monthly.map((row) => ({ ...row, spend: row.spend.toString() })),
  }
}

export async function getCrmDashboard(
  _context: CurrentUserContext,
  tenantId: string,
  options: { churnThreshold?: number } = {}
) {
  const [aggregates, topCustomers, churnRisk] = await Promise.all([
    metricsRepo.dashboardAggregates(tenantId),
    metricsRepo.listTopBySpend(tenantId, 10),
    metricsRepo.listChurnRisk(tenantId, options.churnThreshold ?? 0.7, 25),
  ])

  return {
    customerCount: aggregates.totals._count._all,
    totalSpend: aggregates.totals._sum.totalSpend?.toString() ?? '0',
    totalOrders: aggregates.totals._sum.ordersCount ?? 0,
    totalReturnsValue: aggregates.totals._sum.returnsValue?.toString() ?? '0',
    avgOrderValue: aggregates.totals._avg.avgOrderValue?.toString() ?? '0',
    rfmDistribution: aggregates.rfmDistribution.map((bucket) => ({
      segment: bucket.rfmSegment,
      count: bucket._count._all,
    })),
    topCustomers: topCustomers.map(serializeMetrics),
    churnRisk: churnRisk.map(serializeMetrics),
  }
}

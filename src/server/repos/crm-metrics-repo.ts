import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Per-customer metrics projection rows + monthly trend rows. Written only by
// the metrics projection (guarded by lastEventSequence) and read by the 360
// view and dashboards.

export function findMetrics(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetrics.findUnique({
    where: { tenantId_customerId: { tenantId, customerId } },
  })
}

export interface MetricsUpsertInput {
  firstPurchaseAt?: Date | null
  lastPurchaseAt?: Date | null
  ordersCount: number
  totalSpend: Prisma.Decimal | string
  avgOrderValue: Prisma.Decimal | string
  returnsCount: number
  returnsValue: Prisma.Decimal | string
  visitCount: number
  favoriteProductId?: string | null
  favoriteWarehouseId?: string | null
  favoritePaymentMethod?: string | null
  favoritesJson?: Prisma.InputJsonValue
  rfmRecency?: number | null
  rfmFrequency?: number | null
  rfmMonetary?: number | null
  rfmSegment?: string | null
  churnScore?: Prisma.Decimal | string | number | null
  clvEstimate?: Prisma.Decimal | string | null
  lastEventSequence: bigint
}

export function upsertMetrics(
  tenantId: string,
  customerId: string,
  input: MetricsUpsertInput,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetrics.upsert({
    where: { tenantId_customerId: { tenantId, customerId } },
    create: { tenantId, customerId, ...input },
    update: { ...input },
  })
}

export function incrementMonthly(
  tenantId: string,
  customerId: string,
  periodKey: string,
  delta: { ordersCount?: number; spend?: Prisma.Decimal | string; pointsEarned?: number },
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetricsMonthly.upsert({
    where: {
      tenantId_customerId_periodKey: { tenantId, customerId, periodKey },
    },
    create: {
      tenantId,
      customerId,
      periodKey,
      ordersCount: delta.ordersCount ?? 0,
      spend: delta.spend ?? 0,
      pointsEarned: delta.pointsEarned ?? 0,
    },
    update: {
      ...(delta.ordersCount ? { ordersCount: { increment: delta.ordersCount } } : {}),
      ...(delta.spend ? { spend: { increment: delta.spend } } : {}),
      ...(delta.pointsEarned ? { pointsEarned: { increment: delta.pointsEarned } } : {}),
    },
  })
}

export function listMonthly(
  tenantId: string,
  customerId: string,
  take = 24,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetricsMonthly.findMany({
    where: { tenantId, customerId },
    orderBy: { periodKey: 'desc' },
    take,
  })
}

export function listTopBySpend(
  tenantId: string,
  take = 10,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetrics.findMany({
    where: { tenantId },
    orderBy: { totalSpend: 'desc' },
    take,
  })
}

export function listChurnRisk(
  tenantId: string,
  threshold: Prisma.Decimal | string | number,
  take = 25,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerMetrics.findMany({
    where: { tenantId, churnScore: { gte: threshold } },
    orderBy: { churnScore: 'desc' },
    take,
  })
}

export async function dashboardAggregates(
  tenantId: string,
  client: PrismaClientLike = prisma
) {
  const [totals, rfmDistribution] = await Promise.all([
    client.crmCustomerMetrics.aggregate({
      where: { tenantId },
      _count: { _all: true },
      _sum: { totalSpend: true, ordersCount: true, returnsValue: true },
      _avg: { avgOrderValue: true },
    }),
    client.crmCustomerMetrics.groupBy({
      by: ['rfmSegment'],
      where: { tenantId, rfmSegment: { not: null } },
      _count: { _all: true },
    }),
  ])

  return { totals, rfmDistribution }
}

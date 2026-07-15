import type { CustomerFacts } from '#/server/crm/segment-evaluator'
import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Assembles the flat CustomerFacts projection (metrics + profile + loyalty)
// used by the segment evaluator. One read per source table; missing rows fall
// back to neutral defaults so a brand-new customer still evaluates.

export async function buildCustomerFacts(
  tenantId: string,
  customerId: string,
  now: Date,
  client: PrismaClientLike = prisma
): Promise<CustomerFacts> {
  const [metrics, profile, loyalty] = await Promise.all([
    client.crmCustomerMetrics.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
    }),
    client.crmCustomerProfile.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
    }),
    client.crmLoyaltyAccount.findUnique({
      where: { tenantId_customerId: { tenantId, customerId } },
    }),
  ])

  const daysSinceLastPurchase = metrics?.lastPurchaseAt
    ? Math.floor((now.getTime() - metrics.lastPurchaseAt.getTime()) / 86_400_000)
    : null

  return {
    totalSpend: metrics ? Number(metrics.totalSpend) : 0,
    ordersCount: metrics?.ordersCount ?? 0,
    avgOrderValue: metrics ? Number(metrics.avgOrderValue) : 0,
    returnsCount: metrics?.returnsCount ?? 0,
    visitCount: metrics?.visitCount ?? 0,
    daysSinceLastPurchase,
    loyaltyPoints: loyalty?.pointsBalance ?? 0,
    lifetimePoints: loyalty?.lifetimePoints ?? 0,
    churnScore: metrics?.churnScore ? Number(metrics.churnScore) : null,
    rfmSegment: metrics?.rfmSegment ?? null,
    lifecycleStatus: profile?.lifecycleStatus ?? null,
    vipLevel: profile?.vipLevel ?? 0,
    isCorporate: profile?.isCorporate ?? false,
    acquisitionChannel: profile?.acquisitionChannel ?? null,
  }
}

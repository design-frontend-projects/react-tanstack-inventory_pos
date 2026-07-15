import type { OwnerBillingCycle, OwnerSubscriptionStatus } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'

export async function findDefaultSubscriptionPlan() {
  return prisma.ownerSubscriptionPlan.findFirst({
    where: {
      isDefault: true,
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  })
}

export async function findTenantSubscriptionByTenantId(tenantId: string) {
  return prisma.ownerTenantSubscription.findUnique({
    where: {
      tenantId,
    },
  })
}

export async function createTenantSubscription(input: {
  tenantId: string
  planId: string
  status?: OwnerSubscriptionStatus
  billingCycle?: OwnerBillingCycle
  trialEndsAt?: Date | null
}) {
  return prisma.ownerTenantSubscription.create({
    data: {
      tenantId: input.tenantId,
      planId: input.planId,
      status: input.status ?? 'TRIALING',
      billingCycle: input.billingCycle ?? 'MONTHLY',
      trialEndsAt: input.trialEndsAt ?? null,
    },
  })
}

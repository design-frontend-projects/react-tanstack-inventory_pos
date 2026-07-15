import { ValidationError } from '#/server/auth/errors'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import {
  createTenantSubscription,
  findDefaultSubscriptionPlan,
  findTenantSubscriptionByTenantId,
} from '#/server/repos/owner-subscription-repo'

function computeTrialEndsAt(trialDays: number): Date | null {
  if (trialDays <= 0) {
    return null
  }

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)
  return trialEndsAt
}

// Assigns the default subscription plan to a tenant during owner onboarding.
// Idempotent: returns the existing subscription if one is already provisioned.
export async function provisionDefaultSubscription(
  tenantId: string,
  actorProfileId?: string | null
) {
  const existingSubscription = await findTenantSubscriptionByTenantId(tenantId)
  if (existingSubscription) {
    return existingSubscription
  }

  const defaultPlan = await findDefaultSubscriptionPlan()
  if (!defaultPlan) {
    throw new ValidationError('Default subscription plan seed is missing.')
  }

  const subscription = await createTenantSubscription({
    tenantId,
    planId: defaultPlan.id,
    status: 'TRIALING',
    billingCycle: 'MONTHLY',
    trialEndsAt: computeTrialEndsAt(defaultPlan.trialDays),
  })

  await createAuditLog({
    tenantId,
    actorProfileId: actorProfileId ?? null,
    actionKey: 'subscription.provisioned',
    entityType: 'owner_tenant_subscription',
    entityId: subscription.id,
    newValues: {
      planCode: defaultPlan.code,
      status: subscription.status,
    },
  })

  return subscription
}

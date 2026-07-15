export interface ActivityOption {
  code: string
  name: string
  nameAr: string | null
}

export interface SubscriptionPlanFeature {
  code: string
  name: string
  description: string | null
  isIncluded: boolean
  limitValue: number | null
}

export interface SubscriptionPlan {
  code: string
  name: string
  description: string | null
  priceMonthly: number
  priceYearly: number | null
  currency: string
  trialDays: number
  isDefault: boolean
  features: Array<SubscriptionPlanFeature>
}

export type TenantSubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'

export interface TenantSubscription {
  tenantId: string
  planCode: string
  status: TenantSubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

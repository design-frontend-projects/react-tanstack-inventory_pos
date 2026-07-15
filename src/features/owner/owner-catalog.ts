// Plain-data bootstrap catalog for the owner tier (platform / SaaS-operator level:
// activity options and subscription plans + features). Intentionally free of React
// or Lucide imports so it is safe to import from the `tsx prisma/seed.ts` runner and
// from the client (sign-up fallback). In the DB-authoritative model this is bootstrap
// input for the seed, not the runtime source of truth.

export type ActivityOptionDefinition = {
  code: string
  name: string
  nameAr: string
  description: string
  displayOrder: number
}

export type SubscriptionPlanFeatureDefinition = {
  code: string
  name: string
  description: string
  isIncluded: boolean
  // null = unlimited / not a numeric limit
  limitValue: number | null
  displayOrder: number
}

export type SubscriptionPlanDefinition = {
  code: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number | null
  currency: string
  trialDays: number
  isDefault: boolean
  displayOrder: number
  features: ReadonlyArray<SubscriptionPlanFeatureDefinition>
}

export const ACTIVITY_OPTION_DEFINITIONS: ReadonlyArray<ActivityOptionDefinition> = [
  {
    code: 'restaurant',
    name: 'Restaurant',
    nameAr: 'مطعم',
    description: 'Food service, dine-in, and kitchen operations.',
    displayOrder: 1,
  },
  {
    code: 'retail',
    name: 'Retail',
    nameAr: 'تجزئة',
    description: 'Storefront and point-of-sale retail operations.',
    displayOrder: 2,
  },
  {
    code: 'hybrid',
    name: 'Hybrid',
    nameAr: 'مختلط',
    description: 'Combined restaurant and retail operations.',
    displayOrder: 3,
  },
]

export const SUBSCRIPTION_PLAN_DEFINITIONS: ReadonlyArray<SubscriptionPlanDefinition> = [
  {
    code: 'free',
    name: 'Free',
    description: 'Get started with a single outlet and core POS features.',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    trialDays: 0,
    isDefault: true,
    displayOrder: 1,
    features: [
      { code: 'pos', name: 'Point of sale', description: 'Core POS checkout.', isIncluded: true, limitValue: null, displayOrder: 1 },
      { code: 'inventory', name: 'Inventory', description: 'Basic inventory tracking.', isIncluded: true, limitValue: null, displayOrder: 2 },
      { code: 'max_outlets', name: 'Outlets', description: 'Maximum number of outlets.', isIncluded: true, limitValue: 1, displayOrder: 3 },
      { code: 'max_users', name: 'Team members', description: 'Maximum number of users.', isIncluded: true, limitValue: 3, displayOrder: 4 },
    ],
  },
  {
    code: 'starter',
    name: 'Starter',
    description: 'For growing businesses that need more outlets and staff.',
    priceMonthly: 29,
    priceYearly: 290,
    currency: 'USD',
    trialDays: 14,
    isDefault: false,
    displayOrder: 2,
    features: [
      { code: 'pos', name: 'Point of sale', description: 'Core POS checkout.', isIncluded: true, limitValue: null, displayOrder: 1 },
      { code: 'inventory', name: 'Inventory', description: 'Inventory management.', isIncluded: true, limitValue: null, displayOrder: 2 },
      { code: 'max_outlets', name: 'Outlets', description: 'Maximum number of outlets.', isIncluded: true, limitValue: 3, displayOrder: 3 },
      { code: 'max_users', name: 'Team members', description: 'Maximum number of users.', isIncluded: true, limitValue: 10, displayOrder: 4 },
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Advanced reporting and higher limits for scaling operations.',
    priceMonthly: 79,
    priceYearly: 790,
    currency: 'USD',
    trialDays: 14,
    isDefault: false,
    displayOrder: 3,
    features: [
      { code: 'pos', name: 'Point of sale', description: 'Core POS checkout.', isIncluded: true, limitValue: null, displayOrder: 1 },
      { code: 'inventory', name: 'Inventory', description: 'Advanced inventory management.', isIncluded: true, limitValue: null, displayOrder: 2 },
      { code: 'reporting', name: 'Advanced reporting', description: 'Advanced analytics and reports.', isIncluded: true, limitValue: null, displayOrder: 3 },
      { code: 'max_outlets', name: 'Outlets', description: 'Maximum number of outlets.', isIncluded: true, limitValue: 10, displayOrder: 4 },
      { code: 'max_users', name: 'Team members', description: 'Maximum number of users.', isIncluded: true, limitValue: 50, displayOrder: 5 },
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited scale with priority support and custom terms.',
    priceMonthly: 199,
    priceYearly: 1990,
    currency: 'USD',
    trialDays: 14,
    isDefault: false,
    displayOrder: 4,
    features: [
      { code: 'pos', name: 'Point of sale', description: 'Core POS checkout.', isIncluded: true, limitValue: null, displayOrder: 1 },
      { code: 'inventory', name: 'Inventory', description: 'Advanced inventory management.', isIncluded: true, limitValue: null, displayOrder: 2 },
      { code: 'reporting', name: 'Advanced reporting', description: 'Advanced analytics and reports.', isIncluded: true, limitValue: null, displayOrder: 3 },
      { code: 'priority_support', name: 'Priority support', description: 'Priority customer support.', isIncluded: true, limitValue: null, displayOrder: 4 },
      { code: 'max_outlets', name: 'Outlets', description: 'Unlimited outlets.', isIncluded: true, limitValue: null, displayOrder: 5 },
      { code: 'max_users', name: 'Team members', description: 'Unlimited users.', isIncluded: true, limitValue: null, displayOrder: 6 },
    ],
  },
]

// Stable list of activity codes used as a client-side fallback when the DB-backed
// list is unavailable. The DB (`owner_activity_options`) is the runtime source of truth.
export const ACTIVITY_OPTION_CODES = ACTIVITY_OPTION_DEFINITIONS.map(
  (definition) => definition.code
) as ReadonlyArray<string>

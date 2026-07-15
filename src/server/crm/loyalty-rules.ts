import { Prisma } from '#/server/db/generated/prisma/client'
import { ValidationError } from '#/server/auth/errors'

// Pure loyalty math: earn calculation, tier determination, redemption
// validation, and FIFO expiry-lot consumption. Kept free of I/O so it is
// unit-testable.

export interface EarnSettings {
  pointsPerCurrencyUnit: Prisma.Decimal | string | number
  isActive: boolean
}

export interface EarnRuleFacts {
  ruleType: 'BASE' | 'CATEGORY_BONUS' | 'PRODUCT_BONUS' | 'BIRTHDAY' | 'ANNIVERSARY' | 'CHANNEL'
  multiplier?: Prisma.Decimal | string | number | null
  fixedPoints?: number | null
  conditions?: {
    categoryIds?: Array<string>
    productIds?: Array<string>
    channels?: Array<string>
  } | null
  validFrom?: Date | null
  validTo?: Date | null
  isActive: boolean
}

export interface EarnContext {
  grandTotal: Prisma.Decimal | string | number
  productIds?: Array<string>
  categoryIds?: Array<string>
  channel?: string | null
  isBirthday?: boolean
  isAnniversary?: boolean
  at?: Date
}

function ruleApplies(rule: EarnRuleFacts, context: EarnContext, at: Date): boolean {
  if (!rule.isActive) {
    return false
  }

  if (rule.validFrom && at < rule.validFrom) {
    return false
  }

  if (rule.validTo && at > rule.validTo) {
    return false
  }

  switch (rule.ruleType) {
    case 'BASE':
      return true
    case 'CATEGORY_BONUS':
      return Boolean(
        rule.conditions?.categoryIds?.some((id) => context.categoryIds?.includes(id))
      )
    case 'PRODUCT_BONUS':
      return Boolean(
        rule.conditions?.productIds?.some((id) => context.productIds?.includes(id))
      )
    case 'CHANNEL':
      return Boolean(
        context.channel && rule.conditions?.channels?.includes(context.channel)
      )
    case 'BIRTHDAY':
      return context.isBirthday === true
    case 'ANNIVERSARY':
      return context.isAnniversary === true
  }
}

// Earned points = grandTotal × pointsPerCurrencyUnit × tierMultiplier ×
// (product of applicable rule multipliers) + sum of applicable fixed bonuses,
// floored to a whole point. A disabled program earns nothing.
export function calculateEarnPoints(
  settings: EarnSettings,
  tierMultiplier: Prisma.Decimal | string | number,
  rules: Array<EarnRuleFacts>,
  context: EarnContext
): number {
  if (!settings.isActive) {
    return 0
  }

  const at = context.at ?? new Date()
  const total = new Prisma.Decimal(context.grandTotal)

  if (total.lte(0)) {
    return 0
  }

  let points = total
    .times(new Prisma.Decimal(settings.pointsPerCurrencyUnit))
    .times(new Prisma.Decimal(tierMultiplier))
  let fixedBonus = 0

  for (const rule of rules) {
    if (!ruleApplies(rule, context, at)) {
      continue
    }

    if (rule.multiplier != null) {
      points = points.times(new Prisma.Decimal(rule.multiplier))
    }

    if (rule.fixedPoints != null) {
      fixedBonus += rule.fixedPoints
    }
  }

  return points.floor().toNumber() + fixedBonus
}

export interface TierFacts {
  id: string
  rank: number
  minLifetimePoints: number
}

// Highest-ranked tier whose lifetime threshold is met; null below every tier.
export function determineTier(
  lifetimePoints: number,
  tiers: Array<TierFacts>
): TierFacts | null {
  const eligible = tiers
    .filter((tier) => lifetimePoints >= tier.minLifetimePoints)
    .sort((left, right) => right.rank - left.rank)

  return eligible[0] ?? null
}

export interface RedemptionSettings {
  redemptionValuePerPoint: Prisma.Decimal | string | number
  minRedeemPoints: number
  isActive: boolean
}

// Validates a redemption and returns its currency value.
export function validateRedemption(
  settings: RedemptionSettings,
  balance: number,
  points: number
): { valueAmount: Prisma.Decimal } {
  if (!settings.isActive) {
    throw new ValidationError('The loyalty program is not active.')
  }

  if (!Number.isInteger(points) || points <= 0) {
    throw new ValidationError('Redemption points must be a positive whole number.')
  }

  if (points < settings.minRedeemPoints) {
    throw new ValidationError(
      `Redemption below the minimum of ${settings.minRedeemPoints} points.`
    )
  }

  if (points > balance) {
    throw new ValidationError(
      `Insufficient points: balance ${balance}, requested ${points}.`
    )
  }

  return {
    valueAmount: new Prisma.Decimal(points).times(
      new Prisma.Decimal(settings.redemptionValuePerPoint)
    ),
  }
}

export interface ExpiryLot {
  id: string
  remainingPoints: number
}

export interface LotConsumption {
  lotId: string
  consumed: number
  remainingAfter: number
}

// FIFO consumption over open EARN/BONUS lots (redemption and expiry both eat
// the oldest points first). Throws when the lots cannot cover the request —
// callers validate against the account balance first, so a shortfall means the
// ledger and account disagree.
export function consumeLotsFifo(
  lots: Array<ExpiryLot>,
  points: number
): Array<LotConsumption> {
  const consumptions: Array<LotConsumption> = []
  let remaining = points

  for (const lot of lots) {
    if (remaining <= 0) {
      break
    }

    if (lot.remainingPoints <= 0) {
      continue
    }

    const consumed = Math.min(lot.remainingPoints, remaining)
    consumptions.push({
      lotId: lot.id,
      consumed,
      remainingAfter: lot.remainingPoints - consumed,
    })
    remaining -= consumed
  }

  if (remaining > 0) {
    throw new ValidationError(
      `Loyalty lots cover ${points - remaining} of ${points} requested points — ledger out of sync with balance.`
    )
  }

  return consumptions
}

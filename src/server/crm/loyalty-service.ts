import { NotFoundError, ValidationError } from '#/server/auth/errors'
import {
  calculateEarnPoints,
  consumeLotsFifo,
  determineTier,
  validateRedemption,
} from '#/server/crm/loyalty-rules'
import type { EarnRuleFacts } from '#/server/crm/loyalty-rules'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  CrmLoyaltyAccount,
  CrmLoyaltyEarnRule,
  DomainEvent,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as loyaltyRepo from '#/server/repos/crm-loyalty-repo'
import type { CurrentUserContext } from '#/types/auth'

// Loyalty context. Invariant: sum(ledger.points) == account.pointsBalance —
// every balance mutation happens next to its ledger append, on a row-locked
// account, in one transaction. Redemption/adjustment are synchronous; earning
// is folded from domain events (idempotent via sourceEventId). The deprecated
// Customer.loyaltyPoints column is kept in sync as a read cache.

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  timeout: 30_000,
} as const

function toRuleFacts(rule: CrmLoyaltyEarnRule): EarnRuleFacts {
  return {
    ruleType: rule.ruleType,
    multiplier: rule.multiplier,
    fixedPoints: rule.fixedPoints,
    conditions: (rule.conditionsJson ?? null) as EarnRuleFacts['conditions'],
    validFrom: rule.validFrom,
    validTo: rule.validTo,
    isActive: rule.isActive,
  }
}

async function syncLegacyPointsCache(
  tx: PrismaClientLike,
  tenantId: string,
  customerId: string,
  pointsBalance: number
) {
  await tx.customer.updateMany({
    where: { id: customerId, tenantId },
    data: { loyaltyPoints: pointsBalance },
  })
}

async function recalcTier(
  tx: PrismaClientLike,
  tenantId: string,
  account: CrmLoyaltyAccount,
  lifetimePoints: number
) {
  const tiers = await loyaltyRepo.listTiers(tenantId, tx)
  const target = determineTier(lifetimePoints, tiers)

  if ((target?.id ?? null) !== account.tierId) {
    await loyaltyRepo.applyBalanceChange(
      account.id,
      { pointsDelta: 0, tierId: target?.id ?? null, tierAchievedAt: target ? new Date() : null },
      tx
    )
  }
}

function expiryDateFrom(expiryMonths: number | null, from: Date): Date | null {
  if (!expiryMonths) {
    return null
  }

  const expiry = new Date(from)
  expiry.setMonth(expiry.getMonth() + expiryMonths)

  return expiry
}

// --- Projection entry point ---------------------------------------------------

interface SaleEventPayload {
  grandTotal?: string
  orderType?: string
  lines?: Array<{ productId?: string }>
}

// Folds a completed-sale event into an EARN ledger entry. Idempotent: the
// unique sourceEventId turns a replay into a no-op. Runs inside the
// projector's transaction.
export async function earnPointsFromEvent(tx: PrismaClientLike, event: DomainEvent) {
  if (!event.customerId) {
    return
  }

  if (event.eventType !== 'pos_sale.completed' && event.eventType !== 'sales_order.fulfilled') {
    return
  }

  const settings = await loyaltyRepo.getSettings(event.tenantId, tx)

  if (!settings || !settings.isActive) {
    return
  }

  const payload = event.payloadJson as SaleEventPayload
  const grandTotal = payload.grandTotal ?? '0'

  const account = await loyaltyRepo.ensureAndLockAccount(tx, event.tenantId, event.customerId)
  const rules = await loyaltyRepo.listEarnRules(event.tenantId, tx)
  const tiers = await loyaltyRepo.listTiers(event.tenantId, tx)
  const tierMultiplier =
    tiers.find((tier) => tier.id === account.tierId)?.earnMultiplier ?? new Prisma.Decimal(1)

  const points = calculateEarnPoints(
    settings,
    tierMultiplier,
    rules.map(toRuleFacts),
    {
      grandTotal,
      productIds: (payload.lines ?? [])
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
      channel: payload.orderType ?? null,
      at: event.occurredAt,
    }
  )

  if (points <= 0) {
    return
  }

  const entry = await loyaltyRepo.appendLedgerEntry(
    event.tenantId,
    {
      accountId: account.id,
      customerId: event.customerId,
      entryType: 'EARN',
      points,
      sourceEventId: event.eventId,
      refType: event.aggregateType,
      refId: event.aggregateId,
      expiresAt: expiryDateFrom(settings.expiryMonths, event.occurredAt),
      remainingPoints: points,
    },
    tx
  )

  if (!entry) {
    return
  }

  await loyaltyRepo.applyBalanceChange(
    account.id,
    { pointsDelta: points, lifetimeDelta: points },
    tx
  )
  await recalcTier(tx, event.tenantId, account, account.lifetimePoints + points)
  await syncLegacyPointsCache(
    tx,
    event.tenantId,
    event.customerId,
    account.pointsBalance + points
  )

  await appendDomainEvent(tx, {
    tenantId: event.tenantId,
    eventType: 'crm.loyalty_earned',
    aggregateType: 'crm_loyalty_account',
    aggregateId: account.id,
    customerId: event.customerId,
    payload: {
      points,
      balanceAfter: account.pointsBalance + points,
      refType: event.aggregateType,
      refId: event.aggregateId,
    },
    correlationId: event.correlationId,
  })
}

// --- Synchronous operations -----------------------------------------------------

export async function getLoyaltyAccount(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string
) {
  const account =
    (await loyaltyRepo.findAccountByCustomerId(tenantId, customerId)) ??
    (await loyaltyRepo.ensureAccount(tenantId, customerId))
  const tiers = await loyaltyRepo.listTiers(tenantId)
  const tier = tiers.find((candidate) => candidate.id === account.tierId) ?? null

  return {
    ...account,
    walletBalance: account.walletBalance.toString(),
    tier: tier
      ? {
          ...tier,
          minAnnualSpend: tier.minAnnualSpend?.toString() ?? null,
          earnMultiplier: tier.earnMultiplier.toString(),
        }
      : null,
  }
}

export async function listLoyaltyLedger(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  filters: { take?: number; before?: Date } = {}
) {
  const entries = await loyaltyRepo.listLedger(tenantId, customerId, filters)

  return entries.map((entry) => ({
    ...entry,
    walletAmount: entry.walletAmount?.toString() ?? null,
  }))
}

export async function redeemPoints(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  points: number,
  reference: { refType?: string | null; refId?: string | null; note?: string | null } = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    const settings = await loyaltyRepo.getSettings(tenantId, tx)

    if (!settings) {
      throw new NotFoundError('Loyalty program is not configured for this tenant.')
    }

    const account = await loyaltyRepo.ensureAndLockAccount(tx, tenantId, customerId)
    const { valueAmount } = validateRedemption(settings, account.pointsBalance, points)

    const lots = await loyaltyRepo.listOpenLots(tenantId, account.id, tx)
    const consumptions = consumeLotsFifo(
      lots.map((lot) => ({ id: lot.id, remainingPoints: lot.remainingPoints ?? 0 })),
      points
    )

    for (const consumption of consumptions) {
      await loyaltyRepo.setLotRemaining(consumption.lotId, consumption.remainingAfter, tx)
    }

    await loyaltyRepo.appendLedgerEntry(
      tenantId,
      {
        accountId: account.id,
        customerId,
        entryType: 'REDEEM',
        points: -points,
        walletAmount: valueAmount,
        refType: reference.refType ?? null,
        refId: reference.refId ?? null,
        note: reference.note ?? null,
        createdByProfileId: context.profileId,
      },
      tx
    )

    await loyaltyRepo.applyBalanceChange(account.id, { pointsDelta: -points }, tx)
    await syncLegacyPointsCache(tx, tenantId, customerId, account.pointsBalance - points)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'crm.loyalty_redeem',
        entityType: 'crm_loyalty_account',
        entityId: account.id,
        newValues: { customerId, points, value: valueAmount.toString() },
      },
      tx
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'crm.loyalty_redeemed',
      aggregateType: 'crm_loyalty_account',
      aggregateId: account.id,
      customerId,
      payload: {
        points: -points,
        balanceAfter: account.pointsBalance - points,
        refType: reference.refType ?? null,
        refId: reference.refId ?? null,
      },
      actorProfileId: context.profileId,
    })

    return {
      accountId: account.id,
      customerId,
      redeemedPoints: points,
      valueAmount: valueAmount.toString(),
      pointsBalance: account.pointsBalance - points,
    }
  }, TX_OPTIONS)

  return result
}

export async function adjustPoints(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  points: number,
  note: string
) {
  if (!Number.isInteger(points) || points === 0) {
    throw new ValidationError('Adjustment must be a non-zero whole number of points.')
  }

  const result = await prisma.$transaction(async (tx) => {
    const account = await loyaltyRepo.ensureAndLockAccount(tx, tenantId, customerId)

    if (points < 0) {
      if (account.pointsBalance + points < 0) {
        throw new ValidationError(
          `Adjustment would overdraw the balance (${account.pointsBalance}).`
        )
      }

      const lots = await loyaltyRepo.listOpenLots(tenantId, account.id, tx)
      const consumptions = consumeLotsFifo(
        lots.map((lot) => ({ id: lot.id, remainingPoints: lot.remainingPoints ?? 0 })),
        -points
      )

      for (const consumption of consumptions) {
        await loyaltyRepo.setLotRemaining(consumption.lotId, consumption.remainingAfter, tx)
      }
    }

    await loyaltyRepo.appendLedgerEntry(
      tenantId,
      {
        accountId: account.id,
        customerId,
        entryType: 'ADJUST',
        points,
        remainingPoints: points > 0 ? points : null,
        note,
        createdByProfileId: context.profileId,
      },
      tx
    )

    await loyaltyRepo.applyBalanceChange(
      account.id,
      { pointsDelta: points, lifetimeDelta: points > 0 ? points : 0 },
      tx
    )

    if (points > 0) {
      await recalcTier(tx, tenantId, account, account.lifetimePoints + points)
    }

    await syncLegacyPointsCache(tx, tenantId, customerId, account.pointsBalance + points)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'crm.loyalty_adjust',
        entityType: 'crm_loyalty_account',
        entityId: account.id,
        newValues: { customerId, points, note },
      },
      tx
    )

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'crm.loyalty_adjusted',
      aggregateType: 'crm_loyalty_account',
      aggregateId: account.id,
      customerId,
      payload: { points, balanceAfter: account.pointsBalance + points },
      actorProfileId: context.profileId,
    })

    return {
      accountId: account.id,
      customerId,
      points,
      pointsBalance: account.pointsBalance + points,
    }
  }, TX_OPTIONS)

  return result
}

// Scheduled: expires open FIFO lots past their expiry date, account by
// account (each in its own locked transaction).
export async function expireLoyaltyPoints(
  context: CurrentUserContext,
  tenantId: string,
  options: { limit?: number } = {}
) {
  const cutoff = new Date()
  const candidates = await loyaltyRepo.listAccountsWithExpiredLots(
    tenantId,
    cutoff,
    Math.min(options.limit ?? 100, 500)
  )

  let expiredAccounts = 0
  let expiredPoints = 0

  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const account = await loyaltyRepo.ensureAndLockAccount(
        tx,
        tenantId,
        candidate.customerId
      )
      const lots = await loyaltyRepo.listExpiredLotsForAccount(
        tenantId,
        account.id,
        cutoff,
        tx
      )

      let points = 0

      for (const lot of lots) {
        points += lot.remainingPoints ?? 0
        await loyaltyRepo.setLotRemaining(lot.id, 0, tx)
      }

      if (points === 0) {
        return 0
      }

      await loyaltyRepo.appendLedgerEntry(
        tenantId,
        {
          accountId: account.id,
          customerId: candidate.customerId,
          entryType: 'EXPIRE',
          points: -points,
          note: 'Scheduled point expiry',
        },
        tx
      )

      await loyaltyRepo.applyBalanceChange(account.id, { pointsDelta: -points }, tx)
      await syncLegacyPointsCache(
        tx,
        tenantId,
        candidate.customerId,
        account.pointsBalance - points
      )

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'crm.loyalty_expired',
        aggregateType: 'crm_loyalty_account',
        aggregateId: account.id,
        customerId: candidate.customerId,
        payload: { points: -points, balanceAfter: account.pointsBalance - points },
        actorProfileId: context.profileId,
      })

      return points
    }, TX_OPTIONS)

    if (result > 0) {
      expiredAccounts += 1
      expiredPoints += result
    }
  }

  return { expiredAccounts, expiredPoints }
}

// --- Configuration ---------------------------------------------------------------

export async function getLoyaltySettings(_context: CurrentUserContext, tenantId: string) {
  const settings = await loyaltyRepo.getSettings(tenantId)

  if (!settings) {
    return null
  }

  return {
    ...settings,
    pointsPerCurrencyUnit: settings.pointsPerCurrencyUnit.toString(),
    redemptionValuePerPoint: settings.redemptionValuePerPoint.toString(),
  }
}

export async function updateLoyaltySettings(
  context: CurrentUserContext,
  tenantId: string,
  input: loyaltyRepo.LoyaltySettingsWriteInput
) {
  const settings = await loyaltyRepo.upsertSettings(tenantId, input)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.loyalty_settings_update',
    entityType: 'crm_loyalty_settings',
    entityId: settings.id,
  })

  return {
    ...settings,
    pointsPerCurrencyUnit: settings.pointsPerCurrencyUnit.toString(),
    redemptionValuePerPoint: settings.redemptionValuePerPoint.toString(),
  }
}

export async function listLoyaltyTiers(_context: CurrentUserContext, tenantId: string) {
  const tiers = await loyaltyRepo.listTiers(tenantId)

  return tiers.map((tier) => ({
    ...tier,
    minAnnualSpend: tier.minAnnualSpend?.toString() ?? null,
    earnMultiplier: tier.earnMultiplier.toString(),
  }))
}

export async function upsertLoyaltyTier(
  context: CurrentUserContext,
  tenantId: string,
  input: loyaltyRepo.LoyaltyTierWriteInput
) {
  const tier = await loyaltyRepo.upsertTier(tenantId, input)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.loyalty_tier_update',
    entityType: 'crm_loyalty_tier',
    entityId: tier.id,
    newValues: { code: tier.code },
  })

  return {
    ...tier,
    minAnnualSpend: tier.minAnnualSpend?.toString() ?? null,
    earnMultiplier: tier.earnMultiplier.toString(),
  }
}

export async function listEarnRules(_context: CurrentUserContext, tenantId: string) {
  const rules = await loyaltyRepo.listEarnRules(tenantId)

  return rules.map((rule) => ({
    ...rule,
    multiplier: rule.multiplier?.toString() ?? null,
  }))
}

export async function upsertEarnRule(
  context: CurrentUserContext,
  tenantId: string,
  input: loyaltyRepo.EarnRuleWriteInput
) {
  const rule = await loyaltyRepo.upsertEarnRule(tenantId, input)

  if (!rule) {
    throw new NotFoundError('Earn rule not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.loyalty_rule_update',
    entityType: 'crm_loyalty_earn_rule',
    entityId: rule.id,
    newValues: { name: rule.name },
  })

  return { ...rule, multiplier: rule.multiplier?.toString() ?? null }
}

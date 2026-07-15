import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  CrmLoyaltyAccount,
  LoyaltyEntryType,
  LoyaltyRuleType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Loyalty aggregates: per-tenant settings, tiers, accounts, the append-only
// ledger, and earn rules. Balance mutations happen ONLY next to a ledger
// append inside the caller's transaction, with the account row locked.

export function getSettings(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmLoyaltySettings.findUnique({ where: { tenantId } })
}

export interface LoyaltySettingsWriteInput {
  pointsPerCurrencyUnit?: Prisma.Decimal | string | number
  redemptionValuePerPoint?: Prisma.Decimal | string | number
  minRedeemPoints?: number
  expiryMonths?: number | null
  birthdayBonusPoints?: number
  anniversaryBonusPoints?: number
  isActive?: boolean
}

export function upsertSettings(
  tenantId: string,
  input: LoyaltySettingsWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltySettings.upsert({
    where: { tenantId },
    create: { tenantId, ...input },
    update: { ...input },
  })
}

export function listTiers(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmLoyaltyTier.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { rank: 'asc' },
  })
}

export interface LoyaltyTierWriteInput {
  code: string
  name: string
  rank?: number
  minLifetimePoints?: number
  minAnnualSpend?: Prisma.Decimal | string | number | null
  earnMultiplier?: Prisma.Decimal | string | number
  benefitsJson?: Record<string, unknown> | null
}

export function upsertTier(
  tenantId: string,
  input: LoyaltyTierWriteInput,
  client: PrismaClientLike = prisma
) {
  const data = {
    name: input.name,
    rank: input.rank ?? 0,
    minLifetimePoints: input.minLifetimePoints ?? 0,
    minAnnualSpend: input.minAnnualSpend ?? null,
    earnMultiplier: input.earnMultiplier ?? 1,
    benefitsJson:
      input.benefitsJson == null ? undefined : (input.benefitsJson as Prisma.InputJsonValue),
  }

  return client.crmLoyaltyTier.upsert({
    where: { tenantId_code: { tenantId, code: input.code } },
    create: { tenantId, code: input.code, ...data },
    update: { ...data, deletedAt: null },
  })
}

export function findAccountByCustomerId(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyAccount.findUnique({
    where: { tenantId_customerId: { tenantId, customerId } },
  })
}

export async function ensureAccount(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyAccount.upsert({
    where: { tenantId_customerId: { tenantId, customerId } },
    create: { tenantId, customerId },
    update: {},
  })
}

// Ensure-then-lock: serializes concurrent earn/redeem/adjust on one account.
// MUST run inside a transaction (pass the tx client).
export async function ensureAndLockAccount(
  tx: PrismaClientLike,
  tenantId: string,
  customerId: string
): Promise<CrmLoyaltyAccount> {
  await tx.$executeRaw`
    INSERT INTO crm_loyalty_accounts (id, tenant_id, customer_id, updated_at)
    VALUES (gen_random_uuid(), ${tenantId}::uuid, ${customerId}::uuid, now())
    ON CONFLICT (tenant_id, customer_id) DO NOTHING
  `

  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM crm_loyalty_accounts
    WHERE tenant_id = ${tenantId}::uuid AND customer_id = ${customerId}::uuid
    FOR UPDATE
  `

  const account = await tx.crmLoyaltyAccount.findUnique({
    where: { id: rows[0].id },
  })

  return account!
}

export interface LedgerAppendInput {
  accountId: string
  customerId: string
  entryType: LoyaltyEntryType
  points: number
  walletAmount?: Prisma.Decimal | string | number | null
  sourceEventId?: string | null
  refType?: string | null
  refId?: string | null
  expiresAt?: Date | null
  remainingPoints?: number | null
  note?: string | null
  createdByProfileId?: string | null
}

// Returns null when sourceEventId was already recorded (at-least-once replay).
export async function appendLedgerEntry(
  tenantId: string,
  input: LedgerAppendInput,
  client: PrismaClientLike = prisma
) {
  try {
    return await client.crmLoyaltyLedgerEntry.create({
      data: {
        tenantId,
        accountId: input.accountId,
        customerId: input.customerId,
        entryType: input.entryType,
        points: input.points,
        walletAmount: input.walletAmount ?? null,
        sourceEventId: input.sourceEventId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        expiresAt: input.expiresAt ?? null,
        remainingPoints: input.remainingPoints ?? null,
        note: input.note ?? null,
        createdByProfileId: input.createdByProfileId ?? null,
      },
    })
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      input.sourceEventId
    ) {
      return null
    }

    throw error
  }
}

export function listLedger(
  tenantId: string,
  customerId: string,
  filters: { take?: number; before?: Date } = {},
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyLedgerEntry.findMany({
    where: {
      tenantId,
      customerId,
      ...(filters.before ? { createdAt: { lt: filters.before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.take ?? 50, 200),
  })
}

// Open FIFO lots: EARN/BONUS rows with remaining points, oldest first.
export function listOpenLots(
  tenantId: string,
  accountId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyLedgerEntry.findMany({
    where: {
      tenantId,
      accountId,
      entryType: { in: ['EARN', 'BONUS'] },
      remainingPoints: { gt: 0 },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// Accounts holding lots that expired before the cutoff (for the scheduled
// expiry job).
export function listAccountsWithExpiredLots(
  tenantId: string,
  cutoff: Date,
  limit: number,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyLedgerEntry.findMany({
    where: {
      tenantId,
      entryType: { in: ['EARN', 'BONUS'] },
      remainingPoints: { gt: 0 },
      expiresAt: { lt: cutoff },
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    distinct: ['accountId'],
    select: { accountId: true, customerId: true },
  })
}

export function listExpiredLotsForAccount(
  tenantId: string,
  accountId: string,
  cutoff: Date,
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyLedgerEntry.findMany({
    where: {
      tenantId,
      accountId,
      entryType: { in: ['EARN', 'BONUS'] },
      remainingPoints: { gt: 0 },
      expiresAt: { lt: cutoff },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function setLotRemaining(
  id: string,
  remainingPoints: number,
  client: PrismaClientLike = prisma
) {
  await client.crmLoyaltyLedgerEntry.update({
    where: { id },
    data: { remainingPoints },
  })
}

export async function applyBalanceChange(
  accountId: string,
  change: {
    pointsDelta: number
    lifetimeDelta?: number
    walletDelta?: Prisma.Decimal | string | number
    tierId?: string | null
    tierAchievedAt?: Date | null
  },
  client: PrismaClientLike = prisma
) {
  return client.crmLoyaltyAccount.update({
    where: { id: accountId },
    data: {
      pointsBalance: { increment: change.pointsDelta },
      ...(change.lifetimeDelta
        ? { lifetimePoints: { increment: change.lifetimeDelta } }
        : {}),
      ...(change.walletDelta !== undefined
        ? { walletBalance: { increment: new Prisma.Decimal(change.walletDelta) } }
        : {}),
      ...(change.tierId !== undefined ? { tierId: change.tierId } : {}),
      ...(change.tierAchievedAt !== undefined
        ? { tierAchievedAt: change.tierAchievedAt }
        : {}),
    },
  })
}

export function listEarnRules(tenantId: string, client: PrismaClientLike = prisma) {
  return client.crmLoyaltyEarnRule.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { priority: 'asc' },
  })
}

export interface EarnRuleWriteInput {
  id?: string
  name: string
  ruleType: LoyaltyRuleType
  conditionsJson?: Record<string, unknown> | null
  multiplier?: Prisma.Decimal | string | number | null
  fixedPoints?: number | null
  validFrom?: Date | null
  validTo?: Date | null
  priority?: number
  isActive?: boolean
}

export async function upsertEarnRule(
  tenantId: string,
  input: EarnRuleWriteInput,
  client: PrismaClientLike = prisma
) {
  const data = {
    name: input.name,
    ruleType: input.ruleType,
    conditionsJson:
      input.conditionsJson == null
        ? undefined
        : (input.conditionsJson as Prisma.InputJsonValue),
    multiplier: input.multiplier ?? null,
    fixedPoints: input.fixedPoints ?? null,
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    priority: input.priority ?? 0,
    isActive: input.isActive ?? true,
  }

  if (input.id) {
    const result = await client.crmLoyaltyEarnRule.updateMany({
      where: { id: input.id, tenantId, deletedAt: null },
      data,
    })

    return result.count > 0 ? client.crmLoyaltyEarnRule.findUnique({ where: { id: input.id } }) : null
  }

  return client.crmLoyaltyEarnRule.create({ data: { tenantId, ...data } })
}

import { prisma } from '#/server/db/client'
import type {
  ResGiftCardTxnKind,
  ResPromotionStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Promotions, coupons, and gift cards (growth aggregates).

// --- Promotions -------------------------------------------------------------

export function listPromotions(
  tenantId: string,
  options: { status?: ResPromotionStatus } = {},
  client: PrismaClientLike = prisma,
) {
  return client.resPromotion.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
    },
    include: { coupons: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  })
}

export function findPromotionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resPromotion.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { coupons: true },
  })
}

// Promotions currently applicable: active + inside their date window.
export function listActivePromotions(
  tenantId: string,
  now: Date,
  client: PrismaClientLike = prisma,
) {
  return client.resPromotion.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { priority: 'desc' },
  })
}

export function createPromotion(
  tenantId: string,
  input: {
    branchId?: string | null
    name: string
    kind: string
    priority?: number
    stacking?: string
    conditions: unknown
    action: unknown
    startsAt?: Date | null
    endsAt?: Date | null
    usageLimit?: number | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resPromotion.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      kind: input.kind as never,
      priority: input.priority ?? 10,
      stacking: (input.stacking ?? 'STACKABLE') as never,
      conditions: (input.conditions ?? {}) as never,
      action: input.action as never,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      usageLimit: input.usageLimit ?? null,
    },
  })
}

export async function setPromotionStatus(
  tenantId: string,
  id: string,
  status: ResPromotionStatus,
  client: PrismaClientLike = prisma,
) {
  await client.resPromotion.updateMany({
    where: { id, tenantId },
    data: { status },
  })
}

export async function incrementPromotionUse(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  await client.resPromotion.updateMany({
    where: { id, tenantId },
    data: { usedCount: { increment: 1 } },
  })
}

export function recordApplication(
  tenantId: string,
  input: {
    promotionId: string
    orderId: string
    couponId?: string | null
    amount: string
  },
  client: PrismaClientLike = prisma,
) {
  return client.resPromotionApplication.create({
    data: {
      tenantId,
      promotionId: input.promotionId,
      orderId: input.orderId,
      couponId: input.couponId ?? null,
      amount: input.amount,
    },
  })
}

export function listApplications(
  tenantId: string,
  promotionId: string,
  client: PrismaClientLike = prisma,
) {
  return client.resPromotionApplication.findMany({
    where: { tenantId, promotionId },
    orderBy: { appliedAt: 'desc' },
    take: 200,
  })
}

// --- Coupons ----------------------------------------------------------------

export function findCouponByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
) {
  return client.resCoupon.findFirst({
    where: { tenantId, code, isActive: true },
    include: { promotion: true },
  })
}

export function createCoupon(
  tenantId: string,
  input: {
    promotionId: string
    code: string
    maxUses?: number | null
    expiresAt?: Date | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resCoupon.create({
    data: {
      tenantId,
      promotionId: input.promotionId,
      code: input.code,
      maxUses: input.maxUses ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  })
}

export async function incrementCouponUse(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  await client.resCoupon.updateMany({
    where: { id, tenantId },
    data: { usedCount: { increment: 1 } },
  })
}

// --- Gift cards -------------------------------------------------------------

export function listGiftCards(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.resGiftCard.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findGiftCardById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resGiftCard.findFirst({
    where: { id, tenantId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
  })
}

export function findGiftCardByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
) {
  return client.resGiftCard.findFirst({ where: { tenantId, code } })
}

export function createGiftCard(
  tenantId: string,
  input: {
    code: string
    customerId?: string | null
    initialBalance: string
    expiresAt?: Date | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resGiftCard.create({
    data: {
      tenantId,
      code: input.code,
      customerId: input.customerId ?? null,
      balance: input.initialBalance,
      issuedAmount: input.initialBalance,
      expiresAt: input.expiresAt ?? null,
    },
  })
}

// Atomic balance mutation guarded by the current balance (no overdrafts).
export async function adjustGiftCardBalance(
  tenantId: string,
  id: string,
  delta: string,
  client: PrismaClientLike = prisma,
): Promise<{ balanceAfter: string } | null> {
  const card = await client.resGiftCard.findFirst({ where: { id, tenantId } })
  if (!card) {
    return null
  }
  const next = card.balance.plus(delta)
  if (next.isNegative()) {
    return null
  }
  await client.resGiftCard.updateMany({
    where: { id, tenantId },
    data: {
      balance: next,
      ...(next.isZero() ? { status: 'DEPLETED' } : { status: 'ACTIVE' }),
    },
  })
  return { balanceAfter: next.toString() }
}

export function recordGiftCardTxn(
  tenantId: string,
  input: {
    giftCardId: string
    kind: ResGiftCardTxnKind
    amount: string
    balanceAfter: string
    orderId?: string | null
    reference?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resGiftCardTransaction.create({
    data: {
      tenantId,
      giftCardId: input.giftCardId,
      kind: input.kind,
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      orderId: input.orderId ?? null,
      reference: input.reference ?? null,
    },
  })
}

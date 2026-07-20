import { prisma } from '#/server/db/client'
import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import * as growthRepo from '#/server/repos/res-growth-repo'
import * as orderRepo from '#/server/repos/res-order-repo'
import * as orderService from '#/server/restaurant/orders/order-service'
import { evaluatePromotions } from '#/server/restaurant/promotions/promotion-engine'
import type {
  PromotionCart,
  PromotionRule,
} from '#/server/restaurant/promotions/promotion-engine'
import type {
  ResPromotion,
  ResPromotionApplication,
} from '#/server/db/generated/prisma/client'
import type { CurrentUserContext } from '#/types/auth'

// Promotion CRUD, the order-application flow, and the simulator. The pure
// engine (promotion-engine.ts) is the only rule interpreter.

function serializePromotion(
  row: ResPromotion & { coupons?: Array<{ id: string; code: string; usedCount: number; maxUses: number | null; isActive: boolean }> },
) {
  // Cast the stored JSON to the engine's concrete shapes so the server-fn
  // boundary sees a serializable type (Record<string, unknown> is rejected).
  return {
    ...row,
    conditions: (row.conditions ?? {}) as PromotionRule['conditions'],
    action: row.action as PromotionRule['action'],
  }
}

function toRule(row: ResPromotion): PromotionRule {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    priority: row.priority,
    stacking: row.stacking as 'STACKABLE' | 'EXCLUSIVE',
    conditions: (row.conditions ?? {}) as PromotionRule['conditions'],
    action: row.action as PromotionRule['action'],
  }
}

export async function listPromotions(
  _context: CurrentUserContext,
  tenantId: string,
  input: { status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' } = {},
) {
  const rows = await growthRepo.listPromotions(tenantId, input)
  return rows.map(serializePromotion)
}

export interface PromotionCreateInput {
  name: string
  kind: string
  priority?: number
  stacking?: 'STACKABLE' | 'EXCLUSIVE'
  conditions: Record<string, unknown>
  action: Record<string, unknown>
  startsAt?: string | null
  endsAt?: string | null
  usageLimit?: number | null
  couponCode?: string | null
}

export async function createPromotion(
  _context: CurrentUserContext,
  tenantId: string,
  input: PromotionCreateInput,
) {
  const promotion = await prisma.$transaction(async (tx) => {
    const created = await growthRepo.createPromotion(
      tenantId,
      {
        name: input.name,
        kind: input.kind,
        priority: input.priority,
        stacking: input.stacking,
        conditions: input.conditions,
        action: input.action,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        usageLimit: input.usageLimit ?? null,
      },
      tx,
    )
    if (input.couponCode) {
      await growthRepo.createCoupon(
        tenantId,
        { promotionId: created.id, code: input.couponCode },
        tx,
      )
    }
    return created
  })
  return serializePromotion(promotion)
}

export async function setPromotionStatus(
  _context: CurrentUserContext,
  tenantId: string,
  input: { id: string; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED' },
) {
  const promotion = await growthRepo.findPromotionById(tenantId, input.id)
  if (!promotion) {
    throw new NotFoundError('Promotion not found')
  }
  await growthRepo.setPromotionStatus(tenantId, input.id, input.status)
  return { ok: true }
}

export async function getPromotionAnalytics(
  _context: CurrentUserContext,
  tenantId: string,
  promotionId: string,
) {
  const applications = await growthRepo.listApplications(tenantId, promotionId)
  const total = applications.reduce(
    (sum, app: ResPromotionApplication) => sum + Number(app.amount),
    0,
  )
  return {
    applicationCount: applications.length,
    totalDiscount: total.toFixed(2),
    recent: applications.slice(0, 20).map((app) => ({
      id: app.id,
      orderId: app.orderId,
      amount: app.amount.toString(),
      appliedAt: app.appliedAt.toISOString(),
    })),
  }
}

function orderToCart(order: {
  subtotal: unknown
  channel: string
  orderType: string
  customerId: string | null
  items?: Array<{
    menuItemId: string
    quantity: unknown
    unitPrice: unknown
    lineTotal: unknown
    status: string
  }>
}): PromotionCart {
  return {
    subtotal: String(order.subtotal),
    channel: order.channel,
    orderType: order.orderType,
    customerId: order.customerId,
    items: (order.items ?? [])
      .filter((item) => item.status !== 'VOIDED')
      .map((item) => ({
        menuItemId: item.menuItemId,
        quantity: Number(item.quantity),
        unitPrice: String(item.unitPrice),
        lineTotal: String(item.lineTotal),
      })),
  }
}

// Evaluate active promotions (plus an optional coupon's promotion) against an
// open order, replacing prior promo discounts with the fresh evaluation.
export async function applyPromotionsToOrder(
  context: CurrentUserContext,
  tenantId: string,
  input: { orderId: string; couponCode?: string | null },
) {
  const order = await orderRepo.findOrderWithLines(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED'].includes(order.status)) {
    throw new ValidationError('Promotions can only apply to open orders')
  }

  const now = new Date()
  const active = await growthRepo.listActivePromotions(tenantId, now)
  const rules = active
    .filter(
      (row) => row.usageLimit === null || row.usedCount < row.usageLimit,
    )
    .map(toRule)

  let couponPromotionId: string | null = null
  let couponId: string | null = null
  if (input.couponCode) {
    const coupon = await growthRepo.findCouponByCode(tenantId, input.couponCode)
    if (!coupon) {
      throw new ValidationError('Coupon not found or inactive')
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new ValidationError('Coupon has expired')
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new ValidationError('Coupon is fully used')
    }
    couponPromotionId = coupon.promotionId
    couponId = coupon.id
    if (!rules.some((rule) => rule.id === coupon.promotionId)) {
      const promotion = await growthRepo.findPromotionById(
        tenantId,
        coupon.promotionId,
      )
      if (promotion && promotion.status === 'ACTIVE') {
        rules.push({ ...toRule(promotion), code: coupon.code })
      } else {
        throw new ValidationError('The coupon promotion is not active')
      }
    }
  }

  const evaluation = evaluatePromotions(orderToCart(order), rules, now)

  await prisma.$transaction(async (tx) => {
    // Replace previous promotion discounts with the fresh evaluation.
    await tx.resOrderDiscount.deleteMany({
      where: { tenantId, orderId: order.id, promotionId: { not: null } },
    })

    for (const application of evaluation.applications) {
      await orderRepo.addDiscount(
        tenantId,
        {
          orderId: order.id,
          label: application.name,
          amount: application.discount,
          promotionId: application.promotionId,
          couponId:
            application.promotionId === couponPromotionId ? couponId : null,
        },
        tx,
      )
      await growthRepo.recordApplication(
        tenantId,
        {
          promotionId: application.promotionId,
          orderId: order.id,
          couponId:
            application.promotionId === couponPromotionId ? couponId : null,
          amount: application.discount,
        },
        tx,
      )
      await growthRepo.incrementPromotionUse(
        tenantId,
        application.promotionId,
        tx,
      )
      if (application.promotionId === couponPromotionId && couponId) {
        await growthRepo.incrementCouponUse(tenantId, couponId, tx)
      }
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'restaurant_promotion.applied',
        aggregateType: 'restaurant_promotion',
        aggregateId: application.promotionId,
        customerId: order.customerId,
        actorProfileId: context.profileId,
        payload: {
          promotionId: application.promotionId,
          code: application.code ?? application.name,
          orderId: order.id,
          discount: application.discount,
        },
      })
    }

    // Recompute totals through the order service path (single writer).
    await orderService.recomputeOrderTotals(tenantId, order.id, tx)
  })

  return {
    applications: evaluation.applications,
    totalDiscount: evaluation.totalDiscount,
  }
}

// Dry-run the engine against a hypothetical cart (the wizard's simulator).
export async function simulatePromotions(
  _context: CurrentUserContext,
  tenantId: string,
  input: { cart: PromotionCart; at?: string },
) {
  const now = input.at ? new Date(input.at) : new Date()
  const active = await growthRepo.listActivePromotions(tenantId, now)
  return evaluatePromotions(input.cart, active.map(toRule), now)
}

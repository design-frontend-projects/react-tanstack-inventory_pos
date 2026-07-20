import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as promotions from '#/server/restaurant/promotions/promotion-service'
import * as giftCards from '#/server/restaurant/promotions/gift-card-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  giftCardIssueSchema,
  giftCardRedeemSchema,
  giftCardReloadSchema,
  promotionApplySchema,
  promotionCreateSchema,
  promotionSimulateSchema,
  promotionStatusSchema,
  promotionStatusUpdateSchema,
} from '#/features/restaurant/promotions/validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

const PROMO_VIEW = ['res.promotions.view', 'res.promotions.manage']
const PROMO_MANAGE = 'res.promotions.manage'
const CARD_VIEW = ['res.giftcards.view', 'res.giftcards.manage']
const CARD_MANAGE = 'res.giftcards.manage'

// --- Promotions -------------------------------------------------------------

export const listPromotionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ status: promotionStatusSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, PROMO_VIEW)
    return promotions.listPromotions(context, data.tenantId, {
      status: data.status,
    })
  })

export const createPromotionServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: promotionCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, PROMO_MANAGE)
    return promotions.createPromotion(context, data.tenantId, data.input)
  })

export const setPromotionStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: promotionStatusUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, PROMO_MANAGE)
    return promotions.setPromotionStatus(context, data.tenantId, data.input)
  })

export const getPromotionAnalyticsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ promotionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, PROMO_VIEW)
    return promotions.getPromotionAnalytics(
      context,
      data.tenantId,
      data.promotionId,
    )
  })

export const applyPromotionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: promotionApplySchema }))
  .handler(async ({ data }) => {
    // Cashiers apply promotions/coupons at the point of sale.
    const context = await resolveContext(data, [
      'res.promotions.view',
      'res.orders.update',
      'res.orders.create',
    ])
    const result = await promotions.applyPromotionsToOrder(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['orders'])
    return result
  })

export const simulatePromotionsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: promotionSimulateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, PROMO_VIEW)
    return promotions.simulatePromotions(context, data.tenantId, data.input)
  })

// --- Gift cards -------------------------------------------------------------

export const listGiftCardsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, CARD_VIEW)
    return giftCards.listGiftCards(context, data.tenantId)
  })

export const getGiftCardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, CARD_VIEW)
    return giftCards.getGiftCard(context, data.tenantId, data.id)
  })

export const issueGiftCardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: giftCardIssueSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, CARD_MANAGE)
    return giftCards.issueGiftCard(context, data.tenantId, data.input)
  })

export const reloadGiftCardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: giftCardReloadSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, CARD_MANAGE)
    return giftCards.reloadGiftCard(context, data.tenantId, data.input)
  })

export const redeemGiftCardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: giftCardRedeemSchema }))
  .handler(async ({ data }) => {
    // Redemption happens at the register.
    const context = await resolveContext(data, [
      'res.giftcards.manage',
      'res.cashier.access',
    ])
    const result = await giftCards.redeemGiftCard(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['orders'])
    return result
  })

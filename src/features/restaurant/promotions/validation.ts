import { z } from 'zod'

// Zod schemas for promotions, coupons, and gift cards.

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) =>
    typeof value === 'number' ? value.toString() : value.trim(),
  )
  .refine(
    (value) => value.length > 0 && !Number.isNaN(Number(value)),
    'Must be a numeric value',
  )

export const promotionKindSchema = z.enum([
  'PERCENT',
  'FIXED',
  'BOGO',
  'FREE_ITEM',
  'BUNDLE',
  'HAPPY_HOUR',
  'CASHBACK',
])

export const promotionStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'ENDED',
])

// Declarative condition tree consumed by the pure engine.
export const promotionConditionsSchema = z.object({
  minSubtotal: decimalString.optional(),
  channels: z.array(z.string().max(32)).max(10).optional(),
  orderTypes: z.array(z.string().max(32)).max(10).optional(),
  itemIds: z.array(z.string().uuid()).max(50).optional(),
  categoryIds: z.array(z.string().uuid()).max(50).optional(),
  minQuantity: z.number().int().min(1).max(1000).optional(),
  timeWindow: z
    .object({
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(1).max(1440),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    })
    .optional(),
})

export const promotionActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PERCENT'), value: decimalString }),
  z.object({ type: z.literal('FIXED'), value: decimalString }),
  z.object({
    type: z.literal('BOGO'),
    buyItemIds: z.array(z.string().uuid()).min(1).max(50),
    buyQuantity: z.number().int().min(1).max(100),
    getQuantity: z.number().int().min(1).max(100),
    discountPercent: decimalString.optional(),
  }),
  z.object({
    type: z.literal('FREE_ITEM'),
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  }),
])

export const promotionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: promotionKindSchema,
  priority: z.number().int().min(0).max(1000).optional(),
  stacking: z.enum(['STACKABLE', 'EXCLUSIVE']).optional(),
  conditions: promotionConditionsSchema,
  action: promotionActionSchema,
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  usageLimit: z.number().int().min(1).nullish(),
  couponCode: z.string().trim().min(2).max(64).nullish(),
})

export const promotionStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: promotionStatusSchema,
})

export const promotionApplySchema = z.object({
  orderId: z.string().uuid(),
  couponCode: z.string().trim().max(64).nullish(),
})

export const promotionSimulateSchema = z.object({
  cart: z.object({
    subtotal: decimalString,
    channel: z.string().max(32),
    orderType: z.string().max(32),
    customerId: z.string().uuid().nullish(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          categoryId: z.string().uuid().nullish(),
          quantity: z.number().int().min(1),
          unitPrice: decimalString,
          lineTotal: decimalString,
        }),
      )
      .max(100),
  }),
  at: z.string().datetime().optional(),
})

export const giftCardIssueSchema = z.object({
  code: z.string().trim().min(4).max(64),
  customerId: z.string().uuid().nullish(),
  initialBalance: decimalString,
  expiresAt: z.string().datetime().nullish(),
})

export const giftCardReloadSchema = z.object({
  id: z.string().uuid(),
  amount: decimalString,
})

export const giftCardRedeemSchema = z.object({
  code: z.string().trim().min(4).max(64),
  amount: decimalString,
  orderId: z.string().uuid().nullish(),
})

export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>
export type PromotionApplyInput = z.infer<typeof promotionApplySchema>
export type PromotionSimulateInput = z.infer<typeof promotionSimulateSchema>
export type GiftCardIssueInput = z.infer<typeof giftCardIssueSchema>
export type GiftCardReloadInput = z.infer<typeof giftCardReloadSchema>
export type GiftCardRedeemInput = z.infer<typeof giftCardRedeemSchema>

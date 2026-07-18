import { z } from 'zod'

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => v.length > 0 && !Number.isNaN(Number(v)), 'Must be a numeric value')

export const orderTypeSchema = z.enum(['DINE_IN', 'TAKEAWAY', 'PICKUP', 'DELIVERY', 'DRIVE_THRU'])
export const orderChannelSchema = z.enum([
  'POS',
  'QR',
  'WEBSITE',
  'MOBILE_APP',
  'PHONE',
  'THIRD_PARTY',
])
export const orderStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'CONFIRMED',
  'PREPARING',
  'COOKING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'VOIDED',
])
export const paymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'WALLET',
  'LOYALTY',
  'GIFT_CARD',
  'ONLINE',
  'THIRD_PARTY',
])

export const orderCreateSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid().nullish(),
  customerId: z.string().uuid().nullish(),
  serviceTypeId: z.string().uuid().nullish(),
  orderType: orderTypeSchema.optional(),
  channel: orderChannelSchema.optional(),
  guestCount: z.number().int().min(1).max(100).optional(),
  notes: z.string().trim().max(2000).nullish(),
})

export const orderAddItemSchema = z.object({
  orderId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  quantity: z.number().int().min(1).max(999).optional(),
  unitPrice: decimalString.optional(),
  stationId: z.string().uuid().nullish(),
  specialRequest: z.string().trim().max(500).nullish(),
  modifiers: z
    .array(
      z.object({
        modifierId: z.string().uuid().nullish(),
        name: z.string().trim().min(1).max(200),
        priceDelta: decimalString.optional(),
        quantity: z.number().int().min(1).optional(),
      })
    )
    .optional(),
})

export const orderTransitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: orderStatusSchema,
  reason: z.string().trim().max(500).nullish(),
})

export const orderVoidSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).nullish(),
})

export const orderCompleteSchema = z.object({
  id: z.string().uuid(),
  payments: z
    .array(
      z.object({
        method: paymentMethodSchema,
        amount: decimalString,
        reference: z.string().trim().max(200).nullish(),
        giftCardId: z.string().uuid().nullish(),
        splitLabel: z.string().trim().min(1).max(100).nullish(),
      })
    )
    .min(1),
})

export const orderItemStatusUpdateSchema = z.object({
  orderId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).optional(),
  toStatus: z.enum(['FIRED', 'PREPARING', 'READY', 'SERVED']),
})

export const orderItemVoidSchema = z.object({
  orderId: z.string().uuid(),
  itemId: z.string().uuid(),
  reason: z.string().trim().max(500).nullish(),
})

export const orderTransferSchema = z.object({
  orderId: z.string().uuid(),
  toTableId: z.string().uuid(),
  reason: z.string().trim().max(500).nullish(),
})

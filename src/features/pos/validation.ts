import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const posOrderTypeSchema = z.enum(['COUNTER', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'])
export const paymentMethodSchema = z.enum([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'CREDIT',
  'CHEQUE',
])

export const posSaleLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  unitPrice: decimalInput,
  discount: decimalInput.optional(),
  taxAmount: decimalInput.optional(),
  itemNameSnapshot: z.string().max(200).nullish(),
  skuSnapshot: z.string().max(64).nullish(),
})

export const posSaleCreateSchema = z.object({
  posSessionId: z.string().uuid().nullish(),
  customerId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
  orderType: posOrderTypeSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(posSaleLineSchema).min(1),
})

export const posPaymentSchema = z.object({
  method: paymentMethodSchema,
  amount: decimalInput,
  reference: z.string().max(120).nullish(),
  cardLast4: z.string().max(4).nullish(),
})

export const completeSaleSchema = z.object({
  payments: z.array(posPaymentSchema).min(1),
})

export const openSessionSchema = z.object({
  registerId: z.string().min(1).max(60),
  warehouseId: z.string().uuid().nullish(),
  openingFloat: decimalInput.optional(),
})

export const closeSessionSchema = z.object({
  closingCash: decimalInput,
})

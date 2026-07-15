import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const salesReturnReasonSchema = z.enum([
  'DAMAGED',
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'EXPIRED',
  'CUSTOMER_CHANGED_MIND',
  'OTHER',
])

export const refundMethodSchema = z.enum([
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'CREDIT',
  'CHEQUE',
])

export const salesReturnLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  locationId: z.string().uuid(),
  uomId: z.string().uuid(),
  quantity: decimalInput,
  unitPrice: decimalInput,
  discount: decimalInput.optional(),
  taxAmount: decimalInput.optional(),
  costAtReturn: decimalInput.nullish(),
  restock: z.boolean().optional(),
  originLineId: z.string().uuid().nullish(),
  lotId: z.string().uuid().nullish(),
  serialId: z.string().uuid().nullish(),
})

export const salesReturnCreateSchema = z.object({
  customerId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid(),
  salesOrderId: z.string().uuid().nullish(),
  reason: salesReturnReasonSchema.optional(),
  refundMethod: refundMethodSchema.nullish(),
  notes: z.string().max(2000).nullish(),
  lines: z.array(salesReturnLineSchema).min(1),
})

export const posRefundSchema = z.object({
  reason: salesReturnReasonSchema.optional(),
  refundMethod: refundMethodSchema.nullish(),
  notes: z.string().max(2000).nullish(),
  lines: z
    .array(
      z.object({
        saleLineId: z.string().uuid(),
        quantity: decimalInput,
      })
    )
    .optional(),
})

export const creditNoteFromReturnSchema = z.object({
  salesReturnId: z.string().uuid(),
})

export const debitNoteFromPurchaseReturnSchema = z.object({
  purchaseReturnId: z.string().uuid(),
})

export const noteApplySchema = z.object({
  amount: decimalInput,
})

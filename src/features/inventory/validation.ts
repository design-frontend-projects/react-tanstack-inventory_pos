import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const adjustmentReasonSchema = z.enum([
  'DAMAGE',
  'EXPIRY',
  'LOSS',
  'FOUND',
  'CORRECTION',
  'REVALUATION',
])

export const movementTypeSchema = z.enum([
  'OPENING_BALANCE',
  'PURCHASE_RECEIPT',
  'PURCHASE_RETURN',
  'SALE',
  'SALES_RETURN',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ADJUSTMENT_INC',
  'ADJUSTMENT_DEC',
  'PRODUCTION_OUTPUT',
  'PRODUCTION_CONSUMPTION',
  'DAMAGE',
  'EXPIRED',
  'LOST',
  'CYCLE_COUNT_INC',
  'CYCLE_COUNT_DEC',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'RESERVATION_CONVERSION',
  'REVALUATION',
  'LANDED_COST_ADJUSTMENT',
])

export const adjustmentLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  locationId: z.string().uuid(),
  lotId: z.string().uuid().nullish(),
  serialId: z.string().uuid().nullish(),
  uomId: z.string().uuid(),
  systemQty: decimalInput.optional(),
  adjustedQty: decimalInput,
  qtyDelta: decimalInput,
  unitCost: decimalInput.nullish(),
  reason: z.string().max(240).nullish(),
})

export const adjustmentCreateSchema = z.object({
  warehouseId: z.string().uuid(),
  reasonCode: adjustmentReasonSchema,
  notes: z.string().max(2000).nullish(),
  lines: z.array(adjustmentLineSchema).min(1),
})

export const stockFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  onlyNonZero: z.boolean().optional(),
  take: z.number().int().min(1).max(500).optional(),
  skip: z.number().int().min(0).optional(),
})

export const movementFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  movementType: movementTypeSchema.optional(),
  take: z.number().int().min(1).max(500).optional(),
  skip: z.number().int().min(0).optional(),
})

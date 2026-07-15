import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const dateInput = z.coerce.date()

export const bomComponentSchema = z.object({
  componentProductId: z.string().uuid(),
  componentVariantId: z.string().uuid().nullish(),
  quantity: decimalInput,
  uomId: z.string().uuid(),
  scrapPercent: decimalInput.optional(),
  notes: z.string().max(500).nullish(),
})

export const bomCreateSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  name: z.string().min(1).max(200),
  version: z.number().int().positive().optional(),
  isDefault: z.boolean().optional(),
  outputQty: decimalInput,
  uomId: z.string().uuid(),
  overheadCost: decimalInput.optional(),
  notes: z.string().max(2000).nullish(),
  components: z.array(bomComponentSchema).min(1),
})

export const productionMaterialSchema = z.object({
  componentProductId: z.string().uuid(),
  componentVariantId: z.string().uuid().nullish(),
  fromLocationId: z.string().uuid(),
  uomId: z.string().uuid(),
  plannedQty: decimalInput,
  lotId: z.string().uuid().nullish(),
  serialId: z.string().uuid().nullish(),
})

export const productionOrderCreateSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  bomId: z.string().uuid().nullish(),
  warehouseId: z.string().uuid(),
  outputLocationId: z.string().uuid(),
  materialLocationId: z.string().uuid().nullish(),
  plannedQty: decimalInput,
  overheadCost: decimalInput.optional(),
  plannedStartDate: dateInput.nullish(),
  plannedEndDate: dateInput.nullish(),
  notes: z.string().max(2000).nullish(),
  materials: z.array(productionMaterialSchema).optional(),
})

export const completeProductionSchema = z.object({
  producedQty: decimalInput.optional(),
  lotNumber: z.string().max(120).nullish(),
  expiryDate: dateInput.nullish(),
  serialNumbers: z.array(z.string().min(1).max(120)).optional(),
})

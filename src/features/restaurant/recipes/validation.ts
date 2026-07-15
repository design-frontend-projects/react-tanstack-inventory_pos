import { z } from 'zod'

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v.trim()))
  .refine((v) => v.length > 0 && !Number.isNaN(Number(v)), 'Must be a numeric value')

const code = z.string().trim().min(1).max(64)
const name = z.string().trim().min(1).max(200)

export const recipeStatusSchema = z.enum(['DRAFT', 'APPROVED', 'ARCHIVED'])

export const recipeCreateSchema = z.object({
  menuItemId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  code,
  name,
  status: recipeStatusSchema.optional(),
  yieldQty: decimalString.optional(),
  yieldUomId: z.string().uuid().nullish(),
  notes: z.string().trim().max(2000).nullish(),
})

export const recipeVersionCreateSchema = z.object({
  recipeId: z.string().uuid(),
  notes: z.string().trim().max(2000).nullish(),
})

export const recipeLineCreateSchema = z.object({
  versionId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  uomId: z.string().uuid().nullish(),
  quantity: decimalString,
  wastePercent: decimalString.optional(),
  isOptional: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export const recipeStepCreateSchema = z.object({
  versionId: z.string().uuid(),
  stepNo: z.number().int().min(1),
  instruction: z.string().trim().min(1).max(2000),
  durationMin: z.number().int().min(0).nullish(),
})

export const recipeComputeCostSchema = z.object({
  versionId: z.string().uuid(),
})

export const recipeApproveSchema = z.object({
  recipeId: z.string().uuid(),
  versionId: z.string().uuid(),
})

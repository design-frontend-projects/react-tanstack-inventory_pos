import { z } from 'zod'

// Zod schemas for the career & succession sub-domain server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const careerPathWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  fromPositionId: z.string().uuid().nullish(),
  toPositionId: z.string().uuid().nullish(),
  minYears: decimalInput.nullish(),
  requirements: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
})

export const successorWriteSchema = z.object({
  positionId: z.string().uuid(),
  employeeId: z.string().uuid(),
  readinessLevel: z
    .enum(['ready_now', 'ready_soon', 'developing', 'long_term'])
    .optional(),
  readinessMonths: z.number().int().min(0).nullish(),
  priority: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(2000).nullish(),
})

export const promotionCreateSchema = z.object({
  employeeId: z.string().uuid(),
  toPositionId: z.string().uuid().nullish(),
  toJobGradeId: z.string().uuid().nullish(),
  newSalary: decimalInput.nullish(),
  effectiveDate: z.coerce.date().nullish(),
  reason: z.string().max(2000).nullish(),
})

export const successorFiltersSchema = z.object({
  positionId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

export const promotionFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  statusCode: z.string().optional(),
})

export type CareerPathWriteInput = z.infer<typeof careerPathWriteSchema>
export type SuccessorWriteInput = z.infer<typeof successorWriteSchema>
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>

import { z } from 'zod'

// Zod schemas for the performance sub-domain server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const optionalDate = z.coerce.date().nullish()

export const kpiWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  category: z.string().max(60).optional(),
  measureUnit: z.string().max(40).nullish(),
  targetValue: decimalInput.nullish(),
  weight: decimalInput.nullish(),
  isActive: z.boolean().optional(),
})

export const goalWriteSchema = z.object({
  employeeId: z.string().uuid(),
  kpiId: z.string().uuid().nullish(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  category: z.string().max(60).optional(),
  weight: decimalInput.nullish(),
  targetValue: decimalInput.nullish(),
  startDate: optionalDate,
  dueDate: optionalDate,
  statusCode: z.string().max(40).optional(),
})

export const goalProgressSchema = z.object({
  goalId: z.string().uuid(),
  progressPct: z.number().min(0).max(100),
  actualValue: decimalInput.nullish(),
  note: z.string().max(1000).nullish(),
})

const reviewScoreSchema = z.object({
  kpiId: z.string().uuid().nullish(),
  criterion: z.string().min(1).max(200),
  weight: decimalInput.nullish(),
  score: decimalInput.optional(),
  reviewerType: z.string().max(40).optional(),
  comments: z.string().max(1000).nullish(),
})

export const reviewWriteSchema = z.object({
  employeeId: z.string().uuid(),
  templateId: z.string().uuid().nullish(),
  reviewerId: z.string().uuid().nullish(),
  reviewType: z.string().max(40).optional(),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  strengths: z.string().max(2000).nullish(),
  improvements: z.string().max(2000).nullish(),
  comments: z.string().max(2000).nullish(),
  scores: z.array(reviewScoreSchema).optional(),
})

export const performanceFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  statusCode: z.string().optional(),
})

export type KpiWriteInput = z.infer<typeof kpiWriteSchema>
export type GoalWriteInput = z.infer<typeof goalWriteSchema>
export type GoalProgressInput = z.infer<typeof goalProgressSchema>
export type ReviewWriteInput = z.infer<typeof reviewWriteSchema>

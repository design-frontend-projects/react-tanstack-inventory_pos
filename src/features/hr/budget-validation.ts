import { z } from 'zod'

// Zod schemas for the HR budgeting server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const budgetYearWriteSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
  name: z.string().min(1).max(120),
  companyId: z.string().uuid().nullish(),
  currencyCode: z.string().min(3).max(3).optional(),
  totalBudget: decimalInput.optional(),
  statusCode: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
})

export const budgetDepartmentSchema = z.object({
  budgetYearId: z.string().uuid(),
  departmentId: z.string().uuid(),
  budgetType: z
    .enum(['salary', 'benefits', 'training', 'recruitment', 'other'])
    .optional(),
  budgetAmount: decimalInput.optional(),
  currencyCode: z.string().min(3).max(3).optional(),
})

export const budgetPositionSchema = z.object({
  budgetYearId: z.string().uuid(),
  positionId: z.string().uuid(),
  plannedCount: z.number().int().min(0).optional(),
  avgSalary: decimalInput.optional(),
  totalCost: decimalInput.optional(),
  currencyCode: z.string().min(3).max(3).optional(),
})

export const budgetActualSchema = z.object({
  budgetYearId: z.string().uuid(),
  departmentId: z.string().uuid().nullish(),
  budgetType: z
    .enum(['salary', 'benefits', 'training', 'recruitment', 'other'])
    .optional(),
  periodMonth: z.number().int().min(1).max(12),
  budgetAmount: decimalInput.optional(),
  actualAmount: decimalInput.optional(),
  currencyCode: z.string().min(3).max(3).optional(),
})

export type BudgetYearWriteInput = z.infer<typeof budgetYearWriteSchema>
export type BudgetDepartmentInput = z.infer<typeof budgetDepartmentSchema>
export type BudgetPositionInput = z.infer<typeof budgetPositionSchema>
export type BudgetActualInput = z.infer<typeof budgetActualSchema>

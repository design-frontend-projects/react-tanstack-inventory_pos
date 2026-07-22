import { z } from 'zod'

// Zod schemas for the payroll server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const salaryComponentWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  componentType: z.enum(['earning', 'deduction']).optional(),
  calcMethod: z.enum(['fixed', 'percentage', 'formula', 'hourly']).optional(),
  formula: z.string().max(500).nullish(),
  isTaxable: z.boolean().optional(),
  affectsGross: z.boolean().optional(),
  glAccountId: z.string().uuid().nullish(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const assignComponentSchema = z.object({
  employeeId: z.string().uuid(),
  componentId: z.string().uuid(),
  amount: decimalInput,
  currencyCode: z.string().length(3).optional(),
  effectiveFrom: z.coerce.date(),
})

export const payrollPeriodWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  periodType: z
    .enum(['monthly', 'weekly', 'biweekly', 'semimonthly'])
    .optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  payDate: z.coerce.date().nullish(),
})

export const payrollRunCreateSchema = z.object({
  periodId: z.string().uuid(),
  runType: z.enum(['regular', 'bonus', 'correction', 'final']).optional(),
  companyId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  currencyCode: z.string().length(3).optional(),
})

export const payrollPostSchema = z.object({
  expenseAccountId: z.string().uuid(),
  payableAccountId: z.string().uuid(),
  deductionsAccountId: z.string().uuid().nullish(),
})

export type SalaryComponentWriteInput = z.infer<
  typeof salaryComponentWriteSchema
>
export type PayrollPeriodWriteInput = z.infer<typeof payrollPeriodWriteSchema>
export type PayrollRunCreateInput = z.infer<typeof payrollRunCreateSchema>
export type PayrollPostInput = z.infer<typeof payrollPostSchema>

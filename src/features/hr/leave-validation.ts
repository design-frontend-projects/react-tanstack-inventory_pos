import { z } from 'zod'

// Zod schemas for the leave sub-domain server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const requiredDate = z.coerce.date()

export const leaveTypeWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  isPaid: z.boolean().optional(),
  affectsPayroll: z.boolean().optional(),
  requiresDocument: z.boolean().optional(),
  maxDaysPerYear: decimalInput.nullish(),
  gender: z.enum(['male', 'female']).nullish(),
  colorHex: z.string().max(9).nullish(),
  isActive: z.boolean().optional(),
})

export const leaveBalanceGrantSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  entitledDays: decimalInput.optional(),
  accruedDays: decimalInput.optional(),
})

export const leaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: requiredDate,
  endDate: requiredDate,
  isHalfDay: z.boolean().optional(),
  reason: z.string().max(1000).nullish(),
  contactDuringLeave: z.string().max(200).nullish(),
  documentUrl: z.string().max(500).nullish(),
})

export const leaveDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().max(1000).nullish(),
})

export const leaveFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  statusCode: z.string().optional(),
})

export type LeaveTypeWriteInput = z.infer<typeof leaveTypeWriteSchema>
export type LeaveBalanceGrantInput = z.infer<typeof leaveBalanceGrantSchema>
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>
export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>

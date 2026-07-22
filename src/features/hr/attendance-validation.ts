import { z } from 'zod'

// Zod schemas for the time & attendance server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)')
  .nullish()

export const shiftWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  shiftType: z
    .enum(['fixed', 'flexible', 'night', 'split', 'rotational'])
    .optional(),
  startTime: hhmm,
  endTime: hhmm,
  breakMinutes: z.number().int().min(0).max(600).optional(),
  workHours: decimalInput.nullish(),
  isNightShift: z.boolean().optional(),
  graceInMins: z.number().int().min(0).max(120).optional(),
  graceOutMins: z.number().int().min(0).max(120).optional(),
  isActive: z.boolean().optional(),
})

export const punchSchema = z.object({
  employeeId: z.string().uuid(),
  eventTime: z.coerce.date(),
  direction: z.enum(['in', 'out']),
  captureMethod: z
    .enum(['manual', 'fingerprint', 'face', 'qr', 'mobile', 'gps'])
    .optional(),
  shiftId: z.string().uuid().nullish(),
})

export const overtimeSchema = z.object({
  employeeId: z.string().uuid(),
  overtimeDate: z.coerce.date(),
  startTime: hhmm,
  endTime: hhmm,
  hours: decimalInput,
  rateMultiplier: decimalInput.optional(),
  reason: z.string().max(500).nullish(),
})

export const overtimeDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
})

export type ShiftWriteInput = z.infer<typeof shiftWriteSchema>
export type PunchInput = z.infer<typeof punchSchema>
export type OvertimeInput = z.infer<typeof overtimeSchema>

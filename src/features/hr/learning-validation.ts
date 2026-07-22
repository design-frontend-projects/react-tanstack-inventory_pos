import { z } from 'zod'

// Zod schemas for the learning & training sub-domain server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const trainingCourseWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(160),
  nameAr: z.string().max(160).nullish(),
  category: z.string().max(48).optional(),
  deliveryMode: z
    .enum(['classroom', 'online', 'blended', 'on_the_job'])
    .optional(),
  provider: z.string().max(160).nullish(),
  durationHours: decimalInput.nullish(),
  cost: decimalInput.nullish(),
  currencyCode: z.string().max(3).optional(),
  description: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
})

export const trainingSessionCreateSchema = z.object({
  courseId: z.string().uuid(),
  code: z.string().min(1).max(48),
  trainerId: z.string().uuid().nullish(),
  trainerName: z.string().max(160).nullish(),
  location: z.string().max(200).nullish(),
  startDate: z.coerce.date().nullish(),
  endDate: z.coerce.date().nullish(),
  capacity: z.number().int().min(0).nullish(),
})

export const trainingSessionStatusSchema = z.object({
  statusCode: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
})

export const trainingEnrollSchema = z.object({
  sessionId: z.string().uuid(),
  employeeId: z.string().uuid(),
})

export const trainingCompletionSchema = z.object({
  attendancePct: decimalInput.nullish(),
  score: decimalInput.nullish(),
  completedAt: z.coerce.date().nullish(),
  statusCode: z
    .enum(['enrolled', 'attended', 'completed', 'failed', 'no_show'])
    .optional(),
  feedback: z.string().max(2000).nullish(),
})

export const trainingCertificateSchema = z.object({
  recordId: z.string().uuid(),
  employeeId: z.string().uuid(),
  certificateNo: z.string().min(1).max(64),
  issuedAt: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
  fileUrl: z.string().max(500).nullish(),
})

export const trainingSessionFiltersSchema = z.object({
  courseId: z.string().uuid().optional(),
})

export const trainingRecordFiltersSchema = z.object({
  sessionId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
})

export type TrainingCourseWriteInput = z.infer<typeof trainingCourseWriteSchema>
export type TrainingSessionCreateInput = z.infer<
  typeof trainingSessionCreateSchema
>
export type TrainingEnrollInput = z.infer<typeof trainingEnrollSchema>
export type TrainingCompletionInput = z.infer<typeof trainingCompletionSchema>
export type TrainingCertificateInput = z.infer<typeof trainingCertificateSchema>

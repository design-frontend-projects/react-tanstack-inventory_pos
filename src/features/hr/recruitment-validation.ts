import { z } from 'zod'

// Zod schemas for the recruitment (ATS) and onboarding server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
const optionalDate = z.coerce.date().nullish()

// --- Job openings -----------------------------------------------------------

export const jobOpeningWriteSchema = z.object({
  title: z.string().min(1).max(200),
  departmentId: z.string().uuid().nullish(),
  positionId: z.string().uuid().nullish(),
  jobGradeId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  hiringManagerId: z.string().uuid().nullish(),
  employmentType: z
    .enum(['full_time', 'part_time', 'contract', 'temporary', 'intern'])
    .optional(),
  vacancies: z.number().int().min(1).max(1000).optional(),
  description: z.string().max(4000).nullish(),
  requirements: z.string().max(4000).nullish(),
  salaryMin: decimalInput.nullish(),
  salaryMax: decimalInput.nullish(),
  currencyCode: z.string().length(3).optional(),
  openDate: optionalDate,
  targetCloseDate: optionalDate,
})

export const jobOpeningStatusSchema = z.object({
  action: z.enum(['open', 'close']),
})

// --- Candidates -------------------------------------------------------------

export const candidateWriteSchema = z.object({
  jobOpeningId: z.string().uuid().nullish(),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email().max(200).nullish(),
  phone: z.string().max(50).nullish(),
  source: z.string().max(120).nullish(),
  resumeUrl: z.string().max(500).nullish(),
  currentEmployer: z.string().max(200).nullish(),
  expectedSalary: decimalInput.nullish(),
  noticePeriodDays: z.number().int().min(0).max(365).nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
})

export const candidateStageSchema = z.object({
  targetStage: z.enum([
    'applied',
    'screening',
    'interview',
    'offer',
    'hired',
    'rejected',
  ]),
})

// --- Interviews -------------------------------------------------------------

export const interviewWriteSchema = z.object({
  candidateId: z.string().uuid(),
  jobOpeningId: z.string().uuid().nullish(),
  roundNumber: z.number().int().min(1).max(20).optional(),
  interviewType: z
    .enum(['in_person', 'phone', 'video', 'technical', 'panel'])
    .optional(),
  scheduledAt: optionalDate,
  durationMins: z.number().int().min(0).max(1440).nullish(),
  location: z.string().max(200).nullish(),
  meetingLink: z.string().max(500).nullish(),
})

export const interviewStatusSchema = z.object({
  statusCode: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']),
})

export const interviewFeedbackSchema = z.object({
  interviewId: z.string().uuid(),
  interviewerId: z.string().uuid(),
  overallScore: decimalInput.nullish(),
  recommendation: z
    .enum(['strong_yes', 'yes', 'neutral', 'no', 'strong_no'])
    .nullish(),
  strengths: z.string().max(2000).nullish(),
  weaknesses: z.string().max(2000).nullish(),
  comments: z.string().max(2000).nullish(),
})

// --- Job offers -------------------------------------------------------------

export const jobOfferWriteSchema = z.object({
  candidateId: z.string().uuid(),
  jobOpeningId: z.string().uuid().nullish(),
  positionId: z.string().uuid().nullish(),
  jobGradeId: z.string().uuid().nullish(),
  offeredSalary: decimalInput.optional(),
  currencyCode: z.string().length(3).optional(),
  startDate: optionalDate,
  expiryDate: optionalDate,
  offerLetterUrl: z.string().max(500).nullish(),
})

export const jobOfferStatusSchema = z.object({
  statusCode: z.enum([
    'draft',
    'sent',
    'accepted',
    'declined',
    'expired',
    'hired',
  ]),
})

export const offerAcceptanceSchema = z.object({
  offerId: z.string().uuid(),
  decision: z.enum(['accepted', 'declined']),
  signatureUrl: z.string().max(500).nullish(),
  comments: z.string().max(2000).nullish(),
})

// --- Filters ----------------------------------------------------------------

export const jobOpeningFiltersSchema = z.object({
  statusCode: z.string().optional(),
})

export const candidateFiltersSchema = z.object({
  jobOpeningId: z.string().uuid().optional(),
  stageCode: z.string().optional(),
})

// --- Onboarding -------------------------------------------------------------

export const onboardingTemplateWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  departmentId: z.string().uuid().nullish(),
  description: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
})

export const onboardingTaskWriteSchema = z.object({
  templateId: z.string().uuid(),
  sequence: z.number().int().min(0).max(1000).optional(),
  title: z.string().min(1).max(200),
  category: z
    .enum(['general', 'it', 'hr', 'facilities', 'compliance', 'training'])
    .optional(),
  ownerRole: z.string().max(120).nullish(),
  dueOffsetDays: z.number().int().min(0).max(365).optional(),
  isMandatory: z.boolean().optional(),
})

export const assignTemplateSchema = z.object({
  employeeId: z.string().uuid(),
  templateId: z.string().uuid(),
  startDate: optionalDate,
})

export const onboardingTaskStatusSchema = z.object({
  statusCode: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
})

export const employeeOnboardingFiltersSchema = z.object({
  employeeId: z.string().uuid().optional(),
  statusCode: z.string().optional(),
})

// --- Inferred types ---------------------------------------------------------

export type JobOpeningWriteInput = z.infer<typeof jobOpeningWriteSchema>
export type CandidateWriteInput = z.infer<typeof candidateWriteSchema>
export type InterviewWriteInput = z.infer<typeof interviewWriteSchema>
export type InterviewFeedbackInput = z.infer<typeof interviewFeedbackSchema>
export type JobOfferWriteInput = z.infer<typeof jobOfferWriteSchema>
export type OfferAcceptanceInput = z.infer<typeof offerAcceptanceSchema>
export type OnboardingTemplateWriteInput = z.infer<
  typeof onboardingTemplateWriteSchema
>
export type OnboardingTaskWriteInput = z.infer<typeof onboardingTaskWriteSchema>
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>

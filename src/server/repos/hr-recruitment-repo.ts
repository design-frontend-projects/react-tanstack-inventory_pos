import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the recruitment (ATS) and onboarding
// sub-domains: job openings, candidates, interviews and their feedback, job
// offers and acceptances, and the onboarding template / task / assignment
// aggregate. All reads filter by tenantId; cross-module references (department,
// position, employee, profile) are bare scalar UUIDs enforced at the app layer.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Job openings -----------------------------------------------------------

export interface JobOpeningWriteInput {
  requisitionNo: string
  title: string
  departmentId?: string | null
  positionId?: string | null
  jobGradeId?: string | null
  branchId?: string | null
  hiringManagerId?: string | null
  employmentType?: string
  vacancies?: number
  description?: string | null
  requirements?: string | null
  salaryMin?: string | number | null
  salaryMax?: string | number | null
  currencyCode?: string
  openDate?: Date | null
  targetCloseDate?: Date | null
  statusCode?: string
}

export function listJobOpenings(
  tenantId: string,
  filters: { statusCode?: string; includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOpening.findMany({
    where: {
      ...activeWhere(tenantId, filters.includeInactive ?? true),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findJobOpeningById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOpening.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createJobOpening(
  tenantId: string,
  input: JobOpeningWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOpening.create({
    data: {
      tenantId,
      requisitionNo: input.requisitionNo,
      title: input.title.trim(),
      departmentId: input.departmentId ?? null,
      positionId: input.positionId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      branchId: input.branchId ?? null,
      hiringManagerId: input.hiringManagerId ?? null,
      employmentType: input.employmentType ?? 'full_time',
      vacancies: input.vacancies ?? 1,
      description: input.description ?? null,
      requirements: input.requirements ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      openDate: input.openDate ?? null,
      targetCloseDate: input.targetCloseDate ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateJobOpening(
  tenantId: string,
  id: string,
  input: Partial<JobOpeningWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrJobOpening.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId ?? null }
        : {}),
      ...(input.positionId !== undefined
        ? { positionId: input.positionId ?? null }
        : {}),
      ...(input.jobGradeId !== undefined
        ? { jobGradeId: input.jobGradeId ?? null }
        : {}),
      ...(input.branchId !== undefined
        ? { branchId: input.branchId ?? null }
        : {}),
      ...(input.hiringManagerId !== undefined
        ? { hiringManagerId: input.hiringManagerId ?? null }
        : {}),
      ...(input.employmentType !== undefined
        ? { employmentType: input.employmentType }
        : {}),
      ...(input.vacancies !== undefined ? { vacancies: input.vacancies } : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? null }
        : {}),
      ...(input.requirements !== undefined
        ? { requirements: input.requirements ?? null }
        : {}),
      ...(input.salaryMin !== undefined
        ? { salaryMin: input.salaryMin ?? null }
        : {}),
      ...(input.salaryMax !== undefined
        ? { salaryMax: input.salaryMax ?? null }
        : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode }
        : {}),
      ...(input.openDate !== undefined
        ? { openDate: input.openDate ?? null }
        : {}),
      ...(input.targetCloseDate !== undefined
        ? { targetCloseDate: input.targetCloseDate ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findJobOpeningById(tenantId, id, client)
}

export async function softDeleteJobOpening(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrJobOpening.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

export function updateJobOpeningStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOpening.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

// --- Candidates -------------------------------------------------------------

export interface CandidateWriteInput {
  jobOpeningId?: string | null
  candidateCode: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  source?: string | null
  resumeUrl?: string | null
  currentEmployer?: string | null
  expectedSalary?: string | number | null
  noticePeriodDays?: number | null
  rating?: number | null
  stageCode?: string
  statusCode?: string
}

export function listCandidates(
  tenantId: string,
  filters: {
    jobOpeningId?: string
    stageCode?: string
    includeInactive?: boolean
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrCandidate.findMany({
    where: {
      ...activeWhere(tenantId, filters.includeInactive ?? true),
      ...(filters.jobOpeningId ? { jobOpeningId: filters.jobOpeningId } : {}),
      ...(filters.stageCode ? { stageCode: filters.stageCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findCandidateById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrCandidate.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCandidate(
  tenantId: string,
  input: CandidateWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrCandidate.create({
    data: {
      tenantId,
      jobOpeningId: input.jobOpeningId ?? null,
      candidateCode: input.candidateCode,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? null,
      resumeUrl: input.resumeUrl ?? null,
      currentEmployer: input.currentEmployer ?? null,
      expectedSalary: input.expectedSalary ?? null,
      noticePeriodDays: input.noticePeriodDays ?? null,
      rating: input.rating ?? null,
      stageCode: input.stageCode ?? 'applied',
      statusCode: input.statusCode ?? 'active',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateCandidate(
  tenantId: string,
  id: string,
  input: Partial<CandidateWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCandidate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.jobOpeningId !== undefined
        ? { jobOpeningId: input.jobOpeningId ?? null }
        : {}),
      ...(input.firstName !== undefined
        ? { firstName: input.firstName.trim() }
        : {}),
      ...(input.lastName !== undefined
        ? { lastName: input.lastName.trim() }
        : {}),
      ...(input.email !== undefined ? { email: input.email ?? null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
      ...(input.source !== undefined ? { source: input.source ?? null } : {}),
      ...(input.resumeUrl !== undefined
        ? { resumeUrl: input.resumeUrl ?? null }
        : {}),
      ...(input.currentEmployer !== undefined
        ? { currentEmployer: input.currentEmployer ?? null }
        : {}),
      ...(input.expectedSalary !== undefined
        ? { expectedSalary: input.expectedSalary ?? null }
        : {}),
      ...(input.noticePeriodDays !== undefined
        ? { noticePeriodDays: input.noticePeriodDays ?? null }
        : {}),
      ...(input.rating !== undefined ? { rating: input.rating ?? null } : {}),
      ...(input.stageCode !== undefined ? { stageCode: input.stageCode } : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findCandidateById(tenantId, id, client)
}

export async function softDeleteCandidate(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrCandidate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

export function updateCandidateStage(
  tenantId: string,
  id: string,
  stageCode: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrCandidate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { stageCode, statusCode, updatedBy: actorId },
  })
}

// --- Interviews -------------------------------------------------------------

export interface InterviewWriteInput {
  candidateId: string
  jobOpeningId?: string | null
  roundNumber?: number
  interviewType?: string
  scheduledAt?: Date | null
  durationMins?: number | null
  location?: string | null
  meetingLink?: string | null
  statusCode?: string
}

export function listInterviews(
  tenantId: string,
  filters: { candidateId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrInterview.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.candidateId ? { candidateId: filters.candidateId } : {}),
    },
    orderBy: { scheduledAt: 'desc' },
    take: 300,
  })
}

export function createInterview(
  tenantId: string,
  input: InterviewWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrInterview.create({
    data: {
      tenantId,
      candidateId: input.candidateId,
      jobOpeningId: input.jobOpeningId ?? null,
      roundNumber: input.roundNumber ?? 1,
      interviewType: input.interviewType ?? 'in_person',
      scheduledAt: input.scheduledAt ?? null,
      durationMins: input.durationMins ?? null,
      location: input.location ?? null,
      meetingLink: input.meetingLink ?? null,
      statusCode: input.statusCode ?? 'scheduled',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function updateInterviewStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrInterview.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

export function findInterviewById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrInterview.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

// --- Interview feedback -----------------------------------------------------

export interface InterviewFeedbackWriteInput {
  interviewId: string
  interviewerId: string
  overallScore?: string | number | null
  recommendation?: string | null
  strengths?: string | null
  weaknesses?: string | null
  comments?: string | null
}

export function createInterviewFeedback(
  tenantId: string,
  input: InterviewFeedbackWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrInterviewFeedback.create({
    data: {
      tenantId,
      interviewId: input.interviewId,
      interviewerId: input.interviewerId,
      overallScore: input.overallScore ?? null,
      recommendation: input.recommendation ?? null,
      strengths: input.strengths ?? null,
      weaknesses: input.weaknesses ?? null,
      comments: input.comments ?? null,
      createdBy: actorId,
    },
  })
}

export function listFeedbackForInterview(
  tenantId: string,
  interviewId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrInterviewFeedback.findMany({
    where: { tenantId, interviewId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

// --- Job offers -------------------------------------------------------------

export interface JobOfferWriteInput {
  candidateId: string
  jobOpeningId?: string | null
  offerNumber: string
  positionId?: string | null
  jobGradeId?: string | null
  offeredSalary?: string | number
  currencyCode?: string
  startDate?: Date | null
  expiryDate?: Date | null
  offerLetterUrl?: string | null
  statusCode?: string
}

export function createJobOffer(
  tenantId: string,
  input: JobOfferWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOffer.create({
    data: {
      tenantId,
      candidateId: input.candidateId,
      jobOpeningId: input.jobOpeningId ?? null,
      offerNumber: input.offerNumber,
      positionId: input.positionId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      offeredSalary: input.offeredSalary ?? 0,
      currencyCode: input.currencyCode ?? 'USD',
      startDate: input.startDate ?? null,
      expiryDate: input.expiryDate ?? null,
      offerLetterUrl: input.offerLetterUrl ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function listJobOffers(
  tenantId: string,
  filters: { candidateId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOffer.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.candidateId ? { candidateId: filters.candidateId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findJobOfferById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOffer.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function updateJobOfferStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrJobOffer.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy: actorId },
  })
}

// --- Offer acceptance -------------------------------------------------------

export interface OfferAcceptanceWriteInput {
  offerId: string
  decision: string
  respondedAt?: Date | null
  signatureUrl?: string | null
  comments?: string | null
}

export function createOfferAcceptance(
  tenantId: string,
  input: OfferAcceptanceWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrOfferAcceptance.create({
    data: {
      tenantId,
      offerId: input.offerId,
      decision: input.decision,
      respondedAt: input.respondedAt ?? new Date(),
      signatureUrl: input.signatureUrl ?? null,
      comments: input.comments ?? null,
      createdBy: actorId,
    },
  })
}

// --- Onboarding templates ---------------------------------------------------

export interface OnboardingTemplateWriteInput {
  code: string
  name: string
  nameAr?: string | null
  departmentId?: string | null
  description?: string | null
  statusCode?: string
  isActive?: boolean
}

export function listTemplates(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrOnboardingTemplate.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findTemplateById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrOnboardingTemplate.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createTemplate(
  tenantId: string,
  input: OnboardingTemplateWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrOnboardingTemplate.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      departmentId: input.departmentId ?? null,
      description: input.description ?? null,
      statusCode: input.statusCode ?? 'active',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateTemplate(
  tenantId: string,
  id: string,
  input: Partial<OnboardingTemplateWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrOnboardingTemplate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId ?? null }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findTemplateById(tenantId, id, client)
}

export async function softDeleteTemplate(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrOnboardingTemplate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

// --- Onboarding tasks (template lines) --------------------------------------

export interface OnboardingTaskWriteInput {
  templateId: string
  sequence?: number
  title: string
  category?: string
  ownerRole?: string | null
  dueOffsetDays?: number
  isMandatory?: boolean
}

export function createTask(
  tenantId: string,
  input: OnboardingTaskWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrOnboardingTask.create({
    data: {
      tenantId,
      templateId: input.templateId,
      sequence: input.sequence ?? 0,
      title: input.title.trim(),
      category: input.category ?? 'general',
      ownerRole: input.ownerRole ?? null,
      dueOffsetDays: input.dueOffsetDays ?? 0,
      isMandatory: input.isMandatory ?? true,
      createdBy: actorId,
    },
  })
}

export function listTasksForTemplate(
  tenantId: string,
  templateId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrOnboardingTask.findMany({
    where: { tenantId, templateId, deletedAt: null },
    orderBy: { sequence: 'asc' },
  })
}

// --- Employee onboarding (assigned tasks) -----------------------------------

export interface EmployeeOnboardingWriteInput {
  employeeId: string
  templateId?: string | null
  taskId?: string | null
  title: string
  category?: string
  assignedToId?: string | null
  dueDate?: Date | null
  statusCode?: string
  notes?: string | null
}

export function createEmployeeOnboarding(
  tenantId: string,
  input: EmployeeOnboardingWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeOnboarding.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      templateId: input.templateId ?? null,
      taskId: input.taskId ?? null,
      title: input.title.trim(),
      category: input.category ?? 'general',
      assignedToId: input.assignedToId ?? null,
      dueDate: input.dueDate ?? null,
      statusCode: input.statusCode ?? 'pending',
      notes: input.notes ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export function listEmployeeOnboarding(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeOnboarding.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  })
}

export function findEmployeeOnboardingById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeOnboarding.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function updateEmployeeOnboardingStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeOnboarding.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      completedAt: statusCode === 'completed' ? new Date() : null,
      updatedBy: actorId,
    },
  })
}

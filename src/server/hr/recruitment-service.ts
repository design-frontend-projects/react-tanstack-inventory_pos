import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import * as recruitmentRepo from '#/server/repos/hr-recruitment-repo'
import type { CurrentUserContext } from '#/types/auth'

// Recruitment (ATS) service. Drives the vacancy → candidate → interview → offer
// → hire pipeline. Document numbers (requisition / candidate / offer) are minted
// inside the mutating transaction so the number and the row commit together.
// `hireCandidate` provisions an HrEmployee from an accepted offer atomically.
// Every write appends an audit entry (best-effort, after the transaction).

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

// Valid candidate stage transitions (BR-ATS).
const STAGE_ORDER = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
] as const
type Stage = (typeof STAGE_ORDER)[number]

// --- Job openings -----------------------------------------------------------

export async function listJobOpenings(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { statusCode?: string } = {},
) {
  return serializeRecords(
    await recruitmentRepo.listJobOpenings(tenantId, filters),
  )
}

export async function getJobOpening(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const opening = await recruitmentRepo.findJobOpeningById(tenantId, id)
  if (!opening) throw new NotFoundError('Job opening not found.')
  return serializeRecord(opening)
}

export interface JobOpeningInput {
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
}

export async function createJobOpening(
  context: CurrentUserContext,
  tenantId: string,
  input: JobOpeningInput,
) {
  const opening = await prisma.$transaction(async (tx) => {
    const requisitionNo = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_JOB_OPENING',
    })
    return recruitmentRepo.createJobOpening(
      tenantId,
      { ...input, requisitionNo, statusCode: 'draft' },
      context.profileId,
      tx,
    )
  })
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_job_opening',
    opening.id,
    {
      requisitionNo: opening.requisitionNo,
    },
  )
  return serializeRecord(opening)
}

export async function updateJobOpening(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<JobOpeningInput>,
) {
  const opening = await recruitmentRepo.updateJobOpening(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!opening) throw new NotFoundError('Job opening not found.')
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_job_opening',
    id,
    null,
  )
  return serializeRecord(opening)
}

export async function setJobOpeningStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  action: 'open' | 'close',
) {
  const existing = await recruitmentRepo.findJobOpeningById(tenantId, id)
  if (!existing) throw new NotFoundError('Job opening not found.')
  const statusCode = action === 'open' ? 'open' : 'closed'
  if (action === 'open' && existing.statusCode === 'closed') {
    throw new ConflictError('A closed opening cannot be reopened.')
  }
  await recruitmentRepo.updateJobOpeningStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_job_opening',
    id,
    { statusCode },
  )
  const updated = await recruitmentRepo.findJobOpeningById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

export async function deleteJobOpening(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await recruitmentRepo.softDeleteJobOpening(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Job opening not found.')
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_job_opening',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Candidates -------------------------------------------------------------

export async function listCandidates(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { jobOpeningId?: string; stageCode?: string } = {},
) {
  return serializeRecords(
    await recruitmentRepo.listCandidates(tenantId, filters),
  )
}

export interface CandidateInput {
  jobOpeningId?: string | null
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
}

export async function createCandidate(
  context: CurrentUserContext,
  tenantId: string,
  input: CandidateInput,
) {
  const candidate = await prisma.$transaction(async (tx) => {
    const candidateCode = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_CANDIDATE',
    })
    return recruitmentRepo.createCandidate(
      tenantId,
      { ...input, candidateCode, stageCode: 'applied' },
      context.profileId,
      tx,
    )
  })
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_candidate',
    candidate.id,
    {
      candidateCode: candidate.candidateCode,
    },
  )
  return serializeRecord(candidate)
}

// Advances a candidate along the hiring funnel. `rejected` is reachable from any
// non-terminal stage; forward moves must be one step at a time (BR-ATS).
export async function advanceCandidateStage(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  targetStage: Stage | 'rejected',
) {
  const existing = await recruitmentRepo.findCandidateById(tenantId, id)
  if (!existing) throw new NotFoundError('Candidate not found.')
  if (existing.stageCode === 'hired' || existing.statusCode === 'rejected') {
    throw new ConflictError('This candidate has already reached a final stage.')
  }

  if (targetStage === 'rejected') {
    await recruitmentRepo.updateCandidateStage(
      tenantId,
      id,
      existing.stageCode,
      'rejected',
      context.profileId,
    )
  } else {
    const currentIndex = STAGE_ORDER.indexOf(existing.stageCode as Stage)
    const targetIndex = STAGE_ORDER.indexOf(targetStage)
    if (targetIndex < 0) throw new ValidationError('Unknown candidate stage.')
    if (targetIndex !== currentIndex + 1) {
      throw new ConflictError(
        `Cannot move from '${existing.stageCode}' to '${targetStage}'. Advance one stage at a time.`,
      )
    }
    const statusCode = targetStage === 'hired' ? 'hired' : 'active'
    await recruitmentRepo.updateCandidateStage(
      tenantId,
      id,
      targetStage,
      statusCode,
      context.profileId,
    )
  }

  await audit(context, tenantId, 'hr.recruitment_manage', 'hr_candidate', id, {
    stage: targetStage,
  })
  const updated = await recruitmentRepo.findCandidateById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

// --- Interviews -------------------------------------------------------------

export async function listInterviews(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { candidateId?: string } = {},
) {
  return serializeRecords(
    await recruitmentRepo.listInterviews(tenantId, filters),
  )
}

export interface InterviewInput {
  candidateId: string
  jobOpeningId?: string | null
  roundNumber?: number
  interviewType?: string
  scheduledAt?: Date | null
  durationMins?: number | null
  location?: string | null
  meetingLink?: string | null
}

export async function scheduleInterview(
  context: CurrentUserContext,
  tenantId: string,
  input: InterviewInput,
) {
  const candidate = await recruitmentRepo.findCandidateById(
    tenantId,
    input.candidateId,
  )
  if (!candidate) throw new ValidationError('Candidate not found.')
  const interview = await recruitmentRepo.createInterview(
    tenantId,
    { ...input, statusCode: 'scheduled' },
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_interview',
    interview.id,
    {
      candidateId: input.candidateId,
    },
  )
  return serializeRecord(interview)
}

export async function setInterviewStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const existing = await recruitmentRepo.findInterviewById(tenantId, id)
  if (!existing) throw new NotFoundError('Interview not found.')
  await recruitmentRepo.updateInterviewStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.recruitment_manage', 'hr_interview', id, {
    statusCode,
  })
  const updated = await recruitmentRepo.findInterviewById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

export interface InterviewFeedbackInput {
  interviewId: string
  interviewerId: string
  overallScore?: string | number | null
  recommendation?: string | null
  strengths?: string | null
  weaknesses?: string | null
  comments?: string | null
}

export async function recordInterviewFeedback(
  context: CurrentUserContext,
  tenantId: string,
  input: InterviewFeedbackInput,
) {
  const interview = await recruitmentRepo.findInterviewById(
    tenantId,
    input.interviewId,
  )
  if (!interview) throw new ValidationError('Interview not found.')
  const feedback = await prisma.$transaction(async (tx) => {
    const created = await recruitmentRepo.createInterviewFeedback(
      tenantId,
      input,
      context.profileId,
      tx,
    )
    await recruitmentRepo.updateInterviewStatus(
      tenantId,
      input.interviewId,
      'completed',
      context.profileId,
      tx,
    )
    return created
  })
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_interview_feedback',
    feedback.id,
    {
      interviewId: input.interviewId,
    },
  )
  return serializeRecord(feedback)
}

export async function listInterviewFeedback(
  _c: CurrentUserContext,
  tenantId: string,
  interviewId: string,
) {
  return serializeRecords(
    await recruitmentRepo.listFeedbackForInterview(tenantId, interviewId),
  )
}

// --- Job offers -------------------------------------------------------------

export async function listJobOffers(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { candidateId?: string } = {},
) {
  return serializeRecords(
    await recruitmentRepo.listJobOffers(tenantId, filters),
  )
}

export interface JobOfferInput {
  candidateId: string
  jobOpeningId?: string | null
  positionId?: string | null
  jobGradeId?: string | null
  offeredSalary?: string | number
  currencyCode?: string
  startDate?: Date | null
  expiryDate?: Date | null
  offerLetterUrl?: string | null
}

export async function createJobOffer(
  context: CurrentUserContext,
  tenantId: string,
  input: JobOfferInput,
) {
  const candidate = await recruitmentRepo.findCandidateById(
    tenantId,
    input.candidateId,
  )
  if (!candidate) throw new ValidationError('Candidate not found.')
  const offer = await prisma.$transaction(async (tx) => {
    const offerNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_JOB_OFFER',
    })
    const created = await recruitmentRepo.createJobOffer(
      tenantId,
      { ...input, offerNumber, statusCode: 'draft' },
      context.profileId,
      tx,
    )
    // Move the candidate into the offer stage when they are earlier in the funnel.
    if (candidate.stageCode !== 'offer' && candidate.stageCode !== 'hired') {
      await recruitmentRepo.updateCandidateStage(
        tenantId,
        input.candidateId,
        'offer',
        'active',
        context.profileId,
        tx,
      )
    }
    return created
  })
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_job_offer',
    offer.id,
    {
      offerNumber: offer.offerNumber,
    },
  )
  return serializeRecord(offer)
}

export async function setJobOfferStatus(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  statusCode: string,
) {
  const existing = await recruitmentRepo.findJobOfferById(tenantId, id)
  if (!existing) throw new NotFoundError('Job offer not found.')
  await recruitmentRepo.updateJobOfferStatus(
    tenantId,
    id,
    statusCode,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.recruitment_manage', 'hr_job_offer', id, {
    statusCode,
  })
  const updated = await recruitmentRepo.findJobOfferById(tenantId, id)
  return updated ? serializeRecord(updated) : null
}

export interface OfferAcceptanceInput {
  offerId: string
  decision: 'accepted' | 'declined'
  signatureUrl?: string | null
  comments?: string | null
}

export async function recordOfferAcceptance(
  context: CurrentUserContext,
  tenantId: string,
  input: OfferAcceptanceInput,
) {
  const offer = await recruitmentRepo.findJobOfferById(tenantId, input.offerId)
  if (!offer) throw new NotFoundError('Job offer not found.')
  const acceptance = await prisma.$transaction(async (tx) => {
    const created = await recruitmentRepo.createOfferAcceptance(
      tenantId,
      { ...input, respondedAt: new Date() },
      context.profileId,
      tx,
    )
    await recruitmentRepo.updateJobOfferStatus(
      tenantId,
      input.offerId,
      input.decision === 'accepted' ? 'accepted' : 'declined',
      context.profileId,
      tx,
    )
    return created
  })
  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_offer_acceptance',
    acceptance.id,
    {
      decision: input.decision,
    },
  )
  return serializeRecord(acceptance)
}

// Provisions an HrEmployee from an accepted offer. Guards that the offer is
// accepted, mints an employee code, creates the employee, marks the candidate
// hired, and records an employee history entry — all atomically (BR-ATS-HIRE).
export async function hireCandidate(
  context: CurrentUserContext,
  tenantId: string,
  offerId: string,
) {
  const offer = await recruitmentRepo.findJobOfferById(tenantId, offerId)
  if (!offer) throw new NotFoundError('Job offer not found.')
  if (offer.statusCode !== 'accepted') {
    throw new ConflictError(
      'Only an accepted offer can be converted into a hire.',
    )
  }
  const candidate = await recruitmentRepo.findCandidateById(
    tenantId,
    offer.candidateId,
  )
  if (!candidate)
    throw new ValidationError('Candidate not found for this offer.')
  if (candidate.stageCode === 'hired') {
    throw new ConflictError('This candidate has already been hired.')
  }

  const employee = await prisma.$transaction(async (tx) => {
    const employeeCode = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_EMPLOYEE',
    })
    const created = await employeeRepo.createEmployee(
      tenantId,
      {
        employeeCode,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        workEmail: candidate.email,
        positionId: offer.positionId,
        jobGradeId: offer.jobGradeId,
        hireDate: offer.startDate ?? new Date(),
        employmentStatus: 'active',
      },
      context.profileId,
      tx,
    )
    await recruitmentRepo.updateCandidateStage(
      tenantId,
      candidate.id,
      'hired',
      'hired',
      context.profileId,
      tx,
    )
    await recruitmentRepo.updateJobOfferStatus(
      tenantId,
      offerId,
      'hired',
      context.profileId,
      tx,
    )
    await employeeRepo.appendEmployeeHistory(
      tenantId,
      {
        employeeId: created.id,
        changeType: 'hired',
        newValue: employeeCode,
        reason: `Hired from offer ${offer.offerNumber}`,
        reference: offer.offerNumber,
      },
      context.profileId,
      tx,
    )
    return created
  })

  await audit(
    context,
    tenantId,
    'hr.recruitment_manage',
    'hr_employee',
    employee.id,
    {
      hiredFromOffer: offer.offerNumber,
      candidateId: candidate.id,
    },
  )
  return serializeRecord(employee)
}

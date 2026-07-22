import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as onboardingService from '#/server/hr/onboarding-service'
import * as recruitmentService from '#/server/hr/recruitment-service'
import type { CurrentUserContext } from '#/types/auth'
import {
  assignTemplateSchema,
  candidateFiltersSchema,
  candidateStageSchema,
  candidateWriteSchema,
  employeeOnboardingFiltersSchema,
  interviewFeedbackSchema,
  interviewStatusSchema,
  interviewWriteSchema,
  jobOfferStatusSchema,
  jobOfferWriteSchema,
  jobOpeningFiltersSchema,
  jobOpeningStatusSchema,
  jobOpeningWriteSchema,
  offerAcceptanceSchema,
  onboardingTaskStatusSchema,
  onboardingTaskWriteSchema,
  onboardingTemplateWriteSchema,
} from '#/features/hr/recruitment-validation'

const READ = 'hr.recruitment_view'
const MANAGE = 'hr.recruitment_manage'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

// --- Job openings -----------------------------------------------------------

export const listJobOpeningsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: jobOpeningFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return recruitmentService.listJobOpenings(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createJobOpeningServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: jobOpeningWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.createJobOpening(
      context,
      data.tenantId,
      data.input,
    )
  })

export const updateJobOpeningServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: jobOpeningWriteSchema.partial() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.updateJobOpening(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const setJobOpeningStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: jobOpeningStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.setJobOpeningStatus(
      context,
      data.tenantId,
      data.id,
      data.input.action,
    )
  })

export const deleteJobOpeningServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.deleteJobOpening(context, data.tenantId, data.id)
  })

// --- Candidates -------------------------------------------------------------

export const listCandidatesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ filters: candidateFiltersSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return recruitmentService.listCandidates(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const createCandidateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: candidateWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.createCandidate(
      context,
      data.tenantId,
      data.input,
    )
  })

export const advanceCandidateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: candidateStageSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.advanceCandidateStage(
      context,
      data.tenantId,
      data.id,
      data.input.targetStage,
    )
  })

// --- Interviews -------------------------------------------------------------

export const listInterviewsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ candidateId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return recruitmentService.listInterviews(context, data.tenantId, {
      candidateId: data.candidateId,
    })
  })

export const scheduleInterviewServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: interviewWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.scheduleInterview(
      context,
      data.tenantId,
      data.input,
    )
  })

export const setInterviewStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: interviewStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.setInterviewStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })

export const recordInterviewFeedbackServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: interviewFeedbackSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.recordInterviewFeedback(
      context,
      data.tenantId,
      data.input,
    )
  })

export const listInterviewFeedbackServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ interviewId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return recruitmentService.listInterviewFeedback(
      context,
      data.tenantId,
      data.interviewId,
    )
  })

// --- Job offers -------------------------------------------------------------

export const listJobOffersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ candidateId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return recruitmentService.listJobOffers(context, data.tenantId, {
      candidateId: data.candidateId,
    })
  })

export const createJobOfferServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: jobOfferWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.createJobOffer(context, data.tenantId, data.input)
  })

export const setJobOfferStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: jobOfferStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.setJobOfferStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })

export const recordOfferAcceptanceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: offerAcceptanceSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.recordOfferAcceptance(
      context,
      data.tenantId,
      data.input,
    )
  })

export const hireCandidateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ offerId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return recruitmentService.hireCandidate(
      context,
      data.tenantId,
      data.offerId,
    )
  })

// --- Onboarding: templates --------------------------------------------------

export const listOnboardingTemplatesServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return onboardingService.listTemplates(context, data.tenantId)
  })

export const getOnboardingTemplateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return onboardingService.getTemplate(context, data.tenantId, data.id)
  })

export const createOnboardingTemplateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: onboardingTemplateWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.createTemplate(context, data.tenantId, data.input)
  })

export const updateOnboardingTemplateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(
    withId.extend({ input: onboardingTemplateWriteSchema.partial() }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.updateTemplate(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteOnboardingTemplateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.deleteTemplate(context, data.tenantId, data.id)
  })

// --- Onboarding: template tasks ---------------------------------------------

export const listOnboardingTasksServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ templateId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return onboardingService.listTemplateTasks(
      context,
      data.tenantId,
      data.templateId,
    )
  })

export const addOnboardingTaskServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: onboardingTaskWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.addTemplateTask(context, data.tenantId, data.input)
  })

// --- Onboarding: employee assignments ---------------------------------------

export const listEmployeeOnboardingServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({ filters: employeeOnboardingFiltersSchema.optional() }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, READ)
    return onboardingService.listEmployeeOnboarding(
      context,
      data.tenantId,
      data.filters ?? {},
    )
  })

export const assignOnboardingTemplateServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: assignTemplateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.assignTemplate(context, data.tenantId, data.input)
  })

export const completeOnboardingTaskServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.completeOnboardingTask(
      context,
      data.tenantId,
      data.id,
    )
  })

export const setOnboardingTaskStatusServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId.extend({ input: onboardingTaskStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    return onboardingService.setOnboardingTaskStatus(
      context,
      data.tenantId,
      data.id,
      data.input.statusCode,
    )
  })

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  addOnboardingTaskServerFn,
  advanceCandidateServerFn,
  assignOnboardingTemplateServerFn,
  completeOnboardingTaskServerFn,
  createCandidateServerFn,
  createJobOfferServerFn,
  createJobOpeningServerFn,
  createOnboardingTemplateServerFn,
  deleteJobOpeningServerFn,
  deleteOnboardingTemplateServerFn,
  hireCandidateServerFn,
  listCandidatesServerFn,
  listEmployeeOnboardingServerFn,
  listInterviewsServerFn,
  listJobOffersServerFn,
  listJobOpeningsServerFn,
  listOnboardingTasksServerFn,
  listOnboardingTemplatesServerFn,
  recordInterviewFeedbackServerFn,
  recordOfferAcceptanceServerFn,
  scheduleInterviewServerFn,
  setInterviewStatusServerFn,
  setJobOfferStatusServerFn,
  setJobOpeningStatusServerFn,
  setOnboardingTaskStatusServerFn,
} from '#/features/hr/recruitment-server-functions'
import type {
  CandidateWriteInput,
  InterviewFeedbackInput,
  InterviewWriteInput,
  JobOfferWriteInput,
  JobOpeningWriteInput,
  OfferAcceptanceInput,
  OnboardingTaskWriteInput,
  OnboardingTemplateWriteInput,
} from '#/features/hr/recruitment-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view recruitment data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

// --- Queries ----------------------------------------------------------------

export function useJobOpenings(filters: { statusCode?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-job-openings', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listJobOpeningsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useCandidates(
  filters: { jobOpeningId?: string; stageCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-candidates', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listCandidatesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useInterviews(candidateId?: string) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-interviews', tenantId, candidateId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listInterviewsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          candidateId,
        },
      }),
  })
}

export function useJobOffers(candidateId?: string) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-job-offers', tenantId, candidateId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listJobOffersServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          candidateId,
        },
      }),
  })
}

export function useOnboardingTemplates() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-onboarding-templates', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listOnboardingTemplatesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useOnboardingTasks(templateId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-onboarding-tasks', tenantId, templateId],
    enabled: Boolean(tenantId && templateId),
    queryFn: async () =>
      listOnboardingTasksServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          templateId: templateId as string,
        },
      }),
  })
}

export function useEmployeeOnboarding(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-employee-onboarding', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listEmployeeOnboardingServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

// --- Recruitment mutations --------------------------------------------------

export function useRecruitmentMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-job-openings', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-candidates', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-interviews', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-job-offers', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-employees', tenantId] })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing recruitment.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createOpening = useMutation({
    mutationFn: async (input: JobOpeningWriteInput) =>
      createJobOpeningServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const setOpeningStatus = useMutation({
    mutationFn: async (args: { id: string; action: 'open' | 'close' }) =>
      setJobOpeningStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { action: args.action },
        },
      }),
    onSuccess: invalidate,
  })
  const deleteOpening = useMutation({
    mutationFn: async (id: string) =>
      deleteJobOpeningServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const createCandidate = useMutation({
    mutationFn: async (input: CandidateWriteInput) =>
      createCandidateServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const advanceCandidate = useMutation({
    mutationFn: async (args: {
      id: string
      targetStage:
        | 'applied'
        | 'screening'
        | 'interview'
        | 'offer'
        | 'hired'
        | 'rejected'
    }) =>
      advanceCandidateServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { targetStage: args.targetStage },
        },
      }),
    onSuccess: invalidate,
  })
  const scheduleInterview = useMutation({
    mutationFn: async (input: InterviewWriteInput) =>
      scheduleInterviewServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const setInterviewStatus = useMutation({
    mutationFn: async (args: {
      id: string
      statusCode: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
    }) =>
      setInterviewStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })
  const recordFeedback = useMutation({
    mutationFn: async (input: InterviewFeedbackInput) =>
      recordInterviewFeedbackServerFn({
        data: { ...(await payload()), input },
      }),
    onSuccess: invalidate,
  })
  const createOffer = useMutation({
    mutationFn: async (input: JobOfferWriteInput) =>
      createJobOfferServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const setOfferStatus = useMutation({
    mutationFn: async (args: {
      id: string
      statusCode:
        | 'draft'
        | 'sent'
        | 'accepted'
        | 'declined'
        | 'expired'
        | 'hired'
    }) =>
      setJobOfferStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })
  const recordAcceptance = useMutation({
    mutationFn: async (input: OfferAcceptanceInput) =>
      recordOfferAcceptanceServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const hireCandidate = useMutation({
    mutationFn: async (offerId: string) =>
      hireCandidateServerFn({ data: { ...(await payload()), offerId } }),
    onSuccess: invalidate,
  })

  return {
    createOpening,
    setOpeningStatus,
    deleteOpening,
    createCandidate,
    advanceCandidate,
    scheduleInterview,
    setInterviewStatus,
    recordFeedback,
    createOffer,
    setOfferStatus,
    recordAcceptance,
    hireCandidate,
  }
}

// --- Onboarding mutations ---------------------------------------------------

export function useOnboardingMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['hr-onboarding-templates', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-onboarding-tasks', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-employee-onboarding', tenantId],
    })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing onboarding.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createTemplate = useMutation({
    mutationFn: async (input: OnboardingTemplateWriteInput) =>
      createOnboardingTemplateServerFn({
        data: { ...(await payload()), input },
      }),
    onSuccess: invalidate,
  })
  const deleteTemplate = useMutation({
    mutationFn: async (id: string) =>
      deleteOnboardingTemplateServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const addTask = useMutation({
    mutationFn: async (input: OnboardingTaskWriteInput) =>
      addOnboardingTaskServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const assignTemplate = useMutation({
    mutationFn: async (args: {
      employeeId: string
      templateId: string
      startDate?: string | null
    }) =>
      assignOnboardingTemplateServerFn({
        data: {
          ...(await payload()),
          input: {
            employeeId: args.employeeId,
            templateId: args.templateId,
            startDate: args.startDate ?? null,
          },
        },
      }),
    onSuccess: invalidate,
  })
  const completeTask = useMutation({
    mutationFn: async (id: string) =>
      completeOnboardingTaskServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const setTaskStatus = useMutation({
    mutationFn: async (args: {
      id: string
      statusCode: 'pending' | 'in_progress' | 'completed' | 'skipped'
    }) =>
      setOnboardingTaskStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })

  return {
    createTemplate,
    deleteTemplate,
    addTask,
    assignTemplate,
    completeTask,
    setTaskStatus,
  }
}

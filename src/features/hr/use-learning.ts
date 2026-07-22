'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createTrainingCourseServerFn,
  createTrainingSessionServerFn,
  deleteTrainingCourseServerFn,
  enrollTrainingServerFn,
  issueTrainingCertificateServerFn,
  listTrainingCertificatesServerFn,
  listTrainingCoursesServerFn,
  listTrainingRecordsServerFn,
  listTrainingSessionsServerFn,
  recordTrainingCompletionServerFn,
  updateTrainingCourseServerFn,
  updateTrainingSessionStatusServerFn,
} from '#/features/hr/learning-server-functions'
import type {
  TrainingCertificateInput,
  TrainingCompletionInput,
  TrainingCourseWriteInput,
  TrainingEnrollInput,
  TrainingSessionCreateInput,
} from '#/features/hr/learning-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view training data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useTrainingCourses() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-training-courses', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listTrainingCoursesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useTrainingSessions(filters: { courseId?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-training-sessions', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listTrainingSessionsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useTrainingRecords(
  filters: { sessionId?: string; employeeId?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-training-records', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listTrainingRecordsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useTrainingCertificates(filters: { employeeId?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-training-certificates', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listTrainingCertificatesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useLearningMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['hr-training-courses', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-training-sessions', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-training-records', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-training-certificates', tenantId],
    })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing training.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createCourse = useMutation({
    mutationFn: async (input: TrainingCourseWriteInput) =>
      createTrainingCourseServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateCourse = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<TrainingCourseWriteInput>
    }) =>
      updateTrainingCourseServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteCourse = useMutation({
    mutationFn: async (id: string) =>
      deleteTrainingCourseServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const createSession = useMutation({
    mutationFn: async (input: TrainingSessionCreateInput) =>
      createTrainingSessionServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateSessionStatus = useMutation({
    mutationFn: async (args: { id: string; statusCode: string }) =>
      updateTrainingSessionStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })
  const enroll = useMutation({
    mutationFn: async (input: TrainingEnrollInput) =>
      enrollTrainingServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const recordCompletion = useMutation({
    mutationFn: async (args: { id: string; input: TrainingCompletionInput }) =>
      recordTrainingCompletionServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const issueCertificate = useMutation({
    mutationFn: async (input: TrainingCertificateInput) =>
      issueTrainingCertificateServerFn({
        data: { ...(await payload()), input },
      }),
    onSuccess: invalidate,
  })

  return {
    createCourse,
    updateCourse,
    deleteCourse,
    createSession,
    updateSessionStatus,
    enroll,
    recordCompletion,
    issueCertificate,
  }
}

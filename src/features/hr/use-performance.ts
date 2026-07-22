'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createGoalServerFn,
  createKpiServerFn,
  createReviewServerFn,
  deleteGoalServerFn,
  deleteKpiServerFn,
  finalizeReviewServerFn,
  listGoalsServerFn,
  listKpisServerFn,
  listReviewsServerFn,
  recordGoalProgressServerFn,
  updateGoalServerFn,
  updateKpiServerFn,
  updateReviewServerFn,
} from '#/features/hr/performance-server-functions'
import type {
  GoalProgressInput,
  GoalWriteInput,
  KpiWriteInput,
  ReviewWriteInput,
} from '#/features/hr/performance-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view performance data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useKpis() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-kpis', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listKpisServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useGoals(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-goals', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listGoalsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useReviews(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-reviews', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listReviewsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function usePerformanceMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-kpis', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-goals', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-reviews', tenantId] })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing performance.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createKpi = useMutation({
    mutationFn: async (input: KpiWriteInput) =>
      createKpiServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateKpi = useMutation({
    mutationFn: async (args: { id: string; input: Partial<KpiWriteInput> }) =>
      updateKpiServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteKpi = useMutation({
    mutationFn: async (id: string) =>
      deleteKpiServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const createGoal = useMutation({
    mutationFn: async (input: GoalWriteInput) =>
      createGoalServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateGoal = useMutation({
    mutationFn: async (args: { id: string; input: Partial<GoalWriteInput> }) =>
      updateGoalServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteGoal = useMutation({
    mutationFn: async (id: string) =>
      deleteGoalServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const recordProgress = useMutation({
    mutationFn: async (input: GoalProgressInput) =>
      recordGoalProgressServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const createReview = useMutation({
    mutationFn: async (input: ReviewWriteInput) =>
      createReviewServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateReview = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<ReviewWriteInput>
    }) =>
      updateReviewServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const finalizeReview = useMutation({
    mutationFn: async (args: { id: string; ratingLabel?: string | null }) =>
      finalizeReviewServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          ratingLabel: args.ratingLabel,
        },
      }),
    onSuccess: invalidate,
  })

  return {
    createKpi,
    updateKpi,
    deleteKpi,
    createGoal,
    updateGoal,
    deleteGoal,
    recordProgress,
    createReview,
    updateReview,
    finalizeReview,
  }
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  approvePromotionServerFn,
  createCareerPathServerFn,
  createPromotionServerFn,
  createSuccessorServerFn,
  deleteCareerPathServerFn,
  deleteSuccessorServerFn,
  listCareerPathsServerFn,
  listPromotionsServerFn,
  listSuccessorsServerFn,
  updateCareerPathServerFn,
  updateSuccessorServerFn,
} from '#/features/hr/career-server-functions'
import type {
  CareerPathWriteInput,
  PromotionCreateInput,
  SuccessorWriteInput,
} from '#/features/hr/career-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view career data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useCareerPaths() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-career-paths', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listCareerPathsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useSuccessors(
  filters: { positionId?: string; employeeId?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-successors', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listSuccessorsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function usePromotions(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-promotions', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listPromotionsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useCareerMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-career-paths', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-successors', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-promotions', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-employees', tenantId] })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing career data.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createPath = useMutation({
    mutationFn: async (input: CareerPathWriteInput) =>
      createCareerPathServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updatePath = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<CareerPathWriteInput>
    }) =>
      updateCareerPathServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deletePath = useMutation({
    mutationFn: async (id: string) =>
      deleteCareerPathServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const createSuccessor = useMutation({
    mutationFn: async (input: SuccessorWriteInput) =>
      createSuccessorServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateSuccessor = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<SuccessorWriteInput>
    }) =>
      updateSuccessorServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteSuccessor = useMutation({
    mutationFn: async (id: string) =>
      deleteSuccessorServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const createPromotion = useMutation({
    mutationFn: async (input: PromotionCreateInput) =>
      createPromotionServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const approvePromotion = useMutation({
    mutationFn: async (id: string) =>
      approvePromotionServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createPath,
    updatePath,
    deletePath,
    createSuccessor,
    updateSuccessor,
    deleteSuccessor,
    createPromotion,
    approvePromotion,
  }
}

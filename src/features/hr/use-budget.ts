'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  addBudgetActualServerFn,
  addBudgetDepartmentServerFn,
  addBudgetPositionServerFn,
  createBudgetYearServerFn,
  deleteBudgetYearServerFn,
  getBudgetVarianceServerFn,
  listBudgetActualsServerFn,
  listBudgetDepartmentsServerFn,
  listBudgetPositionsServerFn,
  listBudgetYearsServerFn,
  updateBudgetYearServerFn,
} from '#/features/hr/budget-server-functions'
import type {
  BudgetActualInput,
  BudgetDepartmentInput,
  BudgetPositionInput,
  BudgetYearWriteInput,
} from '#/features/hr/budget-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view budget data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useBudgetYears() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-budget-years', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listBudgetYearsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useBudgetDepartments(budgetYearId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-budget-departments', tenantId, budgetYearId],
    enabled: Boolean(tenantId) && Boolean(budgetYearId),
    queryFn: async () =>
      listBudgetDepartmentsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          budgetYearId: budgetYearId as string,
        },
      }),
  })
}

export function useBudgetPositions(budgetYearId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-budget-positions', tenantId, budgetYearId],
    enabled: Boolean(tenantId) && Boolean(budgetYearId),
    queryFn: async () =>
      listBudgetPositionsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          budgetYearId: budgetYearId as string,
        },
      }),
  })
}

export function useBudgetActuals(budgetYearId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-budget-actuals', tenantId, budgetYearId],
    enabled: Boolean(tenantId) && Boolean(budgetYearId),
    queryFn: async () =>
      listBudgetActualsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          budgetYearId: budgetYearId as string,
        },
      }),
  })
}

export function useBudgetVariance(budgetYearId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-budget-variance', tenantId, budgetYearId],
    enabled: Boolean(tenantId) && Boolean(budgetYearId),
    queryFn: async () =>
      getBudgetVarianceServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          budgetYearId: budgetYearId as string,
        },
      }),
  })
}

export function useBudgetMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-budget-years', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-budget-departments', tenantId],
    })
    queryClient.invalidateQueries({
      queryKey: ['hr-budget-positions', tenantId],
    })
    queryClient.invalidateQueries({ queryKey: ['hr-budget-actuals', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-budget-variance', tenantId],
    })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing budgets.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createYear = useMutation({
    mutationFn: async (input: BudgetYearWriteInput) =>
      createBudgetYearServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateYear = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<BudgetYearWriteInput>
    }) =>
      updateBudgetYearServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteYear = useMutation({
    mutationFn: async (id: string) =>
      deleteBudgetYearServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const addDepartment = useMutation({
    mutationFn: async (input: BudgetDepartmentInput) =>
      addBudgetDepartmentServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const addPosition = useMutation({
    mutationFn: async (input: BudgetPositionInput) =>
      addBudgetPositionServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const addActual = useMutation({
    mutationFn: async (input: BudgetActualInput) =>
      addBudgetActualServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  return {
    createYear,
    updateYear,
    deleteYear,
    addDepartment,
    addPosition,
    addActual,
  }
}

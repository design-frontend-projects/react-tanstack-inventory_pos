'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createEmployeeServerFn,
  deleteEmployeeServerFn,
  getEmployeeServerFn,
  listEmployeesServerFn,
  updateEmployeeServerFn,
} from '#/features/hr/server-functions'
import type {
  EmployeeCreateInput,
  EmployeeFilters,
  EmployeeUpdateInput,
} from '#/features/hr/validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('You must be signed in to view employees.')
  }
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useEmployees(filters: EmployeeFilters = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['hr-employees', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listEmployeesServerFn({
        data: { accessToken, tenantId: tenantId as string, filters },
      })
    },
  })
}

export function useEmployee(id: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['hr-employee', tenantId, id],
    enabled: Boolean(tenantId && id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getEmployeeServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (id?: string) => () => {
    queryClient.invalidateQueries({ queryKey: ['hr-employees', tenantId] })
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', tenantId, id] })
    }
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing employees.')
    }
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createEmployee = useMutation({
    mutationFn: async (input: EmployeeCreateInput) =>
      createEmployeeServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate(),
  })

  const updateEmployee = useMutation({
    mutationFn: async (args: { id: string; input: EmployeeUpdateInput }) =>
      updateEmployeeServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: (_data, args) => invalidate(args.id)(),
  })

  const deleteEmployee = useMutation({
    mutationFn: async (args: { id: string; reason?: string }) =>
      deleteEmployeeServerFn({
        data: { ...(await payload()), id: args.id, reason: args.reason },
      }),
    onSuccess: (_data, args) => invalidate(args.id)(),
  })

  return { createEmployee, updateEmployee, deleteEmployee }
}

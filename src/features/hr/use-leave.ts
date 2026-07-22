'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  cancelLeaveRequestServerFn,
  createLeaveTypeServerFn,
  decideLeaveRequestServerFn,
  deleteLeaveTypeServerFn,
  grantLeaveBalanceServerFn,
  listLeaveBalancesServerFn,
  listLeaveRequestsServerFn,
  listLeaveTypesServerFn,
  submitLeaveRequestServerFn,
  updateLeaveTypeServerFn,
} from '#/features/hr/leave-server-functions'
import type {
  LeaveBalanceGrantInput,
  LeaveRequestInput,
  LeaveTypeWriteInput,
} from '#/features/hr/leave-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('You must be signed in to view leave data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useLeaveTypes() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-leave-types', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listLeaveTypesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useLeaveBalances(
  filters: { employeeId?: string; year?: number } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-leave-balances', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listLeaveBalancesServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useLeaveRequests(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-leave-requests', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listLeaveRequestsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          filters,
        },
      }),
  })
}

export function useLeaveMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-leave-requests', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-leave-balances', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-leave-types', tenantId] })
  }

  async function payload() {
    if (!tenantId) throw new Error('Select a workspace before managing leave.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createType = useMutation({
    mutationFn: async (input: LeaveTypeWriteInput) =>
      createLeaveTypeServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateType = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<LeaveTypeWriteInput>
    }) =>
      updateLeaveTypeServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteType = useMutation({
    mutationFn: async (id: string) =>
      deleteLeaveTypeServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const grantBalance = useMutation({
    mutationFn: async (input: LeaveBalanceGrantInput) =>
      grantLeaveBalanceServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const submitRequest = useMutation({
    mutationFn: async (input: LeaveRequestInput) =>
      submitLeaveRequestServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const decideRequest = useMutation({
    mutationFn: async (args: {
      id: string
      decision: 'approved' | 'rejected'
      comments?: string
    }) =>
      decideLeaveRequestServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { decision: args.decision, comments: args.comments },
        },
      }),
    onSuccess: invalidate,
  })
  const cancelRequest = useMutation({
    mutationFn: async (id: string) =>
      cancelLeaveRequestServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return {
    createType,
    updateType,
    deleteType,
    grantBalance,
    submitRequest,
    decideRequest,
    cancelRequest,
  }
}

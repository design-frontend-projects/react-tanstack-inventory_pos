'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createShiftServerFn,
  decideOvertimeServerFn,
  deleteShiftServerFn,
  listDailyAttendanceServerFn,
  listOvertimeServerFn,
  listShiftsServerFn,
  recordPunchServerFn,
  submitOvertimeServerFn,
  updateShiftServerFn,
} from '#/features/hr/attendance-server-functions'
import type {
  OvertimeInput,
  PunchInput,
  ShiftWriteInput,
} from '#/features/hr/attendance-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('You must be signed in to view attendance.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useShifts() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-shifts', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listShiftsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useDailyAttendance(filters: { employeeId?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-attendance-daily', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listDailyAttendanceServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useOvertime(filters: { statusCode?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-overtime', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listOvertimeServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useAttendanceMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-shifts', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-attendance-daily', tenantId],
    })
    queryClient.invalidateQueries({ queryKey: ['hr-overtime', tenantId] })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before managing attendance.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createShift = useMutation({
    mutationFn: async (input: ShiftWriteInput) =>
      createShiftServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const updateShift = useMutation({
    mutationFn: async (args: { id: string; input: Partial<ShiftWriteInput> }) =>
      updateShiftServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  const deleteShift = useMutation({
    mutationFn: async (id: string) =>
      deleteShiftServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })
  const recordPunch = useMutation({
    mutationFn: async (input: PunchInput) =>
      recordPunchServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const submitOvertime = useMutation({
    mutationFn: async (input: OvertimeInput) =>
      submitOvertimeServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const decideOvertime = useMutation({
    mutationFn: async (args: {
      id: string
      decision: 'approved' | 'rejected'
    }) =>
      decideOvertimeServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { decision: args.decision },
        },
      }),
    onSuccess: invalidate,
  })

  return {
    createShift,
    updateShift,
    deleteShift,
    recordPunch,
    submitOvertime,
    decideOvertime,
  }
}

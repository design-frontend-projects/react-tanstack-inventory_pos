'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createAnnouncementServerFn,
  listAnnouncementsServerFn,
  listEmployeeRequestsServerFn,
  setAnnouncementStatusServerFn,
  setEmployeeRequestStatusServerFn,
  submitEmployeeRequestServerFn,
} from '#/features/hr/ess-server-functions'
import type {
  AnnouncementInput,
  EmployeeRequestInput,
} from '#/features/hr/ess-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken)
    throw new Error('You must be signed in to view self-service data.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useEmployeeRequests(
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-ess-requests', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listEmployeeRequestsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useAnnouncements(filters: { statusCode?: string } = {}) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-ess-announcements', tenantId, filters],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listAnnouncementsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
          ...filters,
        },
      }),
  })
}

export function useEssMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-ess-requests', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['hr-ess-announcements', tenantId],
    })
  }

  async function payload() {
    if (!tenantId)
      throw new Error('Select a workspace before using self-service.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const submitRequest = useMutation({
    mutationFn: async (input: EmployeeRequestInput) =>
      submitEmployeeRequestServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const setRequestStatus = useMutation({
    mutationFn: async (args: { id: string; statusCode: string }) =>
      setEmployeeRequestStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })
  const createAnnouncement = useMutation({
    mutationFn: async (input: AnnouncementInput) =>
      createAnnouncementServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const setAnnouncementStatus = useMutation({
    mutationFn: async (args: { id: string; statusCode: string }) =>
      setAnnouncementStatusServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { statusCode: args.statusCode },
        },
      }),
    onSuccess: invalidate,
  })

  return {
    submitRequest,
    setRequestStatus,
    createAnnouncement,
    setAnnouncementStatus,
  }
}

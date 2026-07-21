'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  approveRequisitionServerFn,
  convertRequisitionServerFn,
  createRequisitionServerFn,
  getRequisitionServerFn,
  listRequisitionsServerFn,
  submitRequisitionServerFn,
} from '#/features/purchasing/server-functions'
import type { z } from 'zod'
import type {
  requisitionConvertSchema,
  requisitionCreateSchema,
} from '#/features/purchasing/validation'

export type RequisitionCreateInput = z.infer<typeof requisitionCreateSchema>
export type RequisitionConvertInput = z.infer<typeof requisitionConvertSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view requisitions.')
  }

  return accessToken
}

// The list server fn takes no filters — the register filters client-side.
export function useRequisitions() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['requisitions', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listRequisitionsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useRequisition(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['requisition', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getRequisitionServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

// Lifecycle mutations. Conversion mints a draft purchase order, so every success
// also refreshes the purchase order register.
export function useRequisitionMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['requisitions', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['requisition', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders', tenantId] })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing requisitions.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createRequisition = useMutation({
    mutationFn: async (input: RequisitionCreateInput) =>
      createRequisitionServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const submitRequisition = useMutation({
    mutationFn: async (id: string) =>
      submitRequisitionServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const approveRequisition = useMutation({
    mutationFn: async (id: string) =>
      approveRequisitionServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  const convertRequisition = useMutation({
    mutationFn: async (args: { id: string; input: RequisitionConvertInput }) =>
      convertRequisitionServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  return {
    createRequisition,
    submitRequisition,
    approveRequisition,
    convertRequisition,
  }
}

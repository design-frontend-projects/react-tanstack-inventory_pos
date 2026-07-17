'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  actOnApprovalServerFn,
  listApprovalsServerFn,
  listMyApprovalsServerFn,
} from '#/features/purchasing/approval-server-functions'
import type { z } from 'zod'
import type { approvalActSchema } from '#/features/purchasing/approval-validation'

export type ApprovalAct = z.infer<typeof approvalActSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to manage approvals.')
  }

  return accessToken
}

export function useMyApprovals() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['my-approvals', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listMyApprovalsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useApprovals(
  input: { statusCode?: string; entityType?: string } = {},
) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['approvals', tenantId, input],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listApprovalsServerFn({
        data: { accessToken, tenantId: tenantId as string, input },
      })
    },
  })
}

export function useApprovalActions() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const act = useMutation({
    mutationFn: async (args: { id: string; input: ApprovalAct }) => {
      const accessToken = await requireAccessToken()

      return actOnApprovalServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: args.id,
          input: args.input,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-approvals', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['approvals', tenantId] })
    },
  })

  return { act }
}

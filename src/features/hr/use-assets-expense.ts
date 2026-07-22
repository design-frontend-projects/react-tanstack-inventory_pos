'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  assignAssetServerFn,
  decideClaimServerFn,
  decideTravelServerFn,
  listAssetsServerFn,
  listClaimsServerFn,
  listExpenseAccountsServerFn,
  listTravelServerFn,
  reimburseClaimServerFn,
  returnAssetServerFn,
  submitClaimServerFn,
  submitTravelServerFn,
} from '#/features/hr/assets-expense-server-functions'
import type {
  AssetWriteInput,
  ExpenseClaimInput,
  ReimburseInput,
  TravelWriteInput,
} from '#/features/hr/assets-expense-validation'

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()
  if (!accessToken) throw new Error('You must be signed in.')
  return accessToken
}

function useTenantId() {
  return usePreferencesStore((state) => state.activeTenantId)
}

export function useAssets() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-assets', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listAssetsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useTravelRequests() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-travel', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listTravelServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useExpenseClaims() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-expense-claims', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listClaimsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useExpenseAccounts(enabled: boolean) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['hr-expense-accounts', tenantId],
    enabled: Boolean(tenantId) && enabled,
    queryFn: async () =>
      listExpenseAccountsServerFn({
        data: {
          accessToken: await requireAccessToken(),
          tenantId: tenantId as string,
        },
      }),
  })
}

export function useAssetMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['hr-assets', tenantId] })

  async function payload() {
    if (!tenantId) throw new Error('Select a workspace first.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const assignAsset = useMutation({
    mutationFn: async (input: AssetWriteInput) =>
      assignAssetServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const returnAsset = useMutation({
    mutationFn: async (args: { id: string; conditionIn?: string }) =>
      returnAssetServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          conditionIn: args.conditionIn,
        },
      }),
    onSuccess: invalidate,
  })
  return { assignAsset, returnAsset }
}

export function useExpenseMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['hr-expense-claims', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['hr-travel', tenantId] })
  }

  async function payload() {
    if (!tenantId) throw new Error('Select a workspace first.')
    return { accessToken: await requireAccessToken(), tenantId }
  }

  const submitTravel = useMutation({
    mutationFn: async (input: TravelWriteInput) =>
      submitTravelServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const decideTravel = useMutation({
    mutationFn: async (args: {
      id: string
      decision: 'approved' | 'rejected'
    }) =>
      decideTravelServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { decision: args.decision },
        },
      }),
    onSuccess: invalidate,
  })
  const submitClaim = useMutation({
    mutationFn: async (input: ExpenseClaimInput) =>
      submitClaimServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })
  const decideClaim = useMutation({
    mutationFn: async (args: {
      id: string
      decision: 'approved' | 'rejected'
    }) =>
      decideClaimServerFn({
        data: {
          ...(await payload()),
          id: args.id,
          input: { decision: args.decision },
        },
      }),
    onSuccess: invalidate,
  })
  const reimburseClaim = useMutation({
    mutationFn: async (args: { id: string; input: ReimburseInput }) =>
      reimburseClaimServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })
  return {
    submitTravel,
    decideTravel,
    submitClaim,
    decideClaim,
    reimburseClaim,
  }
}

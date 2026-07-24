'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createFinAccountServerFn,
  deactivateFinAccountServerFn,
  deleteFinAccountMappingServerFn,
  listFinAccountClassesServerFn,
  listFinAccountMappingsServerFn,
  listFinAccountTypesServerFn,
  listFinAccountsServerFn,
  updateFinAccountServerFn,
  upsertFinAccountMappingServerFn,
} from '#/features/finance/account-server-functions'
import type {
  accountCreateSchema,
  accountListSchema,
  accountMappingListSchema,
  accountMappingUpsertSchema,
  accountUpdateSchema,
} from '#/features/finance/finance-validation'
import {
  financePayload,
  requireAccessToken,
  useTenantId,
} from '#/features/finance/use-finance-base'

// Chart-of-accounts reads + mutations. Query keys follow the
// ['fin-<resource>', tenantId, ...args] convention used across modules.

export type FinAccountRow = Awaited<
  ReturnType<typeof listFinAccountsServerFn>
>[number]
export type FinAccountTypeRow = Awaited<
  ReturnType<typeof listFinAccountTypesServerFn>
>[number]
export type FinAccountClassRow = Awaited<
  ReturnType<typeof listFinAccountClassesServerFn>
>[number]
export type FinAccountMappingRow = Awaited<
  ReturnType<typeof listFinAccountMappingsServerFn>
>[number]

export type FinAccountListFilters = z.infer<typeof accountListSchema>
export type FinAccountCreateValues = z.infer<typeof accountCreateSchema>
export type FinAccountUpdateValues = z.infer<typeof accountUpdateSchema>
export type FinAccountMappingFilters = z.infer<typeof accountMappingListSchema>
export type FinAccountMappingValues = z.infer<typeof accountMappingUpsertSchema>

export function useFinAccounts(filters: FinAccountListFilters = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-accounts', tenantId, filters],
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFinAccountsServerFn({
        data: { accessToken, tenantId: tenantId as string, input: filters },
      })
    },
  })
}

export function useFinAccountTypes() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-account-types', tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFinAccountTypesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useFinAccountClasses() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-account-classes', tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFinAccountClassesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useFinAccountMappings(filters: FinAccountMappingFilters = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-account-mappings', tenantId, filters],
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFinAccountMappingsServerFn({
        data: { accessToken, tenantId: tenantId as string, input: filters },
      })
    },
  })
}

export function useFinAccountMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidateAccounts = () => {
    queryClient.invalidateQueries({ queryKey: ['fin-accounts', tenantId] })
  }

  const createAccount = useMutation({
    mutationFn: async (input: FinAccountCreateValues) => {
      const payload = await financePayload(tenantId)
      return createFinAccountServerFn({ data: { ...payload, input } })
    },
    onSuccess: invalidateAccounts,
  })

  const updateAccount = useMutation({
    mutationFn: async (args: { id: string; input: FinAccountUpdateValues }) => {
      const payload = await financePayload(tenantId)
      return updateFinAccountServerFn({
        data: { ...payload, id: args.id, input: args.input },
      })
    },
    onSuccess: invalidateAccounts,
  })

  const deactivateAccount = useMutation({
    mutationFn: async (id: string) => {
      const payload = await financePayload(tenantId)
      return deactivateFinAccountServerFn({ data: { ...payload, id } })
    },
    onSuccess: invalidateAccounts,
  })

  const upsertMapping = useMutation({
    mutationFn: async (input: FinAccountMappingValues) => {
      const payload = await financePayload(tenantId)
      return upsertFinAccountMappingServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fin-account-mappings', tenantId],
      })
    },
  })

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const payload = await financePayload(tenantId)
      return deleteFinAccountMappingServerFn({ data: { ...payload, id } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fin-account-mappings', tenantId],
      })
    },
  })

  return {
    createAccount,
    updateAccount,
    deactivateAccount,
    upsertMapping,
    deleteMapping,
  }
}

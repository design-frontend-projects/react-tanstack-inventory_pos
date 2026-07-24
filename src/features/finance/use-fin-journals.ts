'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createJournalEntryServerFn,
  deleteJournalEntryDraftServerFn,
  getJournalEntryServerFn,
  listJournalEntriesServerFn,
  listJournalTypesServerFn,
  postJournalEntryServerFn,
  readTrialBalanceServerFn,
  reverseJournalEntryServerFn,
  updateJournalEntryServerFn,
} from '#/features/finance/journal-server-functions'
import type {
  journalEntryCreateSchema,
  journalEntryListSchema,
  journalReverseSchema,
} from '#/features/finance/finance-validation'
import {
  financePayload,
  requireAccessToken,
  useTenantId,
} from '#/features/finance/use-finance-base'

// Journal entries, journal types, and the trial balance read.

export type JournalTypeRow = Awaited<
  ReturnType<typeof listJournalTypesServerFn>
>[number]
export type JournalEntryRow = Awaited<
  ReturnType<typeof listJournalEntriesServerFn>
>[number]
export type JournalEntryDetail = Awaited<
  ReturnType<typeof getJournalEntryServerFn>
>
export type TrialBalanceRow = Awaited<
  ReturnType<typeof readTrialBalanceServerFn>
>[number]

export type JournalEntryFilters = z.infer<typeof journalEntryListSchema>
export type JournalEntryValues = z.infer<typeof journalEntryCreateSchema>
export type JournalReverseValues = z.infer<typeof journalReverseSchema>

export function useJournalTypes() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-journal-types', tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listJournalTypesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useJournalEntries(filters: JournalEntryFilters = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-journal-entries', tenantId, filters],
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listJournalEntriesServerFn({
        data: { accessToken, tenantId: tenantId as string, input: filters },
      })
    },
  })
}

export function useJournalEntry(entryId: string | null) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-journal-entry', tenantId, entryId],
    enabled: Boolean(tenantId && entryId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getJournalEntryServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          id: entryId as string,
        },
      })
    },
  })
}

export function useTrialBalance(fiscalPeriodIds: Array<string>) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-trial-balance', tenantId, fiscalPeriodIds],
    enabled: Boolean(tenantId) && fiscalPeriodIds.length > 0,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return readTrialBalanceServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          input: { fiscalPeriodIds },
        },
      })
    },
  })
}

export function useJournalMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (entryId?: string) => {
    queryClient.invalidateQueries({
      queryKey: ['fin-journal-entries', tenantId],
    })
    queryClient.invalidateQueries({ queryKey: ['fin-trial-balance', tenantId] })
    if (entryId) {
      queryClient.invalidateQueries({
        queryKey: ['fin-journal-entry', tenantId, entryId],
      })
    }
  }

  const createEntry = useMutation({
    mutationFn: async (input: JournalEntryValues) => {
      const payload = await financePayload(tenantId)
      return createJournalEntryServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => invalidate(),
  })

  const updateEntry = useMutation({
    mutationFn: async (args: { id: string; input: JournalEntryValues }) => {
      const payload = await financePayload(tenantId)
      return updateJournalEntryServerFn({
        data: { ...payload, id: args.id, input: args.input },
      })
    },
    onSuccess: (entry) => invalidate(entry.id),
  })

  const postEntry = useMutation({
    mutationFn: async (args: { id: string; isAdjustment?: boolean }) => {
      const payload = await financePayload(tenantId)
      return postJournalEntryServerFn({
        data: {
          ...payload,
          id: args.id,
          input: { isAdjustment: args.isAdjustment },
        },
      })
    },
    onSuccess: (entry) => invalidate(entry.id),
  })

  const reverseEntry = useMutation({
    mutationFn: async (args: { id: string; input?: JournalReverseValues }) => {
      const payload = await financePayload(tenantId)
      return reverseJournalEntryServerFn({
        data: { ...payload, id: args.id, input: args.input },
      })
    },
    onSuccess: (_reversal, args) => invalidate(args.id),
  })

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const payload = await financePayload(tenantId)
      return deleteJournalEntryDraftServerFn({ data: { ...payload, id } })
    },
    onSuccess: () => invalidate(),
  })

  return { createEntry, updateEntry, postEntry, reverseEntry, deleteDraft }
}

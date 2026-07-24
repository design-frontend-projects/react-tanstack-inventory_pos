'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  getFinSettingsServerFn,
  initializeFinanceServerFn,
  listExchangeRatesServerFn,
  listFinCurrenciesServerFn,
  listPostingRulesServerFn,
  updateFinSettingsServerFn,
  upsertExchangeRateServerFn,
  upsertPostingRuleServerFn,
} from '#/features/finance/settings-server-functions'
import type {
  bootstrapSchema,
  exchangeRateListSchema,
  exchangeRateUpsertSchema,
  postingRuleUpsertSchema,
  settingsUpdateSchema,
} from '#/features/finance/finance-validation'
import {
  financePayload,
  requireAccessToken,
  useTenantId,
} from '#/features/finance/use-finance-base'

// Finance settings, bootstrap, currencies, exchange rates, and posting rules.

export type FinSettings = Awaited<ReturnType<typeof getFinSettingsServerFn>>
export type FinCurrencyRow = Awaited<
  ReturnType<typeof listFinCurrenciesServerFn>
>[number]
export type ExchangeRateRow = Awaited<
  ReturnType<typeof listExchangeRatesServerFn>
>[number]
export type PostingRuleRow = Awaited<
  ReturnType<typeof listPostingRulesServerFn>
>[number]

export type FinSettingsValues = z.infer<typeof settingsUpdateSchema>
export type FinBootstrapValues = z.infer<typeof bootstrapSchema>
export type ExchangeRateFilters = z.infer<typeof exchangeRateListSchema>
export type ExchangeRateValues = z.infer<typeof exchangeRateUpsertSchema>
export type PostingRuleValues = z.infer<typeof postingRuleUpsertSchema>

// The settings read throws until finance is bootstrapped for the tenant — the
// workspace turns that error into the "initialize finance" call to action, so
// retries would only delay the empty state.
export function useFinSettings() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-settings', tenantId],
    enabled: Boolean(tenantId),
    retry: false,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getFinSettingsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useFinCurrencies() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-currencies', tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFinCurrenciesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useExchangeRates(filters: ExchangeRateFilters = {}) {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-exchange-rates', tenantId, filters],
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listExchangeRatesServerFn({
        data: { accessToken, tenantId: tenantId as string, input: filters },
      })
    },
  })
}

export function usePostingRules() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-posting-rules', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listPostingRulesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useFinSettingsMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const updateSettings = useMutation({
    mutationFn: async (input: FinSettingsValues) => {
      const payload = await financePayload(tenantId)
      return updateFinSettingsServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fin-settings', tenantId] })
    },
  })

  const initializeFinance = useMutation({
    mutationFn: async (input: FinBootstrapValues) => {
      const payload = await financePayload(tenantId)
      return initializeFinanceServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => {
      // Bootstrap seeds the COA, settings, and first fiscal year in one shot.
      queryClient.invalidateQueries({ queryKey: ['fin-settings', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['fin-accounts', tenantId] })
      queryClient.invalidateQueries({
        queryKey: ['fin-fiscal-years', tenantId],
      })
      queryClient.invalidateQueries({ queryKey: ['fin-currencies', tenantId] })
    },
  })

  const upsertExchangeRate = useMutation({
    mutationFn: async (input: ExchangeRateValues) => {
      const payload = await financePayload(tenantId)
      return upsertExchangeRateServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fin-exchange-rates', tenantId],
      })
    },
  })

  const upsertPostingRule = useMutation({
    mutationFn: async (input: PostingRuleValues) => {
      const payload = await financePayload(tenantId)
      return upsertPostingRuleServerFn({ data: { ...payload, input } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['fin-posting-rules', tenantId],
      })
    },
  })

  return {
    updateSettings,
    initializeFinance,
    upsertExchangeRate,
    upsertPostingRule,
  }
}

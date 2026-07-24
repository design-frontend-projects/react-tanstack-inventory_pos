'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  createFiscalYearServerFn,
  listFiscalYearsServerFn,
  setPeriodModuleLockServerFn,
  transitionFiscalPeriodServerFn,
} from '#/features/finance/fiscal-server-functions'
import type {
  fiscalYearCreateSchema,
  periodModuleLockSchema,
  periodTransitionSchema,
} from '#/features/finance/finance-validation'
import {
  financePayload,
  requireAccessToken,
  useTenantId,
} from '#/features/finance/use-finance-base'

// Fiscal years + periods + per-module period locks.

export type FiscalYearRow = Awaited<
  ReturnType<typeof listFiscalYearsServerFn>
>[number]
export type FiscalPeriodRow = FiscalYearRow['periods'][number]

export type FiscalYearCreateValues = z.infer<typeof fiscalYearCreateSchema>
export type PeriodTransitionValues = z.infer<typeof periodTransitionSchema>
export type PeriodModuleLockValues = z.infer<typeof periodModuleLockSchema>

export function useFiscalYears() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['fin-fiscal-years', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listFiscalYearsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useFiscalMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fin-fiscal-years', tenantId] })
  }

  const createFiscalYear = useMutation({
    mutationFn: async (input: FiscalYearCreateValues) => {
      const payload = await financePayload(tenantId)
      return createFiscalYearServerFn({ data: { ...payload, input } })
    },
    onSuccess: invalidate,
  })

  const transitionPeriod = useMutation({
    mutationFn: async (input: PeriodTransitionValues) => {
      const payload = await financePayload(tenantId)
      return transitionFiscalPeriodServerFn({ data: { ...payload, input } })
    },
    onSuccess: invalidate,
  })

  const setModuleLock = useMutation({
    mutationFn: async (input: PeriodModuleLockValues) => {
      const payload = await financePayload(tenantId)
      return setPeriodModuleLockServerFn({ data: { ...payload, input } })
    },
    onSuccess: invalidate,
  })

  return { createFiscalYear, transitionPeriod, setModuleLock }
}

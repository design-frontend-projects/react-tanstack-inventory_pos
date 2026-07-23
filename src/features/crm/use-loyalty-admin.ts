'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getLoyaltySettingsServerFn,
  listEarnRulesServerFn,
  listLoyaltyTiersServerFn,
  updateLoyaltySettingsServerFn,
  upsertEarnRuleServerFn,
  upsertLoyaltyTierServerFn,
} from '#/features/crm/server-functions'
import type { z } from 'zod'
import type {
  earnRuleSchema,
  loyaltySettingsSchema,
  loyaltyTierSchema,
} from '#/features/crm/validation'
import {
  crmPayload,
  requireAccessToken,
  useTenantId,
} from '#/features/crm/use-crm-base'

// Loyalty program administration: settings, tiers, and earn rules.

export function useLoyaltySettings() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-loyalty-settings', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return getLoyaltySettingsServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useLoyaltyTiers() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-loyalty-tiers', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listLoyaltyTiersServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useEarnRules() {
  const tenantId = useTenantId()

  return useQuery({
    queryKey: ['crm-earn-rules', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()
      return listEarnRulesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useLoyaltyAdminMutations() {
  const queryClient = useQueryClient()
  const tenantId = useTenantId()

  const invalidate = (key: string) => () => {
    queryClient.invalidateQueries({ queryKey: [key, tenantId] })
  }

  const updateSettings = useMutation({
    mutationFn: async (input: z.infer<typeof loyaltySettingsSchema>) =>
      updateLoyaltySettingsServerFn({
        data: { ...(await crmPayload(tenantId)), input },
      }),
    onSuccess: invalidate('crm-loyalty-settings'),
  })

  const upsertTier = useMutation({
    mutationFn: async (input: z.infer<typeof loyaltyTierSchema>) =>
      upsertLoyaltyTierServerFn({
        data: { ...(await crmPayload(tenantId)), input },
      }),
    onSuccess: invalidate('crm-loyalty-tiers'),
  })

  const upsertEarnRule = useMutation({
    mutationFn: async (input: z.infer<typeof earnRuleSchema>) =>
      upsertEarnRuleServerFn({
        data: { ...(await crmPayload(tenantId)), input },
      }),
    onSuccess: invalidate('crm-earn-rules'),
  })

  return { updateSettings, upsertTier, upsertEarnRule }
}

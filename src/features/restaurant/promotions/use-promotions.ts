'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  applyPromotionsServerFn,
  createPromotionServerFn,
  getGiftCardServerFn,
  getPromotionAnalyticsServerFn,
  issueGiftCardServerFn,
  listGiftCardsServerFn,
  listPromotionsServerFn,
  redeemGiftCardServerFn,
  reloadGiftCardServerFn,
  setPromotionStatusServerFn,
  simulatePromotionsServerFn,
} from '#/features/restaurant/promotions/server-functions'
import type {
  GiftCardIssueInput,
  GiftCardRedeemInput,
  GiftCardReloadInput,
  PromotionApplyInput,
  PromotionCreateInput,
  PromotionSimulateInput,
} from '#/features/restaurant/promotions/validation'

function useTenantId(): string | null {
  return usePreferencesStore((state) => state.activeTenantId)
}

async function auth(tenantId: string) {
  return { accessToken: await requireAccessToken(), tenantId }
}

export function usePromotions() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-promotions', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listPromotionsServerFn({ data: await auth(tenantId as string) }),
  })
}

export function usePromotionAnalytics(promotionId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-promotion-analytics', tenantId, promotionId],
    enabled: Boolean(tenantId) && Boolean(promotionId),
    queryFn: async () =>
      getPromotionAnalyticsServerFn({
        data: {
          ...(await auth(tenantId as string)),
          promotionId: promotionId as string,
        },
      }),
  })
}

export function useGiftCards() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-gift-cards', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listGiftCardsServerFn({ data: await auth(tenantId as string) }),
  })
}

export function useGiftCard(id: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-gift-card', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () =>
      getGiftCardServerFn({
        data: { ...(await auth(tenantId as string)), id: id as string },
      }),
  })
}

export function usePromotionMutations() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  const invalidate = () => {
    for (const prefix of [
      'res-promotions',
      'res-promotion-analytics',
      'res-gift-cards',
      'res-gift-card',
      'res-orders',
      'res-order',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  const createPromotion = useMutation({
    mutationFn: async (input: PromotionCreateInput) =>
      createPromotionServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const setPromotionStatus = useMutation({
    mutationFn: async (input: {
      id: string
      status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'
    }) =>
      setPromotionStatusServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const applyPromotions = useMutation({
    mutationFn: async (input: PromotionApplyInput) =>
      applyPromotionsServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const simulate = useMutation({
    mutationFn: async (input: PromotionSimulateInput) =>
      simulatePromotionsServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
  })

  const issueGiftCard = useMutation({
    mutationFn: async (input: GiftCardIssueInput) =>
      issueGiftCardServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const reloadGiftCard = useMutation({
    mutationFn: async (input: GiftCardReloadInput) =>
      reloadGiftCardServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const redeemGiftCard = useMutation({
    mutationFn: async (input: GiftCardRedeemInput) =>
      redeemGiftCardServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  return {
    createPromotion,
    setPromotionStatus,
    applyPromotions,
    simulate,
    issueGiftCard,
    reloadGiftCard,
    redeemGiftCard,
  }
}

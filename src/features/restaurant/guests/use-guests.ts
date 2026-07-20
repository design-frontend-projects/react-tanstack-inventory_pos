'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  addWaitlistEntryServerFn,
  createPickupServerFn,
  createQrCampaignServerFn,
  createReservationServerFn,
  getTakeawayBoardServerFn,
  listQrCampaignsServerFn,
  listReservationsServerFn,
  listWaitlistServerFn,
  seatReservationServerFn,
  setQrCampaignActiveServerFn,
  stampPickupServerFn,
  transitionReservationServerFn,
  updateWaitlistStatusServerFn,
} from '#/features/restaurant/guests/server-functions'
import type {
  PickupCreateInput,
  PickupStampInput,
  QrCampaignCreateInput,
  ReservationCreateInput,
  ReservationListInput,
  ReservationSeatInput,
  ReservationTransitionInput,
  WaitlistCreateInput,
  WaitlistStatusInput,
} from '#/features/restaurant/guests/validation'

function useTenantId(): string | null {
  return usePreferencesStore((state) => state.activeTenantId)
}

async function auth(tenantId: string) {
  return { accessToken: await requireAccessToken(), tenantId }
}

export function useReservations(input: Omit<ReservationListInput, never> | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-reservations', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    queryFn: async () =>
      listReservationsServerFn({
        data: {
          ...(await auth(tenantId as string)),
          input: input as ReservationListInput,
        },
      }),
  })
}

export function useWaitlist(branchId: string | null, activeOnly = true) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-waitlist', tenantId, branchId, activeOnly],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () =>
      listWaitlistServerFn({
        data: {
          ...(await auth(tenantId as string)),
          branchId: branchId as string,
          activeOnly,
        },
      }),
  })
}

export function useTakeawayBoard(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-takeaway-board', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    refetchInterval: 60_000,
    queryFn: async () =>
      getTakeawayBoardServerFn({
        data: {
          ...(await auth(tenantId as string)),
          branchId: branchId as string,
        },
      }),
  })
}

export function useQrCampaigns(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-qr-campaigns', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listQrCampaignsServerFn({
        data: { ...(await auth(tenantId as string)), branchId },
      }),
  })
}

export function useGuestMutations() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  const invalidate = () => {
    for (const prefix of [
      'res-reservations',
      'res-waitlist',
      'res-takeaway-board',
      'res-qr-campaigns',
      'res-orders',
      'res-floor-status',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  const createReservation = useMutation({
    mutationFn: async (input: ReservationCreateInput) =>
      createReservationServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const transitionReservation = useMutation({
    mutationFn: async (input: ReservationTransitionInput) =>
      transitionReservationServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const seatReservation = useMutation({
    mutationFn: async (input: ReservationSeatInput) =>
      seatReservationServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const addWaitlistEntry = useMutation({
    mutationFn: async (input: WaitlistCreateInput) =>
      addWaitlistEntryServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const updateWaitlistStatus = useMutation({
    mutationFn: async (input: WaitlistStatusInput) =>
      updateWaitlistStatusServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const createPickup = useMutation({
    mutationFn: async (input: PickupCreateInput) =>
      createPickupServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const stampPickup = useMutation({
    mutationFn: async (input: PickupStampInput) =>
      stampPickupServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const createQrCampaign = useMutation({
    mutationFn: async (input: QrCampaignCreateInput) =>
      createQrCampaignServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const setQrCampaignActive = useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      setQrCampaignActiveServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  return {
    createReservation,
    transitionReservation,
    seatReservation,
    addWaitlistEntry,
    updateWaitlistStatus,
    createPickup,
    stampPickup,
    createQrCampaign,
    setQrCampaignActive,
  }
}

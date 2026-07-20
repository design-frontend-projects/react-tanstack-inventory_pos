'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  addEventPaymentServerFn,
  createCateringJobServerFn,
  createEventServerFn,
  listCateringJobsServerFn,
  listEventsServerFn,
  savePartyBookingServerFn,
  setEventTaskStatusServerFn,
  transitionCateringJobServerFn,
  transitionEventServerFn,
} from '#/features/restaurant/events/server-functions'
import type {
  CateringCreateInput,
  CateringTransitionInput,
  EventCreateInput,
  EventListInput,
  EventPaymentInput,
  EventTaskStatusInput,
  EventTransitionInput,
  PartySaveInput,
} from '#/features/restaurant/events/validation'

function useTenantId(): string | null {
  return usePreferencesStore((state) => state.activeTenantId)
}

async function auth(tenantId: string) {
  return { accessToken: await requireAccessToken(), tenantId }
}

export function useRestaurantEvents(input: EventListInput | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-events', tenantId, input],
    enabled: Boolean(tenantId) && Boolean(input),
    queryFn: async () =>
      listEventsServerFn({
        data: {
          ...(await auth(tenantId as string)),
          input: input as EventListInput,
        },
      }),
  })
}

export function useCateringJobs(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-catering-jobs', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () =>
      listCateringJobsServerFn({
        data: {
          ...(await auth(tenantId as string)),
          branchId: branchId as string,
        },
      }),
  })
}

export function useEventMutations() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  const invalidate = () => {
    for (const prefix of ['res-events', 'res-catering-jobs']) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  const createEvent = useMutation({
    mutationFn: async (input: EventCreateInput) =>
      createEventServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const transitionEvent = useMutation({
    mutationFn: async (input: EventTransitionInput) =>
      transitionEventServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const setTaskStatus = useMutation({
    mutationFn: async (input: EventTaskStatusInput) =>
      setEventTaskStatusServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const addPayment = useMutation({
    mutationFn: async (input: EventPaymentInput) =>
      addEventPaymentServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const saveParty = useMutation({
    mutationFn: async (input: PartySaveInput) =>
      savePartyBookingServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const createCatering = useMutation({
    mutationFn: async (input: CateringCreateInput) =>
      createCateringJobServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const transitionCatering = useMutation({
    mutationFn: async (input: CateringTransitionInput) =>
      transitionCateringJobServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  return {
    createEvent,
    transitionEvent,
    setTaskStatus,
    addPayment,
    saveParty,
    createCatering,
    transitionCatering,
  }
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  assignDriverServerFn,
  createDeliveryServerFn,
  createDriverServerFn,
  createZoneServerFn,
  listDeliveriesServerFn,
  listDriversServerFn,
  listZonesServerFn,
  setDriverStatusServerFn,
  transitionDeliveryServerFn,
} from '#/features/restaurant/delivery/server-functions'
import type {
  DeliveryAssignInput,
  DeliveryCreateInput,
  DeliveryTransitionInput,
  DriverCreateInput,
  ZoneCreateInput,
} from '#/features/restaurant/delivery/validation'

function useTenantId(): string | null {
  return usePreferencesStore((state) => state.activeTenantId)
}

async function auth(tenantId: string) {
  return { accessToken: await requireAccessToken(), tenantId }
}

export function useDrivers(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-drivers', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: async () =>
      listDriversServerFn({
        data: { ...(await auth(tenantId as string)), branchId },
      }),
  })
}

export function useDeliveryZones(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-delivery-zones', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () =>
      listZonesServerFn({
        data: {
          ...(await auth(tenantId as string)),
          branchId: branchId as string,
        },
      }),
  })
}

export function useDeliveries(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-deliveries', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    refetchInterval: 60_000,
    queryFn: async () =>
      listDeliveriesServerFn({
        data: {
          ...(await auth(tenantId as string)),
          branchId: branchId as string,
        },
      }),
  })
}

export function useDeliveryMutations() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  const invalidate = () => {
    for (const prefix of [
      'res-deliveries',
      'res-drivers',
      'res-delivery-zones',
      'res-orders',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  const createDriver = useMutation({
    mutationFn: async (input: DriverCreateInput) =>
      createDriverServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const setDriverStatus = useMutation({
    mutationFn: async (input: {
      id: string
      status: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY'
    }) =>
      setDriverStatusServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const createZone = useMutation({
    mutationFn: async (input: ZoneCreateInput) =>
      createZoneServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const createDelivery = useMutation({
    mutationFn: async (input: DeliveryCreateInput) =>
      createDeliveryServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const assignDriver = useMutation({
    mutationFn: async (input: DeliveryAssignInput) =>
      assignDriverServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  const transitionDelivery = useMutation({
    mutationFn: async (input: DeliveryTransitionInput) =>
      transitionDeliveryServerFn({
        data: { ...(await auth(tenantId as string)), input },
      }),
    onSuccess: invalidate,
  })

  return {
    createDriver,
    setDriverStatus,
    createZone,
    createDelivery,
    assignDriver,
    transitionDelivery,
  }
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import {
  createLocationServerFn,
  createWarehouseServerFn,
  deleteLocationServerFn,
  deleteWarehouseServerFn,
  listLocationsServerFn,
  listWarehousesServerFn,
  updateLocationServerFn,
  updateWarehouseServerFn,
} from '#/features/warehouses/server-functions'
import type { z } from 'zod'
import type {
  locationWriteSchema,
  warehouseWriteSchema,
} from '#/features/warehouses/validation'

export type WarehouseWriteInput = z.infer<typeof warehouseWriteSchema>
export type LocationWriteInput = z.infer<typeof locationWriteSchema>

async function requireAccessToken(): Promise<string> {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('You must be signed in to view warehouses.')
  }

  return accessToken
}

export function useWarehouses() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['warehouses', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listWarehousesServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })
}

export function useLocations(warehouseId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['locations', tenantId, warehouseId],
    enabled: Boolean(tenantId) && Boolean(warehouseId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listLocationsServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          warehouseId: warehouseId as string,
        },
      })
    },
  })
}

export function useWarehouseMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouses', tenantId] })
    queryClient.invalidateQueries({
      queryKey: ['inventory-analytics', tenantId],
    })
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing warehouses.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createWarehouse = useMutation({
    mutationFn: async (input: WarehouseWriteInput) =>
      createWarehouseServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateWarehouse = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<WarehouseWriteInput>
    }) =>
      updateWarehouseServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteWarehouse = useMutation({
    mutationFn: async (id: string) =>
      deleteWarehouseServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createWarehouse, updateWarehouse, deleteWarehouse }
}

export function useLocationMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['locations', tenantId] })

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing locations.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createLocation = useMutation({
    mutationFn: async (input: LocationWriteInput) =>
      createLocationServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateLocation = useMutation({
    mutationFn: async (args: {
      id: string
      input: Partial<Omit<LocationWriteInput, 'warehouseId'>>
    }) =>
      updateLocationServerFn({
        data: { ...(await payload()), id: args.id, input: args.input },
      }),
    onSuccess: invalidate,
  })

  const deleteLocation = useMutation({
    mutationFn: async (id: string) =>
      deleteLocationServerFn({ data: { ...(await payload()), id } }),
    onSuccess: invalidate,
  })

  return { createLocation, updateLocation, deleteLocation }
}

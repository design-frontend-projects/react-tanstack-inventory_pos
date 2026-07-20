'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  createBranchServerFn,
  createKitchenStationServerFn,
  createRestaurantServerFn,
  createServiceChargeRuleServerFn,
  createServiceTypeServerFn,
  createTaxConfigServerFn,
  listBranchesServerFn,
  listKitchenStationsServerFn,
  listRestaurantsServerFn,
  listServiceChargeRulesServerFn,
  listServiceTypesServerFn,
  listTaxConfigsServerFn,
} from '#/features/restaurant/master-data/server-functions'
import type {
  BranchCreateInput,
  RestaurantCreateInput,
  ServiceTypeCreateInput,
} from '#/features/restaurant/master-data/validation'

// Settings screen data layer over the master-data server functions. Every
// mutation invalidates the settings query family so tabs stay coherent.

function useTenantId(): string | null {
  return usePreferencesStore((state) => state.activeTenantId)
}

async function callWithAuth<TResult>(
  tenantId: string,
  call: (payload: { accessToken: string; tenantId: string }) => Promise<TResult>,
): Promise<TResult> {
  const accessToken = await requireAccessToken()
  return call({ accessToken, tenantId })
}

export function useRestaurants() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-restaurants', tenantId],
    enabled: Boolean(tenantId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listRestaurantsServerFn({ data: payload }),
      ),
  })
}

export function useSettingsBranches() {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-branches', tenantId],
    enabled: Boolean(tenantId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listBranchesServerFn({ data: payload }),
      ),
  })
}

export function useServiceTypes(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-service-types', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listServiceTypesServerFn({ data: { ...payload, branchId } }),
      ),
  })
}

export function useSettingsStations(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-stations', tenantId, branchId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listKitchenStationsServerFn({
          data: { ...payload, branchId: branchId as string },
        }),
      ),
  })
}

export function useTaxConfigs(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-taxes', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listTaxConfigsServerFn({ data: { ...payload, branchId } }),
      ),
  })
}

export function useServiceChargeRules(branchId: string | null) {
  const tenantId = useTenantId()
  return useQuery({
    queryKey: ['res-settings-service-charges', tenantId, branchId],
    enabled: Boolean(tenantId),
    queryFn: () =>
      callWithAuth(tenantId as string, (payload) =>
        listServiceChargeRulesServerFn({ data: { ...payload, branchId } }),
      ),
  })
}

export function useSettingsMutations() {
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['res-settings-restaurants', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['res-settings-branches', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['res-settings-service-types', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['res-settings-stations', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['res-settings-taxes', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['res-settings-service-charges', tenantId] })
    // The shared branch picker reads this key.
    void queryClient.invalidateQueries({ queryKey: ['res-branches', tenantId] })
  }

  const createRestaurant = useMutation({
    mutationFn: (input: RestaurantCreateInput) =>
      callWithAuth(tenantId as string, (payload) =>
        createRestaurantServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  const createBranch = useMutation({
    mutationFn: (input: BranchCreateInput) =>
      callWithAuth(tenantId as string, (payload) =>
        createBranchServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  const createServiceType = useMutation({
    mutationFn: (input: ServiceTypeCreateInput) =>
      callWithAuth(tenantId as string, (payload) =>
        createServiceTypeServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  const createStation = useMutation({
    mutationFn: (input: { branchId: string; code: string; name: string }) =>
      callWithAuth(tenantId as string, (payload) =>
        createKitchenStationServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  const createTaxConfig = useMutation({
    mutationFn: (input: {
      branchId?: string | null
      code: string
      name: string
      rate: string
      isInclusive?: boolean
      appliesTo?: 'ORDER' | 'LINE' | 'SERVICE_CHARGE' | 'DELIVERY'
    }) =>
      callWithAuth(tenantId as string, (payload) =>
        createTaxConfigServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  const createServiceCharge = useMutation({
    mutationFn: (input: {
      branchId?: string | null
      code: string
      name: string
      chargeType?: 'PERCENT' | 'FIXED'
      value: string
      minGuests?: number | null
      isTaxable?: boolean
    }) =>
      callWithAuth(tenantId as string, (payload) =>
        createServiceChargeRuleServerFn({ data: { ...payload, input } }),
      ),
    onSuccess: invalidate,
  })

  return {
    createRestaurant,
    createBranch,
    createServiceType,
    createStation,
    createTaxConfig,
    createServiceCharge,
  }
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { requireAccessToken } from '#/features/restaurant/shared/access'
import {
  addOrderItemServerFn,
  completeOrderServerFn,
  createOrderServerFn,
  getKitchenBoardServerFn,
  getOrderServerFn,
  listOrdersServerFn,
  mergeOrdersServerFn,
  transferOrderTableServerFn,
  transitionOrderServerFn,
  updateOrderItemStatusServerFn,
  voidOrderItemServerFn,
  voidOrderServerFn,
} from '#/features/restaurant/orders/server-functions'
import type { z } from 'zod'
import type {
  orderAddItemSchema,
  orderCompleteSchema,
  orderCreateSchema,
  orderItemStatusUpdateSchema,
  orderItemVoidSchema,
  orderMergeSchema,
  orderStatusSchema,
  orderTransferSchema,
  orderTransitionSchema,
  orderVoidSchema,
} from '#/features/restaurant/orders/validation'

export type OrderCreateInput = z.infer<typeof orderCreateSchema>
export type OrderAddItemInput = z.infer<typeof orderAddItemSchema>
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>
export type OrderCompleteInput = z.infer<typeof orderCompleteSchema>
export type OrderVoidInput = z.infer<typeof orderVoidSchema>
export type OrderItemStatusUpdateInput = z.infer<typeof orderItemStatusUpdateSchema>
export type OrderItemVoidInput = z.infer<typeof orderItemVoidSchema>
export type OrderTransferInput = z.infer<typeof orderTransferSchema>
export type OrderMergeInput = z.infer<typeof orderMergeSchema>
export type OrderStatusValue = z.infer<typeof orderStatusSchema>

export interface OrderListFilters {
  branchId?: string
  status?: OrderStatusValue
}

export function useOrders(filters: OrderListFilters = {}) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-orders', tenantId, filters],
    enabled: Boolean(tenantId) && Boolean(filters.branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return listOrdersServerFn({
        data: { accessToken, tenantId: tenantId as string, ...filters },
      })
    },
  })
}

export function useOrder(id: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-order', tenantId, id],
    enabled: Boolean(tenantId) && Boolean(id),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getOrderServerFn({
        data: { accessToken, tenantId: tenantId as string, id: id as string },
      })
    },
  })
}

export function useKitchenBoard(branchId: string | null, stationId: string | null) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  return useQuery({
    queryKey: ['res-kitchen-board', tenantId, branchId, stationId],
    enabled: Boolean(tenantId) && Boolean(branchId),
    queryFn: async () => {
      const accessToken = await requireAccessToken()

      return getKitchenBoardServerFn({
        data: {
          accessToken,
          tenantId: tenantId as string,
          branchId: branchId as string,
          stationId,
        },
      })
    },
  })
}

export function useOrderMutations() {
  const queryClient = useQueryClient()
  const tenantId = usePreferencesStore((state) => state.activeTenantId)

  const invalidate = () => {
    for (const prefix of [
      'res-orders',
      'res-order',
      'res-kitchen-board',
      'res-floor-status',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix, tenantId] })
    }
  }

  async function payload() {
    if (!tenantId) {
      throw new Error('Select a workspace before managing orders.')
    }

    return { accessToken: await requireAccessToken(), tenantId }
  }

  const createOrder = useMutation({
    mutationFn: async (input: OrderCreateInput) =>
      createOrderServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const addItem = useMutation({
    mutationFn: async (input: OrderAddItemInput) =>
      addOrderItemServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const transition = useMutation({
    mutationFn: async (input: OrderTransitionInput) =>
      transitionOrderServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const completeOrder = useMutation({
    mutationFn: async (input: OrderCompleteInput) =>
      completeOrderServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const voidOrder = useMutation({
    mutationFn: async (input: OrderVoidInput) =>
      voidOrderServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const updateItemStatus = useMutation({
    mutationFn: async (input: OrderItemStatusUpdateInput) =>
      updateOrderItemStatusServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const voidItem = useMutation({
    mutationFn: async (input: OrderItemVoidInput) =>
      voidOrderItemServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const transferTable = useMutation({
    mutationFn: async (input: OrderTransferInput) =>
      transferOrderTableServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  const mergeOrders = useMutation({
    mutationFn: async (input: OrderMergeInput) =>
      mergeOrdersServerFn({ data: { ...(await payload()), input } }),
    onSuccess: invalidate,
  })

  return {
    createOrder,
    addItem,
    transition,
    completeOrder,
    voidOrder,
    updateItemStatus,
    voidItem,
    transferTable,
    mergeOrders,
  }
}

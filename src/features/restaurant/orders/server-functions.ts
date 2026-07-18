import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as orders from '#/server/restaurant/orders/order-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  orderAddItemSchema,
  orderCompleteSchema,
  orderCreateSchema,
  orderItemStatusUpdateSchema,
  orderItemVoidSchema,
  orderStatusSchema,
  orderTransferSchema,
  orderTransitionSchema,
  orderVoidSchema,
} from '#/features/restaurant/orders/validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId
    ),
    permission
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })

export const listOrdersServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema.optional(), status: orderStatusSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.view')
    return orders.listOrders(context, data.tenantId, {
      branchId: data.branchId,
      status: data.status,
    })
  })

export const getOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ id: idSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.view')
    return orders.getOrder(context, data.tenantId, data.id)
  })

export const createOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.create')
    const result = await orders.createOrder(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'floor'])
    return result
  })

export const addOrderItemServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderAddItemSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.orders.update', 'res.orders.create'])
    const result = await orders.addItem(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const transitionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.orders.update',
      'res.kitchen.update_order_status',
    ])
    const result = await orders.transition(
      context,
      data.tenantId,
      data.input.id,
      data.input.toStatus,
      data.input.reason
    )
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const completeOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderCompleteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.orders.create', 'res.cashier.access'])
    const result = await orders.completeOrder(
      context,
      data.tenantId,
      data.input.id,
      data.input.payments
    )
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const voidOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderVoidSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.cancel')
    const result = await orders.voidOrder(context, data.tenantId, data.input.id, data.input.reason)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const updateOrderItemStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderItemStatusUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.kitchen.update_order_status',
      'res.orders.update',
    ])
    const result = await orders.updateItemStatus(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const voidOrderItemServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderItemVoidSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.orders.update', 'res.orders.cancel'])
    const result = await orders.voidOrderItem(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'kitchen', 'floor'])
    return result
  })

export const transferOrderTableServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderTransferSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.floor.manage', 'res.orders.update'])
    const result = await orders.transferOrderTable(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['orders', 'floor'])
    return result
  })

export const getKitchenBoardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: idSchema, stationId: idSchema.nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.kitchen.access', 'res.orders.view'])
    return orders.getKitchenBoard(context, data.tenantId, {
      branchId: data.branchId,
      stationId: data.stationId ?? null,
    })
  })

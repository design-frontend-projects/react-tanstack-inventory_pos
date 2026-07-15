import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as orders from '#/server/restaurant/orders/order-service'
import { getCurrentUserContext } from '#/server/auth/session'
import { requirePermission, requireTenantAccess } from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  orderAddItemSchema,
  orderCompleteSchema,
  orderCreateSchema,
  orderStatusSchema,
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
    return orders.createOrder(context, data.tenantId, data.input)
  })

export const addOrderItemServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderAddItemSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.update')
    return orders.addItem(context, data.tenantId, data.input)
  })

export const transitionOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.update')
    return orders.transition(context, data.tenantId, data.input.id, data.input.toStatus, data.input.reason)
  })

export const completeOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderCompleteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, ['res.orders.create', 'res.cashier.access'])
    return orders.completeOrder(context, data.tenantId, data.input.id, data.input.payments)
  })

export const voidOrderServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: orderVoidSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.orders.cancel')
    return orders.voidOrder(context, data.tenantId, data.input.id, data.input.reason)
  })

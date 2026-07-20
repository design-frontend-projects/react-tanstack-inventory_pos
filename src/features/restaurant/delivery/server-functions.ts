import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as delivery from '#/server/restaurant/delivery/delivery-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  deliveryAssignSchema,
  deliveryCreateSchema,
  deliveryTransitionSchema,
  driverCreateSchema,
  driverStatusSchema,
  zoneCreateSchema,
} from '#/features/restaurant/delivery/validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

const VIEW = ['res.delivery.view', 'res.delivery.manage']
const MANAGE = 'res.delivery.manage'

export const listDriversServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid().nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return delivery.listDrivers(context, data.tenantId, data.branchId ?? null)
  })

export const createDriverServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: driverCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await delivery.createDriver(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

export const setDriverStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: driverStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await delivery.setDriverStatus(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

export const listZonesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return delivery.listZones(context, data.tenantId, data.branchId)
  })

export const createZoneServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: zoneCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await delivery.createZone(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

export const listDeliveriesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return delivery.listDeliveries(context, data.tenantId, {
      branchId: data.branchId,
    })
  })

export const createDeliveryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: deliveryCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.delivery.manage',
      'res.orders.update',
    ])
    const result = await delivery.createDelivery(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

export const assignDriverServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: deliveryAssignSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await delivery.assignDriver(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

export const transitionDeliveryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: deliveryTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await delivery.transitionDelivery(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['delivery'])
    return result
  })

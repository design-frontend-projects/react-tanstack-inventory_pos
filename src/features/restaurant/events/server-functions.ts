import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as functions from '#/server/restaurant/functions/functions-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  cateringCreateSchema,
  cateringTransitionSchema,
  eventCreateSchema,
  eventListSchema,
  eventPaymentSchema,
  eventTaskStatusSchema,
  eventTransitionSchema,
  partySaveSchema,
} from '#/features/restaurant/events/validation'

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

const VIEW = ['res.events.view', 'res.events.manage']
const MANAGE = 'res.events.manage'

export const listEventsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: eventListSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, VIEW)
    return functions.listEvents(context, data.tenantId, data.input)
  })

export const createEventServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: eventCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await functions.createEvent(context, data.tenantId, data.input)
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const transitionEventServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: eventTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await functions.transitionEvent(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const setEventTaskStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: eventTaskStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await functions.setEventTaskStatus(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const addEventPaymentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: eventPaymentSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await functions.addEventPayment(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const savePartyBookingServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: partySaveSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, MANAGE)
    const result = await functions.savePartyBooking(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const listCateringJobsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.catering.view',
      'res.catering.manage',
      'res.events.view',
    ])
    return functions.listCateringJobs(context, data.tenantId, {
      branchId: data.branchId,
    })
  })

export const createCateringJobServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: cateringCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.catering.manage')
    const result = await functions.createCateringJob(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

export const transitionCateringJobServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: cateringTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.catering.manage')
    const result = await functions.transitionCateringJob(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['events'])
    return result
  })

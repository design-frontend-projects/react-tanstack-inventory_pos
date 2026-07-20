import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as reservations from '#/server/restaurant/guests/reservation-service'
import * as guestFlow from '#/server/restaurant/guests/guest-flow-service'
import { broadcastRestaurantEvent } from '#/server/realtime/broadcast'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  pickupCreateSchema,
  pickupStampSchema,
  qrCampaignActiveSchema,
  qrCampaignCreateSchema,
  reservationCreateSchema,
  reservationListSchema,
  reservationSeatSchema,
  reservationTransitionSchema,
  waitlistCreateSchema,
  waitlistStatusSchema,
} from '#/features/restaurant/guests/validation'

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

const RES_VIEW = ['res.reservations.view', 'res.reservations.manage']
const RES_MANAGE = 'res.reservations.manage'
const TAKEAWAY_VIEW = ['res.takeaway.view', 'res.takeaway.manage']
const TAKEAWAY_MANAGE = ['res.takeaway.manage', 'res.orders.update']

// --- Reservations -----------------------------------------------------------

export const listReservationsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reservationListSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_VIEW)
    return reservations.listReservations(context, data.tenantId, data.input)
  })

export const createReservationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reservationCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_MANAGE)
    const result = await reservations.createReservation(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['reservations'])
    return result
  })

export const transitionReservationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reservationTransitionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_MANAGE)
    const result = await reservations.transitionReservation(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['reservations', 'floor'])
    return result
  })

export const seatReservationServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: reservationSeatSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.reservations.manage',
      'res.floor.manage',
    ])
    const result = await reservations.seatReservation(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['reservations', 'floor', 'orders'])
    return result
  })

// --- Waitlist ---------------------------------------------------------------

export const listWaitlistServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    base.extend({
      branchId: z.string().uuid(),
      activeOnly: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_VIEW)
    return guestFlow.listWaitlist(context, data.tenantId, {
      branchId: data.branchId,
      activeOnly: data.activeOnly,
    })
  })

export const addWaitlistEntryServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: waitlistCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_MANAGE)
    const result = await guestFlow.addWaitlistEntry(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['reservations'])
    return result
  })

export const updateWaitlistStatusServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: waitlistStatusSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, RES_MANAGE)
    const result = await guestFlow.updateWaitlistStatus(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['reservations'])
    return result
  })

// --- Takeaway ---------------------------------------------------------------

export const getTakeawayBoardServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, TAKEAWAY_VIEW)
    return guestFlow.getTakeawayBoard(context, data.tenantId, {
      branchId: data.branchId,
    })
  })

export const createPickupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: pickupCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, TAKEAWAY_MANAGE)
    const result = await guestFlow.createPickup(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['takeaway'])
    return result
  })

export const stampPickupServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: pickupStampSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, TAKEAWAY_MANAGE)
    const result = await guestFlow.stampPickup(
      context,
      data.tenantId,
      data.input,
    )
    broadcastRestaurantEvent(data.tenantId, ['takeaway'])
    return result
  })

// --- QR campaigns -----------------------------------------------------------

export const listQrCampaignsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ branchId: z.string().uuid().nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'res.qr.manage',
      'res.dashboard.view',
    ])
    return guestFlow.listQrCampaigns(
      context,
      data.tenantId,
      data.branchId ?? null,
    )
  })

export const createQrCampaignServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: qrCampaignCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.qr.manage')
    return guestFlow.createQrCampaign(context, data.tenantId, data.input)
  })

export const setQrCampaignActiveServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: qrCampaignActiveSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'res.qr.manage')
    return guestFlow.setQrCampaignActive(context, data.tenantId, data.input)
  })

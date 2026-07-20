import { prisma } from '#/server/db/client'
import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import * as deliveryRepo from '#/server/repos/res-delivery-repo'
import * as orderRepo from '#/server/repos/res-order-repo'
import type {
  ResDelivery,
  ResDeliveryZone,
} from '#/server/db/generated/prisma/client'
import type { CurrentUserContext } from '#/types/auth'

// Dispatch: drivers, zones, and the delivery lifecycle
// PENDING → ASSIGNED → PICKED_UP → EN_ROUTE → DELIVERED | FAILED.

function serializeDelivery(row: ResDelivery) {
  return {
    ...row,
    lat: row.lat ? row.lat.toString() : null,
    lng: row.lng ? row.lng.toString() : null,
  }
}

function serializeZone(row: ResDeliveryZone) {
  return { ...row, feeAmount: row.feeAmount.toString() }
}

// --- Drivers ----------------------------------------------------------------

export async function listDrivers(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null,
) {
  return deliveryRepo.listDrivers(tenantId, branchId)
}

export async function createDriver(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId?: string | null
    name: string
    phone: string
    vehicle?: string | null
  },
) {
  return deliveryRepo.createDriver(tenantId, input)
}

export async function setDriverStatus(
  _context: CurrentUserContext,
  tenantId: string,
  input: { id: string; status: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY' },
) {
  await deliveryRepo.setDriverStatus(tenantId, input.id, input.status)
  return { ok: true }
}

// --- Zones ------------------------------------------------------------------

export async function listZones(
  _context: CurrentUserContext,
  tenantId: string,
  branchId: string,
) {
  const rows = await deliveryRepo.listZones(tenantId, branchId)
  return rows.map(serializeZone)
}

export async function createZone(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId: string
    name: string
    feeAmount?: string
    etaMinutes?: number
  },
) {
  const zone = await deliveryRepo.createZone(tenantId, input)
  return serializeZone(zone)
}

// --- Deliveries -------------------------------------------------------------

export async function listDeliveries(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string },
) {
  const rows = await deliveryRepo.listDeliveries(tenantId, {
    branchId: input.branchId,
  })
  return rows.map(serializeDelivery)
}

export async function createDelivery(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId: string
    orderId: string
    zoneId?: string | null
    addressLine: string
    addressNotes?: string | null
  },
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (order.orderType !== 'DELIVERY') {
    throw new ValidationError('Deliveries only apply to delivery orders')
  }
  const existing = await deliveryRepo.findDeliveryByOrder(
    tenantId,
    input.orderId,
  )
  if (existing) {
    throw new ValidationError('This order already has a delivery')
  }

  const delivery = await deliveryRepo.createDelivery(tenantId, input)
  return serializeDelivery(delivery)
}

export async function assignDriver(
  context: CurrentUserContext,
  tenantId: string,
  input: { deliveryId: string; driverId: string },
) {
  const [delivery, driver] = await Promise.all([
    deliveryRepo.findDeliveryById(tenantId, input.deliveryId),
    deliveryRepo.findDriverById(tenantId, input.driverId),
  ])
  if (!delivery || !driver) {
    throw new NotFoundError('Delivery or driver not found')
  }
  if (['DELIVERED', 'FAILED'].includes(delivery.status)) {
    throw new ValidationError('This delivery is already closed')
  }

  const order = await orderRepo.findOrderById(tenantId, delivery.orderId)

  await prisma.$transaction(async (tx) => {
    await deliveryRepo.updateDelivery(
      tenantId,
      delivery.id,
      { driverId: driver.id, status: 'ASSIGNED', assignedAt: new Date() },
      tx,
    )
    await deliveryRepo.setDriverStatus(tenantId, driver.id, 'ON_DELIVERY', tx)
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_delivery.assigned',
      aggregateType: 'restaurant_delivery',
      aggregateId: delivery.id,
      customerId: order?.customerId ?? null,
      actorProfileId: context.profileId,
      payload: {
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        driverId: driver.id,
        zoneId: delivery.zoneId,
        customerId: order?.customerId ?? null,
      },
    })
  })

  const updated = await deliveryRepo.findDeliveryById(tenantId, delivery.id)
  return updated ? serializeDelivery(updated) : null
}

const DELIVERY_FLOW: Record<string, ReadonlyArray<string>> = {
  PENDING: ['ASSIGNED'],
  ASSIGNED: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['EN_ROUTE', 'DELIVERED', 'FAILED'],
  EN_ROUTE: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
}

export async function transitionDelivery(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    deliveryId: string
    toStatus: 'PICKED_UP' | 'EN_ROUTE' | 'DELIVERED' | 'FAILED'
    reason?: string | null
    proofUrl?: string | null
  },
) {
  const delivery = await deliveryRepo.findDeliveryById(
    tenantId,
    input.deliveryId,
  )
  if (!delivery) {
    throw new NotFoundError('Delivery not found')
  }
  if (!DELIVERY_FLOW[delivery.status].includes(input.toStatus)) {
    throw new ValidationError(
      `Illegal transition ${delivery.status} -> ${input.toStatus}`,
    )
  }

  const order = await orderRepo.findOrderById(tenantId, delivery.orderId)
  const now = new Date()
  const patch: Record<string, unknown> = { status: input.toStatus }
  if (input.toStatus === 'PICKED_UP') patch.pickedUpAt = now
  if (input.toStatus === 'DELIVERED') {
    patch.deliveredAt = now
    if (input.proofUrl) patch.proofUrl = input.proofUrl
  }
  if (input.toStatus === 'FAILED') patch.failReason = input.reason ?? null

  await prisma.$transaction(async (tx) => {
    await deliveryRepo.updateDelivery(tenantId, delivery.id, patch, tx)

    // Terminal states release the driver.
    if (
      (input.toStatus === 'DELIVERED' || input.toStatus === 'FAILED') &&
      delivery.driverId
    ) {
      await deliveryRepo.setDriverStatus(
        tenantId,
        delivery.driverId,
        'AVAILABLE',
        tx,
      )
    }

    if (input.toStatus === 'DELIVERED') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'restaurant_delivery.delivered',
        aggregateType: 'restaurant_delivery',
        aggregateId: delivery.id,
        customerId: order?.customerId ?? null,
        actorProfileId: context.profileId,
        payload: {
          deliveryId: delivery.id,
          orderId: delivery.orderId,
          driverId: delivery.driverId,
          customerId: order?.customerId ?? null,
          deliveredAt: now.toISOString(),
        },
      })
    } else if (input.toStatus === 'FAILED') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'restaurant_delivery.failed',
        aggregateType: 'restaurant_delivery',
        aggregateId: delivery.id,
        customerId: order?.customerId ?? null,
        actorProfileId: context.profileId,
        payload: {
          deliveryId: delivery.id,
          orderId: delivery.orderId,
          customerId: order?.customerId ?? null,
          reason: input.reason ?? null,
        },
      })
    }
  })

  const updated = await deliveryRepo.findDeliveryById(tenantId, delivery.id)
  return updated ? serializeDelivery(updated) : null
}

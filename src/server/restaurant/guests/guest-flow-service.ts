import { NotFoundError, ValidationError } from '#/server/auth/errors'
import * as guestFlowRepo from '#/server/repos/res-guest-flow-repo'
import * as orderRepo from '#/server/repos/res-order-repo'
import type { CurrentUserContext } from '#/types/auth'

// Waitlist queue, takeaway pickup flow, and QR campaign management.

// --- Waitlist ---------------------------------------------------------------

export async function listWaitlist(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string; activeOnly?: boolean },
) {
  return guestFlowRepo.listWaitlist(tenantId, input)
}

export async function addWaitlistEntry(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId: string
    guestName: string
    guestPhone?: string | null
    partySize?: number
    priority?: 'NORMAL' | 'FAMILY' | 'VIP'
    quotedMinutes?: number
    notes?: string | null
  },
) {
  return guestFlowRepo.createWaitlistEntry(tenantId, input)
}

export async function updateWaitlistStatus(
  _context: CurrentUserContext,
  tenantId: string,
  input: { id: string; toStatus: 'NOTIFIED' | 'SEATED' | 'LEFT' },
) {
  const stamp =
    input.toStatus === 'NOTIFIED'
      ? { notifiedAt: new Date() }
      : input.toStatus === 'SEATED'
        ? { seatedAt: new Date() }
        : {}
  await guestFlowRepo.setWaitlistStatus(
    tenantId,
    input.id,
    input.toStatus,
    stamp,
  )
  return { ok: true }
}

// --- Takeaway ---------------------------------------------------------------

// Board = takeaway/pickup orders joined to their pickup rows.
export async function getTakeawayBoard(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string },
) {
  const [orders, pickups] = await Promise.all([
    orderRepo.listOrders(tenantId, { branchId: input.branchId }),
    guestFlowRepo.listPickups(tenantId, { branchId: input.branchId }),
  ])

  const pickupByOrder = new Map(pickups.map((pickup) => [pickup.orderId, pickup]))

  return orders
    .filter(
      (order) =>
        (order.orderType === 'TAKEAWAY' || order.orderType === 'PICKUP') &&
        !['CANCELLED', 'REFUNDED', 'VOIDED'].includes(order.status),
    )
    .map((order) => {
      const pickup = pickupByOrder.get(order.id) ?? null
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toString(),
        amountPaid: order.amountPaid.toString(),
        currencyCode: order.currencyCode,
        customerId: order.customerId,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        pickup: pickup
          ? {
              id: pickup.id,
              promisedAt: pickup.promisedAt.toISOString(),
              verificationCode: pickup.verificationCode,
              counter: pickup.counter,
              packedAt: pickup.packedAt?.toISOString() ?? null,
              notifiedAt: pickup.notifiedAt?.toISOString() ?? null,
              pickedUpAt: pickup.pickedUpAt?.toISOString() ?? null,
            }
          : null,
      }
    })
}

export async function createPickup(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId: string
    orderId: string
    promisedAt: string
    counter?: string | null
  },
) {
  const order = await orderRepo.findOrderById(tenantId, input.orderId)
  if (!order) {
    throw new NotFoundError('Order not found')
  }
  if (order.orderType !== 'TAKEAWAY' && order.orderType !== 'PICKUP') {
    throw new ValidationError('Pickups only apply to takeaway/pickup orders')
  }
  const existing = await guestFlowRepo.findPickupByOrder(tenantId, input.orderId)
  if (existing) {
    throw new ValidationError('This order already has a pickup ticket')
  }

  // 4-digit human-friendly verification code the guest reads at the counter.
  const verificationCode = String(Math.floor(1000 + Math.random() * 9000))

  return guestFlowRepo.createPickup(tenantId, {
    branchId: input.branchId,
    orderId: input.orderId,
    promisedAt: new Date(input.promisedAt),
    verificationCode,
    counter: input.counter ?? null,
  })
}

export async function stampPickup(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    id: string
    action: 'PACKED' | 'NOTIFIED' | 'PICKED_UP'
    verificationCode?: string | null
  },
) {
  const pickup = await guestFlowRepo.findPickupById(tenantId, input.id)
  if (!pickup) {
    throw new NotFoundError('Pickup ticket not found')
  }
  if (input.action === 'PICKED_UP') {
    // Handing over requires the code the guest received.
    if (pickup.verificationCode !== (input.verificationCode ?? '')) {
      throw new ValidationError('Verification code does not match')
    }
  }

  const patch =
    input.action === 'PACKED'
      ? { packedAt: new Date() }
      : input.action === 'NOTIFIED'
        ? { notifiedAt: new Date() }
        : { pickedUpAt: new Date() }

  await guestFlowRepo.stampPickup(tenantId, input.id, patch)
  return { ok: true }
}

// --- QR campaigns -----------------------------------------------------------

export async function listQrCampaigns(
  _context: CurrentUserContext,
  tenantId: string,
  branchId?: string | null,
) {
  return guestFlowRepo.listQrCampaigns(tenantId, branchId)
}

export async function createQrCampaign(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId?: string | null
    name: string
    slug: string
    target?: 'TABLE' | 'MENU' | 'CAMPAIGN'
    tableId?: string | null
    menuId?: string | null
    targetUrl?: string | null
    expiresAt?: string | null
  },
) {
  return guestFlowRepo.createQrCampaign(tenantId, {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  })
}

export async function setQrCampaignActive(
  _context: CurrentUserContext,
  tenantId: string,
  input: { id: string; isActive: boolean },
) {
  await guestFlowRepo.setQrCampaignActive(tenantId, input.id, input.isActive)
  return { ok: true }
}

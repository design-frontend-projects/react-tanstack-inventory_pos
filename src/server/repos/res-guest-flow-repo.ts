import { prisma } from '#/server/db/client'
import type {
  ResQrCampaignTarget,
  ResWaitlistPriority,
  ResWaitlistStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Waitlist, takeaway pickups, and QR campaigns — the light guest-flow
// aggregates that surround reservations.

// --- Waitlist ---------------------------------------------------------------

export function listWaitlist(
  tenantId: string,
  options: { branchId: string; activeOnly?: boolean },
  client: PrismaClientLike = prisma,
) {
  return client.resWaitlistEntry.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      ...(options.activeOnly
        ? { status: { in: ['WAITING', 'NOTIFIED'] } }
        : {}),
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 200,
  })
}

export function createWaitlistEntry(
  tenantId: string,
  input: {
    branchId: string
    guestName: string
    guestPhone?: string | null
    partySize?: number
    priority?: ResWaitlistPriority
    quotedMinutes?: number
    notes?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resWaitlistEntry.create({
    data: {
      tenantId,
      branchId: input.branchId,
      guestName: input.guestName,
      guestPhone: input.guestPhone ?? null,
      partySize: input.partySize ?? 2,
      priority: input.priority ?? 'NORMAL',
      quotedMinutes: input.quotedMinutes ?? 15,
      notes: input.notes ?? null,
    },
  })
}

export async function setWaitlistStatus(
  tenantId: string,
  id: string,
  status: ResWaitlistStatus,
  extra: Record<string, unknown> = {},
  client: PrismaClientLike = prisma,
) {
  await client.resWaitlistEntry.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })
}

// --- Takeaway pickups -------------------------------------------------------

export function findPickupById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resPickup.findFirst({ where: { id, tenantId } })
}

export function findPickupByOrder(
  tenantId: string,
  orderId: string,
  client: PrismaClientLike = prisma,
) {
  return client.resPickup.findFirst({ where: { tenantId, orderId } })
}

export function listPickups(
  tenantId: string,
  options: { branchId: string; from?: Date; to?: Date },
  client: PrismaClientLike = prisma,
) {
  return client.resPickup.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      ...(options.from || options.to
        ? {
            promisedAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lt: options.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { promisedAt: 'asc' },
    take: 300,
  })
}

export function createPickup(
  tenantId: string,
  input: {
    branchId: string
    orderId: string
    promisedAt: Date
    verificationCode: string
    counter?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resPickup.create({
    data: {
      tenantId,
      branchId: input.branchId,
      orderId: input.orderId,
      promisedAt: input.promisedAt,
      verificationCode: input.verificationCode,
      counter: input.counter ?? null,
    },
  })
}

export async function stampPickup(
  tenantId: string,
  id: string,
  patch: Partial<{
    packedAt: Date
    notifiedAt: Date
    pickedUpAt: Date
    counter: string | null
  }>,
  client: PrismaClientLike = prisma,
) {
  await client.resPickup.updateMany({ where: { id, tenantId }, data: patch })
}

// --- QR campaigns -----------------------------------------------------------

export function listQrCampaigns(
  tenantId: string,
  branchId?: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.resQrCampaign.findMany({
    where: {
      tenantId,
      ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

export function createQrCampaign(
  tenantId: string,
  input: {
    branchId?: string | null
    name: string
    slug: string
    target?: ResQrCampaignTarget
    tableId?: string | null
    menuId?: string | null
    targetUrl?: string | null
    expiresAt?: Date | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resQrCampaign.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      slug: input.slug,
      target: input.target ?? 'MENU',
      tableId: input.tableId ?? null,
      menuId: input.menuId ?? null,
      targetUrl: input.targetUrl ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  })
}

export async function setQrCampaignActive(
  tenantId: string,
  id: string,
  isActive: boolean,
  client: PrismaClientLike = prisma,
) {
  await client.resQrCampaign.updateMany({
    where: { id, tenantId },
    data: { isActive },
  })
}

export async function incrementQrScans(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  await client.resQrCampaign.updateMany({
    where: { id, tenantId },
    data: { scanCount: { increment: 1 } },
  })
}

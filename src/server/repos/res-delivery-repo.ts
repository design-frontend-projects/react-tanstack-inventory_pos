import { prisma } from '#/server/db/client'
import type {
  ResDeliveryStatus,
  ResDriverStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Drivers, delivery zones, and deliveries (dispatch aggregates).

// --- Drivers ----------------------------------------------------------------

export function listDrivers(
  tenantId: string,
  branchId?: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.resDriver.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
    },
    orderBy: { name: 'asc' },
    take: 200,
  })
}

export function findDriverById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resDriver.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createDriver(
  tenantId: string,
  input: {
    branchId?: string | null
    profileId?: string | null
    name: string
    phone: string
    vehicle?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resDriver.create({
    data: {
      tenantId,
      branchId: input.branchId ?? null,
      profileId: input.profileId ?? null,
      name: input.name,
      phone: input.phone,
      vehicle: input.vehicle ?? null,
    },
  })
}

export async function setDriverStatus(
  tenantId: string,
  id: string,
  status: ResDriverStatus,
  client: PrismaClientLike = prisma,
) {
  await client.resDriver.updateMany({ where: { id, tenantId }, data: { status } })
}

// --- Zones ------------------------------------------------------------------

export function listZones(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma,
) {
  return client.resDeliveryZone.findMany({
    where: { tenantId, branchId },
    orderBy: { name: 'asc' },
    take: 200,
  })
}

export function createZone(
  tenantId: string,
  input: {
    branchId: string
    name: string
    feeAmount?: string
    etaMinutes?: number
    polygon?: unknown
  },
  client: PrismaClientLike = prisma,
) {
  return client.resDeliveryZone.create({
    data: {
      tenantId,
      branchId: input.branchId,
      name: input.name,
      feeAmount: input.feeAmount ?? 0,
      etaMinutes: input.etaMinutes ?? 45,
      polygon: (input.polygon ?? undefined) as never,
    },
  })
}

// --- Deliveries -------------------------------------------------------------

export function findDeliveryById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resDelivery.findFirst({ where: { id, tenantId } })
}

export function findDeliveryByOrder(
  tenantId: string,
  orderId: string,
  client: PrismaClientLike = prisma,
) {
  return client.resDelivery.findFirst({ where: { tenantId, orderId } })
}

export function listDeliveries(
  tenantId: string,
  options: { branchId: string; status?: ResDeliveryStatus },
  client: PrismaClientLike = prisma,
) {
  return client.resDelivery.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function createDelivery(
  tenantId: string,
  input: {
    branchId: string
    orderId: string
    zoneId?: string | null
    addressLine: string
    addressNotes?: string | null
    lat?: string | null
    lng?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resDelivery.create({
    data: {
      tenantId,
      branchId: input.branchId,
      orderId: input.orderId,
      zoneId: input.zoneId ?? null,
      addressLine: input.addressLine,
      addressNotes: input.addressNotes ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    },
  })
}

export async function updateDelivery(
  tenantId: string,
  id: string,
  patch: Record<string, unknown>,
  client: PrismaClientLike = prisma,
) {
  await client.resDelivery.updateMany({ where: { id, tenantId }, data: patch })
}

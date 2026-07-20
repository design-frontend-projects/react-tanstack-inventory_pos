import { prisma } from '#/server/db/client'
import type {
  ResReservationSource,
  ResReservationStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResReservationCreateInput {
  branchId: string
  code: string
  customerId?: string | null
  guestName: string
  guestPhone?: string | null
  partySize?: number
  requestedAt: Date
  durationMinutes?: number
  source?: ResReservationSource
  depositAmount?: string | null
  notes?: string | null
}

export function findReservationById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resReservation.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { tables: true },
  })
}

export function listReservations(
  tenantId: string,
  options: {
    branchId: string
    from?: Date
    to?: Date
    status?: ResReservationStatus
  },
  client: PrismaClientLike = prisma,
) {
  return client.resReservation.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.from || options.to
        ? {
            requestedAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lt: options.to } : {}),
            },
          }
        : {}),
    },
    include: { tables: true },
    orderBy: { requestedAt: 'asc' },
    take: 500,
  })
}

export function createReservation(
  tenantId: string,
  input: ResReservationCreateInput,
  client: PrismaClientLike = prisma,
) {
  return client.resReservation.create({
    data: {
      tenantId,
      branchId: input.branchId,
      code: input.code,
      customerId: input.customerId ?? null,
      guestName: input.guestName,
      guestPhone: input.guestPhone ?? null,
      partySize: input.partySize ?? 2,
      requestedAt: input.requestedAt,
      durationMinutes: input.durationMinutes ?? 90,
      source: input.source ?? 'PHONE',
      depositAmount: input.depositAmount ?? null,
      notes: input.notes ?? null,
      status: 'REQUESTED',
    },
    include: { tables: true },
  })
}

export async function setReservationStatus(
  tenantId: string,
  id: string,
  status: ResReservationStatus,
  extra: Record<string, unknown> = {},
  client: PrismaClientLike = prisma,
) {
  await client.resReservation.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })
}

export async function setReservationTables(
  tenantId: string,
  reservationId: string,
  tableIds: ReadonlyArray<string>,
  client: PrismaClientLike = prisma,
) {
  await client.resReservationTable.deleteMany({
    where: { tenantId, reservationId },
  })
  if (tableIds.length > 0) {
    await client.resReservationTable.createMany({
      data: tableIds.map((tableId) => ({ tenantId, reservationId, tableId })),
    })
  }
}

// Reservations overlapping [from, to) that hold any of the given tables.
// Duration lives on the row, so the lower bound is widened by the longest
// realistic booking (12h) and precise overlap is confirmed in the service.
const MAX_RESERVATION_MS = 12 * 60 * 60 * 1000

export function findTableConflicts(
  tenantId: string,
  branchId: string,
  tableIds: ReadonlyArray<string>,
  from: Date,
  to: Date,
  excludeReservationId?: string,
  client: PrismaClientLike = prisma,
) {
  return client.resReservation.findMany({
    where: {
      tenantId,
      branchId,
      deletedAt: null,
      status: { in: ['REQUESTED', 'CONFIRMED', 'SEATED'] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      requestedAt: {
        gte: new Date(from.getTime() - MAX_RESERVATION_MS),
        lt: to,
      },
      tables: { some: { tableId: { in: [...tableIds] } } },
    },
    include: { tables: true },
  })
}

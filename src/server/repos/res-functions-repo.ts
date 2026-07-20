import { prisma } from '#/server/db/client'
import type {
  ResCateringStatus,
  ResEventStatus,
  ResEventTaskStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Events, party bookings, and catering jobs (functions aggregates).

// --- Events -----------------------------------------------------------------

export function listEvents(
  tenantId: string,
  options: { branchId: string; from?: Date; to?: Date; status?: ResEventStatus },
  client: PrismaClientLike = prisma,
) {
  return client.resEvent.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.from || options.to
        ? {
            startsAt: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lt: options.to } : {}),
            },
          }
        : {}),
    },
    include: { tasks: { orderBy: { sortOrder: 'asc' } }, payments: true, party: true },
    orderBy: { startsAt: 'asc' },
    take: 300,
  })
}

export function findEventById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resEvent.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { tasks: { orderBy: { sortOrder: 'asc' } }, payments: true, party: true },
  })
}

export function createEvent(
  tenantId: string,
  input: {
    branchId: string
    code: string
    kind: string
    name: string
    customerId?: string | null
    hallId?: string | null
    startsAt: Date
    endsAt: Date
    guestCount?: number
    packageJson?: unknown
    quoteAmount?: string
    notes?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resEvent.create({
    data: {
      tenantId,
      branchId: input.branchId,
      code: input.code,
      kind: input.kind as never,
      name: input.name,
      customerId: input.customerId ?? null,
      hallId: input.hallId ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      guestCount: input.guestCount ?? 20,
      packageJson: (input.packageJson ?? {}) as never,
      quoteAmount: input.quoteAmount ?? 0,
      notes: input.notes ?? null,
    },
  })
}

export async function setEventStatus(
  tenantId: string,
  id: string,
  status: ResEventStatus,
  client: PrismaClientLike = prisma,
) {
  await client.resEvent.updateMany({ where: { id, tenantId }, data: { status } })
}

// Events overlapping [startsAt, endsAt) in the same hall.
export function findHallConflicts(
  tenantId: string,
  branchId: string,
  hallId: string,
  startsAt: Date,
  endsAt: Date,
  client: PrismaClientLike = prisma,
) {
  return client.resEvent.findMany({
    where: {
      tenantId,
      branchId,
      hallId,
      deletedAt: null,
      status: { in: ['QUOTED', 'CONFIRMED', 'IN_PROGRESS'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  })
}

export function createEventTasks(
  tenantId: string,
  eventId: string,
  titles: ReadonlyArray<string>,
  client: PrismaClientLike = prisma,
) {
  return client.resEventTask.createMany({
    data: titles.map((title, index) => ({
      tenantId,
      eventId,
      title,
      sortOrder: index,
    })),
  })
}

export async function setTaskStatus(
  tenantId: string,
  id: string,
  status: ResEventTaskStatus,
  client: PrismaClientLike = prisma,
) {
  await client.resEventTask.updateMany({
    where: { id, tenantId },
    data: { status },
  })
}

export function addEventPayment(
  tenantId: string,
  input: {
    eventId: string
    kind: string
    amount: string
    method?: string
    reference?: string | null
    paidAt?: Date | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resEventPayment.create({
    data: {
      tenantId,
      eventId: input.eventId,
      kind: input.kind as never,
      amount: input.amount,
      method: input.method ?? 'cash',
      reference: input.reference ?? null,
      paidAt: input.paidAt ?? null,
    },
  })
}

export function upsertPartyBooking(
  tenantId: string,
  input: {
    eventId: string
    theme?: string | null
    decorationsJson?: unknown
    seatingJson?: unknown
    vendorJson?: unknown
    costAmount?: string
    revenueAmount?: string
  },
  client: PrismaClientLike = prisma,
) {
  return client.resPartyBooking.upsert({
    where: { eventId: input.eventId },
    create: {
      tenantId,
      eventId: input.eventId,
      theme: input.theme ?? null,
      decorationsJson: (input.decorationsJson ?? undefined) as never,
      seatingJson: (input.seatingJson ?? undefined) as never,
      vendorJson: (input.vendorJson ?? undefined) as never,
      costAmount: input.costAmount ?? 0,
      revenueAmount: input.revenueAmount ?? 0,
    },
    update: {
      theme: input.theme ?? null,
      decorationsJson: (input.decorationsJson ?? undefined) as never,
      seatingJson: (input.seatingJson ?? undefined) as never,
      vendorJson: (input.vendorJson ?? undefined) as never,
      ...(input.costAmount !== undefined ? { costAmount: input.costAmount } : {}),
      ...(input.revenueAmount !== undefined
        ? { revenueAmount: input.revenueAmount }
        : {}),
    },
  })
}

// --- Catering ---------------------------------------------------------------

export function listCateringJobs(
  tenantId: string,
  options: { branchId: string; status?: ResCateringStatus },
  client: PrismaClientLike = prisma,
) {
  return client.resCateringJob.findMany({
    where: {
      tenantId,
      branchId: options.branchId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
    },
    orderBy: { eventDate: 'asc' },
    take: 300,
  })
}

export function findCateringJobById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.resCateringJob.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createCateringJob(
  tenantId: string,
  input: {
    branchId: string
    code: string
    kind: string
    name: string
    customerId?: string | null
    eventDate: Date
    addressLine?: string | null
    guestCount?: number
    menuJson?: unknown
    quoteAmount?: string
    costAmount?: string
    notes?: string | null
  },
  client: PrismaClientLike = prisma,
) {
  return client.resCateringJob.create({
    data: {
      tenantId,
      branchId: input.branchId,
      code: input.code,
      kind: input.kind as never,
      name: input.name,
      customerId: input.customerId ?? null,
      eventDate: input.eventDate,
      addressLine: input.addressLine ?? null,
      guestCount: input.guestCount ?? 20,
      menuJson: (input.menuJson ?? {}) as never,
      quoteAmount: input.quoteAmount ?? 0,
      costAmount: input.costAmount ?? 0,
      notes: input.notes ?? null,
    },
  })
}

export async function setCateringStatus(
  tenantId: string,
  id: string,
  status: ResCateringStatus,
  client: PrismaClientLike = prisma,
) {
  await client.resCateringJob.updateMany({
    where: { id, tenantId },
    data: { status },
  })
}

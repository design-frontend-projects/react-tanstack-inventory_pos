import { prisma } from '#/server/db/client'
import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import * as functionsRepo from '#/server/repos/res-functions-repo'
import type {
  ResCateringJob,
  ResEvent,
  ResEventPayment,
  ResEventTask,
  ResPartyBooking,
} from '#/server/db/generated/prisma/client'
import type { CurrentUserContext } from '#/types/auth'

// Events (with tasks, payments, party extension) and catering jobs.

type EventRow = ResEvent & {
  tasks: Array<ResEventTask>
  payments: Array<ResEventPayment>
  party: ResPartyBooking | null
}

function serializeEvent(row: EventRow) {
  const paid = row.payments
    .filter((payment) => payment.kind !== 'REFUND' && payment.paidAt)
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  const refunded = row.payments
    .filter((payment) => payment.kind === 'REFUND' && payment.paidAt)
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  // JSON columns stay as Prisma's JsonValue — casting them to
  // Record<string, unknown> makes the server-fn boundary reject them.
  return {
    ...row,
    quoteAmount: row.quoteAmount.toString(),
    paidAmount: (paid - refunded).toFixed(2),
    payments: row.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
    })),
    party: row.party
      ? {
          ...row.party,
          costAmount: row.party.costAmount.toString(),
          revenueAmount: row.party.revenueAmount.toString(),
        }
      : null,
  }
}

function serializeCatering(row: ResCateringJob) {
  return {
    ...row,
    costAmount: row.costAmount.toString(),
    quoteAmount: row.quoteAmount.toString(),
  }
}

// Default checklist stamped onto every new booking.
const DEFAULT_TASKS = [
  'Confirm menu & packages',
  'Collect deposit',
  'Plan kitchen prep & inventory',
  'Assign staff',
  'Arrange hall & seating',
  'Final payment & close-out',
]

export async function listEvents(
  _context: CurrentUserContext,
  tenantId: string,
  input: {
    branchId: string
    from?: string
    to?: string
    status?: 'INQUIRY' | 'QUOTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  },
) {
  const rows = await functionsRepo.listEvents(tenantId, {
    branchId: input.branchId,
    from: input.from ? new Date(input.from) : undefined,
    to: input.to ? new Date(input.to) : undefined,
    status: input.status,
  })
  return rows.map(serializeEvent)
}

export async function getEvent(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const row = await functionsRepo.findEventById(tenantId, id)
  if (!row) {
    throw new NotFoundError('Event not found')
  }
  return serializeEvent(row)
}

export interface EventCreateInput {
  branchId: string
  kind: string
  name: string
  customerId?: string | null
  hallId?: string | null
  startsAt: string
  endsAt: string
  guestCount?: number
  packageJson?: Record<string, unknown>
  quoteAmount?: string
  notes?: string | null
}

export async function createEvent(
  context: CurrentUserContext,
  tenantId: string,
  input: EventCreateInput,
) {
  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(input.endsAt)
  if (endsAt <= startsAt) {
    throw new ValidationError('The event must end after it starts')
  }

  if (input.hallId) {
    const conflicts = await functionsRepo.findHallConflicts(
      tenantId,
      input.branchId,
      input.hallId,
      startsAt,
      endsAt,
    )
    if (conflicts.length > 0) {
      throw new ValidationError(
        `The hall is already booked (${conflicts[0].code})`,
      )
    }
  }

  const event = await prisma.$transaction(async (tx) => {
    // Simple per-branch sequence: EVT-<count+1> avoids adding a sequence type.
    const count = await tx.resEvent.count({
      where: { tenantId, branchId: input.branchId },
    })
    const created = await functionsRepo.createEvent(
      tenantId,
      {
        branchId: input.branchId,
        code: `EVT-${String(count + 1).padStart(5, '0')}`,
        kind: input.kind,
        name: input.name,
        customerId: input.customerId ?? null,
        hallId: input.hallId ?? null,
        startsAt,
        endsAt,
        guestCount: input.guestCount,
        packageJson: input.packageJson,
        quoteAmount: input.quoteAmount,
        notes: input.notes ?? null,
      },
      tx,
    )
    await functionsRepo.createEventTasks(tenantId, created.id, DEFAULT_TASKS, tx)
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_event.booked',
      aggregateType: 'restaurant_event',
      aggregateId: created.id,
      customerId: created.customerId,
      actorProfileId: context.profileId,
      payload: {
        eventId: created.id,
        branchId: created.branchId,
        code: created.code,
        kind: created.kind,
        customerId: created.customerId,
        startsAt: created.startsAt.toISOString(),
        guestCount: created.guestCount,
      },
    })
    return created
  })

  return getEvent(context, tenantId, event.id)
}

const EVENT_FLOW: Record<string, ReadonlyArray<string>> = {
  INQUIRY: ['QUOTED', 'CONFIRMED', 'CANCELLED'],
  QUOTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export async function transitionEvent(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    id: string
    toStatus: 'QUOTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  },
) {
  const event = await functionsRepo.findEventById(tenantId, input.id)
  if (!event) {
    throw new NotFoundError('Event not found')
  }
  if (!EVENT_FLOW[event.status].includes(input.toStatus)) {
    throw new ValidationError(
      `Illegal transition ${event.status} -> ${input.toStatus}`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await functionsRepo.setEventStatus(
      tenantId,
      input.id,
      input.toStatus,
      tx,
    )
    if (input.toStatus === 'COMPLETED' || input.toStatus === 'CANCELLED') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType:
          input.toStatus === 'COMPLETED'
            ? 'restaurant_event.completed'
            : 'restaurant_event.cancelled',
        aggregateType: 'restaurant_event',
        aggregateId: event.id,
        customerId: event.customerId,
        actorProfileId: context.profileId,
        payload: {
          eventId: event.id,
          code: event.code,
          customerId: event.customerId,
          statusCode: input.toStatus,
        },
      })
    }
  })

  return getEvent(context, tenantId, input.id)
}

export async function setEventTaskStatus(
  _context: CurrentUserContext,
  tenantId: string,
  input: { taskId: string; status: 'TODO' | 'DOING' | 'DONE' },
) {
  await functionsRepo.setTaskStatus(tenantId, input.taskId, input.status)
  return { ok: true }
}

export async function addEventPayment(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    eventId: string
    kind: 'DEPOSIT' | 'INSTALLMENT' | 'FINAL' | 'REFUND'
    amount: string
    method?: string
    reference?: string | null
  },
) {
  const event = await functionsRepo.findEventById(tenantId, input.eventId)
  if (!event) {
    throw new NotFoundError('Event not found')
  }
  if (Number(input.amount) <= 0) {
    throw new ValidationError('Payment amount must be positive')
  }
  await functionsRepo.addEventPayment(tenantId, {
    eventId: input.eventId,
    kind: input.kind,
    amount: input.amount,
    method: input.method,
    reference: input.reference ?? null,
    paidAt: new Date(),
  })
  return getEvent(context, tenantId, input.eventId)
}

export async function savePartyBooking(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    eventId: string
    theme?: string | null
    seatingJson?: unknown
    decorationsJson?: unknown
    costAmount?: string
    revenueAmount?: string
  },
) {
  const event = await functionsRepo.findEventById(tenantId, input.eventId)
  if (!event) {
    throw new NotFoundError('Event not found')
  }
  await functionsRepo.upsertPartyBooking(tenantId, input)
  return getEvent(context, tenantId, input.eventId)
}

// --- Catering ---------------------------------------------------------------

export async function listCateringJobs(
  _context: CurrentUserContext,
  tenantId: string,
  input: { branchId: string },
) {
  const rows = await functionsRepo.listCateringJobs(tenantId, input)
  return rows.map(serializeCatering)
}

export interface CateringCreateInput {
  branchId: string
  kind: string
  name: string
  customerId?: string | null
  eventDate: string
  addressLine?: string | null
  guestCount?: number
  quoteAmount?: string
  costAmount?: string
  notes?: string | null
}

export async function createCateringJob(
  _context: CurrentUserContext,
  tenantId: string,
  input: CateringCreateInput,
) {
  const job = await prisma.$transaction(async (tx) => {
    const count = await tx.resCateringJob.count({
      where: { tenantId, branchId: input.branchId },
    })
    return functionsRepo.createCateringJob(
      tenantId,
      {
        branchId: input.branchId,
        code: `CAT-${String(count + 1).padStart(5, '0')}`,
        kind: input.kind,
        name: input.name,
        customerId: input.customerId ?? null,
        eventDate: new Date(input.eventDate),
        addressLine: input.addressLine ?? null,
        guestCount: input.guestCount,
        quoteAmount: input.quoteAmount,
        costAmount: input.costAmount,
        notes: input.notes ?? null,
      },
      tx,
    )
  })
  return serializeCatering(job)
}

const CATERING_FLOW: Record<string, ReadonlyArray<string>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPPING', 'CANCELLED'],
  PREPPING: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export async function transitionCateringJob(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    id: string
    toStatus: 'CONFIRMED' | 'PREPPING' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED'
  },
) {
  const job = await functionsRepo.findCateringJobById(tenantId, input.id)
  if (!job) {
    throw new NotFoundError('Catering job not found')
  }
  if (!CATERING_FLOW[job.status].includes(input.toStatus)) {
    throw new ValidationError(
      `Illegal transition ${job.status} -> ${input.toStatus}`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await functionsRepo.setCateringStatus(tenantId, input.id, input.toStatus, tx)
    if (input.toStatus === 'CONFIRMED' || input.toStatus === 'COMPLETED') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType:
          input.toStatus === 'CONFIRMED'
            ? 'restaurant_catering.confirmed'
            : 'restaurant_catering.completed',
        aggregateType: 'restaurant_catering',
        aggregateId: job.id,
        customerId: job.customerId,
        actorProfileId: context.profileId,
        payload: {
          cateringJobId: job.id,
          code: job.code,
          customerId: job.customerId,
          statusCode: input.toStatus,
          quoteAmount: job.quoteAmount.toString(),
        },
      })
    }
  })

  const updated = await functionsRepo.findCateringJobById(tenantId, input.id)
  return updated ? serializeCatering(updated) : null
}

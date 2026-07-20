import { prisma } from '#/server/db/client'
import { NotFoundError, ValidationError } from '#/server/auth/errors'
import { appendDomainEvent } from '#/server/events/event-outbox'
import * as reservationRepo from '#/server/repos/res-reservation-repo'
import * as sequenceRepo from '#/server/repos/res-number-sequence-repo'
import * as orderService from '#/server/restaurant/orders/order-service'
import type { ResReservation, ResReservationTable } from '#/server/db/generated/prisma/client'
import type { CurrentUserContext } from '#/types/auth'

// Reservation lifecycle: REQUESTED → CONFIRMED → SEATED → COMPLETED with
// NO_SHOW / CANCELLED exits. Seating can open a linked dine-in order.

type ReservationRow = ResReservation & { tables: Array<ResReservationTable> }

function serializeReservation(row: ReservationRow) {
  return {
    ...row,
    depositAmount: row.depositAmount ? row.depositAmount.toString() : null,
    tableIds: row.tables.map((table) => table.tableId),
    tables: undefined,
  }
}

export interface ReservationListFilters {
  branchId: string
  from?: string
  to?: string
  status?:
    | 'REQUESTED'
    | 'CONFIRMED'
    | 'SEATED'
    | 'COMPLETED'
    | 'NO_SHOW'
    | 'CANCELLED'
}

export async function listReservations(
  _context: CurrentUserContext,
  tenantId: string,
  filters: ReservationListFilters,
) {
  const rows = await reservationRepo.listReservations(tenantId, {
    branchId: filters.branchId,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(filters.to) : undefined,
    status: filters.status,
  })
  return rows.map(serializeReservation)
}

export interface ReservationCreateInput {
  branchId: string
  guestName: string
  guestPhone?: string | null
  customerId?: string | null
  partySize?: number
  requestedAt: string
  durationMinutes?: number
  source?: 'PHONE' | 'WALK_IN' | 'QR' | 'ONLINE'
  depositAmount?: string | null
  notes?: string | null
  tableIds?: Array<string>
}

export async function createReservation(
  context: CurrentUserContext,
  tenantId: string,
  input: ReservationCreateInput,
) {
  const requestedAt = new Date(input.requestedAt)
  if (Number.isNaN(requestedAt.getTime())) {
    throw new ValidationError('Invalid reservation time')
  }

  const reservation = await prisma.$transaction(async (tx) => {
    if (input.tableIds?.length) {
      const windowEnd = new Date(
        requestedAt.getTime() + (input.durationMinutes ?? 90) * 60_000,
      )
      const candidates = await reservationRepo.findTableConflicts(
        tenantId,
        input.branchId,
        input.tableIds,
        requestedAt,
        windowEnd,
        undefined,
        tx,
      )
      // The repo widens the lower bound; confirm the precise overlap here.
      const conflicts = candidates.filter((candidate) => {
        const candidateEnd = new Date(
          candidate.requestedAt.getTime() +
            candidate.durationMinutes * 60_000,
        )
        return candidate.requestedAt < windowEnd && candidateEnd > requestedAt
      })
      if (conflicts.length > 0) {
        throw new ValidationError(
          `Table already reserved around that time (${conflicts[0].code})`,
        )
      }
    }

    const issued = await sequenceRepo.issueNextNumber(
      tenantId,
      { branchId: input.branchId, sequenceType: 'RESERVATION' },
      tx,
    )

    const created = await reservationRepo.createReservation(
      tenantId,
      {
        branchId: input.branchId,
        code: issued.formatted,
        customerId: input.customerId ?? null,
        guestName: input.guestName,
        guestPhone: input.guestPhone ?? null,
        partySize: input.partySize,
        requestedAt,
        durationMinutes: input.durationMinutes,
        source: input.source,
        depositAmount: input.depositAmount ?? null,
        notes: input.notes ?? null,
      },
      tx,
    )

    if (input.tableIds?.length) {
      await reservationRepo.setReservationTables(
        tenantId,
        created.id,
        input.tableIds,
        tx,
      )
    }

    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_reservation.created',
      aggregateType: 'restaurant_reservation',
      aggregateId: created.id,
      customerId: created.customerId,
      actorProfileId: context.profileId,
      payload: {
        reservationId: created.id,
        branchId: created.branchId,
        customerId: created.customerId,
        partySize: created.partySize,
        scheduledAt: created.requestedAt.toISOString(),
      },
    })

    return created
  })

  return getReservation(context, tenantId, reservation.id)
}

export async function getReservation(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const row = await reservationRepo.findReservationById(tenantId, id)
  if (!row) {
    throw new NotFoundError('Reservation not found')
  }
  return serializeReservation(row)
}

const STATUS_FLOW: Record<string, ReadonlyArray<string>> = {
  REQUESTED: ['CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['SEATED', 'CANCELLED', 'NO_SHOW'],
  SEATED: ['COMPLETED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
}

export interface ReservationTransitionInput {
  id: string
  toStatus: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED'
  reason?: string | null
}

export async function transitionReservation(
  context: CurrentUserContext,
  tenantId: string,
  input: ReservationTransitionInput,
) {
  const reservation = await reservationRepo.findReservationById(
    tenantId,
    input.id,
  )
  if (!reservation) {
    throw new NotFoundError('Reservation not found')
  }
  if (!STATUS_FLOW[reservation.status].includes(input.toStatus)) {
    throw new ValidationError(
      `Illegal transition ${reservation.status} -> ${input.toStatus}`,
    )
  }

  await prisma.$transaction(async (tx) => {
    await reservationRepo.setReservationStatus(
      tenantId,
      input.id,
      input.toStatus,
      {},
      tx,
    )

    if (input.toStatus === 'NO_SHOW') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'restaurant_reservation.no_show',
        aggregateType: 'restaurant_reservation',
        aggregateId: reservation.id,
        customerId: reservation.customerId,
        actorProfileId: context.profileId,
        payload: {
          reservationId: reservation.id,
          customerId: reservation.customerId,
        },
      })
    } else if (input.toStatus === 'CANCELLED') {
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'restaurant_reservation.cancelled',
        aggregateType: 'restaurant_reservation',
        aggregateId: reservation.id,
        customerId: reservation.customerId,
        actorProfileId: context.profileId,
        payload: {
          reservationId: reservation.id,
          customerId: reservation.customerId,
          reason: input.reason ?? null,
        },
      })
    }
  })

  return getReservation(context, tenantId, input.id)
}

export interface ReservationSeatInput {
  id: string
  tableIds: Array<string>
  openOrder?: boolean
}

// Seat the party: assign tables, stamp seatedAt, optionally open a linked
// dine-in order on the first table.
export async function seatReservation(
  context: CurrentUserContext,
  tenantId: string,
  input: ReservationSeatInput,
) {
  const reservation = await reservationRepo.findReservationById(
    tenantId,
    input.id,
  )
  if (!reservation) {
    throw new NotFoundError('Reservation not found')
  }
  if (!['REQUESTED', 'CONFIRMED'].includes(reservation.status)) {
    throw new ValidationError('Only open reservations can be seated')
  }
  if (input.tableIds.length === 0) {
    throw new ValidationError('Pick at least one table to seat the party')
  }

  let orderId: string | null = null
  if (input.openOrder ?? true) {
    const order = await orderService.createOrder(context, tenantId, {
      branchId: reservation.branchId,
      tableId: input.tableIds[0],
      customerId: reservation.customerId,
      guestCount: reservation.partySize,
      notes: reservation.notes,
    })
    orderId = order.id
  }

  await prisma.$transaction(async (tx) => {
    await reservationRepo.setReservationTables(
      tenantId,
      reservation.id,
      input.tableIds,
      tx,
    )
    await reservationRepo.setReservationStatus(
      tenantId,
      reservation.id,
      'SEATED',
      { seatedAt: new Date(), orderId },
      tx,
    )
    await appendDomainEvent(tx, {
      tenantId,
      eventType: 'restaurant_reservation.seated',
      aggregateType: 'restaurant_reservation',
      aggregateId: reservation.id,
      customerId: reservation.customerId,
      actorProfileId: context.profileId,
      payload: {
        reservationId: reservation.id,
        branchId: reservation.branchId,
        customerId: reservation.customerId,
        tableIds: input.tableIds,
        orderId,
      },
    })
  })

  return getReservation(context, tenantId, reservation.id)
}

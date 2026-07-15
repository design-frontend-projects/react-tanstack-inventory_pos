import { ValidationError } from '#/server/auth/errors'
import { InsufficientStockError } from '#/server/inventory/movement-engine'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  ReservationType,
  SourceDocType,
  StockReservation,
} from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as reservationRepo from '#/server/repos/stock-reservation-repo'
import {
  adjustReserved,
  ensureAndLockBalance,
} from '#/server/repos/stock-balance-repo'
import type { BalanceGrain } from '#/server/repos/stock-balance-repo'
import type { CurrentUserContext } from '#/types/auth'

// A reservation is a soft hold: it raises the `reserved` bucket (never `on_hand`)
// under the balance row lock, so `available = on_hand − reserved − allocated`
// drops without any ledger movement. Holds are created when a document commits to
// future issue (sales-order confirm) and released on fulfilment, cancel, or expiry.
// Every mutation of `reserved` happens here, always after `ensureAndLockBalance`.

const ZERO = new Prisma.Decimal(0)

export interface ReserveStockInput {
  reservationType: ReservationType
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  lotId?: string | null
  serialId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  sourceDocType?: SourceDocType | null
  sourceDocId?: string | null
  sourceDocLineId?: string | null
  sourceDocNumber?: string | null
  expiresAt?: Date | null
  reservedByProfileId?: string | null
  notes?: string | null
}

function grainOf(reservation: StockReservation): BalanceGrain {
  return {
    tenantId: reservation.tenantId,
    productId: reservation.productId,
    variantId: reservation.variantId,
    warehouseId: reservation.warehouseId,
    locationId: reservation.locationId,
    lotId: reservation.lotId,
    serialId: reservation.serialId,
  }
}

function remainingHold(reservation: StockReservation): Prisma.Decimal {
  return new Prisma.Decimal(reservation.quantity)
    .minus(reservation.fulfilledQty)
    .minus(reservation.releasedQty)
}

// Places a hold: locks the grain, checks available ≥ qty, raises `reserved`, and
// records the reservation. Runs inside the caller's transaction.
export async function reserveStock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: ReserveStockInput
): Promise<StockReservation> {
  const qty = new Prisma.Decimal(input.quantity)

  if (qty.lte(ZERO)) {
    throw new ValidationError('Reservation quantity must be a positive magnitude.')
  }

  const balance = await ensureAndLockBalance(tx, {
    tenantId,
    productId: input.productId,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    lotId: input.lotId,
    serialId: input.serialId,
  })

  const available = balance.onHand.minus(balance.reserved).minus(balance.allocated)

  if (qty.gt(available)) {
    throw new InsufficientStockError(
      `Cannot reserve ${qty.toString()}; only ${available.toString()} available.`
    )
  }

  await adjustReserved(tx, balance.id, qty)

  return reservationRepo.createReservation(tenantId, { ...input, quantity: qty }, tx)
}

// Converts a hold into an issue-in-progress: releases the entire remaining hold
// off `reserved` and marks the reservation FULFILLED. The caller then posts the
// SALE (OUT) — releasing first keeps the oversell guard from double-counting the
// same units as both reserved and on-hand.
export async function fulfillReservation(
  tx: Prisma.TransactionClient,
  reservation: StockReservation
): Promise<void> {
  const remaining = remainingHold(reservation)

  if (remaining.gt(ZERO)) {
    const balance = await ensureAndLockBalance(tx, grainOf(reservation))
    await adjustReserved(tx, balance.id, remaining.negated())
  }

  assertTransition('reservation', reservation.status.toLowerCase(), 'fulfilled')
  await reservationRepo.updateReservation(
    reservation.id,
    {
      fulfilledQty: new Prisma.Decimal(reservation.fulfilledQty).plus(remaining),
      status: 'FULFILLED',
    },
    tx
  )
}

// Frees an unfulfilled hold back to available (on cancel or expiry) without any
// stock movement. `terminal` distinguishes a deliberate release from an expiry.
export async function releaseReservation(
  tx: Prisma.TransactionClient,
  reservation: StockReservation,
  terminal: 'RELEASED' | 'EXPIRED' = 'RELEASED'
): Promise<void> {
  const remaining = remainingHold(reservation)

  if (remaining.gt(ZERO)) {
    const balance = await ensureAndLockBalance(tx, grainOf(reservation))
    await adjustReserved(tx, balance.id, remaining.negated())
  }

  const target = terminal === 'EXPIRED' ? 'expired' : 'released'
  assertTransition('reservation', reservation.status.toLowerCase(), target)
  await reservationRepo.updateReservation(
    reservation.id,
    {
      releasedQty: new Prisma.Decimal(reservation.releasedQty).plus(remaining),
      status: terminal,
    },
    tx
  )
}

// Releases every still-open hold tied to a source document (used when the source
// order is cancelled). Runs inside the caller's transaction.
export async function releaseReservationsForSource(
  tx: Prisma.TransactionClient,
  tenantId: string,
  sourceDocId: string
): Promise<number> {
  const open = await reservationRepo.findOpenReservationsForSource(tenantId, sourceDocId, tx)

  for (const reservation of open) {
    await releaseReservation(tx, reservation, 'RELEASED')
  }

  return open.length
}

// Batch sweep for stale holds: releases (as EXPIRED) any active reservation whose
// `expiresAt` has lapsed. Intended to be driven by a scheduled job.
export async function expireReservations(
  context: CurrentUserContext,
  tenantId: string,
  now: Date = new Date()
): Promise<{ expired: number }> {
  const expired = await prisma.$transaction(
    async (tx) => {
      const stale = await reservationRepo.findExpiredReservations(tenantId, now, 200, tx)

      for (const reservation of stale) {
        await releaseReservation(tx, reservation, 'EXPIRED')
      }

      if (stale.length > 0) {
        await createAuditLog(
          {
            tenantId,
            actorProfileId: context.profileId,
            actorEmail: context.email,
            actionKey: 'inventory.reservation_expire',
            entityType: 'stock_reservation',
            entityId: tenantId,
            newValues: { expired: stale.length },
          },
          tx
        )
      }

      return stale.length
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 }
  )

  return { expired }
}

function serializeReservation(reservation: StockReservation) {
  return {
    ...reservation,
    quantity: reservation.quantity.toString(),
    fulfilledQty: reservation.fulfilledQty.toString(),
    releasedQty: reservation.releasedQty.toString(),
  }
}

export async function listReservations(_context: CurrentUserContext, tenantId: string) {
  const reservations = await reservationRepo.listReservations(tenantId, {})

  return reservations.map(serializeReservation)
}

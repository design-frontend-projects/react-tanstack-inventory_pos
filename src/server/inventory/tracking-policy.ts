import { ValidationError } from '#/server/auth/errors'
import { Prisma } from '#/server/db/generated/prisma/client'
import type {
  MovementType,
  SerialStatus,
  TrackingPolicy,
} from '#/server/db/generated/prisma/client'

// Pure guard for a product's lot/serial tracking policy, enforced by the movement
// engine on every stock-changing line. Kept free of I/O so the rules are trivially
// unit-testable:
//   NONE       → no lot/serial required (any supplied are allowed but optional)
//   LOT        → a lotId is mandatory
//   SERIAL     → a serialId is mandatory and the movement quantity must be exactly 1
//   LOT_SERIAL → both a lotId and a serialId are mandatory, quantity exactly 1
// A serialized unit is atomic: one serial per movement, so serialized document
// lines are split into one qty-1 movement per serial by the calling service.

export interface TrackingContext {
  lotId?: string | null
  serialId?: string | null
  quantity: Prisma.Decimal | string | number
}

const ONE = new Prisma.Decimal(1)

export function requiresLot(policy: TrackingPolicy): boolean {
  return policy === 'LOT' || policy === 'LOT_SERIAL'
}

export function requiresSerial(policy: TrackingPolicy): boolean {
  return policy === 'SERIAL' || policy === 'LOT_SERIAL'
}

export function assertTrackingCompliance(
  policy: TrackingPolicy,
  context: TrackingContext
): void {
  if (requiresLot(policy) && !context.lotId) {
    throw new ValidationError('This product is lot-tracked; a lot is required for the movement.')
  }

  if (requiresSerial(policy)) {
    if (!context.serialId) {
      throw new ValidationError(
        'This product is serial-tracked; a serial number is required for the movement.'
      )
    }

    if (!new Prisma.Decimal(context.quantity).equals(ONE)) {
      throw new ValidationError(
        'A serial-tracked movement must be for exactly one unit (split lines per serial).'
      )
    }
  }
}

export interface SerialTransition {
  status: SerialStatus
  // When true the serial's current warehouse/location becomes the movement target;
  // otherwise it is cleared (the unit has left this location).
  toTarget: boolean
  sold: boolean
}

// Maps a movement to the serial's next lifecycle state and whereabouts. The
// movement is authoritative for a serialized unit — a SALE sells it, a
// TRANSFER_OUT puts it in transit, an IN receipt/return lands it at the target
// location. Pure, so it is unit-testable without a database.
export function serialTransition(
  movementType: MovementType,
  direction: 'IN' | 'OUT'
): SerialTransition {
  switch (movementType) {
    case 'SALE':
      return { status: 'SOLD', toTarget: false, sold: true }
    case 'TRANSFER_OUT':
      return { status: 'IN_TRANSIT', toTarget: false, sold: false }
    case 'TRANSFER_IN':
      return { status: 'IN_STOCK', toTarget: true, sold: false }
    case 'PURCHASE_RETURN':
      return { status: 'RETURNED', toTarget: false, sold: false }
    case 'SALES_RETURN':
      return { status: 'IN_STOCK', toTarget: true, sold: false }
    case 'DAMAGE':
    case 'LOST':
    case 'ADJUSTMENT_DEC':
    case 'CYCLE_COUNT_DEC':
    case 'PRODUCTION_CONSUMPTION':
      return { status: 'SCRAPPED', toTarget: false, sold: false }
    default:
      // Remaining IN movements (receipt, opening, adjustment_inc, count_inc,
      // production_output) land the serial in stock; any other OUT is treated as
      // a sale-like removal.
      return direction === 'IN'
        ? { status: 'IN_STOCK', toTarget: true, sold: false }
        : { status: 'SOLD', toTarget: false, sold: true }
  }
}

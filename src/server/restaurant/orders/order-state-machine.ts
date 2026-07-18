// Pure restaurant-order state machine. Encodes the legal transitions of the
// order lifecycle so the service can reject invalid moves. No DB access — trivial
// to unit-test exhaustively.

export type ResOrderStatusValue =
  | 'DRAFT'
  | 'OPEN'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'COOKING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'VOIDED'

// Forward operational flow plus the terminal exits reachable from each state.
const TRANSITIONS: Record<ResOrderStatusValue, ReadonlyArray<ResOrderStatusValue>> = {
  DRAFT: ['OPEN', 'CONFIRMED', 'CANCELLED', 'VOIDED'],
  OPEN: ['CONFIRMED', 'CANCELLED', 'VOIDED'],
  CONFIRMED: ['PREPARING', 'READY', 'CANCELLED', 'VOIDED'],
  PREPARING: ['COOKING', 'READY', 'CANCELLED', 'VOIDED'],
  COOKING: ['READY', 'CANCELLED', 'VOIDED'],
  READY: ['SERVED', 'COMPLETED', 'CANCELLED', 'VOIDED'],
  SERVED: ['COMPLETED', 'VOIDED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  VOIDED: [],
}

// Statuses at or beyond which inventory has been consumed (a movement posted).
const CONSUMED_STATUSES: ReadonlyArray<ResOrderStatusValue> = ['SERVED', 'COMPLETED', 'REFUNDED']

// Statuses that hold an active inventory reservation (confirmed but not yet consumed).
const RESERVED_STATUSES: ReadonlyArray<ResOrderStatusValue> = [
  'CONFIRMED',
  'PREPARING',
  'COOKING',
  'READY',
]

const TERMINAL_STATUSES: ReadonlyArray<ResOrderStatusValue> = [
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'VOIDED',
]

export function canTransition(from: ResOrderStatusValue, to: ResOrderStatusValue): boolean {
  return TRANSITIONS[from].includes(to)
}

export function allowedTransitions(
  from: ResOrderStatusValue
): ReadonlyArray<ResOrderStatusValue> {
  return TRANSITIONS[from]
}

export function isTerminal(status: ResOrderStatusValue): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function hasConsumedInventory(status: ResOrderStatusValue): boolean {
  return CONSUMED_STATUSES.includes(status)
}

export function hasActiveReservation(status: ResOrderStatusValue): boolean {
  return RESERVED_STATUSES.includes(status)
}

// --- Order-item status machine ----------------------------------------------
// Items advance forward-only through the kitchen flow; skipping ahead is legal
// (FIRED -> READY), moving backward is not. VOIDED is handled by the dedicated
// void-item flow, never by a plain status advance.

export type ResOrderItemStatusValue =
  | 'PENDING'
  | 'FIRED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'VOIDED'

export const ITEM_STATUS_FLOW: ReadonlyArray<ResOrderItemStatusValue> = [
  'PENDING',
  'FIRED',
  'PREPARING',
  'READY',
  'SERVED',
]

export function itemStatusRank(status: ResOrderItemStatusValue): number {
  return ITEM_STATUS_FLOW.indexOf(status)
}

export function canItemTransition(
  from: ResOrderItemStatusValue,
  to: ResOrderItemStatusValue
): boolean {
  const fromRank = itemStatusRank(from)
  const toRank = itemStatusRank(to)
  return fromRank >= 0 && toRank >= 0 && toRank > fromRank
}

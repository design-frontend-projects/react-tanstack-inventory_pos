import { ValidationError } from '#/server/auth/errors'

// Data-driven document lifecycle guard. Each document type declares the set of
// allowed target states for every source state. Services call
// `assertTransition(machine, from, to)` before persisting a status change so the
// lifecycle rules live in one place, decoupled from inventory posting. The state
// strings mirror the document status enums introduced in later phases; keeping
// them here as plain data lets the guard ship (and be tested) in Phase 0.

export type StateTransitionMap = Readonly<Record<string, ReadonlyArray<string>>>

export const DOCUMENT_STATE_MACHINES = {
  purchaseOrder: {
    draft: ['pending_approval', 'approved', 'cancelled'],
    pending_approval: ['approved', 'rejected', 'cancelled'],
    approved: ['confirmed', 'cancelled'],
    confirmed: ['partially_received', 'received', 'cancelled'],
    partially_received: ['partially_received', 'received', 'closed'],
    received: ['closed'],
    closed: [],
    cancelled: [],
    rejected: [],
  },
  purchaseRequisition: {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected'],
    approved: ['converted', 'closed'],
    converted: ['closed'],
    closed: [],
    rejected: [],
    cancelled: [],
  },
  goodsReceipt: {
    draft: ['received', 'completed', 'rejected'],
    received: ['quality_check', 'put_away', 'completed'],
    quality_check: ['put_away', 'rejected'],
    put_away: ['completed'],
    completed: [],
    rejected: [],
  },
  salesOrder: {
    draft: ['confirmed', 'cancelled'],
    confirmed: [
      'reserved',
      'partially_fulfilled',
      'fulfilled',
      'on_hold',
      'backordered',
      'cancelled',
    ],
    reserved: ['partially_fulfilled', 'fulfilled', 'cancelled'],
    partially_fulfilled: ['partially_fulfilled', 'fulfilled', 'cancelled'],
    fulfilled: ['invoiced', 'closed'],
    invoiced: ['closed'],
    on_hold: ['confirmed', 'cancelled'],
    backordered: ['confirmed', 'cancelled'],
    closed: [],
    cancelled: [],
  },
  salesInvoice: {
    draft: ['issued', 'cancelled'],
    issued: ['partially_paid', 'paid', 'overdue', 'cancelled'],
    partially_paid: ['partially_paid', 'paid', 'overdue'],
    overdue: ['partially_paid', 'paid'],
    paid: [],
    cancelled: [],
  },
  posSale: {
    open: ['parked', 'completed', 'voided'],
    parked: ['open', 'completed', 'voided'],
    completed: ['refunded', 'partially_refunded'],
    partially_refunded: ['refunded'],
    refunded: [],
    voided: [],
  },
  salesReturn: {
    draft: ['requested', 'cancelled'],
    requested: ['approved', 'rejected'],
    approved: ['in_transit', 'received'],
    in_transit: ['received'],
    received: ['credited', 'closed'],
    credited: ['closed'],
    closed: [],
    rejected: [],
    cancelled: [],
  },
  purchaseReturn: {
    draft: ['requested', 'shipped', 'cancelled'],
    requested: ['approved', 'rejected'],
    approved: ['shipped'],
    shipped: ['received'],
    received: ['refunded', 'closed'],
    refunded: ['closed'],
    closed: [],
    rejected: [],
    cancelled: [],
  },
  stockTransfer: {
    draft: ['confirmed', 'shipped', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['in_transit', 'partially_received', 'received'],
    in_transit: ['partially_received', 'received'],
    partially_received: ['partially_received', 'received', 'closed'],
    received: ['closed'],
    closed: [],
    cancelled: [],
  },
  stockAdjustment: {
    draft: ['pending_approval', 'approved', 'posted', 'cancelled'],
    pending_approval: ['approved', 'rejected'],
    approved: ['posted'],
    posted: [],
    rejected: [],
    cancelled: [],
  },
  stockCount: {
    draft: ['in_progress', 'cancelled'],
    in_progress: ['counted', 'cancelled'],
    counted: ['review'],
    review: ['reconciled', 'in_progress'],
    reconciled: ['closed'],
    closed: [],
    cancelled: [],
  },
  productionOrder: {
    draft: ['planned', 'cancelled'],
    planned: ['released', 'on_hold', 'cancelled'],
    released: ['in_progress', 'on_hold', 'cancelled'],
    in_progress: ['partially_completed', 'completed', 'on_hold'],
    partially_completed: ['partially_completed', 'completed'],
    completed: ['closed'],
    on_hold: ['released', 'in_progress', 'cancelled'],
    closed: [],
    cancelled: [],
  },
  note: {
    draft: ['issued', 'cancelled'],
    issued: ['applied', 'cancelled'],
    applied: ['closed'],
    closed: [],
    cancelled: [],
  },
  reservation: {
    active: ['partially_fulfilled', 'fulfilled', 'released', 'expired'],
    partially_fulfilled: ['partially_fulfilled', 'fulfilled', 'released', 'expired'],
    fulfilled: [],
    released: [],
    expired: [],
  },
  lot: {
    active: ['quarantine', 'expired', 'recalled', 'depleted'],
    quarantine: ['active', 'expired', 'recalled'],
    expired: ['depleted'],
    recalled: ['depleted'],
    depleted: [],
  },
  serial: {
    in_stock: ['reserved', 'sold', 'in_transit', 'returned', 'scrapped', 'in_repair'],
    reserved: ['in_stock', 'sold', 'in_transit'],
    in_transit: ['in_stock', 'returned'],
    sold: ['returned'],
    returned: ['in_stock', 'scrapped'],
    in_repair: ['in_stock', 'scrapped'],
    scrapped: [],
  },
} as const satisfies Record<string, StateTransitionMap>

export type DocumentMachineKey = keyof typeof DOCUMENT_STATE_MACHINES

export function canTransition(
  machine: DocumentMachineKey,
  from: string,
  to: string
): boolean {
  const transitions = DOCUMENT_STATE_MACHINES[machine] as StateTransitionMap
  const allowed = transitions[from]

  return Array.isArray(allowed) && allowed.includes(to)
}

export function assertTransition(
  machine: DocumentMachineKey,
  from: string,
  to: string
): void {
  const transitions = DOCUMENT_STATE_MACHINES[machine] as StateTransitionMap

  if (!(from in transitions)) {
    throw new ValidationError(
      `Unknown ${machine} status "${from}".`
    )
  }

  if (!canTransition(machine, from, to)) {
    throw new ValidationError(
      `Illegal ${machine} transition from "${from}" to "${to}".`
    )
  }
}

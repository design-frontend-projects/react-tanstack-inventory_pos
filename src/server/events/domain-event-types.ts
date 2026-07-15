// Typed catalog of every domain event the platform emits through the
// transactional outbox (`domain_events`). `eventType` is stored as a string in
// the DB so adding an event type never needs a migration — this file is the
// contract. Payloads are plain JSON: every money/quantity value MUST be
// serialized to a string by the emitter (Prisma Json cannot hold Decimal);
// consumers re-hydrate with `new Prisma.Decimal(...)`.

export interface DomainEventSaleLine {
  productId: string
  variantId?: string | null
  quantity: string
  unitPrice: string
  lineTotal: string
}

export interface PosSaleCompletedPayload {
  documentNumber: string
  warehouseId: string
  orderType: string
  currencyCode: string
  subtotal: string
  discountTotal: string
  taxTotal: string
  grandTotal: string
  amountPaid: string
  paymentMethods: Array<string>
  lines: Array<DomainEventSaleLine>
}

export interface DocumentNumberPayload {
  documentNumber: string
}

export interface PosSaleRefundedPayload {
  documentNumber: string
  amount: string
}

export interface SalesOrderPayload {
  documentNumber: string
  grandTotal: string
  lines: Array<DomainEventSaleLine>
}

export interface SalesInvoicePayload {
  documentNumber: string
  grandTotal: string
  amountPaid?: string
}

export interface SalesReturnCreditedPayload {
  documentNumber: string
  refundTotal: string
}

export interface FinancialNoteIssuedPayload {
  documentNumber: string
  noteType: string
  amount: string
}

export interface CustomerUpsertPayload {
  code: string
  name: string
  customerType: string
  email?: string | null
  phone?: string | null
}

export interface ConsentChangedPayload {
  channel: string
  purpose: string
  status: string
  source?: string | null
}

export interface LoyaltyMovementPayload {
  points: number
  balanceAfter: number
  refType?: string | null
  refId?: string | null
}

export interface SegmentMembershipPayload {
  segmentId: string
  segmentCode: string
}

// Maps every event type to its payload shape. Deferred contexts (dining,
// delivery, campaigns, tickets, feedback) reserve their event names in
// specs/003-crm/data-model.md Appendix A and are added here when implemented.
export interface DomainEventPayloadMap {
  'customer.created': CustomerUpsertPayload
  'customer.updated': CustomerUpsertPayload
  'pos_sale.completed': PosSaleCompletedPayload
  'pos_sale.voided': DocumentNumberPayload
  'pos_sale.refunded': PosSaleRefundedPayload
  'sales_order.confirmed': SalesOrderPayload
  'sales_order.fulfilled': SalesOrderPayload
  'sales_order.cancelled': DocumentNumberPayload
  'sales_invoice.issued': SalesInvoicePayload
  'sales_invoice.paid': SalesInvoicePayload
  'sales_return.credited': SalesReturnCreditedPayload
  'financial_note.issued': FinancialNoteIssuedPayload
  'crm.consent_changed': ConsentChangedPayload
  'crm.loyalty_earned': LoyaltyMovementPayload
  'crm.loyalty_redeemed': LoyaltyMovementPayload
  'crm.loyalty_adjusted': LoyaltyMovementPayload
  'crm.loyalty_expired': LoyaltyMovementPayload
  'crm.segment_entered': SegmentMembershipPayload
  'crm.segment_exited': SegmentMembershipPayload
}

export type DomainEventType = keyof DomainEventPayloadMap

export const DOMAIN_EVENT_TYPES = [
  'customer.created',
  'customer.updated',
  'pos_sale.completed',
  'pos_sale.voided',
  'pos_sale.refunded',
  'sales_order.confirmed',
  'sales_order.fulfilled',
  'sales_order.cancelled',
  'sales_invoice.issued',
  'sales_invoice.paid',
  'sales_return.credited',
  'financial_note.issued',
  'crm.consent_changed',
  'crm.loyalty_earned',
  'crm.loyalty_redeemed',
  'crm.loyalty_adjusted',
  'crm.loyalty_expired',
  'crm.segment_entered',
  'crm.segment_exited',
] as const satisfies ReadonlyArray<DomainEventType>

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as ReadonlyArray<string>).includes(value)
}

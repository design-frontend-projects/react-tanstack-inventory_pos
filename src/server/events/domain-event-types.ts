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

export interface RestaurantOrderLine {
  menuItemId: string
  productId?: string | null
  categoryId?: string | null
  quantity: string
  unitPrice: string
  lineTotal: string
}

export interface RestaurantOrderPromotion {
  promotionId: string
  code: string
  discount: string
}

export interface RestaurantOrderCompletedPayload {
  documentNumber: string
  branchId: string
  orderType: string
  serviceType: string
  channel: string
  currencyCode: string
  subtotal: string
  discountTotal: string
  taxTotal: string
  serviceChargeTotal: string
  deliveryFee: string
  tipTotal: string
  roundingTotal: string
  grandTotal: string
  amountPaid: string
  paymentMethods: Array<string>
  customerId?: string | null
  guestCount: number
  lines: Array<RestaurantOrderLine>
  promotions: Array<RestaurantOrderPromotion>
}

export interface RestaurantOrderRefundedPayload {
  documentNumber: string
  amount: string
  reason?: string | null
}

export interface RestaurantOrderVoidedPayload {
  documentNumber: string
  reason?: string | null
}

export interface RestaurantReservationCreatedPayload {
  reservationId: string
  branchId: string
  customerId?: string | null
  partySize: number
  scheduledAt: string
}

export interface RestaurantReservationNoShowPayload {
  reservationId: string
  customerId?: string | null
}

export interface RestaurantGiftCardIssuedPayload {
  cardId: string
  code: string
  initialBalance: string
  customerId?: string | null
}

export interface RestaurantGiftCardRedeemedPayload {
  cardId: string
  amount: string
  balanceAfter: string
}

export interface RestaurantPromotionAppliedPayload {
  promotionId: string
  code: string
  orderId: string
  discount: string
}

// --- Purchase Management (Spec 005) -----------------------------------------

export interface RfqPayload {
  documentNumber: string
  supplierCount: number
}

export interface RfqAwardedPayload {
  documentNumber: string
  awardedSupplierId: string
  awardedQuotationId?: string | null
}

export interface SupplierQuotationPayload {
  documentNumber: string
  supplierId: string
  grandTotal: string
}

export interface SupplierInvoicePayload {
  documentNumber: string
  supplierId: string
  grandTotal: string
  outstandingAmount?: string
}

export interface SupplierInvoiceMatchedPayload {
  documentNumber: string
  matchStatusCode: string
}

export interface SupplierPaymentPayload {
  documentNumber: string
  supplierId: string
  amount: string
  allocatedAmount?: string
}

export interface LandedCostPayload {
  documentNumber: string
  totalCharges: string
  allocationBasis: string
}

export interface ApprovalDecisionPayload {
  requestId: string
  entityType: string
  entityId: string
  statusCode: string
  actorProfileId?: string | null
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
  'restaurant_order.completed': RestaurantOrderCompletedPayload
  'restaurant_order.refunded': RestaurantOrderRefundedPayload
  'restaurant_order.voided': RestaurantOrderVoidedPayload
  'restaurant_reservation.created': RestaurantReservationCreatedPayload
  'restaurant_reservation.no_show': RestaurantReservationNoShowPayload
  'restaurant_gift_card.issued': RestaurantGiftCardIssuedPayload
  'restaurant_gift_card.redeemed': RestaurantGiftCardRedeemedPayload
  'restaurant_promotion.applied': RestaurantPromotionAppliedPayload
  'rfq.issued': RfqPayload
  'rfq.awarded': RfqAwardedPayload
  'supplier_quotation.submitted': SupplierQuotationPayload
  'supplier_quotation.approved': SupplierQuotationPayload
  'supplier_invoice.posted': SupplierInvoicePayload
  'supplier_invoice.matched': SupplierInvoiceMatchedPayload
  'supplier_payment.posted': SupplierPaymentPayload
  'landed_cost.posted': LandedCostPayload
  'purchase_approval.decided': ApprovalDecisionPayload
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
  'restaurant_order.completed',
  'restaurant_order.refunded',
  'restaurant_order.voided',
  'restaurant_reservation.created',
  'restaurant_reservation.no_show',
  'restaurant_gift_card.issued',
  'restaurant_gift_card.redeemed',
  'restaurant_promotion.applied',
  'rfq.issued',
  'rfq.awarded',
  'supplier_quotation.submitted',
  'supplier_quotation.approved',
  'supplier_invoice.posted',
  'supplier_invoice.matched',
  'supplier_payment.posted',
  'landed_cost.posted',
  'purchase_approval.decided',
] as const satisfies ReadonlyArray<DomainEventType>

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as ReadonlyArray<string>).includes(value)
}

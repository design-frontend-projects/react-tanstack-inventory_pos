// Pure mapping from a domain event to a timeline entry draft. Kept free of I/O
// so it is unit-testable. Returns null for events that do not belong on a
// customer timeline (no customer attached, or an internal event type).

export interface TimelineSourceEvent {
  eventId: string
  eventType: string
  aggregateType: string
  aggregateId: string
  customerId: string | null
  payloadJson: unknown
  occurredAt: Date
}

export interface TimelineEntryDraft {
  customerId: string
  entryType: string
  title: string
  summaryJson: Record<string, unknown> | null
  refType: string | null
  refId: string | null
  sourceEventId: string
  occurredAt: Date
}

function payloadField(payload: unknown, key: string): string | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const value = (payload as Record<string, unknown>)[key]

    return typeof value === 'string' ? value : null
  }

  return null
}

const EVENT_TITLES: Partial<Record<string, (documentNumber: string | null) => string>> = {
  'customer.created': () => 'Customer registered',
  'customer.updated': () => 'Customer details updated',
  'pos_sale.completed': (doc) => `POS sale ${doc ?? ''} completed`.trim(),
  'pos_sale.voided': (doc) => `POS sale ${doc ?? ''} voided`.trim(),
  'pos_sale.refunded': (doc) => `POS sale ${doc ?? ''} refunded`.trim(),
  'sales_order.confirmed': (doc) => `Sales order ${doc ?? ''} confirmed`.trim(),
  'sales_order.fulfilled': (doc) => `Sales order ${doc ?? ''} fulfilled`.trim(),
  'sales_order.cancelled': (doc) => `Sales order ${doc ?? ''} cancelled`.trim(),
  'sales_invoice.issued': (doc) => `Invoice ${doc ?? ''} issued`.trim(),
  'sales_invoice.paid': (doc) => `Invoice ${doc ?? ''} paid`.trim(),
  'sales_return.credited': (doc) => `Return ${doc ?? ''} credited`.trim(),
  'financial_note.issued': (doc) => `Note ${doc ?? ''} issued`.trim(),
  'crm.consent_changed': () => 'Communication consent changed',
  'crm.loyalty_earned': () => 'Loyalty points earned',
  'crm.loyalty_redeemed': () => 'Loyalty points redeemed',
  'crm.loyalty_adjusted': () => 'Loyalty points adjusted',
  'crm.loyalty_expired': () => 'Loyalty points expired',
  'crm.segment_entered': () => 'Entered segment',
  'crm.segment_exited': () => 'Exited segment',
}

const ENTRY_TYPE_BY_PREFIX: Array<[string, string]> = [
  ['pos_sale.', 'sale'],
  ['sales_order.', 'order'],
  ['sales_invoice.', 'invoice'],
  ['sales_return.', 'return'],
  ['financial_note.', 'note_doc'],
  ['customer.', 'customer'],
  ['crm.consent', 'consent'],
  ['crm.loyalty', 'loyalty'],
  ['crm.segment', 'segment'],
]

export function mapEventToTimelineEntry(
  event: TimelineSourceEvent
): TimelineEntryDraft | null {
  if (!event.customerId) {
    return null
  }

  const titleFactory = EVENT_TITLES[event.eventType]

  if (!titleFactory) {
    return null
  }

  const entryType =
    ENTRY_TYPE_BY_PREFIX.find(([prefix]) => event.eventType.startsWith(prefix))?.[1] ??
    'activity'
  const documentNumber = payloadField(event.payloadJson, 'documentNumber')

  const summary =
    event.payloadJson && typeof event.payloadJson === 'object'
      ? (event.payloadJson as Record<string, unknown>)
      : null

  // Keep the summary small: drop line-level detail, keep header facts.
  const summaryJson = summary
    ? Object.fromEntries(
        Object.entries(summary).filter(([key]) => key !== 'lines')
      )
    : null

  return {
    customerId: event.customerId,
    entryType,
    title: titleFactory(documentNumber),
    summaryJson,
    refType: event.aggregateType,
    refId: event.aggregateId,
    sourceEventId: event.eventId,
    occurredAt: event.occurredAt,
  }
}

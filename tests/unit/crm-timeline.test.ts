import { describe, expect, it } from 'vitest'
import { mapEventToTimelineEntry } from '#/server/crm/timeline-mapper'
import type { TimelineSourceEvent } from '#/server/crm/timeline-mapper'
import { DOMAIN_EVENT_TYPES } from '#/server/events/domain-event-types'

const BASE_EVENT: TimelineSourceEvent = {
  eventId: '00000000-0000-0000-0000-00000000e001',
  eventType: 'pos_sale.completed',
  aggregateType: 'pos_sale',
  aggregateId: '00000000-0000-0000-0000-00000000a001',
  customerId: '00000000-0000-0000-0000-00000000c001',
  payloadJson: {
    documentNumber: 'POS-000042',
    grandTotal: '150.0000',
    lines: [{ productId: 'p1', quantity: '1', unitPrice: '150', lineTotal: '150' }],
  },
  occurredAt: new Date('2026-07-15T12:00:00Z'),
}

describe('timeline mapper', () => {
  it('maps a POS sale completion to a sale entry', () => {
    const draft = mapEventToTimelineEntry(BASE_EVENT)

    expect(draft).not.toBeNull()
    expect(draft?.entryType).toBe('sale')
    expect(draft?.title).toBe('POS sale POS-000042 completed')
    expect(draft?.refType).toBe('pos_sale')
    expect(draft?.refId).toBe(BASE_EVENT.aggregateId)
    expect(draft?.sourceEventId).toBe(BASE_EVENT.eventId)
  })

  it('strips line-level detail from the summary', () => {
    const draft = mapEventToTimelineEntry(BASE_EVENT)

    expect(draft?.summaryJson).toEqual({
      documentNumber: 'POS-000042',
      grandTotal: '150.0000',
    })
  })

  it('skips events without a customer', () => {
    expect(mapEventToTimelineEntry({ ...BASE_EVENT, customerId: null })).toBeNull()
  })

  it('skips unknown event types', () => {
    expect(
      mapEventToTimelineEntry({ ...BASE_EVENT, eventType: 'warehouse.rebalanced' })
    ).toBeNull()
  })

  it('maps every catalog event type when a customer is attached', () => {
    for (const eventType of DOMAIN_EVENT_TYPES) {
      const draft = mapEventToTimelineEntry({ ...BASE_EVENT, eventType })

      expect(draft, eventType).not.toBeNull()
      expect(draft?.entryType, eventType).not.toBe('activity')
    }
  })

  it('classifies loyalty, consent, and segment events', () => {
    expect(
      mapEventToTimelineEntry({ ...BASE_EVENT, eventType: 'crm.loyalty_earned' })?.entryType
    ).toBe('loyalty')
    expect(
      mapEventToTimelineEntry({ ...BASE_EVENT, eventType: 'crm.consent_changed' })?.entryType
    ).toBe('consent')
    expect(
      mapEventToTimelineEntry({ ...BASE_EVENT, eventType: 'crm.segment_entered' })?.entryType
    ).toBe('segment')
  })
})

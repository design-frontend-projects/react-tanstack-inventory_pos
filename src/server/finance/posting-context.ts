// Adapter contract for the async posting pipeline (Phase 2+). Per-module
// adapters translate a domain event payload into a normalized PostingContext;
// the engine resolves the posting rule, accounts, and amounts from it without
// knowing anything module-specific.

import type { MappingCandidate } from '#/server/finance/account-resolution'

export interface PostingContext {
  tenantId: string
  eventType: string
  sourceDocType: string
  sourceDocId: string
  sourceDocNumber?: string | null
  documentDate: Date
  currencyCode: string
  exchangeRate?: string | number
  // Amount pool keyed by amountSelector codes used in fin_posting_rule_lines
  // ('net_total', 'tax_total', 'gross_total', 'paid_total', 'discount_total',
  // 'cost_total', 'service_charge_total', 'tip_total', ...). Values are
  // Decimal-safe strings.
  amounts: Record<string, string>
  // Mapping-lookup candidates, most specific first (e.g. product, its
  // category chain, warehouse, branch, payment method code).
  mappingCandidates: Array<MappingCandidate>
  // Subledger party, when the event affects AR/AP.
  partyType?: 'customer' | 'supplier' | null
  partyId?: string | null
  dueDate?: Date | null
  // Dimension defaults applied to every generated line.
  costCenterId?: string | null
  projectId?: string | null
  branchId?: string | null
  warehouseId?: string | null
  correlationId?: string | null
}

export interface PostingAdapter {
  // Domain event types this adapter can translate.
  eventTypes: ReadonlyArray<string>
  buildContext: (input: {
    tenantId: string
    eventType: string
    aggregateId: string
    payload: unknown
  }) => Promise<PostingContext | null>
}

# Data Model — Enterprise CRM (Feature 003)

The authoritative schema is `prisma/schema.prisma`; this document tracks the CRM domain model
and its build status.

## Conventions

Inherits every feature 001/002 convention: `String @id @default(uuid()) @db.Uuid`; camelCase
fields with explicit snake_case `@map`/`@@map`; every tenant-owned model carries `tenantId` +
`tenant TenantAccount @relation(onDelete: Cascade)` and a back-relation array on
`TenantAccount`; enums `UPPER @map("lower")` + `@@map("PascalCase")`; `createdAt` always,
`updatedAt @updatedAt` on mutable rows only, `deletedAt?` on masters only; actor columns are
bare `*ProfileId String? @db.Uuid` scalars; cross-aggregate references (customerId, productId,
refId) are bare scalar UUIDs with app-enforced integrity; money `Decimal(19,4)`, quantities
`Decimal(18,4)`, rates/multipliers `Decimal(9,6)`; tenant-leading named indexes.

**CRM-specific additions:**

- All CRM tables use the **`crm_` prefix** (explicit product requirement; a deliberate,
  documented divergence from the unprefixed 001/002 tables). The outbox is module-neutral
  **`domain_events`** because every module writes it.
- **Event payloads** (`domain_events.payloadJson`) carry all Decimal values as **strings**
  (Prisma `Json` cannot hold `Decimal`); consumers re-hydrate with `new Prisma.Decimal(...)`.
- `eventType` is a **string**, not a DB enum — the catalog is typed in
  `src/server/events/domain-event-types.ts` so new events don't need migrations.
- Append-only tables (`domain_events`, `crm_loyalty_ledger`, `crm_timeline_entries`) have no
  update/soft-delete paths in their repos and omit `updatedAt`.
- RLS-ready: every table here has `tenant_id NOT NULL` except `crm_projection_cursors`
  (global consumer state — documented exemption). See Appendix B.

---

## Implemented — Phase 0 (event infrastructure)

**DomainEvent** (`domain_events`) — the transactional outbox and the platform's integration
ledger. `id BigInt @id @default(autoincrement())` (bigserial — the global, gap-tolerant cursor
axis), `eventId @unique @default(uuid())` (idempotency key carried into projections),
`tenantId`, `eventType` (string, e.g. `pos_sale.completed`), `aggregateType`/`aggregateId`
(source document), `customerId?` (denormalized for fast CRM filtering; nullable — walk-in sales
still emit), `payloadJson` (Decimal-as-string snapshot of what consumers need: totals, lines
with productId/categoryId, payment methods, channel), `correlationId?`, `actorProfileId?`,
`occurredAt` (business time), `createdAt`. Indexes: `[tenantId, customerId]`, `[eventType]`.
Appended only via `appendDomainEvent(tx, …)` inside the source service's transaction.

**CrmProjectionCursor** (`crm_projection_cursors`) — one row per consumer
(`consumerName @unique`, currently only `'crm'`), `lastSequence BigInt`, `updatedAt`. Global
infrastructure (no tenantId): the cursor advances over the cross-tenant bigserial. RLS
exemption documented in Appendix B.

## Implemented — Phase 1 (customer management satellites)

All keyed by `customerId` (bare scalar UUID → `customers.id`). The existing `Customer` model
remains the master; `Customer.loyaltyPoints` is deprecated to a projector-maintained read cache.

**CrmCustomerProfile** (`crm_customer_profiles`) — 1:1 extension of the master
(`@@unique([tenantId, customerId])`): `dateOfBirth?`, `anniversaryDate?`, `gender?`,
`languageCode?`, `currencyCode?`, `timezone?`, `lifecycleStatus` enum `CrmLifecycleStatus`
(`prospect/active/at_risk/inactive/blocked`), `vipLevel Int @default(0)`, `classification?`,
`isCorporate Boolean`, `companyName?`, `acquisitionChannel?`, `notes?`. Mutable master → has
`updatedAt`; no `deletedAt` (lifecycle of the satellite follows the master row).

**CrmCustomerContact** (`crm_customer_contacts`) — multi-valued contact points:
`contactType` enum `CrmContactType` (`phone/email/social/other`), `label?`, `value`,
`isPrimary`, `isVerified`, `metaJson?` (e.g. `{ network: 'instagram' }`). Index
`[tenantId, customerId]`.

**CrmCustomerAddress** (`crm_customer_addresses`) — `addressType` enum `CrmAddressType`
(`billing/shipping/delivery/other`), `label?`, `addressJson`, `deliveryInstructions?`,
`latitude/longitude Decimal(9,6)?`, `isDefault`. Also the delivery-context contract (preferred
address, GPS).

**CrmCustomerRelationship** (`crm_customer_relationships`) — family/emergency/corporate links:
`relatedCustomerId?` (when the relative is also a customer) or free-form `relatedName?`,
`relationType` enum `CrmRelationType` (`family/emergency/company_contact/referrer/other`),
`phone?`, `note?`.

**CrmCommunicationConsent** (`crm_communication_consents`) — current-state consent per
channel×purpose: `channel` enum `ConsentChannel` (`email/sms/push/whatsapp/phone`), `purpose`
enum `ConsentPurpose` (`marketing/transactional/survey`), `status` enum `ConsentStatus`
(`granted/denied/withdrawn`), `source?`, `grantedAt?/withdrawnAt?`, `evidenceJson?`.
`@@unique([tenantId, customerId, channel, purpose])`. Every change emits
`crm.consent_changed` → timeline is the consent history.

**CrmCustomerPreference** (`crm_customer_preferences`) — namespaced key-value:
`prefKey String`, `valueJson Json`; `@@unique([tenantId, customerId, prefKey])`. Reserved
namespaces double as module contracts: `dining.*` (allergies, diet, favorite table/waiter,
occasions), `delivery.*` (preferred time/driver), `shopping.*`.

**CrmTag** (`crm_tags`, master: `name`, `color?`, `@@unique([tenantId, name])`, soft delete) +
**CrmCustomerTag** (`crm_customer_tags`, `@@unique([tenantId, customerId, tagId])`).

**CrmCustomerGroup** (`crm_customer_groups`, master: `code`, `name`, `description?`,
`@@unique([tenantId, code])`, soft delete) + **CrmCustomerGroupMember**
(`crm_customer_group_members`, `@@unique([tenantId, groupId, customerId])`).

**CrmCustomFieldDefinition** (`crm_custom_field_definitions`) — tenant-defined fields:
`entityType @default("customer")`, `fieldKey`, `label`, `fieldType` enum `CrmFieldType`
(`text/number/date/boolean/select/multi_select`), `optionsJson?`, `isRequired`,
`displayOrder`; `@@unique([tenantId, entityType, fieldKey])`; soft delete. +
**CrmCustomFieldValue** (`crm_custom_field_values`) — `definitionId` (real FK, cascade),
`customerId`, `valueJson`; `@@unique([tenantId, definitionId, customerId])`.

## Implemented — Phase 2 (timeline)

**CrmTimelineEntry** (`crm_timeline_entries`) — append-only chronological feed:
`customerId`, `entryType String` (`sale/order/invoice/return/note_doc/loyalty/consent/segment/
customer/note`), `title`, `summaryJson?` (small display payload — never the full document),
`refType?/refId?` (deep link to the source aggregate), `sourceEventId? @unique` (projector
idempotency; null for manual notes), `occurredAt`, `createdByProfileId?` (manual notes),
`createdAt`. Index `[tenantId, customerId, occurredAt(sort: Desc)]`.

## Implemented — Phase 3 (loyalty)

**CrmLoyaltySettings** (`crm_loyalty_settings`) — per-tenant singleton
(`@@unique([tenantId])`): `pointsPerCurrencyUnit Decimal(9,6)`,
`redemptionValuePerPoint Decimal(9,6)`, `minRedeemPoints Int`, `expiryMonths Int?`,
`birthdayBonusPoints Int`, `anniversaryBonusPoints Int`, `isActive`.

**CrmLoyaltyTier** (`crm_loyalty_tiers`) — Bronze→VIP ladder: `code`, `name`, `rank Int`,
`minLifetimePoints Int`, `minAnnualSpend Decimal(19,4)?`, `earnMultiplier Decimal(9,6)`,
`benefitsJson?`; `@@unique([tenantId, code])`; soft delete.

**CrmLoyaltyAccount** (`crm_loyalty_accounts`) — one per customer
(`@@unique([tenantId, customerId])`): `tierId?`, `pointsBalance Int`, `lifetimePoints Int`,
`walletBalance Decimal(19,4)`, `tierAchievedAt?`. Balance is only ever changed in the same
transaction as a ledger append, under `SELECT … FOR UPDATE`.

**CrmLoyaltyLedgerEntry** (`crm_loyalty_ledger`) — append-only, the loyalty source of truth:
`accountId` (FK cascade), `customerId`, `entryType` enum `LoyaltyEntryType`
(`earn/redeem/adjust/expire/bonus/reversal`), `points Int` (signed),
`walletAmount Decimal(19,4)?`, `sourceEventId? @unique` (idempotent auto-earn),
`refType?/refId?`, `expiresAt?` + `remainingPoints Int?` (EARN rows are FIFO expiry lots;
redemption and expiry consume `remainingPoints` oldest-first), `note?`,
`createdByProfileId?`. Indexes `[tenantId, customerId, createdAt]`, `[tenantId, expiresAt]`.
Invariant (tested): `sum(ledger.points) == account.pointsBalance`.

**CrmLoyaltyEarnRule** (`crm_loyalty_earn_rules`) — configurable earning:
`ruleType` enum `LoyaltyRuleType` (`base/category_bonus/product_bonus/birthday/anniversary/
channel`), `conditionsJson` (e.g. `{ categoryIds: [...] }`), `multiplier Decimal(9,6)?`,
`fixedPoints Int?`, `validFrom?/validTo?`, `priority Int`, `isActive`; soft delete.

## Implemented — Phase 4 (customer intelligence)

**CrmCustomerMetrics** (`crm_customer_metrics`) — per-customer materialized projection (the
`StockBalance` of CRM; `@@unique([tenantId, customerId])`): `firstPurchaseAt?`,
`lastPurchaseAt?`, `ordersCount Int`, `totalSpend Decimal(19,4)`,
`avgOrderValue Decimal(19,4)`, `returnsCount Int`, `returnsValue Decimal(19,4)`,
`visitCount Int`, `favoriteProductId?`, `favoriteCategoryId?`, `favoriteWarehouseId?`,
`favoritePaymentMethod?`, `favoritesJson?` (top-N counters the favorites are derived from),
`rfmRecency/rfmFrequency/rfmMonetary Int?`, `rfmSegment String?`,
`churnScore Decimal(9,6)?`, `clvEstimate Decimal(19,4)?`, `lastEventSequence BigInt`
(monotonic idempotency guard — an event with `id <= lastEventSequence` is skipped),
`updatedAt`. Written only by the metrics projection.

**CrmCustomerMetricsMonthly** (`crm_customer_metrics_monthly`) — trend series:
`periodKey String` (`YYYY-MM`), `ordersCount`, `spend Decimal(19,4)`, `pointsEarned Int`;
`@@unique([tenantId, customerId, periodKey])`.

## Implemented — Phase 5 (segmentation)

**CrmSegment** (`crm_segments`) — `code`, `name`, `description?`, `ruleJson` (declarative tree:
`{ op: 'and'|'or', conditions: [{ field, cmp, value }] }` over the flat `CustomerFacts`
projection — see `segment-evaluator.ts`), `isSystem`, `isActive`, `memberCount Int` (cache),
`lastRebuiltAt?`; `@@unique([tenantId, code])`; soft delete.

**CrmSegmentMember** (`crm_segment_members`) — `segmentId` (FK cascade), `customerId`,
`addedAt`; `@@unique([tenantId, segmentId, customerId])`, index `[tenantId, customerId]`.
Membership changes emit `crm.segment_entered/.exited` events (→ timeline, future campaign
triggers).

## Implemented — Phase 6 (AI-ready scores)

**CrmCustomerScore** (`crm_customer_scores`) — model-agnostic prediction store:
`scoreType String` (`churn/next_best_offer/clv_prediction/recommendation/…`),
`score Decimal(9,6)?`, `payloadJson?` (ranked offers/products), `modelName`, `modelVersion`,
`featuresJson?` (input snapshot for auditability), `computedAt`;
`@@unique([tenantId, customerId, scoreType])`. First producer: `churn-heuristics.ts`
(`modelName='heuristic-v1'`). Future ML pipelines upsert the same shape.

---

## Planned — deferred contexts (Phase 7, schema designed, no migration yet)

**Marketing.** `crm_campaigns` (`code`, `name`, `campaignType`
(`promo/birthday/winback/seasonal/referral`), `status` via `crm-state-machines.ts`
campaign machine (`draft→scheduled→running→paused→completed→archived`), `segmentId?`,
`channel`, `scheduledAt?/startedAt?/endedAt?`, `budget Decimal(19,4)?`, `contentJson?`);
`crm_campaign_recipients` (`campaignId`, `customerId`, `status`
(`queued/sent/delivered/opened/clicked/converted/bounced/unsubscribed`) + per-status
timestamps, `revenueAttributed Decimal(19,4)?` — delivered/open/click/ROI metrics are
aggregations over this table); `crm_coupons` (`code @@unique([tenantId, code])`,
`discountType` (`percent/fixed/points`), `value`, `maxUses`, `perCustomerLimit`,
`validFrom/validTo`, `campaignId?`); `crm_coupon_redemptions` (`couponId`, `customerId`,
`refType/refId` → pos_sale, `amount Decimal(19,4)`). Events: `campaign.sent`,
`coupon.redeemed`, `promotion.applied`.

**Customer service.** `crm_tickets` (`ticketNumber` via `document-number-service`
(`DocumentType` addition `CRM_TICKET`, prefix `TKT`), `channel`
(`phone/whatsapp/email/web/app/pos/facebook/instagram/chat`), `category?`, `priority`
(`low/normal/high/urgent`), `status` via ticket machine
(`open→in_progress→waiting_customer→resolved→closed`, reopen allowed), `assignedToProfileId?`,
`slaDueAt?`, `resolvedAt?`); `crm_ticket_messages` (`ticketId`, `direction`
(`inbound/outbound/internal_note`), `body`, `attachmentsJson?`, `authorProfileId?`). Events:
`ticket.opened/.resolved`.

**Feedback.** `crm_feedback` (`feedbackType` (`nps/csat/review/complaint/suggestion`),
`rating Int?`, `npsScore Int?`, `comment?`, `mediaJson?`, `refType?/refId?` (product, sale,
delivery, dining visit, branch, employee), `status` (`new/reviewed/actioned/dismissed`)).
Event: `feedback.submitted`. Satisfaction-over-time = aggregation by period over this table.

**Restaurant guest management.** `crm_dining_reservations` (named to avoid the stock
"reservation" collision): `reservationNumber`, `branchId?`, `tableRef?`, `partySize`,
`reservedFor DateTime`, `status` (`requested/confirmed/seated/completed/cancelled/no_show`),
`occasion?`, `specialRequests?`. Dining preferences/allergies via `crm_customer_preferences`
`dining.*` keys. Events: `dining_reservation.*`, `dining_visit.completed` (drives favorite
items/tables, visit frequency, average duration in metrics).

**Delivery intelligence.** No new tables — `crm_customer_addresses` (type `delivery`, GPS,
instructions) + `delivery.completed/.failed` events folding delivery success rate, average
delivery time, preferred driver/time into `crm_customer_metrics.favoritesJson` and
preferences.

---

## Appendix A — Domain event catalog (implemented types)

| eventType | Emitted by | Payload (all Decimals as strings) |
|---|---|---|
| `customer.created` / `customer.updated` | catalog-service | `{ code, name, customerType, email?, phone? }` |
| `pos_sale.completed` | pos-sale-service | `{ documentNumber, warehouseId, orderType, currencyCode, subtotal, discountTotal, taxTotal, grandTotal, amountPaid, paymentMethods: string[], lines: [{ productId, variantId?, quantity, unitPrice, lineTotal }] }` |
| `pos_sale.voided` | pos-sale-service | `{ documentNumber }` |
| `pos_sale.refunded` | sales-return-service (POS refund path) | `{ documentNumber, amount }` |
| `sales_order.confirmed/.fulfilled/.cancelled` | sales-order-service | `{ documentNumber, grandTotal, lines: [...] }` |
| `sales_invoice.issued/.paid` | sales-invoice-service | `{ documentNumber, grandTotal, amountPaid? }` |
| `sales_return.credited` | sales-return-service | `{ documentNumber, refundTotal }` |
| `financial_note.issued` | financial-note-service | `{ documentNumber, noteType, amount }` |
| `crm.consent_changed` | customer-profile-service | `{ channel, purpose, status, source? }` |
| `crm.loyalty_earned/.redeemed/.adjusted/.expired` | loyalty-service | `{ points, balanceAfter, refType?, refId? }` |
| `crm.segment_entered/.exited` | segment-service | `{ segmentId, segmentCode }` |

Reserved (deferred): `dining_reservation.created/.honored/.no_show`, `dining_visit.completed`,
`delivery.completed/.failed`, `coupon.redeemed`, `promotion.applied`, `campaign.sent`,
`ticket.opened/.resolved`, `feedback.submitted`, `payment.failed`.

## Appendix B — RLS enablement templates (NOT applied)

Isolation is app-enforced today. When defense-in-depth is wanted, per table:

```sql
ALTER TABLE crm_customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON crm_customer_profiles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Runbook: (1) add a Prisma client extension that runs
`SET LOCAL app.tenant_id = '<tenant>'` at the start of every `$transaction`; (2) apply the
template to every `crm_` table and `domain_events`; (3) leave `crm_projection_cursors`
exempt (global consumer state; the projector runs as a system actor) — or move to
per-tenant cursors first. The stub `auth.uid()` function from feature 001 remains unused by
CRM.

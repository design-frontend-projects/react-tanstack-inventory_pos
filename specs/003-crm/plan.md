# Implementation Plan — Enterprise CRM (Feature 003)

## Bounded contexts (DDD)

| Context | Responsibility | Owns |
|---|---|---|
| Customer Management | master data satellites: profile, contacts, addresses, relationships, consents, preferences, tags, groups, custom fields | `crm_customer_*`, `crm_tags`, `crm_customer_groups`, `crm_custom_field_*` |
| Timeline | chronological event feed per customer + manual notes | `crm_timeline_entries` |
| Loyalty | points ledger, accounts, tiers, earn rules, settings, expiry | `crm_loyalty_*` |
| Customer Intelligence | incrementally folded behavioral metrics + monthly trends | `crm_customer_metrics`, `crm_customer_metrics_monthly` |
| Segmentation | declarative rules + materialized membership | `crm_segments`, `crm_segment_members` |
| AI Insights | model-agnostic prediction/score storage | `crm_customer_scores` |
| Marketing *(designed)* | campaigns, recipients, coupons, redemptions | `crm_campaigns`, `crm_campaign_recipients`, `crm_coupons`, `crm_coupon_redemptions` |
| Customer Service *(designed)* | tickets, messages, SLA | `crm_tickets`, `crm_ticket_messages` |
| Feedback *(designed)* | reviews, NPS/CSAT, complaints | `crm_feedback` |
| Event infrastructure | module-neutral outbox + consumer cursors | `domain_events`, `crm_projection_cursors` |

Source modules keep their aggregates; CRM references them via bare scalar UUIDs
(`customerId`, `refType`/`refId`) per the app-enforced-integrity convention.

## Layering (reuses feature 001/002 patterns)

- `prisma/schema.prisma` — new banner section per context; conventions per `data-model.md`.
- `src/server/events/` **(new)** — `domain-event-types.ts` (typed event catalog),
  `event-outbox.ts` (`appendDomainEvent(tx, …)` emitter).
- `src/server/repos/` — one repo per aggregate, standalone functions
  `(tenantId, input, client: PrismaClientLike = prisma)`, tenant-scoped `updateMany`.
- `src/server/crm/` **(new)** — pure logic (`loyalty-rules.ts`, `segment-evaluator.ts`,
  `rfm-scoring.ts`, `churn-heuristics.ts`, `timeline-mapper.ts`, `crm-state-machines.ts`),
  orchestration services (`customer-profile-service.ts`, `loyalty-service.ts`,
  `timeline-service.ts`, `segment-service.ts`, `metrics-service.ts`), the projector
  (`projector.ts` + `projections/*`), and `crm-dto.ts` serializers.
- `src/features/crm/` **(new)** — `validation.ts` (Zod) + `server-functions.ts`
  (`createServerFn` handlers, guard chain `requireAuth → requireTenantAccess →
  requirePermission`).
- RBAC — `module-catalog.ts` + `rbac-catalog.ts` + `prisma/seed.ts` + `app-nav.ts` mirror.

## Event-driven architecture (transactional outbox)

**Write path.** Any service whose outcome CRM must observe calls
`appendDomainEvent(tx, { tenantId, eventType, aggregateType, aggregateId, customerId?,
payload, correlationId?, actorProfileId?, occurredAt? })` inside its existing
`prisma.$transaction`. The event commits atomically with the business write; a rollback rolls
both back. `payload` is JSON with **all Decimals serialized to strings** by the emitter.

Emitting call sites (initial):

| Service | Transitions → events |
|---|---|
| `documents/pos-sale-service.ts` | complete → `pos_sale.completed`; void → `pos_sale.voided` |
| `documents/sales-order-service.ts` | confirm/fulfill/cancel → `sales_order.confirmed/.fulfilled/.cancelled` |
| `documents/sales-invoice-service.ts` | issue/payment → `sales_invoice.issued/.paid` |
| `documents/sales-return-service.ts` | credit → `sales_return.credited` |
| `documents/financial-note-service.ts` | issue → `financial_note.issued` |
| `catalog-service.ts` (customer CRUD) | create/update → `customer.created/.updated` |
| CRM's own services | `crm.loyalty_earned/.redeemed/.adjusted/.expired`, `crm.consent_changed`, `crm.segment_entered/.exited` |

Events without a `customerId` (walk-in sales) are still appended — metrics about anonymous
traffic remain possible later — but CRM projections skip them.

**Read path (projector).** `runCrmProjector` (in `src/server/crm/projector.ts`):

1. Opens a `$transaction` (RepeatableRead, 30s) and takes
   `pg_advisory_xact_lock` on a constant key — two overlapping scheduler ticks cannot
   double-process.
2. Reads the `'crm'` cursor from `crm_projection_cursors`, fetches
   `domain_events` with `id > cursor ORDER BY id LIMIT batchSize`.
3. Dispatches each event to the projection handlers in order: timeline → metrics → loyalty
   auto-earn → segment re-evaluation → legacy `Customer.loyaltyPoints` cache sync.
4. Advances the cursor in the same transaction. Repeats up to `maxBatches`.

Delivery semantics: **at-least-once**, in-order (single cursor over a bigserial), idempotent
handlers (unique `sourceEventId` on timeline/ledger rows; `lastEventSequence` monotonic guard on
metrics; upsert/delete semantics for segments). One consumer name (`'crm'`) for now;
per-projection cursors are the documented scale path.

**Trigger.** `runCrmProjectorServerFn` — scheduler-driven exactly like
`expireReservationsServerFn` (external cron / pg_cron / uptime pinger). Optional near-real-time:
source features may fire-and-forget invoke the projector after commit; correctness never
depends on it.

**Retention.** `domain_events` is pruned by a scheduled job: delete rows with
`id < min(all cursors)` **and** `occurredAt < now() - 90 days`. Timeline/ledger rows are the
durable per-customer copies. (Designed; wired in a later ops phase.)

## Integration architecture (per module)

- **POS / Sales / Returns / Finance notes** — implemented now via the events above. Metrics
  fold spend, counts, favorites, payment-method preference (from `pos_payments` snapshot in the
  event payload), channel (`orderType`).
- **Inventory** — product/category favorites derive from sale-line payload snapshots
  (productId/categoryId per line); no direct inventory coupling.
- **Restaurant** *(contract)* — future events `dining_reservation.created/.honored/.no_show`,
  `dining_visit.completed` (party size, table, duration, items). Guest preferences (allergies,
  diet, favorite table) live in `crm_customer_preferences` under reserved `dining.*` keys —
  the restaurant module reads/writes them through CRM's preference API.
- **Delivery** *(contract)* — future events `delivery.completed/.failed` (address, driver,
  duration, rating). Delivery addresses/GPS live in `crm_customer_addresses`
  (`addressType=DELIVERY`, lat/lng, instructions).
- **Promotions** *(contract)* — `coupon.redeemed`, `promotion.applied` events feed campaign
  attribution and metrics.
- **RBAC / audit** — CRM writes `audit_logs` in-transaction like every 002 service.

## API design (server functions)

All `createServerFn({ method: 'POST' })`, input Zod-validated
(`{ accessToken, tenantId, … }`), returning DTOs with Decimals as strings. Grouped:

- **Profile/360**: `getCustomer360`, `upsertCustomerProfile`, `upsertCustomerContact`,
  `deleteCustomerContact`, `upsertCustomerAddress`, `deleteCustomerAddress`,
  `upsertCustomerRelationship`, `deleteCustomerRelationship`, `setCustomerPreference`,
  `setConsent`, `listConsents`
- **Tags/groups/custom fields**: `listTags`, `upsertTag`, `assignTag`, `unassignTag`,
  `listGroups`, `upsertGroup`, `setGroupMembers`, `listCustomFieldDefinitions`,
  `upsertCustomFieldDefinition`, `setCustomFieldValues`
- **Timeline**: `listCustomerTimeline` (cursor-paged), `addTimelineNote`
- **Loyalty**: `getLoyaltyAccount`, `listLoyaltyLedger`, `redeemPoints`, `adjustPoints`,
  `getLoyaltySettings`, `updateLoyaltySettings`, `listLoyaltyTiers`, `upsertLoyaltyTier`,
  `listEarnRules`, `upsertEarnRule`, `expireLoyaltyPoints` *(scheduled)*
- **Segments**: `listSegments`, `upsertSegment`, `deleteSegment`, `rebuildSegment`,
  `listSegmentMembers`
- **Analytics**: `getCustomerMetrics`, `getCrmDashboard` (KPIs: customer counts by lifecycle,
  top spenders, RFM distribution, churn-risk list, loyalty liability)
- **Ops**: `runCrmProjector` *(scheduled)*

## RBAC

- Module `crm` (icon `HeartHandshake`, displayOrder 4; `system_admin` moves to 5), rootPath
  `/crm/customers`.
- Screens: `crm-customers` (`/crm/customers`), `crm-loyalty` (`/crm/loyalty`),
  `crm-segments` (`/crm/segments`), `crm-analytics` (`/crm/analytics`); deferred:
  `crm-campaigns`, `crm-tickets`.
- Permissions (`crm.*`): `crm.view`, `crm.profile_manage`, `crm.timeline_view`,
  `crm.timeline_note`, `crm.loyalty_view`, `crm.loyalty_manage`, `crm.loyalty_redeem`,
  `crm.loyalty_adjust`, `crm.segment_view`, `crm.segment_manage`, `crm.analytics_view`,
  `crm.settings_manage`. Existing `customer.view`/`customer.manage` keep guarding master CRUD.
- New role `crm_manager` (rank 57): all `crm.*` + `customer.*` + `tenant.view`,
  `dashboard.view`, profile self. Role map deltas: super_admin/admin → all `crm.*`;
  sales_manager → view/analytics/timeline/loyalty view+adjust; pos_cashier →
  `crm.loyalty_view` + `crm.loyalty_redeem`.

## Real-time analytics architecture

- `crm_customer_metrics` is the per-customer materialized projection (like `StockBalance` for
  stock): folded incrementally per event, guarded by `lastEventSequence`. Dashboards and the
  360 view read it directly.
- `crm_customer_metrics_monthly` provides trend series (spend/orders/points per month) —
  upserted per event by period key, mirroring `StockSnapshot`'s period pattern without replay.
- RFM quintiles and the churn heuristic are recomputed for the affected customer on each fold;
  tenant-wide distribution boundaries are refreshed by the scheduled rebuild
  (`rebuildSegment`-adjacent job) rather than per event.
- No SQL views/materialized views in v1 — Prisma-managed tables keep the migration story
  uniform; a reporting view layer can be added when a BI surface lands.

## AI-ready architecture

`crm_customer_scores` stores one row per `(tenant, customer, scoreType)` with `score`,
`payloadJson` (e.g. ranked offers), `modelName`, `modelVersion`, `featuresJson`, `computedAt`.
Producers upsert; consumers read the latest row. The Phase 4 churn heuristic writes
`scoreType='churn', modelName='heuristic-v1'` proving the contract. Future ML pipelines (batch
or online) write the same shape — no schema change needed for new score types. Feature
snapshots (`featuresJson`) make predictions auditable/reproducible.

## RLS-ready strategy (not enabled)

Isolation stays app-enforced (guards + tenant-scoped repos) — consistent with all 40+ existing
tables. Every `crm_` table and `domain_events` carries `tenant_id NOT NULL`; the single
exception is `crm_projection_cursors` (global infrastructure, one row per consumer).
`data-model.md` Appendix B holds ready-to-run `ALTER TABLE … ENABLE ROW LEVEL SECURITY` +
`CREATE POLICY` templates keyed on `current_setting('app.tenant_id')`, plus the runbook
(set the session variable inside `$transaction` via a Prisma client extension) for when
defense-in-depth is wanted.

## Performance & scalability

- Outbox appends are one INSERT per business tx (negligible). The projector batches (500/batch)
  under an advisory lock; lag is bounded by scheduler cadence.
- All hot paths hit tenant-leading composite indexes; timeline reads use
  `(tenant_id, customer_id, occurred_at DESC)`.
- Loyalty redemption uses `SELECT … FOR UPDATE` on the account row (same pattern as
  `ensureAndLockBalance`).
- Scale path (documented, not built): per-projection cursors → multiple consumers; outbox
  partitioning by month; move the projector to a worker/queue without changing emitters.

## Phases

- **Phase 0 — Outbox foundation.** `domain_events` + `crm_projection_cursors`, event catalog,
  emitter, emission call sites, repos, contract tests.
- **Phase 1 — Customer profile + RBAC.** Profile satellites, repos, `customer-profile-service`,
  feature layer (profile slice), `crm` module/permissions/role/nav/seed, RBAC tests.
- **Phase 2 — Timeline + projector core.** `crm_timeline_entries`, projector + cursor +
  advisory lock, timeline mapper/projection/service/server-fns, idempotent replay tests.
- **Phase 3 — Loyalty engine.** Loyalty schema, pure rules, service (sync redeem, async earn,
  FIFO expiry, tiers), projection, server fns, invariant tests.
- **Phase 4 — Metrics & intelligence.** Metrics tables, fold projection, RFM + churn heuristic,
  dashboard reads, tests.
- **Phase 5 — Segmentation.** Segments + members, rule evaluator, service + projection +
  enter/exit events, tests.
- **Phase 6 — AI-ready scores.** `crm_customer_scores` + heuristic writer + contract docs.
- **Phase 7 — Deferred contexts (design-only).** Campaigns/coupons, tickets, feedback,
  dining/delivery contracts — schema and events documented in `data-model.md`; no migration.
- **Phase 8 — Ops (design-only).** Outbox pruning job, backfill of historical sales via
  synthetic events, per-projection cursors, RLS enablement runbook.

## Testing

Per phase: pure-logic unit tests (loyalty math, rule evaluator, RFM, mapper) + RBAC wiring
assertions (permission registered/linked/mapped) in `tests/unit/crm-*.test.ts`; DB-behavior
invariants (projector idempotency, redemption locking) as harness-gated integration tests
(`INVENTORY_DB_TESTS=1`, reusing `src/server/inventory/__tests__/harness.ts`). Run
`pnpm smoke` before finishing.

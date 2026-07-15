# Feature 003 — Enterprise CRM (Customer Intelligence Layer)

## Summary

CRM is the **customer intelligence layer** of the platform, not a standalone application. Source
modules (POS, sales, inventory, purchasing, returns, and later restaurant, delivery, promotions,
finance) keep full ownership of their transactional data; CRM consumes their **domain events**
through a transactional outbox and folds them into a 360° customer view: profile, timeline,
loyalty, segments, behavioral metrics, and AI-ready scores. CRM never duplicates transactional
rows and never stores calculated business metrics on the customer master.

**Core principle (non-negotiable).** Source modules own their transactions; CRM owns customer
intelligence. The only coupling points are (1) the `customerId` reference already present on
sales documents, and (2) `domain_events` rows appended in the *same database transaction* as the
business write. Everything CRM knows is derived from those events (plus its own master-data
writes) by idempotent projections.

## Goals

- A complete, lightweight customer master: contacts (multiple phones/emails/social), addresses,
  relationships and emergency contacts, preferences, communication consent, language/currency/
  timezone, classification, VIP level, tags, groups, and tenant-defined custom fields — extending
  the existing `customers` table without duplicating it.
- Customer 360 view: one aggregation surface returning profile + metrics + loyalty + segments +
  recent timeline, read entirely from projections (no expensive fan-out queries per request).
- A chronological customer timeline fed by domain events from every module, plus manual notes.
- A configurable loyalty engine: points ledger (append-only), tier levels, earn rules,
  synchronous redemption, FIFO point expiration, birthday/anniversary bonuses, wallet/cashback.
- Dynamic segmentation: declarative rules over customer facts, re-evaluated automatically when
  events change a customer's metrics; enter/exit events feed the timeline and future campaigns.
- Real-time-enough analytics: incrementally maintained per-customer metrics (CLV, AOV, RFM,
  churn risk, favorites, visit frequency) and monthly trend rows — dashboards never replay
  transactions.
- AI-ready data structures: a scores table with model metadata (churn, next-best-offer,
  recommendations) so future ML pipelines write predictions without schema changes. A
  deterministic churn heuristic ships as the first score producer.
- Marketing (campaigns, coupons), customer service (tickets), feedback/reviews, restaurant guest
  management, and delivery intelligence: fully designed (schema, events, permissions, workflows)
  as contracts; implemented after their source modules materialize.

## Non-goals (this feature)

- Email/SMS/WhatsApp delivery infrastructure (campaign *execution* needs a message provider;
  we design the tracking model only).
- ML model training or inference — only the data structures that receive predictions.
- Enabling PostgreSQL Row-Level Security. All `crm_` tables are RLS-*ready* (tenant_id
  everywhere, policy templates documented in `data-model.md`), but isolation remains app-enforced
  like the rest of the schema.
- Restaurant/delivery operational features (table management, driver dispatch). CRM only defines
  the event contracts it will consume when those modules exist.
- Customer-facing surfaces (portals, apps). CRM is back-office.
- File attachments on customer records (needs a storage strategy decision; documented as planned).

## User stories (prioritized)

**US1 (P1) — Customer 360.** As a sales manager I open a customer and see, on one screen:
profile and contact details, tags and groups, loyalty balance and tier, segment memberships,
lifetime metrics (total spend, AOV, visit frequency, churn risk, favorites), and a recent
activity timeline — without any module being queried live. *(Phases 1–4.)*

**US2 (P1) — Loyalty at POS.** As a cashier I can see a customer's points balance and redeem
points against a sale synchronously (balance is row-locked; overdrawing is impossible). Points
for a completed sale are earned automatically from the sale's domain event, according to
tenant-configured earn rules and tier multipliers. *(Phase 3.)*

**US3 (P2) — Segmentation.** As a marketer I define segments with declarative rules ("total
spend > 1000 and last purchase within 90 days", "inactive 180 days") and the platform keeps
membership current automatically as events arrive; I can also trigger a full rebuild. Enter/exit
transitions are visible on the customer timeline. *(Phase 5.)*

**US4 (P2) — Timeline.** As a support user I see every registration, order, payment, refund,
loyalty movement, consent change, and segment change for a customer in reverse-chronological
order, and I can add manual notes. *(Phase 2.)*

**US5 (P2) — Profile & consent management.** As a back-office user I maintain multiple phones/
emails/addresses, family/emergency relationships, delivery instructions, preferences, and
per-channel marketing consent (with granted/withdrawn evidence) for any customer. *(Phase 1.)*

**US6 (P3) — CRM analytics dashboard.** As an owner I see customer growth, top customers,
RFM distribution, churn-risk lists, and loyalty program performance from pre-aggregated
projections. *(Phase 4.)*

**US7 (P3) — Campaigns & coupons.** As a marketer I create a campaign targeting a segment,
issue coupons, and track delivered/opened/clicked/redeemed and revenue attribution. *(Designed;
implementation deferred — needs a message provider.)*

**US8 (P3) — Support tickets & feedback.** As a support agent I manage tickets (channels,
priorities, assignment, SLA) and collect ratings/reviews tied to sales/products. *(Designed;
implementation deferred.)*

**US9 (P3) — Restaurant guest intelligence.** As a restaurant manager I see dining history,
favorite items/tables, allergies and diet preferences, special occasions, and no-show history.
*(Designed as event contracts + preference keys; implemented with the restaurant module.)*

## Key rules

1. **Outbox atomicity.** A business transaction that must be visible to CRM appends its
   `domain_events` row inside the same `$transaction`. No event ⇒ the business write must have
   rolled back too. Emission failures are never swallowed.
2. **At-least-once + idempotent.** The projector may see an event more than once. Every
   projection is idempotent: timeline and loyalty ledger rows carry a unique `sourceEventId`;
   metrics rows carry a monotonic `lastEventSequence` guard; segment membership is an
   upsert/delete.
3. **No metrics on the master.** `customers` and `crm_customer_profiles` hold identity and
   preference data only. All computed values live in `crm_customer_metrics`,
   `crm_loyalty_accounts`, and `crm_customer_scores`.
4. **Redemption is synchronous; earning is asynchronous.** Redeeming points happens in the
   caller's transaction under a row lock on the loyalty account (a customer cannot spend the
   same points twice). Earning is folded from events by the projector (a delay of one projector
   cycle is acceptable; over-crediting is prevented by `sourceEventId` uniqueness).
5. **`Customer.loyaltyPoints` is deprecated.** The ledger (`crm_loyalty_ledger`) plus the
   account row (`crm_loyalty_accounts.pointsBalance`) are the source of truth; the legacy column
   is a read cache the projector keeps in sync until callers migrate off it.
6. **Naming.** All CRM tables use the `crm_` prefix; the outbox is module-neutral
   `domain_events` because every module writes it. "Reservation" is reserved for stock holds
   (feature 002); restaurant bookings are "dining reservations".
7. **Eventual consistency is documented, not hidden.** Dashboards and timelines lag by at most
   one projector cycle (scheduler interval). Surfaces that need hard consistency (redemption,
   profile edits) write synchronously.

## Customer lifecycle

`PROSPECT → ACTIVE → AT_RISK → INACTIVE` (+ `BLOCKED` from any state, manual). Lifecycle status
lives on `crm_customer_profiles.lifecycleStatus`; the metrics projection proposes automatic
transitions (first purchase ⇒ ACTIVE; no purchase for the tenant-configured at-risk window ⇒
AT_RISK; beyond the inactive window ⇒ INACTIVE; any new purchase ⇒ back to ACTIVE). Manual
override always wins (BLOCKED is manual-only).

## Customer journey (module touchpoints → CRM)

1. **Acquisition** — customer created at POS/back office → `customer.created` event → profile,
   loyalty account, timeline entry, PROSPECT lifecycle.
2. **Purchase** — POS sale completes / sales order fulfills / invoice paid → events → timeline,
   metrics fold (spend, AOV, favorites, RFM inputs), loyalty auto-earn, segment re-evaluation,
   lifecycle ACTIVE.
3. **Service** — returns/refunds/credit notes → events → metrics (returns count/value),
   timeline; later: tickets and feedback.
4. **Retention** — projector-derived churn score rises; customer enters "at risk" segments;
   (later) win-back campaigns target those segments; birthday/anniversary bonus jobs award
   points.
5. **Departure/reactivation** — lifecycle INACTIVE after the configured window; any new event
   reactivates.

## Security model

- Every CRM server function chains `requireAuth → requireTenantAccess → requirePermission`
  exactly like features 001/002 — this remains the tenant isolation boundary.
- New `crm` module with screens (`crm-customers`, `crm-loyalty`, `crm-segments`,
  `crm-analytics`) registered in the dynamic RBAC registry; permissions follow `crm.<action>`
  (see `plan.md` §RBAC). Existing `customer.view`/`customer.manage` continue to guard the
  master CRUD.
- New `crm_manager` role; owner/admin inherit all CRM permissions; POS cashier gets
  loyalty view/redeem only.
- Consent data (`crm_communication_consents`) is auditable: grants/withdrawals carry source and
  evidence and are mirrored to the timeline.
- All CRM mutations write `audit_logs` rows in-transaction, like feature 002 services.
- RLS enablement is a documented runbook (data-model.md appendix), deliberately not enabled.

## Cross-references

- Implementation plan: `plan.md` (layering, outbox/projector architecture, API design, RBAC,
  analytics/AI architecture, performance, phases).
- Data model: `data-model.md` (all tables, enums, indexes, event catalog, RLS templates).
- Task list: `tasks.md`.

# Feature 004 — Enterprise Restaurant Management & Promotions

## Summary

The Restaurant module is the **operational front-of-house + kitchen + guest domain** of the
platform. It turns the existing inventory catalog into a sellable menu, runs the full dine-in /
takeaway / delivery order lifecycle, drives a Kitchen Display System (KDS), manages reservations
and table service, and layers a fully **configurable promotions/coupons/loyalty/gift-card/campaign
engine** on top of ordering.

It is **not** a standalone POS. It reuses and integrates with what already exists:

- **Inventory** owns stock. Menu items never own stock; they consume `products`/`product_variants`
  through **recipes**, generating `InventoryMovement` + `StockReservation` rows via the existing
  inventory services.
- **CRM** owns customer intelligence. Restaurant emits `restaurant_*` **domain events** through the
  existing `domain_events` outbox; CRM projects them into loyalty, metrics, timeline, and segments.
- **Auth/RBAC** owns access. Restaurant extends the already-seeded `restaurant` module, `res:` roles
  and `res.` permissions — every server function chains
  `getCurrentUserContext → requireTenantAccess → requirePermission`.
- **Financial** integration is delivered as **event-readiness**: order/refund events carry the
  accounting-relevant snapshot (revenue, discount, tax, service charge, delivery, tips, payment
  allocation) so a future GL module can post entries without schema changes.

**Core principle (non-negotiable).** Nothing about promotions, pricing, taxes, service charges,
order types, kitchen routing, or numbering is hardcoded in application logic — it is all
configurable through `res_`-prefixed tables. Application code evaluates configuration; it does not
embed business rules.

## Goals

- **Multi-tenant, multi-branch, franchise-ready.** A tenant owns one or more restaurants; each
  restaurant owns branches; every operational entity (tables, menus, orders, promotions) is scoped
  to tenant and, where relevant, branch — so a single-branch café and a global franchise use the
  same schema.
- **Complete restaurant master data** — restaurants, branches, business hours, holidays, dining
  areas/sections/tables, QR codes, service types, shifts, kitchen stations/printers, receipt
  templates, tax and service-charge configuration, delivery/takeaway settings, and per-branch
  order/invoice number sequences — all table-driven.
- **A complete menu engine** — menus, categories, items, variants/sizes, time/channel/service-type
  scheduled pricing (happy-hour, weekend, holiday, delivery, takeaway), modifiers and modifier
  groups, combos/bundles, allergens, diet types, tags, availability schedules, visibility rules,
  and cross/up-sell links.
- **Recipe management** binding menu items to inventory products — ingredient consumption, waste %,
  yield, sub-recipes, versioning, costing, and approval.
- **A full order lifecycle** — draft → open → confirmed → preparing → cooking → ready → served →
  completed, plus cancelled / refunded / voided — with split/merge/transfer bills, guest counts,
  notes, discounts, service charge, delivery fees, tips, rounding, order source/type/channel, and a
  complete audit trail; order transitions drive inventory consumption and event emission.
- **A Kitchen Display System** — kitchen tickets and ticket items routed to stations, a live queue,
  preparation/cooking/ready/served statuses, cooking timers, priority/rush handling, and kitchen
  performance projections.
- **Reservations & table service** — reservations, walk-ins, waiting list, table assignment and
  automatic allocation, deposits, no-shows, guest preferences, and status/source tracking.
- **A configurable promotion engine** — percentage/fixed/BOGO/combo/free-item/free-delivery/
  cashback/upgrade promotions driven by a **conditions + actions rule engine** (min order, segment,
  loyalty tier, time/day/date, branch, service type, payment method, category/product, quantity,
  Nth/first purchase, birthday…) with priority, stacking, conflict resolution, usage limits, and a
  full application audit ledger.
- **Coupons, loyalty, gift cards, and campaigns** — coupon generation/validation/tracking, a
  loyalty bridge to the CRM loyalty ledger, gift-card issuance/reload/redeem with transaction
  history, and marketing campaigns with budgets, CRM-segment targeting, promotion assignment, and
  performance metrics.
- **Reporting** — projection tables (folded from `domain_events`, CRM-style) and report server
  functions for daily/hourly/branch sales, cashier/waiter/kitchen performance, popular/slow items,
  food cost, average ticket, table turnover, promotion/coupon usage, refunds, tax, and delivery.

## Non-goals (this feature)

- **PostgreSQL Row-Level Security enablement.** Every `res_` table is RLS-*ready* (`tenant_id NOT
  NULL` everywhere, policy templates documented), but isolation stays app-enforced like the rest of
  the schema.
- **A general ledger / accounting posting engine.** No GL module exists yet; we deliver the event
  contracts and accounting-relevant snapshots, not journal entries.
- **Message delivery infrastructure** (email/SMS/WhatsApp/push) for campaigns — we model the
  campaign, targeting, and tracking data only, mirroring how CRM handles campaigns.
- **Customer-facing surfaces** (guest QR-ordering web app, native apps). We model QR codes and order
  sources; the customer PWA is a later, separate feature.
- **Third-party delivery-platform live integrations** (Uber Eats, Talabat…). We model the order
  source and settings; the connectors are out of scope.
- **Payment gateway integration.** Payments are recorded/allocated; gateway capture is external.

## User scenarios & testing *(mandatory)*

### User Story 1 (Priority: P1) — Configure a restaurant and its menu

As a **restaurant manager**, I set up a restaurant, add a branch with business hours and tax/
service-charge rules, define dining areas and tables with QR codes, build a menu with categories,
items, variants, modifiers, and time-based pricing, and attach recipes so items consume inventory.

**Acceptance scenarios**
1. Given I hold `res.settings.manage`, when I create a restaurant + branch, then per-branch order
   and invoice number sequences are provisioned and the branch appears scoped to my tenant only.
2. Given a menu item with a happy-hour price rule (16:00–18:00 weekdays), when the item is priced
   at 17:00 on a Tuesday, then the happy-hour price applies; at 20:00 the base price applies.
3. Given a menu item with a recipe consuming 200g of a tracked product, when an order containing it
   is served, then an `InventoryMovement` of −200g (× waste factor) is written for that branch's
   warehouse.

### User Story 2 (Priority: P1) — Run the dine-in order + kitchen lifecycle

As a **waiter/cashier**, I open a dine-in order for a table, add items with modifiers, fire it to
the kitchen, and the KDS routes items to stations; the kitchen advances statuses; I split the bill,
apply a promotion, take payment, and complete the order.

**Acceptance scenarios**
1. Given an open order with items routed to "Grill" and "Bar" stations, when I confirm it, then one
   kitchen ticket per station is created with the correct items and appears in that station's queue.
2. Given a bill split into two, when each split is paid by a different method, then each payment is
   allocated to its split and the order completes only when the full grand total is covered.
3. Given an order that qualifies for a stackable 10%-off promotion and a non-stackable free-delivery
   promotion, when pricing is evaluated, then conflict resolution applies both only if their stack
   groups permit, and every applied promotion is recorded in the application ledger.
4. Given a completed order for a known customer, when it completes, then a
   `restaurant_order.completed` event is emitted (Decimal-as-string) and CRM loyalty points accrue.

### User Story 3 (Priority: P2) — Configure and evaluate promotions

As a **marketing manager**, I create promotions from configuration only — choosing a type, adding
conditions and actions, setting priority/stacking and usage limits — issue coupon batches, and see
promotion/coupon usage in reports; no code deploy is required.

**Acceptance scenarios**
1. Given a "Buy 2 pizzas get 1 free" promotion built from conditions (category=Pizza, qty≥2) and a
   free-item action, when a qualifying order is priced, then the cheapest qualifying pizza is free.
2. Given a coupon batch with per-customer limit 1 and global limit 500, when a customer redeems a
   second coupon from the batch, then redemption is rejected with a typed validation error.
3. Given two promotions in the same non-stackable stack group, when both qualify, then only the
   higher-priority one applies and the other is skipped (recorded as skipped in the ledger).

### User Story 4 (Priority: P3) — Reservations, gift cards, campaigns, reporting

As a **branch manager**, I take reservations and manage walk-ins/waitlist, sell and redeem gift
cards, run a seasonal campaign targeting a CRM segment, and review daily sales, food cost, table
turnover, and campaign performance.

### Edge cases
- Order voided after items were fired to the kitchen → inventory reservations are released; no
  consumption movement is posted; a void event is emitted with reason.
- Promotion whose validity window closed mid-order → re-evaluation at payment drops it and re-prices.
- Two waiters transfer the same table concurrently → optimistic guard (single active order per
  table) rejects the second transfer with a conflict error.
- Gift card redeemed for more than its balance → rejected; partial redemption allowed down to zero.
- Recipe references a soft-deleted product → menu item flagged unavailable; order cannot fire it.

## Requirements *(mandatory)*

### Functional requirements

- **FR-001** Every `res_` table MUST carry `tenant_id NOT NULL` with a cascading `tenant` relation
  and MUST be queried tenant-scoped; branch-scoped tables MUST also carry `branch_id`.
- **FR-002** Restaurant → branch → (dining area → section → table) hierarchy MUST be modeled, with
  each table optionally carrying a QR code and belonging to exactly one section.
- **FR-003** Order/invoice numbering MUST be configurable per branch via a sequence table; numbers
  MUST be gap-tolerant and unique per (tenant, branch, sequence).
- **FR-004** Tax, service charge, delivery, and takeaway settings MUST be configuration rows, not
  constants; multiple tax configs and service-charge rules MUST be supportable per branch.
- **FR-005** Menu item pricing MUST support multiple concurrent price rules resolved by
  service type, channel, and schedule (happy-hour/weekend/holiday), with a deterministic
  precedence and a base fallback price.
- **FR-006** Menu items MUST support variants/sizes, required/optional modifier groups with
  min/max selection, combos/bundles, allergens, diet types, tags, availability schedules, and
  visibility rules.
- **FR-007** A menu item MAY have a versioned recipe binding it to inventory products with per-line
  quantity, waste %, and yield; recipe cost MUST be computable from inventory cost.
- **FR-008** Orders MUST implement the full state machine and MUST reject invalid transitions;
  every transition MUST be recorded in an append-only order-event log with actor and reason.
- **FR-009** Orders MUST support split/merge/transfer, guest count, per-line modifiers, discounts,
  service charge, delivery fee, tips, and rounding, with monetary totals stored as `Decimal(19,4)`.
- **FR-010** Confirming/serving an order MUST reserve/consume inventory via recipes inside the same
  transaction; voiding before consumption MUST release reservations.
- **FR-011** Completing/refunding an order MUST append a `restaurant_order.*` domain event with a
  Decimal-as-string payload sufficient for CRM projection and future GL posting.
- **FR-012** Confirming an order MUST generate one kitchen ticket per target station; the KDS MUST
  track per-item status, cooking timers, and priority, and MUST expose a station queue.
- **FR-013** Reservations MUST support source/status, deposits, no-shows, waitlist, walk-ins, and
  table assignment (manual + automatic allocation) without double-booking an active table.
- **FR-014** Promotions MUST be fully configuration-driven: a promotion has many typed conditions
  (ANDed) and many typed actions; the engine MUST evaluate eligibility, resolve conflicts by
  priority + stacking, apply actions to an immutable pricing snapshot, and record every application.
- **FR-015** Usage limits (global, per-customer, per-branch) MUST be enforced atomically; exceeding
  a limit MUST raise a typed validation error and record nothing.
- **FR-016** Coupons MUST support batch/manual generation, single/multi use, expiration, customer/
  campaign assignment, validation, and redemption tracking.
- **FR-017** Loyalty earn/redeem MUST bridge to the CRM loyalty ledger (no duplicate point store);
  gift cards MUST support issue/reload/redeem/expire with an append-only transaction history.
- **FR-018** Campaigns MUST support budgets, CRM-segment targeting, promotion assignment, schedule,
  status, and performance metrics.
- **FR-019** Reporting MUST be served from projection tables/materialized views folded from
  `domain_events`, never by replaying transactions live.
- **FR-020** Every new server function MUST enforce the guard chain and MUST validate all input with
  Zod; every new permission MUST be registered in both RBAC catalogs and seeded.

### Key entities

Master data (`res_restaurants`, `res_branches`, `res_tables`, `res_service_types`,
`res_kitchen_stations`, `res_tax_configs`, `res_service_charge_rules`, `res_number_sequences`…),
Menu (`res_menus`, `res_menu_categories`, `res_menu_items`, `res_menu_item_variants`,
`res_menu_item_prices`, `res_modifier_groups`, `res_modifiers`, `res_combos`…), Recipes
(`res_recipes`, `res_recipe_lines`, `res_recipe_versions`…), Orders (`res_orders`,
`res_order_items`, `res_order_item_modifiers`, `res_order_payments`, `res_order_events`…), KDS
(`res_kitchen_tickets`, `res_kitchen_ticket_items`…), Reservations (`res_reservations`,
`res_waitlist`…), Promotions (`res_promotions`, `res_promotion_conditions`,
`res_promotion_actions`, `res_promotion_applications`…), Coupons/Loyalty/Gift cards
(`res_coupons`, `res_gift_cards`…), Campaigns (`res_campaigns`…), Reporting (`res_report_*`).

## Success criteria

### Measurable outcomes
- A restaurant, branch, menu, and recipe can be configured entirely through server functions with
  zero code changes, and a dine-in order can be taken, fired, priced with promotions, paid, and
  completed end-to-end.
- Serving an order posts correct inventory movements; completing it emits a domain event CRM
  projects into loyalty/metrics.
- Adding a new promotion type-instance (e.g. a Ramadan combo) requires only inserting configuration
  rows — no deploy.
- `pnpm smoke` (lint + typecheck + vitest) is green after every phase; each phase's migration
  applies cleanly and `prisma generate` produces a type-correct client.

## Assumptions
- The single `prisma/schema.prisma` file continues to hold all models (no multi-file schema).
- Business logic lives in app-layer services/repos; no DB triggers/stored procedures are added.
- Branch is the primary operational scope beneath tenant; a tenant with one restaurant/one branch
  is the degenerate case of the franchise model.
- The existing `domain_events` outbox and CRM projectors are the integration substrate; restaurant
  adds event types but does not build its own message bus.

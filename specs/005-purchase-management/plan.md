# Implementation Plan — Feature 005 (Enterprise Purchase Management)

## Summary

Deliver enterprise procure-to-pay as an **extension** of the working Spec-002 purchasing spine.
Phase 0 (this pass) lays the DB + config foundation: Prisma `pod_` models, a hand-authored raw-SQL
migration (columns, generated columns, functions, triggers, views, materialized views, RLS, lookup
seed), `DocumentType` enum additions, RBAC/catalog wiring, and purchasing domain-event types.
Phases 1–7 build the app layer (repos → services → server functions → routes → tests) aggregate by
aggregate, each an independently migratable, `smoke`-green increment. No phase rebuilds the spine or
moves inventory posting out of `movement-engine.ts`.

## Technical context

- **Stack:** TanStack Start (SSR React 19), Prisma 7 (`prisma-client` generator →
  `src/server/db/generated/prisma`), PostgreSQL, Supabase identity, Zustand + TanStack Query,
  i18next (en/ar). pnpm; dev on :3005.
- **Reused modules:** inventory (products, movements, cost layers, lots/serials via
  `movement-engine.ts`), auth/RBAC (registry seeded from `rbac-catalog.ts` + `module-catalog.ts`),
  the `domain_events` outbox, `document-number-service.ts`, `state-machine.ts` (enum docs),
  `audit-log-repo.ts`.
- **Existing spine (Spec 002):** `suppliers`, `purchase_requisitions` (+lines), `purchase_orders`
  (+lines), `goods_receipts` (+lines), `purchase_returns` (+lines), `financial_notes`,
  `product_suppliers`, with services in `src/server/inventory/documents/*`, repos in
  `src/server/repos/*`, server functions in `src/features/purchasing/*`.
- **Testing:** vitest unit tests (`tests/unit/purchase-*.test.ts`); DB-integration deferred/harness
  gated per existing convention; Playwright later.

## Constitution check

`.specify/memory/constitution.md` is the unfilled template; the de-facto constitution honored here,
drawn from features 001–004:

- Prisma is the single source of truth; snake_case `@map`/`@@map`; camelCase model fields; UUID PKs.
- Tenant isolation is app-enforced via the guard chain; RLS is defense-in-depth only.
- Cross-aggregate/lookup references are bare scalar `@db.Uuid` (app-enforced integrity); only
  `tenant` and header→line links are real relations (cascade).
- **Divergence, deliberate:** unlike Feature 004 (no triggers), Feature 005 adds DB
  triggers/functions/views **for cross-cutting concerns and reporting only** — never for inventory
  posting or business-rule enforcement, which stay in the service layer. This is a Decision-recorded
  exception, not a precedent for domain logic in the DB.
- New `pod_` documents use lookup-table statuses; Spec-002 documents keep enums.
- No hardcoded business rules — statuses, transitions, reasons, methods, incoterms, and approval
  thresholds are configuration.

## Reconciliation with Spec 002

- **Reuse as-is (FK, no new table):** `products`, `product_variants`, `units_of_measure`,
  `uom_conversions`, `warehouses`, `warehouse_locations`, `tax_rates`, `lots`, `serial_numbers`,
  `inventory_movements`, `stock_balances`, `cost_layers`, `document_sequences`, `product_suppliers`,
  `audit_logs`, `domain_events`, `purchase_returns`.
- **Extend in place (non-breaking columns):** `suppliers`, `purchase_requisitions`,
  `purchase_orders`, `purchase_order_lines`, `goods_receipts` (see the reconciliation map in
  `spec.md`).
- **New (`pod_`):** supplier CRM satellites, RFQ, quotations, approval engine, supplier invoices +
  3-way match, debit-note lines, landed cost, supplier payments, attachments, custom fields, and the
  status/classification lookups.

## Project structure

```
specs/005-purchase-management/
  spec.md              # business architecture, 32 sub-modules, user stories (done)
  plan.md              # this file
  tasks.md             # phased task checklist with exact file paths

prisma/
  schema.prisma                                             # + pod_ models, spine columns, DocumentType values
  migrations/20260717090000_purchase_management_enterprise_v1/migration.sql   # hand-authored DDL (done)
  seed.ts                                                   # upsert RBAC + default per-tenant approval workflow

src/
  server/repos/pod-*-repo.ts                     # tenant-scoped data access (later phases)
  server/inventory/documents/*-service.ts        # supplier-invoice-service.ts, supplier-payment-service.ts, etc.
  server/purchasing/approval-engine.ts           # pure workflow routing (later phase)
  server/events/domain-event-types.ts            # + purchasing event types
  features/purchasing/*                          # server-functions.ts + validation.ts (+ hooks/stores)
  routes/_app/purchase/*.tsx                      # new wired routes (later phases; none exist today)
  features/auth/rbac-catalog.ts                   # + purchase.* permissions / role map
  features/auth/module-catalog.ts                 # + purchase module / screens / permission links
  lib/navigation/app-nav.ts                       # + purchase nav section
  lib/i18n/resources/{en,ar}/common.json          # + nav + screen labels

tests/unit/purchase-*.test.ts                      # per-phase unit tests
```

## Canonical service transaction shape

Every write path in Phases 1–7 follows the shape already used by
`src/server/inventory/documents/purchase-order-service.ts` — one `prisma.$transaction`, guards
first, numbering, transition assertion, repo write, optional inventory posting, event append, audit:

```
async function createXxx(context, tenantId, input) {
  // 0. guards (in the server function, before the service): getCurrentUserContext →
  //    requireTenantAccess(context, tenantId) → requirePermission(context, 'purchase.xxx_manage')
  // 1. validate: Zod .inputValidator on the server function; service assumes trusted input
  return prisma.$transaction(async (tx) => {
    // 2. numbering (new pod_ docs reuse DocumentType): nextDocumentNumber(tx, { tenantId, documentType: 'supplier_invoice' })
    const documentNumber = await nextDocumentNumber(tx, { tenantId, documentType })
    // 3. assert transition:
    //      - pod_ docs: assertPodTransition(tx, entityType, fromCode, toCode)  [lookup-table analogue]
    //      - enum spine docs: assertTransition(...) from state-machine.ts
    // 4. repo write: pod<Aggregate>Repo.create(tenantId, { ... }, tx)  (header + lines)
    // 5. postMovement ONLY when inventory changes (GRN post, landed-cost post):
    //      movementEngine.post(tx, { ... })  — never a trigger
    // 6. appendDomainEvent(tx, { tenantId, eventType: 'supplier_invoice.posted', payload /* Decimal→string */ })
    // 7. createAuditLog(tx, { tenantId, actionKey, entityType, entityId, ... })
    return serialize(created)  // Decimal→string via document-dto.ts
  })
}
```

Notes: DB triggers already recompute denormalized header totals, bump `version_number`, touch
`updated_at`, and capture activity into `audit_logs` — services rely on them and do **not** duplicate
that math. The service-layer `createAuditLog` remains the semantic activity trail (actor + reason);
the trigger capture is the low-level row-diff safety net.

## Phasing (see tasks.md for the checklist)

| Phase | Domain | Key deliverable |
|-------|--------|-----------------|
| 0 | **DB + config foundation (this pass)** | `pod_` Prisma models + hand-authored migration (columns, generated cols, functions, triggers, views, matviews, RLS, lookup seed), `DocumentType` values, RBAC/catalog wiring, purchasing event types |
| 1 | Supplier CRM | contacts/addresses/bank-accounts/categories services + UI; supplier rating surface |
| 2 | RFQ → Quotation | RFQ issue/invite, quotation capture, comparison + award |
| 3 | Approval engine | workflow config + request routing + actions (generic, reused by PO/invoice/payment) |
| 4 | Supplier invoices + 3-way match | AP invoice capture, match, post; supplier balance |
| 5 | Landed cost | voucher + charges + allocation; service-layer inventory revaluation |
| 6 | Supplier payments | payment capture + allocation + advances; balance/aging |
| 7 | Reporting + gaps | matview refresh scheduling, notification dispatch layer, RLS-GUC runtime wiring |

**Sequencing note:** Phase 0 is the reviewable foundation (schema + migration + config). Phase 3
(approval engine) precedes Phases 4–6 because invoice/payment submission route through it. Phase 7
closes the two genuine gaps.

### Phase 0 — DB + config foundation *(this pass)*

- **Deliverables:** all `pod_` models in `schema.prisma`; non-breaking spine column additions;
  `DocumentType` += `rfq`, `supplier_quotation`, `supplier_invoice`, `supplier_payment`,
  `landed_cost`; the hand-authored `migration.sql` (functions `pod_touch_updated_at`,
  `pod_bump_version`, `pod_capture_activity`, `pod_recompute_invoice_totals`,
  `pod_recompute_quotation_totals`, `pod_recompute_voucher_charges`, `pod_allocate_landed_cost`,
  `pod_recompute_supplier_balance`, `pod_three_way_match`, `pod_set_tenant_context`,
  `pod_refresh_reporting_matviews`; triggers; views `pod_v_open_purchase_orders`,
  `pod_v_po_line_status`, `pod_v_outstanding_payables`, `pod_v_supplier_balances`,
  `pod_v_three_way_match_variance`; matviews `pod_mv_supplier_performance`, `pod_mv_spend_analysis`,
  `pod_mv_purchase_price_variance`; RLS enable+policy loop; global lookup seed); RBAC permission
  codes + module/screen/link wiring; purchasing domain-event types; catalog unit test.
- **Reused infra:** `document-number-service.ts`, `state-machine.ts`, `audit-log-repo.ts`,
  `domain_events`, `movement-engine.ts` (referenced, not invoked yet), `tenant-guard.ts`/`errors.ts`,
  `prisma/seed.ts` (upsert-by-code picks up new permissions automatically).
- **Service transaction shape:** n/a (no services this pass) — but the shape above is the contract
  every later phase implements.
- **Verification:** `pnpm prisma validate`; `pnpm prisma migrate deploy` (NOT `migrate dev` — see the
  `auth.uid()` drift memory note) + `pnpm prisma generate`; `pnpm db:seed`; spot-check a view,
  matview refresh, and trigger; `pnpm smoke`.

### Phase 1 — Supplier CRM

- **Deliverables:** repos (`pod-supplier-contact-repo.ts`, `pod-supplier-address-repo.ts`,
  `pod-supplier-bank-account-repo.ts`, `pod-supplier-category-repo.ts`); services for CRUD +
  primary-flag invariants; `features/purchasing` server functions + Zod validation; routes
  `routes/_app/purchase/suppliers.tsx`; `purchase.supplier_view` / `purchase.supplier_manage`
  enforcement; unit tests (tenant scoping, single-primary invariant).
- **Reused infra:** `audit-log-repo.ts`, tenant guards, `document-dto.ts`.
- **Transaction shape:** create/update satellites inside `$transaction`; enforce "one primary per
  supplier" before write; `createAuditLog`; no numbering, no inventory, no events (master data).

### Phase 2 — RFQ → Quotation

- **Deliverables:** repos (`pod-rfq-repo.ts`, `pod-supplier-quotation-repo.ts`); services
  (`rfq-service.ts`, `supplier-quotation-service.ts`) for issue → invite → capture → compare →
  award; award stamps `pod_rfqs.awarded_supplier_id`/`awarded_quotation_id` and moves quotation to
  `awarded`; server functions + validation; routes `routes/_app/purchase/rfq.tsx`,
  `quotations.tsx`; permissions `purchase.rfq_view/rfq_manage`,
  `purchase.quotation_view/quotation_manage/quotation_award`; tests (transition guard, award,
  totals from trigger).
- **Reused infra:** `document-number-service.ts` (`rfq`, `supplier_quotation`), lookup-table
  transition assertion, `domain_events` (`rfq.*`, `supplier_quotation.*`), audit.
- **Transaction shape:** numbering → `assertPodTransition` → repo write (header+items) →
  `appendDomainEvent` → `createAuditLog`. Header totals come from `pod_recompute_quotation_totals`.

### Phase 3 — Approval engine (generic)

- **Deliverables:** `server/purchasing/approval-engine.ts` (pure: pick workflow by `entity_type` +
  amount, build steps, evaluate `condition` JSON); repos (`pod-approval-workflow-repo.ts`,
  `pod-approval-request-repo.ts`); `approval-service.ts` (raise request, record action, advance /
  approve / reject / delegate / escalate); server functions + validation; routes
  `routes/_app/purchase/approvals.tsx`; permissions `purchase.approval_action`,
  `purchase.config_manage` (workflow config); tests (routing by amount, multi-step advance,
  delegation, escalation timing).
- **Reused infra:** lookup-table transitions (`approval_request`), `domain_events` (`approval.*`),
  audit; RBAC role codes for step targeting.
- **Transaction shape:** raise → repo write request → link `approval_request_id` on the document →
  event → audit. Each action: `assertPodTransition` on the request → append `pod_approval_actions`
  → advance `current_step_order` or terminalize → event → audit.

### Phase 4 — Supplier invoices + 3-way match

- **Deliverables:** repos (`pod-supplier-invoice-repo.ts`); `supplier-invoice-service.ts` (capture →
  match → approve via Phase 3 → post); match writes `pod_supplier_invoice_matches` and calls
  `pod_three_way_match()`; post sets `is_posted` and calls `pod_recompute_supplier_balance()`; server
  functions + validation; routes `routes/_app/purchase/invoices.tsx`; permissions
  `purchase.invoice_view/invoice_manage/invoice_match`; tests (totals trigger, match tolerance,
  balance recompute, aging bucket).
- **Reused infra:** `document-number-service.ts` (`supplier_invoice`), approval engine (Phase 3),
  `domain_events` (`supplier_invoice.captured/matched/posted`), audit, `pod_v_outstanding_payables`.
- **Transaction shape:** numbering → `assertPodTransition` → repo write (header+items; totals via
  trigger) → on match, write matches + `SELECT pod_three_way_match($1)` → on post,
  `SELECT pod_recompute_supplier_balance($tenant,$supplier)` → `appendDomainEvent` (Decimal→string,
  GL-ready) → `createAuditLog`.

### Phase 5 — Landed cost

- **Deliverables:** repos (`pod-landed-cost-repo.ts`); `landed-cost-service.ts` (voucher → charges →
  allocate → post); allocate calls `pod_allocate_landed_cost()`; **post revalues inventory via
  `movement-engine.ts`** (service layer, not trigger); server functions + validation; routes
  `routes/_app/purchase/landed-cost.tsx`; permission `purchase.landed_cost_manage`; tests
  (charge total trigger, proportional allocation, zero-basis no-op, revaluation call).
- **Reused infra:** `document-number-service.ts` (`landed_cost`), `movement-engine.ts` +
  `costing.ts`, `domain_events` (`landed_cost.*`), audit.
- **Transaction shape:** numbering → transition → repo write (header+charges; total via trigger) →
  `SELECT pod_allocate_landed_cost($voucher)` → on post, `movementEngine.revalue(...)` →
  event → audit.

### Phase 6 — Supplier payments

- **Deliverables:** repos (`pod-supplier-payment-repo.ts`); `supplier-payment-service.ts` (capture →
  allocate → approve via Phase 3 → post); allocation reduces invoice `outstanding_amount` / raises
  `paid_amount` and sets `payment_status_code`; advances tracked via `unallocated_amount` /
  `is_advance`; post calls `pod_recompute_supplier_balance()`; server functions + validation; routes
  `routes/_app/purchase/payments.tsx`; permissions `purchase.payment_view/payment_manage`; tests
  (allocation caps, advance, balance/aging).
- **Reused infra:** `document-number-service.ts` (`supplier_payment`), approval engine,
  `domain_events` (`supplier_payment.*`), audit, `pod_v_supplier_balances`.
- **Transaction shape:** numbering → transition → repo write (payment + allocations) → update matched
  invoices' `paid_amount`/`outstanding_amount`/`payment_status_code` → on post,
  `pod_recompute_supplier_balance()` → event → audit. Debit-note lines (`pod_debit_note_lines`)
  attach to `financial_notes` here or in a debit-note sub-service under `purchase.debit_note_manage`.

### Phase 7 — Reporting + gap closure

- **Deliverables:** a scheduled/queued caller for `pod_refresh_reporting_matviews()` (matviews ship
  `WITH NO DATA` and need a first refresh + cadence); report server functions over the `pod_v_*`
  views; **notification dispatch layer** (the genuine gap) so approval escalation / due-invoice
  reminders can send; **RLS-GUC runtime wiring** so the pooled Prisma connection sets
  `app.current_tenant_id` per request (turning RLS from documented posture into an active second
  boundary); tests.
- **Reused infra:** `domain_events` (as the trigger for notifications), matview helpers,
  `pod_v_outstanding_payables` / `pod_v_supplier_balances` / `pod_v_three_way_match_variance`.

## Genuine gaps (called out, not hand-waved)

1. **Notification dispatch.** There is no server-side notification/email/reminder service today. The
   approval engine models `escalate_after_hours` and invoices carry `due_date`, but nothing sends.
   Phase 7 introduces the dispatcher; until then, escalation is a state change only.
2. **RLS GUC runtime wiring.** `pod_set_tenant_context()` and the per-table `tenant_isolation`
   policies exist, and RLS is `ENABLE`d (not `FORCE`d), so the pooled owner role bypasses them and
   nothing breaks. Making RLS an *active* boundary requires the runtime to call
   `pod_set_tenant_context(tenantId)` on each pooled connection as a non-owner role — deferred to
   Phase 7.

## Risks & mitigations

- **Schema size** — `schema.prisma` grows; mitigate with the Spec-005 banner comment block and
  `spec.md` / `data-model.md` as the human index.
- **Migration drift on Supabase** (`auth.uid()` default drift, per memory) — apply with
  `migrate deploy`, never `migrate dev`; the migration is hand-authored and reviewed.
- **Trigger vs service double-work** — triggers own denormalized totals / version / activity ONLY;
  services never recompute those. Inventory posting is service-only. This boundary is the guardrail
  against double-posting.
- **Enum + lookup-status split** — two status mechanisms coexist by design; the split is documented
  so contributors don't "unify" them and break the Spec-002 state machine.
- **Approval engine complexity** — isolate routing as a pure `approval-engine.ts` with the richest
  unit-test surface; services only persist its decisions.

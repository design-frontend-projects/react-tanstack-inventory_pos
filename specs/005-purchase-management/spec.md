# Feature 005 — Enterprise Purchase Management

## Summary

Purchase Management is the **procure-to-pay (P2P) domain** of the platform: it takes a demand
signal (requisition), sources it (RFQ → quotation → award), commits to a supplier (purchase order),
receives and inspects goods (GRN + quality), captures the supplier's bill (supplier invoice with
3-way match), absorbs import/logistics cost into inventory valuation (landed cost), and settles the
liability (supplier payment + allocation), while keeping a running **AP subledger** (supplier
balance, aging, outstanding payables) and a generic, reusable **approval engine** over the whole
flow.

This is **not a greenfield build**. The repository already ships a working, integrated Spec-002
purchasing spine:

- Models: `suppliers`, `purchase_requisitions` (+lines), `purchase_orders` (+lines),
  `goods_receipts` (+lines), `purchase_returns` (+lines), `financial_notes` (debit/credit notes),
  `product_suppliers`.
- Services (`src/server/inventory/documents/*`), repos (`src/server/repos/*`), and server functions
  (`src/features/purchasing/*`), wired to document numbering (`document-number-service.ts`), a
  declarative state machine (`state-machine.ts`), audit logs (`audit-log-repo.ts`), a transactional
  event outbox (`event-outbox.ts` / `domain_events`), and the inventory movement/costing engine
  (`movement-engine.ts`, WAC/FIFO, lot/serial).
- RBAC: 7 `purchase.*` permissions, a `purchasing_officer` role, and unit tests.

Feature 005 **extends** that spine with the missing enterprise capabilities as new `pod_`-prefixed
tables and non-breaking column additions — it does **not** replace it. The Spec-002 documents
(`purchase_orders`, `goods_receipts`, …) keep their native Postgres enums and `state-machine.ts`;
the new `pod_` documents use admin-customizable **lookup-table statuses**
(`pod_document_statuses` + `pod_status_transitions`).

**Core principle.** Reuse before extend; extend before create. Inventory posting and costing stay
in the service layer (`movement-engine.ts`) — never in DB triggers. Triggers cover only
cross-cutting concerns (timestamps, optimistic-lock version bump, activity capture, denormalized
total recomputation) and reporting.

## Goals

- **Extend, don't duplicate.** Reuse `suppliers` / `purchase_orders` / `goods_receipts` /
  `purchase_requisitions` / `financial_notes` / `product_suppliers` as the spine; add only the
  enterprise gaps as `pod_` tables plus nullable/defaulted columns on the spine.
- **Full P2P lifecycle** — requisition → RFQ → quotation → award → purchase order → goods receipt +
  inspection → supplier invoice + 3-way match → landed cost → payment + allocation → returns /
  debit notes, each an auditable, transition-guarded document.
- **AP subledger without a GL.** Supplier invoices, payments, allocations, and a recomputed
  supplier running balance + aging — emitting domain events so a future double-entry GL can post
  journals with no schema change. No general ledger in this feature.
- **Generic, reusable approval engine.** Amount- and condition-based multi-step workflows
  (`pod_approval_workflows` → `pod_approval_workflow_steps` → `pod_approval_requests` →
  `pod_approval_actions`) usable by any module, with delegation and time-based escalation.
- **Admin-customizable lifecycles.** New document statuses and their allowed transitions live in
  lookup tables (`pod_document_statuses`, `pod_status_transitions`) so a tenant admin can tailor a
  lifecycle without a code deploy.
- **Multi-company / multi-branch ready.** Every transactional `pod_` table carries nullable
  `company_id` (→ `tenant_accounts`) and `branch_id` (operational unit, `warehouses` today) so a
  single-company tenant is the degenerate case of a multi-company group.
- **Reporting foundation** — reporting views (`pod_v_*`) and materialized views (`pod_mv_*`) for
  open POs, outstanding payables + aging, supplier balances, 3-way-match variance, supplier
  performance, spend analysis, and purchase price variance.
- **Defense-in-depth RLS.** RLS is `ENABLE`d (not `FORCE`d) on every `pod_` table via the
  `app.current_tenant_id` GUC; app-level tenant scoping remains the primary boundary.

## Non-goals (this feature)

- **A general ledger / double-entry accounting engine.** No GL exists yet. We deliver the AP
  subledger and the domain events (with accounting-relevant snapshots); journal posting is a future
  subscriber.
- **Services, server functions, and UI routes for the new `pod_` aggregates.** This pass delivers
  the **spec + DB foundation** (Prisma models, migration, RBAC/catalog wiring, event types, lookup
  seed). Repos/services/routes for RFQ, quotation, supplier invoice, payment, landed cost, and the
  approval engine are later phases (see `plan.md`).
- **A server-side notification dispatch layer.** Genuinely absent today — flagged as a gap. The
  approval engine models escalation timing (`escalate_after_hours`) but nothing dispatches
  reminders/emails yet.
- **Wiring the RLS GUC into the pooled runtime connection.** The `pod_set_tenant_context()` helper
  and policies exist; connecting the pooled Prisma runtime role to set the GUC per-request is
  deferred runtime work.
- **Replacing the Spec-002 enum documents.** `purchase_orders` / `goods_receipts` /
  `purchase_requisitions` keep their enums and `state-machine.ts`.
- **Full E2E tests.** Unit tests accompany later service phases; Playwright is out of scope here.

## Domain-driven design framing

The module is decomposed into aggregates, each with a consistency boundary (header + its lines /
satellites), a lifecycle, and — in later phases — a service that owns all writes inside one
`prisma.$transaction`.

| Aggregate | Root | Members | Lifecycle source | Status/reuse |
|-----------|------|---------|------------------|--------------|
| **Supplier** | `suppliers` (extended) | `pod_supplier_contacts`, `pod_supplier_addresses`, `pod_supplier_bank_accounts`, `product_suppliers` (reuse) | `suppliers.status_code` | Extend |
| **Requisition** | `purchase_requisitions` (extended) | `purchase_requisition_lines` | enum + `state-machine.ts` | Extend |
| **RFQ** | `pod_rfqs` | `pod_rfq_items`, `pod_rfq_suppliers` | `pod_document_statuses` (`rfq`) | New |
| **Quotation** | `pod_supplier_quotations` | `pod_supplier_quotation_items` | `pod_document_statuses` (`supplier_quotation`) | New |
| **PurchaseOrder** | `purchase_orders` (extended) | `purchase_order_lines` (extended, generated `remaining_qty`) | enum + `state-machine.ts` | Extend |
| **GoodsReceipt** | `goods_receipts` (extended) | `goods_receipt_lines` | enum + `state-machine.ts`; `inspection_status_code` | Extend |
| **SupplierInvoice** | `pod_supplier_invoices` | `pod_supplier_invoice_items`, `pod_supplier_invoice_matches` | `pod_document_statuses` (`supplier_invoice`) + `match_status_code` + `payment_status_code` | New |
| **DebitNote** | `financial_notes` (reuse) | `pod_debit_note_lines` | enum (financial note) | Reuse + new lines |
| **LandedCostVoucher** | `pod_landed_cost_vouchers` | `pod_landed_cost_charges`, `pod_landed_cost_allocations` | `pod_document_statuses` (`landed_cost`) | New |
| **SupplierPayment** | `pod_supplier_payments` | `pod_supplier_payment_allocations` | `pod_document_statuses` (`supplier_payment`) | New |
| **ApprovalRequest** | `pod_approval_requests` | `pod_approval_actions` (+ `pod_approval_workflows`/`_steps` config) | `pod_document_statuses` (`approval_request`) | New |

Cross-cutting, non-aggregate concerns reused/added: `audit_logs` (activity trail),
`domain_events` (outbox), `document_sequences` (numbering), `pod_attachments` (polymorphic files),
`pod_custom_field_definitions` / `pod_custom_field_values` (tenant custom fields), and the
status/classification lookup tables.

## The 32 sub-modules — reconciliation map

`R` = reuse existing as-is (FK, no new table) · `E` = extend in place (non-breaking columns) ·
`N` = new `pod_` table(s).

| # | Sub-module | Disposition | Backing table(s) |
|---|------------|-------------|------------------|
| 1 | Supplier master | E | `suppliers` (+`category_id`, `status_code`, `rating`, `lead_time_days`, `is_preferred`, `current_balance`, `tags`, `company_id`, `branch_id`, `version_number`, `created_by`/`updated_by`/`deleted_by`) |
| 2 | Supplier categories (hierarchical) | N | `pod_supplier_categories` |
| 3 | Supplier contacts | N | `pod_supplier_contacts` |
| 4 | Supplier addresses | N | `pod_supplier_addresses` |
| 5 | Supplier bank accounts | N | `pod_supplier_bank_accounts` |
| 6 | Supplier product catalog / price list | R | `product_suppliers` |
| 7 | Supplier rating & performance | E + N | `suppliers.rating` + `pod_mv_supplier_performance` |
| 8 | Purchase requisitions | E | `purchase_requisitions` (+`priority`, `required_date`, `department`, `source_type`, `branch_id`, `company_id`, `approval_request_id`) |
| 9 | Requisition sourcing (source_type) | E | `purchase_requisitions.source_type` |
| 10 | RFQ (request for quotation) | N | `pod_rfqs`, `pod_rfq_items` |
| 11 | RFQ supplier invitations | N | `pod_rfq_suppliers` |
| 12 | Supplier quotations | N | `pod_supplier_quotations`, `pod_supplier_quotation_items` |
| 13 | Quotation comparison & award | N | award columns on `pod_rfqs` (`awarded_supplier_id`, `awarded_quotation_id`) |
| 14 | Purchase orders | E | `purchase_orders` (+`branch_id`, `company_id`, `exchange_rate`, `incoterms`, `delivery_address_json`, `billing_address_json`, `buyer_profile_id`, `discount_total`, `approval_request_id`, `quotation_id`, `version_number`) |
| 15 | PO line fulfilment tracking | E | `purchase_order_lines` (+`rejected_qty`, `returned_qty`, `cancelled_qty`, `discount_pct`, `discount_amount`, `net_amount`, `gross_amount`, generated `remaining_qty`) |
| 16 | Goods receipts (GRN) | E | `goods_receipts` (+`inspection_status_code`, `branch_id`) |
| 17 | Quality inspection | E | `goods_receipts.inspection_status_code` |
| 18 | Purchase returns | R | `purchase_returns` (+lines) |
| 19 | Debit notes | R + N | `financial_notes` (header) + `pod_debit_note_lines` |
| 20 | Supplier invoices (AP bill) | N | `pod_supplier_invoices`, `pod_supplier_invoice_items` |
| 21 | 3-way match (PO ↔ GRN ↔ invoice) | N | `pod_supplier_invoice_matches` + `match_status_code` |
| 22 | Landed cost vouchers | N | `pod_landed_cost_vouchers` |
| 23 | Landed cost charges | N | `pod_landed_cost_charges` |
| 24 | Landed cost allocation | N | `pod_landed_cost_allocations` + `pod_allocate_landed_cost()` |
| 25 | Supplier payments | N | `pod_supplier_payments` |
| 26 | Payment allocations & advances | N | `pod_supplier_payment_allocations` (+`is_advance`, `unallocated_amount`) |
| 27 | Supplier balance & AP aging | N | `pod_recompute_supplier_balance()` + `pod_v_supplier_balances` + `pod_v_outstanding_payables` |
| 28 | Approval workflows (config) | N | `pod_approval_workflows`, `pod_approval_workflow_steps` |
| 29 | Approval requests & routing | N | `pod_approval_requests` |
| 30 | Approval history / actions | N | `pod_approval_actions` |
| 31 | Attachments (polymorphic) | N | `pod_attachments` |
| 32 | Custom fields | N | `pod_custom_field_definitions`, `pod_custom_field_values` |

Cross-cutting foundations that back the above: document numbering (R — `document-number-service.ts`
+ `DocumentType` enum values `rfq`, `supplier_quotation`, `supplier_invoice`, `supplier_payment`,
`landed_cost`), activity log (R — `audit_logs` via `pod_capture_activity()` trigger), events
(R — `domain_events`), status/lifecycle config (N — `pod_document_statuses`,
`pod_status_transitions`), classification lookups (N — `pod_return_reasons`, `pod_payment_methods`,
`pod_landed_cost_types`, `pod_incoterms`, `pod_debit_note_reasons`), inventory/costing (R —
`movement-engine.ts`), and reporting (N — `pod_v_*` views + `pod_mv_*` materialized views).

## User scenarios & testing *(mandatory)*

### User Story 1 (Priority: P1) — Procurement officer sources and awards a requisition

As a **procurement officer** holding `purchase.rfq_manage` and `purchase.quotation_award`, I turn an
approved requisition into an RFQ, invite suppliers, capture their quotations, compare them, and award
one — which stamps the RFQ and seeds a purchase order.

**Acceptance scenarios**
1. Given an approved `purchase_requisitions` row, when I create an RFQ from it, then a `pod_rfqs`
   row is created with `status_code = 'open'`, a unique `document_number` from the `rfq` sequence,
   and `pod_rfq_items` copied from the requisition lines.
2. Given an open RFQ with three invited suppliers (`pod_rfq_suppliers`), when each returns a
   `pod_supplier_quotations` with items, then each quotation's `grand_total` is recomputed by the
   `pod_recompute_quotation_totals` trigger from its `pod_supplier_quotation_items`.
3. Given three submitted quotations, when I award one, then the RFQ moves `open → awarded`
   (a transition present in `pod_status_transitions`), `awarded_supplier_id` /
   `awarded_quotation_id` are set, and the awarded quotation moves to `awarded`.
4. Given an RFQ past its `expiry_date` with no award, when the lifecycle is evaluated, then it may
   move `open → expired` (terminal) and no further quotations are accepted.

### User Story 2 (Priority: P1) — Buyer raises a purchase order under an approval threshold

As a **buyer** holding `purchase.order_manage`, I raise a PO (optionally from an awarded quotation).
If its value exceeds the configured threshold, it routes for approval before it can be issued.

**Acceptance scenarios**
1. Given an awarded quotation, when I create a PO from it, then `purchase_orders.quotation_id`,
   `exchange_rate`, `incoterms`, and buyer/company/branch context are populated and line
   `net_amount` / `gross_amount` / `remaining_qty` are derived.
2. Given a `pod_approval_workflows` row for `entity_type = 'purchase_order'` with
   `min_amount = 10000`, when I submit a PO of 25,000, then a `pod_approval_requests` is created
   (`status_code = 'pending'`, `current_step_order = 1`) and `purchase_orders.approval_request_id`
   is linked.
3. Given a pending approval request, when the step approver records an `approve` action in
   `pod_approval_actions` and it is the final step, then the request moves `pending → approved` and
   the PO may be issued.
4. Given a PO of 500 under a `min_amount = 10000` workflow (or an `auto_approve` workflow), when
   submitted, then no approval request is required and it may be issued directly.

### User Story 3 (Priority: P1) — Warehouse receives and inspects goods

As a **warehouse operator** holding `purchase.receipt_manage`, I receive goods against an issued PO,
record accepted/rejected quantities, and set an inspection outcome; inventory posting happens in the
service layer.

**Acceptance scenarios**
1. Given an issued PO with `remaining_qty > 0`, when I post a `goods_receipts` for part of a line,
   then `purchase_order_lines.received_qty` increases and the generated `remaining_qty`
   (`ordered − received − rejected − returned − cancelled`) decreases, and an `InventoryMovement` is
   written by `movement-engine.ts` (not by a trigger).
2. Given a receipt requiring inspection, when I set `goods_receipts.inspection_status_code`, then a
   downstream supplier invoice's 3-way match can reference the receipt line.
3. Given a rejected quantity, when recorded on the PO line (`rejected_qty`), then it is excluded
   from `remaining_qty` and available to a purchase return / debit note.

### User Story 4 (Priority: P1) — AP clerk captures a supplier invoice and runs 3-way match

As an **AP clerk** holding `purchase.invoice_manage` and `purchase.invoice_match`, I enter the
supplier's invoice, match it to the PO and GRN, and post it so it hits the supplier balance.

**Acceptance scenarios**
1. Given a supplier invoice draft with items, when items are inserted/updated, then the
   `pod_recompute_invoice_totals` trigger recomputes `subtotal`, `tax_total`, `discount_total`,
   `grand_total`, and `outstanding_amount` on `pod_supplier_invoices`.
2. Given invoice items linked to `purchase_order_line_id` / `goods_receipt_line_id`, when I run the
   match, then `pod_supplier_invoice_matches` rows capture `matched_qty`, `matched_amount`,
   `price_variance`, `qty_variance`, and `pod_three_way_match()` sets `match_status_code` to
   `matched` / `partially_matched` / `variance` / `unmatched` (0.01 tolerance).
3. Given a matched invoice, when I post it (`is_posted = true`), then
   `pod_recompute_supplier_balance()` raises `suppliers.current_balance` and the invoice appears in
   `pod_v_outstanding_payables` with the correct `aging_bucket`.
4. Given a price variance above tolerance, when matched, then `match_status_code = 'variance'` and
   the invoice can be routed to `disputed` (a transition in `pod_status_transitions`).

### User Story 5 (Priority: P2) — AP clerk pays and allocates against invoices

As an **AP clerk** holding `purchase.payment_manage`, I record a supplier payment and allocate it
across one or more posted invoices (or leave it as an unallocated advance).

**Acceptance scenarios**
1. Given two posted, outstanding invoices, when I create a `pod_supplier_payments` and add
   `pod_supplier_payment_allocations`, then each invoice's `paid_amount` rises and
   `outstanding_amount` falls, and `payment_status_code` becomes `partial` or `paid`.
2. Given a payment larger than the allocated total, when posted, then `unallocated_amount > 0` marks
   it a supplier advance (`is_advance`) and reduces the recomputed supplier balance.
3. Given a fully allocated, posted payment, when supplier balance is recomputed, then
   `pod_v_supplier_balances.total_outstanding` reflects the settlement.

### User Story 6 (Priority: P2) — Cost accountant applies landed cost

As a **cost accountant** holding `purchase.landed_cost_manage`, I create a landed-cost voucher for a
receipt, add charges (freight, duty, insurance), and allocate them across the received lines by a
chosen basis so inventory valuation reflects true cost.

**Acceptance scenarios**
1. Given a voucher with charges, when charges change, then `pod_recompute_voucher_charges` sums
   `amount + tax_amount` into `total_charges`.
2. Given allocation rows with `basis_value`, when `pod_allocate_landed_cost(voucher_id)` runs, then
   `allocated_amount` is distributed proportionally by basis and rounded to 4 dp.
3. Given an allocated voucher, when posted, then (later phase) the service layer revalues the
   affected inventory via `movement-engine.ts` — the DB only computes the allocation.

### User Story 7 (Priority: P2) — Approver acts on a routed document

As an **approver** holding `purchase.approval_action`, I see documents pending my step, approve /
reject / delegate them, and my action is recorded with an audit trail.

**Acceptance scenarios**
1. Given a `pod_approval_requests` at my `current_step_order`, when I approve, then a
   `pod_approval_actions` (`action_code = 'approve'`) is recorded and the request advances to the
   next step or to `approved` if final.
2. Given a step with `allow_delegate = true`, when I delegate, then `delegated_to_profile_id` is set
   and the request stays pending for the delegate.
3. Given a step with `escalate_after_hours` elapsed, when escalation runs (later phase), then the
   request may move `pending → escalated` (notification dispatch is a documented gap).

### User Story 8 (Priority: P3) — Admin customizes lifecycles and lookups

As a **tenant admin** holding `purchase.config_manage`, I add a custom status and transition, define
custom fields, and adjust classification lookups without a code deploy.

**Acceptance scenarios**
1. Given the global (`tenant_id IS NULL`) `pod_document_statuses` seed, when I insert a
   tenant-scoped status + `pod_status_transitions` row, then my tenant's document lifecycle honors it
   while other tenants are unaffected.
2. Given a `pod_custom_field_definitions` for `entity_type = 'supplier'`, when a value is stored in
   `pod_custom_field_values`, then it is uniquely keyed by `(tenant_id, definition_id, entity_id)`.

### Edge cases

- Invoice matched to a receipt line that was later reversed → variance surfaces via
  `pod_v_three_way_match_variance`; posting is blocked at the service layer until re-matched.
- Payment allocation exceeding an invoice's `outstanding_amount` → rejected at the service layer;
  allocation rows never over-apply.
- A `pod_` document transition not present in `pod_status_transitions` → rejected (the lookup-table
  analogue of `assertTransition`); nothing is written.
- Landed-cost allocation when total `basis_value = 0` → `pod_allocate_landed_cost` no-ops (guarded)
  rather than dividing by zero.
- Cross-tenant read attempt by a non-owner role with the GUC set to another tenant → RLS policy
  blocks it (defense-in-depth); the app-level tenant filter is still the primary guard.
- Deleting a tenant → all `pod_` rows cascade via the `tenant_id` FK.

## Requirements *(mandatory)*

### Functional requirements

- **FR-001** Every transactional `pod_` table MUST carry `tenant_id` with a cascading `tenant`
  relation; lookup tables MAY carry `tenant_id NULL` for global defaults; all reads MUST be
  tenant-scoped at the app layer.
- **FR-002** New `pod_` documents MUST store status as a `status_code` string validated against
  `pod_document_statuses`, with transitions constrained to rows in `pod_status_transitions`
  (`entity_type`, `from_code`, `to_code`). Spec-002 documents MUST keep their native enums.
- **FR-003** Document numbering for new `pod_` documents MUST reuse `document-number-service.ts` with
  the additive `DocumentType` values `rfq`, `supplier_quotation`, `supplier_invoice`,
  `supplier_payment`, `landed_cost`; `document_number` MUST be unique per `(tenant_id,
  document_number)`.
- **FR-004** Extensions to spine tables MUST be non-breaking (nullable or defaulted); no existing
  column may change type or nullability.
- **FR-005** `purchase_order_lines.remaining_qty` MUST be a STORED generated column
  (`ordered_qty − received_qty − rejected_qty − returned_qty − cancelled_qty`) and MUST never be
  written by the app.
- **FR-006** Supplier-invoice, quotation, and landed-cost header totals MUST be recomputed from their
  lines by DB triggers; the app MUST NOT hand-maintain those denormalized totals.
- **FR-007** 3-way match MUST record per-line `matched_qty`, `matched_amount`, `price_variance`,
  `qty_variance` and set `match_status_code` via `pod_three_way_match()` with a 0.01 tolerance.
- **FR-008** Supplier balance MUST be recomputed as posted-invoice outstanding minus unallocated
  advances via `pod_recompute_supplier_balance()`; the app MUST NOT hand-write
  `suppliers.current_balance`.
- **FR-009** Landed-cost charges MUST allocate across lines proportionally to `basis_value` via
  `pod_allocate_landed_cost()`; inventory revaluation MUST occur in the service layer, not in a
  trigger.
- **FR-010** The approval engine MUST support amount- and condition-scoped multi-step workflows with
  role- or profile-targeted steps, delegation, and escalation timing; every action MUST be recorded
  in `pod_approval_actions`.
- **FR-011** Inventory posting and costing MUST remain in `movement-engine.ts`; triggers MUST be
  limited to `updated_at`, `version_number`, activity capture, and total recomputation.
- **FR-012** Every `pod_` table MUST have RLS `ENABLE`d with a `tenant_isolation` policy using
  `app.current_tenant_id`; global lookup rows (`tenant_id IS NULL`) MUST remain readable.
- **FR-013** Every new server function (later phases) MUST chain
  `getCurrentUserContext → requireTenantAccess → requirePermission`, validate input with Zod, and
  write inside a single `prisma.$transaction`.
- **FR-014** Every new `purchase.*` permission MUST be registered in `rbac-catalog.ts` and linked in
  `module-catalog.ts` (total `PERMISSION_LINKS` record) and seeded via `prisma/seed.ts`.
- **FR-015** AP state changes MUST emit `domain_events` (`supplier_invoice.*`, `supplier_payment.*`,
  `landed_cost.*`, `approval.*`, `rfq.*`, `supplier_quotation.*`) with Decimal-as-string payloads
  sufficient for a future GL subscriber.

### Key entities

Status/lookup (`pod_document_statuses`, `pod_status_transitions`, `pod_supplier_categories`,
`pod_return_reasons`, `pod_payment_methods`, `pod_landed_cost_types`, `pod_incoterms`,
`pod_debit_note_reasons`), Supplier CRM (`pod_supplier_contacts`, `pod_supplier_addresses`,
`pod_supplier_bank_accounts`), Sourcing (`pod_rfqs`, `pod_rfq_items`, `pod_rfq_suppliers`,
`pod_supplier_quotations`, `pod_supplier_quotation_items`), Approval (`pod_approval_workflows`,
`pod_approval_workflow_steps`, `pod_approval_requests`, `pod_approval_actions`), AP
(`pod_supplier_invoices`, `pod_supplier_invoice_items`, `pod_supplier_invoice_matches`,
`pod_debit_note_lines`, `pod_landed_cost_vouchers`, `pod_landed_cost_charges`,
`pod_landed_cost_allocations`, `pod_supplier_payments`, `pod_supplier_payment_allocations`),
Cross-cutting (`pod_attachments`, `pod_custom_field_definitions`, `pod_custom_field_values`), plus
the extended spine (`suppliers`, `purchase_requisitions`, `purchase_orders`, `purchase_order_lines`,
`goods_receipts`).

## Success criteria

- `pnpm prisma validate` parses the schema; the hand-authored migration applies cleanly via
  `pnpm prisma migrate deploy` and `pnpm prisma generate` produces a type-correct client.
- `pnpm db:seed` seeds the new `purchase.*` permissions and the global lookup/status data; a
  cross-tenant `SELECT` is blocked when the GUC is set to another tenant.
- A spot-check of `pod_v_outstanding_payables`, a matview refresh via
  `pod_refresh_reporting_matviews()`, and a trigger firing (`updated_at` / `version_number` bump on a
  test row) all succeed.
- `pnpm smoke` (lint + typecheck + vitest) is green, including the updated catalog assertion and a
  new `purchase-management-catalog.test.ts`.
- Adding a custom document status + transition for one tenant requires only inserting lookup rows —
  no deploy.

## Assumptions

- The single `prisma/schema.prisma` continues to hold all models.
- **Company = `TenantAccount`; operational branch = `Warehouse`.** No generic Company/Branch entity
  is invented; `company_id` / `branch_id` are nullable scalar UUIDs for future multi-company/branch.
- App-level tenant scoping stays the primary isolation boundary; RLS is defense-in-depth until the
  pooled runtime connection sets the GUC.
- Inventory/costing invariants stay owned by `movement-engine.ts`; landed cost and receipts call it
  at the service layer in later phases.
- The `domain_events` outbox and existing proj(numbering/audit/state-machine) infra are the
  integration substrate; Purchase Management adds event types and lookup data, not new infrastructure.

## Glossary

- **P2P (procure-to-pay)** — the end-to-end flow from requisition to supplier payment.
- **RFQ** — Request for Quotation; a solicitation sent to invited suppliers.
- **Quotation** — a supplier's priced response to an RFQ.
- **PO (purchase order)** — a committed order to a supplier.
- **GRN (goods receipt note)** — record of goods physically received against a PO.
- **3-way match** — reconciliation of PO ↔ GRN ↔ supplier invoice on quantity and price within
  tolerance.
- **AP subledger** — the accounts-payable ledger of supplier invoices, payments, allocations, and
  balances that feeds (a future) GL, without being a double-entry ledger itself.
- **Landed cost** — freight/duty/insurance/handling charges allocated onto received goods to reflect
  true inventory cost.
- **Allocation** — assigning a payment (or advance) to specific invoices, or a landed-cost charge to
  specific lines.
- **Debit note** — a claim raised against a supplier (price difference, shortage, damage);
  header on `financial_notes`, lines on `pod_debit_note_lines`.
- **Approval request** — an instance of a workflow raised against a document, routed through steps.
- **Incoterms** — standardized international trade delivery terms (EXW, FOB, CIF, DDP, …).
- **GUC** — Postgres "grand unified configuration" runtime setting; here `app.current_tenant_id`
  drives RLS.
- **Matview** — materialized view; a precomputed reporting snapshot refreshed on a schedule.
- **`pod_`** — table prefix for the new Purchase-Order/Procurement enterprise layer (Spec 005).

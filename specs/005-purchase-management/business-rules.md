# Business Rules — Purchase Management (Spec 005)

Validation and business rules per aggregate, the state-transition contract, and the mapping from
rule violations to the app's `DomainError` subclasses (`src/server/auth/errors.ts`:
`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`,
`ServiceUnavailableError`). Where a rule is enforced by the DB (CHECK constraint, generated column,
trigger, or lookup unique) it is noted; the service layer validates the same rule ahead of time to
return a friendly `DomainError` rather than a raw Postgres error.

Throughout: **all tenant-scoped server functions chain the guards**
`requireAuth → requireTenantAccess → requirePermission` before any read/write. A missing guard is a
cross-tenant leak, since app-level scoping is the primary isolation boundary (RLS is
defense-in-depth only until the runtime GUC is wired).

---

## Cross-cutting rules

### Optimistic locking (`version_number`)

- Every transactional `pod_*` header (`pod_rfqs`, `pod_supplier_quotations`,
  `pod_supplier_invoices`, `pod_supplier_payments`, `pod_landed_cost_vouchers`,
  `pod_approval_requests`) carries `version_number INTEGER DEFAULT 1`.
- The DB trigger `pod_bump_version()` (BEFORE UPDATE) sets `version_number = OLD.version_number + 1`
  and touches `updated_at`.
- Every update mutation must include the client-held `version_number` in its `WHERE` clause. A
  zero-row update means a concurrent writer won → raise **`ConflictError`** (stale write).
- The app never sets `version_number` itself on update — the trigger owns it.

### Soft delete

- Masters/headers with `deleted_at` are soft-deleted: set `deleted_at`, `deleted_by`,
  `is_active = false`; never hard-delete.
- Reads default to `deleted_at IS NULL`. Referencing a soft-deleted row from a new document →
  **`ValidationError`**.
- Line/child rows have no `deleted_at`; they cascade-delete with their header (real FK). Replacing
  lines on an editable header is delete-and-reinsert inside the header's transaction.
- A document that is `posted`/`awarded`/terminal cannot be soft-deleted → **`ConflictError`**.

### Tenant / company / branch scope

- `tenant_id` is mandatory and enforced by FK + guard. `company_id` defaults to the tenant;
  `branch_id` is the operational unit (a warehouse today) and is app-enforced.
- Any scalar reference (`supplier_id`, `product_id`, `purchase_order_id`, …) must resolve to a row
  **in the same tenant**; a mismatch → **`ValidationError`** (or **`NotFoundError`** if absent).

### Numbering & idempotency

- `document_number` is issued atomically from `document_sequences` via the `DocumentType` values
  `rfq`/`supplier_quotation`/`supplier_invoice`/`supplier_payment`/`landed_cost`, inside the create
  transaction.
- `(tenant_id, document_number)` is UNIQUE per document table; a collision → **`ConflictError`**.
- `correlation_id` deduplicates retried commands; a repeat with the same `correlation_id` returns
  the original result rather than creating a duplicate.

### Activity trail

- The `pod_capture_activity()` trigger writes an `audit_logs` row
  (`action_key = '<table>.<op>'`, `old_values`/`new_values` JSON) on every insert/update/delete of
  the five document headers, complementing the service-layer audit.

---

## State-transition rules (`pod_status_transitions`)

New `pod_*` documents store `status_code` and may only move along an edge that exists in
`pod_status_transitions` for that `entity_type` (tenant row if present, else the global default).

**Transition algorithm (service layer):**

1. Load the current `status_code`.
2. Look up `(entity_type, from_code = current, to_code = target)` in `pod_status_transitions`
   scoped to the tenant, falling back to `tenant_id IS NULL`.
3. If no such edge → **`ConflictError`** (illegal transition).
4. If the edge's `requires_permission` is set and the actor lacks it → **`ForbiddenError`**.
5. If the target status in `pod_document_statuses` is `is_terminal`, no further transition is
   allowed afterwards.
6. Apply the transition and any side effects atomically; bump `version_number`.

Seeded legal edges (global) — see `data-model.md` for the full list. Summary:

| entity_type | legal edges |
|---|---|
| `rfq` | open→{awarded, expired, cancelled} |
| `supplier_quotation` | draft→submitted→under_review→{approved→awarded, rejected}; submitted→expired; draft→cancelled |
| `supplier_invoice` | draft↔pending_approval→approved→{posted, disputed↔approved}; draft→cancelled |
| `supplier_payment` | draft→pending_approval→approved→posted; draft→cancelled |
| `landed_cost` | draft→allocated→posted; draft→cancelled |
| `approval_request` | pending→{approved, rejected, escalated, cancelled}; escalated→{approved, rejected} |

---

## Aggregate: RFQ (`pod_rfqs` + items + suppliers)

- An RFQ must have ≥ 1 item (`pod_rfq_items`) and ≥ 1 invited supplier (`pod_rfq_suppliers`) before
  it can be issued/awarded → else **`ValidationError`**.
- `pod_rfq_items.quantity >= 0` (DB CHECK); a negative/zero required quantity → **`ValidationError`**.
- A supplier may be invited to an RFQ at most once: `(tenant_id, rfq_id, supplier_id)` UNIQUE →
  duplicate invite → **`ConflictError`**.
- Awarding sets `awarded_supplier_id` + `awarded_quotation_id` and moves `open → awarded`; the
  awarded quotation must belong to an invited supplier and to this RFQ → else **`ValidationError`**.
- Only `open` RFQs accept quotations; a quotation against a non-open RFQ → **`ConflictError`**.

## Aggregate: Supplier quotation (`pod_supplier_quotations` + items)

- `pod_supplier_quotation_items.quantity >= 0` (DB CHECK); `unit_price >= 0` (service) →
  **`ValidationError`**.
- **Line net computation** (service, mirrored by the header-totals trigger):
  `line_discount = discount_amount` (or `unit_price * quantity * discount_pct` when `discount_pct`
  is given); `net_amount = unit_price * quantity − line_discount`; `tax_amount` from `tax_rate_id`.
- **Header totals** are recomputed by `pod_recompute_quotation_totals()` from the items:
  `subtotal = Σ net_amount`, `tax_total = Σ tax_amount`, `discount_total = Σ discount_amount`,
  `grand_total = subtotal + tax_total + freight_amount + insurance_amount − discount_total`. The app
  must not hand-set these on the header.
- `valid_until` in the past blocks award → quotation auto-`expired`; awarding an expired quotation →
  **`ConflictError`**.
- Award → PO: awarding stamps `purchase_orders.quotation_id`; the generated PO copies quotation
  currency/exchange rate/lines.

## Aggregate: Approval engine (`pod_approval_*`)

- **Routing by amount:** when a document needs approval, pick the active
  `pod_approval_workflows` for its `entity_type` whose `[min_amount, max_amount]` band contains the
  document amount (in the workflow's currency). If none matches and no default exists →
  **`ValidationError`** (unroutable). If `auto_approve` is set, the request is created already
  `approved`.
- Steps run in `step_order`; `pod_approval_requests.current_step_order` tracks progress.
- An actor may act on the current step only if they hold `approver_role_code` or are the named
  `approver_profile_id` (or a valid delegate when `allow_delegate`) → else **`ForbiddenError`**.
- Each action is appended to `pod_approval_actions` (immutable history). Re-acting on an already
  completed request → **`ConflictError`**.
- Reaching a step flagged `is_final` with an approve action completes the request
  (`status → approved`, `completed_at` set) and unblocks the source document's transition.
- `escalate_after_hours` elapsed without action → `pending → escalated` (background job); escalation
  routes to the escalation approver.
- A reject at any step → `status → rejected` (terminal); the source document returns to its editable
  state (e.g. invoice `pending_approval → draft`).

## Aggregate: Supplier invoice + 3-way match (`pod_supplier_invoices`)

- DB CHECKs: `grand_total >= 0`, `paid_amount >= 0`; violations surface as **`ValidationError`**.
- **Line net:** `net_amount = unit_price * quantity − discount_amount`; `tax_amount` from
  `tax_rate_id`.
- **Header totals** recomputed by `pod_recompute_invoice_totals()`:
  `subtotal = Σ net_amount`, `tax_total = Σ tax_amount`, `discount_total = Σ discount_amount`;
  `grand_total = subtotal + tax_total + freight_amount − discount_total − retention_amount −
  withholding_tax_amount`; `outstanding_amount = grand_total − paid_amount`. App must not hand-set.
- **Three-way match** (`pod_three_way_match()`, tolerance **0.01**): from the
  `pod_supplier_invoice_matches` rows, `match_status_code` is set to:
  - `unmatched` when nothing is matched;
  - `variance` when `Σ|price_variance| > 0.01`;
  - `matched` when `Σ matched_amount >= grand_total − 0.01`;
  - `partially_matched` otherwise.
- A match row must reference a PO line and/or GRN line belonging to the same supplier/PO as the
  invoice; matched quantity cannot exceed the receipted quantity for that GRN line →
  **`ValidationError`**.
- **Posting** requires `status_code = approved` and (per tenant policy) `match_status_code IN
  ('matched','partially_matched')`; posting sets `is_posted = true`, `posted_at`,
  `posted_by_profile_id`, transitions `approved → posted`, then triggers
  `pod_recompute_supplier_balance`. Posting a `variance`/`unmatched` invoice without override →
  **`ConflictError`**. Re-posting an already posted invoice → **`ConflictError`**.
- A posted invoice is immutable except via credit/debit note or dispute
  (`posted`… `approved → disputed`).

## Aggregate: Debit note lines (`pod_debit_note_lines`)

- The header is a reused `financial_notes` row of debit type; `financial_note_id` must resolve in
  the same tenant → else **`NotFoundError`**.
- `amount` is required; `reason_id` (if given) must reference an active `pod_debit_note_reasons`
  row → else **`ValidationError`**.
- A debit line raised against a return references `purchase_return_id`; the returned quantity must
  not exceed the receipted quantity → **`ValidationError`**.

## Aggregate: Landed cost (`pod_landed_cost_vouchers`)

- A voucher must reference at least a `goods_receipt_id` (or PO / supplier invoice) and have ≥ 1
  charge → else **`ValidationError`**.
- `pod_landed_cost_charges.amount` is required; `total_charges` is recomputed by
  `pod_recompute_voucher_charges()` as `Σ(amount + tax_amount)`. App must not hand-set.
- **Allocation by basis** (`pod_allocate_landed_cost(voucher_id)`): with
  `total = total_charges` and `basis = Σ basis_value` across allocation rows, each row's
  `allocated_amount = round(total * basis_value / basis, 4)`. `basis_value` is filled from the
  voucher's `allocation_basis` (`value` = line value, `weight`, `quantity`). If `Σ basis_value = 0`
  the allocation is skipped → **`ValidationError`** (no basis to allocate on).
- Rounding residue (`total − Σ allocated_amount`) is assigned to the largest allocation line so the
  allocation is penny-exact.
- Transition `draft → allocated` runs the allocation; `allocated → posted` applies the landed cost
  to inventory unit cost via the costing engine (service layer, later phase) — never in a trigger.
  Re-posting → **`ConflictError`**.

## Aggregate: Supplier payment (`pod_supplier_payments`)

- DB CHECK `amount >= 0`; violation → **`ValidationError`**.
- Invariant: `allocated_amount + unallocated_amount = amount`. An over-allocation
  (`Σ pod_supplier_payment_allocations.allocated_amount > amount`) → **`ValidationError`**.
- Each allocation cannot exceed the target invoice's `outstanding_amount` (or note balance) →
  **`ValidationError`**; on allocation the invoice `paid_amount`/`outstanding_amount` and
  `payment_status_code` (`unpaid → partially_paid → paid`) are updated in the same transaction.
- An advance payment (`is_advance = true`) may be created with `unallocated_amount = amount` and
  allocated later.
- Posting sets `is_posted`, transitions `approved → posted`, and triggers
  `pod_recompute_supplier_balance`. Re-posting → **`ConflictError`**.

## Purchase order line invariants (extended spine)

- **`remaining_qty` is a STORED generated column** = `ordered_qty − received_qty − rejected_qty −
  returned_qty − cancelled_qty`; the app never writes it. Any service computation must read it, not
  recompute it.
- Invariant (service-enforced): `received_qty + rejected_qty + returned_qty + cancelled_qty <=
  ordered_qty`, i.e. `remaining_qty >= 0`. A receipt/return/cancel that would drive it negative →
  **`ConflictError`** (over-receipt / over-return).
- **Line net/gross:** `gross_amount = unit_cost * ordered_qty`;
  `net_amount = gross_amount − discount_amount` (with `discount_amount = gross_amount *
  discount_pct` when `discount_pct` is supplied).
- Partial receiving/invoicing/payment is allowed and normal: a PO stays open while
  `Σ remaining_qty > 0`; an invoice may cover a subset of received lines; a payment may partially
  settle an invoice. Fully consumed documents transition to their closed/terminal state.

## Supplier balance rule

- `suppliers.current_balance` is maintained by `pod_recompute_supplier_balance(tenant_id,
  supplier_id)`:
  `current_balance = Σ outstanding_amount of posted invoices − Σ unallocated_amount of posted
  advance payments`.
- It is recomputed after posting/allocating invoices and payments; it is a denormalized cache, never
  authored directly by the app. `pod_v_supplier_balances` exposes the same figure alongside open
  invoice counts.

---

## Error-handling map

| Rule violated | Example | DomainError |
|---|---|---|
| Missing/invalid session token | no `accessToken` or expired | `UnauthorizedError` |
| Actor lacks permission for the action | no `purchase.invoice_manage`; step approver mismatch; `requires_permission` on a transition | `ForbiddenError` |
| Referenced entity not found in tenant | unknown `supplier_id`, `financial_note_id`, invoice id | `NotFoundError` |
| Input fails schema/business validation | negative qty/amount (also DB CHECK), empty RFQ items, over-allocation, unroutable approval, allocation with zero basis, cross-tenant reference | `ValidationError` |
| State/concurrency conflict | illegal `status_code` transition, stale `version_number`, duplicate `document_number`, duplicate RFQ supplier invite, re-post, over-receipt (`remaining_qty` < 0), posting a `variance` invoice | `ConflictError` |
| Downstream dependency unavailable | numbering / external service failure | `ServiceUnavailableError` |

**Notes:**

- DB CHECK constraints (`quantity >= 0`, `grand_total >= 0`, `paid_amount >= 0`, `amount >= 0`) and
  UNIQUE constraints are the last line of defense; the service validates first and raises the mapped
  `DomainError` so the UI never sees a raw Postgres error.
- `ConflictError` is the canonical mapping for both optimistic-lock failures and illegal state
  transitions — both are "the world changed / the move isn't allowed from here".
- Every error carries a stable machine `code` and a user-facing message (see `errors.ts`); server
  logs retain full context, and messages never leak cross-tenant data.

# Data Model — Purchase Management (Spec 005)

The authoritative schema is `prisma/schema.prisma` (search `Spec 005`) and the migration
`prisma/migrations/20260717090000_purchase_management_enterprise_v1/migration.sql`. This document
tracks the enterprise procurement domain model: every new `pod_*` table, the non-breaking additions
to the Spec-002 spine, the status-lookup approach, and the reused/extended entity map.

Spec 005 **extends** the Spec-002 purchasing spine rather than replacing it. The spine
(`suppliers`, `purchase_requisitions`, `purchase_orders`, `goods_receipts`, `purchase_returns`,
`financial_notes`) keeps its native Postgres enums and `state-machine.ts` engine. New enterprise
capabilities land as `pod_*` tables that use **lookup-table statuses**
(`pod_document_statuses` + `pod_status_transitions`) instead of enums, so tenant admins can
customize lifecycles without code changes.

---

## Conventions

### Numeric precision (fixed across the module)

| Concept | Type | Columns (examples) |
|---|---|---|
| Money / amounts | `DECIMAL(19,4)` | `grand_total`, `net_amount`, `allocated_amount`, `discount_total`, `current_balance` |
| Unit cost / price | `DECIMAL(19,6)` | `unit_price`, `unit_cost` |
| Quantity | `DECIMAL(18,4)` | `quantity`, `matched_qty`, `remaining_qty`, `ordered_qty` |
| Rate / percentage | `DECIMAL(9,6)` | `discount_pct` |
| Exchange rate | `DECIMAL(19,8)` | `exchange_rate` |
| Supplier rating | `DECIMAL(3,2)` | `suppliers.rating` |

### Foreign-key strategy (matches the existing schema convention)

Only **two** kinds of relationship are real DB foreign keys:

1. **Tenant scope** — every `pod_*` table has `tenant_id → tenant_accounts(id)`
   `ON DELETE CASCADE ON UPDATE CASCADE`. On the lookup tables that allow global rows
   (`tenant_id` nullable) the FK is still present but nullable.
2. **Header → line composition** — a line/child table references its own header with a real FK
   and `ON DELETE CASCADE` (listed per table below).

**Every other reference is a bare scalar `UUID` column with app-enforced integrity** (no
`@relation`, no DB FK): all cross-aggregate and lookup references — `supplier_id`, `product_id`,
`variant_id`, `uom_id`, `tax_rate_id`, `warehouse_id`, `purchase_order_id`, `goods_receipt_id`,
`purchase_order_line_id`, `goods_receipt_line_id`, `financial_note_id`, `purchase_return_id`,
`requisition_id`, `category_id`, `parent_id`, `cost_type_id`, `payment_method_id`,
`bank_account_id`, `supplier_invoice_id`, `workflow_id` (on requests), `buyer_profile_id`,
`approved_by_profile_id`, `posted_by_profile_id`, `*_profile_id`, and the polymorphic
`entity_type`/`entity_id` pairs. Services enforce these via the guard chain and repos.

### Audit-column standard

Transactional `pod_*` document headers carry the full audit column set:

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | `UUID NOT NULL` | tenant scope (real FK) |
| `company_id` | `UUID` (nullable) | future multi-company; defaults to tenant (`tenant_accounts`) |
| `branch_id` | `UUID` (nullable) | operational unit (warehouse today); app-enforced |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | soft toggle |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | optimistic lock, bumped by `pod_bump_version()` trigger |
| `created_at` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `updated_at` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | touched by trigger |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor profile ids (scalar) |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

**Line/child tables** are append-composed with the header and carry only `id`, `tenant_id`,
their header FK, and `created_at` (no `updated_at`/`version_number`/soft-delete of their own — they
live and die with the header via cascade). **Lookup tables** carry `created_at`/`updated_at`
(+ `deleted_at` on `pod_supplier_categories`) but no version/soft-delete columns.

---

## Status lookup approach (`pod_document_statuses` + `pod_status_transitions`)

New `pod_*` documents store their status as a denormalized `status_code TEXT` column (e.g.
`pod_supplier_invoices.status_code DEFAULT 'draft'`). Legal codes and legal transitions live in two
admin-customizable lookup tables. This is the lookup-table analogue of the enum state machine used
by the Spec-002 docs.

### `pod_document_statuses`

Purpose: the catalog of valid statuses per `entity_type`. Rows with `tenant_id IS NULL` are global
defaults (seeded in the migration); a tenant admin may add tenant-scoped rows to customize.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = global default; FK → `tenant_accounts` |
| `entity_type` | `TEXT NOT NULL` | e.g. `rfq`, `supplier_invoice`, `approval_request` |
| `code` | `TEXT NOT NULL` | status code (e.g. `draft`, `posted`) |
| `name` | `TEXT NOT NULL` | display label |
| `sort_order` | `INT DEFAULT 0` | ordering in UI |
| `is_initial` | `BOOLEAN DEFAULT false` | the entry status |
| `is_terminal` | `BOOLEAN DEFAULT false` | no outgoing transitions |
| `color` | `TEXT` (nullable) | UI hint |
| `is_active` | `BOOLEAN DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3)` | |

- **Unique:** `(tenant_id, entity_type, code)` → `pod_document_statuses_scope_unique`.
- **Index:** `(tenant_id, entity_type)`.

### `pod_status_transitions`

Purpose: the allowed `from_code → to_code` edges per `entity_type`, optionally gated by a permission.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = global default; FK → `tenant_accounts` |
| `entity_type` | `TEXT NOT NULL` | |
| `from_code` / `to_code` | `TEXT NOT NULL` | transition edge |
| `requires_permission` | `TEXT` (nullable) | permission code gating the transition |
| `created_at` | `TIMESTAMP(3)` | |

- **Unique:** `(tenant_id, entity_type, from_code, to_code)` → `pod_status_transitions_scope_unique`.
- **Index:** `(tenant_id, entity_type)`.

### Seeded statuses (global, `tenant_id = NULL`)

| entity_type | codes (initial → … → terminal*) |
|---|---|
| `rfq` | `open`* init, `awarded`, `expired`†, `cancelled`† |
| `supplier_quotation` | `draft`* init, `submitted`, `under_review`, `approved`, `rejected`†, `expired`†, `awarded`, `cancelled`† |
| `supplier_invoice` | `draft`* init, `pending_approval`, `approved`, `posted`, `disputed`, `cancelled`† |
| `supplier_payment` | `draft`* init, `pending_approval`, `approved`, `posted`, `cancelled`† |
| `landed_cost` | `draft`* init, `allocated`, `posted`, `cancelled`† |
| `approval_request` | `pending`* init, `escalated`, `approved`†, `rejected`†, `cancelled`† |

(† = `is_terminal`; * = `is_initial`.)

### Seeded transitions (global)

| entity_type | edges |
|---|---|
| `rfq` | `open→awarded`, `open→expired`, `open→cancelled` |
| `supplier_quotation` | `draft→submitted`, `submitted→under_review`, `under_review→approved`, `under_review→rejected`, `approved→awarded`, `submitted→expired`, `draft→cancelled` |
| `supplier_invoice` | `draft→pending_approval`, `pending_approval→approved`, `pending_approval→draft`, `approved→posted`, `approved→disputed`, `disputed→approved`, `draft→cancelled` |
| `supplier_payment` | `draft→pending_approval`, `pending_approval→approved`, `approved→posted`, `draft→cancelled` |
| `landed_cost` | `draft→allocated`, `allocated→posted`, `draft→cancelled` |
| `approval_request` | `pending→approved`, `pending→rejected`, `pending→escalated`, `escalated→approved`, `escalated→rejected`, `pending→cancelled` |

---

## Reused entities (Spec-002 spine and inventory core)

Referenced by bare scalar UUID (app-enforced) unless noted. No new table is created for these.

| Entity | Table | How referenced by Spec 005 |
|---|---|---|
| Supplier (spine, extended) | `suppliers` | `supplier_id` on RFQ/quotation/invoice/payment/charge; extended in place (below) |
| Purchase requisition | `purchase_requisitions` | `requisition_id` on `pod_rfqs`; extended in place |
| Purchase order (header) | `purchase_orders` | `purchase_order_id` on invoice/landed-cost; extended in place |
| Purchase order line | `purchase_order_lines` | `purchase_order_line_id` on invoice item/match/landed-cost alloc; extended (+ generated `remaining_qty`) |
| Goods receipt | `goods_receipts` | `goods_receipt_id` on landed-cost voucher; extended in place |
| Goods receipt line | `goods_receipt_lines` | `goods_receipt_line_id` on invoice item/match/landed-cost alloc |
| Purchase return | `purchase_returns` | `purchase_return_id` on `pod_debit_note_lines` |
| Financial note (debit/credit note header) | `financial_notes` | `financial_note_id` on `pod_debit_note_lines` + payment allocations |
| Product / variant | `products`, `product_variants` | `product_id`, `variant_id` on RFQ/quotation/invoice/landed-cost lines |
| Unit of measure | `units_of_measure` | `uom_id` on RFQ/quotation/invoice lines |
| Tax rate | `tax_rates` | `tax_rate_id` on quotation/invoice items |
| Warehouse | `warehouses` | `warehouse_id` on `pod_rfqs`; operational `branch_id` today |
| Lots / serials | `lots`, `serial_numbers` | inventory posting (service layer, later phase) |
| Inventory movements | `inventory_movements` | landed-cost re-costing (service layer, later phase) |
| Document numbering | `document_sequences` | numbering via `DocumentType` values `rfq`, `supplier_quotation`, `supplier_invoice`, `supplier_payment`, `landed_cost` |
| Audit trail | `audit_logs` | written by the `pod_capture_activity()` trigger and the service layer |
| Domain events | `domain_events` | AP/procurement events emitted by services (later phase) |
| Tenant | `tenant_accounts` | real FK `tenant_id` on every `pod_*` table |

### `DocumentType` enum additions (additive only)

`rfq`, `supplier_quotation`, `supplier_invoice`, `supplier_payment`, `landed_cost` — added via
`ALTER TYPE ... ADD VALUE IF NOT EXISTS` so numbering can issue document numbers for the new docs.

---

## Non-breaking extensions to the spine

All additions are nullable or defaulted (non-breaking). Columns are added with
`ADD COLUMN IF NOT EXISTS`.

### `suppliers`

| Column | Type | Notes |
|---|---|---|
| `category_id` | `UUID` (nullable) | scalar → `pod_supplier_categories` |
| `status_code` | `TEXT NOT NULL DEFAULT 'active'` | supplier lifecycle (lookup-style code) |
| `rating` | `DECIMAL(3,2)` (nullable) | supplier score |
| `lead_time_days` | `INTEGER` (nullable) | default lead time |
| `is_preferred` | `BOOLEAN NOT NULL DEFAULT false` | |
| `current_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | AP running balance (maintained by `pod_recompute_supplier_balance`) |
| `tags` | `JSONB` (nullable) | |
| `company_id` / `branch_id` | `UUID` (nullable) | multi-company/branch |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |

New index: `suppliers_tenant_category_idx (tenant_id, category_id)`.

### `purchase_requisitions`

| Column | Type | Notes |
|---|---|---|
| `priority` | `TEXT` (nullable) | |
| `required_date` | `TIMESTAMP(3)` (nullable) | |
| `department` | `TEXT` (nullable) | |
| `source_type` | `TEXT` (nullable) | warehouse/restaurant/retail/production/maintenance/office/department |
| `branch_id` / `company_id` | `UUID` (nullable) | |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |

### `purchase_orders`

| Column | Type | Notes |
|---|---|---|
| `branch_id` / `company_id` | `UUID` (nullable) | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `incoterms` | `TEXT` (nullable) | code → `pod_incoterms` |
| `delivery_address_json` / `billing_address_json` | `JSONB` (nullable) | |
| `buyer_profile_id` | `UUID` (nullable) | scalar → `profiles` |
| `discount_total` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |
| `quotation_id` | `UUID` (nullable) | scalar → `pod_supplier_quotations` (award → PO) |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |

### `purchase_order_lines`

| Column | Type | Notes |
|---|---|---|
| `rejected_qty` / `returned_qty` / `cancelled_qty` | `DECIMAL(18,4) NOT NULL DEFAULT 0` | receiving lifecycle |
| `discount_pct` | `DECIMAL(9,6)` (nullable) | |
| `discount_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `net_amount` / `gross_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | line net/gross |
| **`remaining_qty`** | `DECIMAL(18,4)` **GENERATED ALWAYS AS STORED** | `ordered_qty − received_qty − rejected_qty − returned_qty − cancelled_qty`. Read-only; the app never writes it. |

### `goods_receipts`

| Column | Type | Notes |
|---|---|---|
| `inspection_status_code` | `TEXT` (nullable) | inspection lifecycle code |
| `branch_id` | `UUID` (nullable) | |

---

## New `pod_*` tables

### Cluster: classification lookups

Besides `pod_document_statuses`/`pod_status_transitions` (above), these admin-customizable lookups
allow global (`tenant_id NULL`) and tenant rows. Each has `id`, `tenant_id?`, `code`, a label,
flags, `created_at`, `updated_at`, unique `(tenant_id, code)`, and tenant FK.

| Table | Distinctive columns | Unique | Seeded (global) |
|---|---|---|---|
| `pod_supplier_categories` | `parent_id?` (scalar self-ref), `name`, `description?`, `is_active`, `deleted_at?` | `(tenant_id, code)`; index `(tenant_id, is_active)`. `tenant_id NOT NULL` | none (per-tenant) |
| `pod_return_reasons` | `label`, `requires_inspection` | `(tenant_id, code)` | `damaged`, `expired`, `wrong_item`, `quantity_difference`, `quality_issue` |
| `pod_payment_methods` | `label` | `(tenant_id, code)` | `cash`, `bank_transfer`, `cheque`, `credit_card`, `online` |
| `pod_landed_cost_types` | `label`, `default_allocation_basis DEFAULT 'value'` | `(tenant_id, code)` | `freight`(weight), `shipping`(weight), `insurance`(value), `import_duty`(value), `customs`(value), `broker_fee`(value), `handling`(quantity), `port_charges`(quantity), `other`(value) |
| `pod_incoterms` | `label` | `(tenant_id, code)` | `EXW`,`FCA`,`FOB`,`CFR`,`CIF`,`CPT`,`CIP`,`DAP`,`DPU`,`DDP` |
| `pod_debit_note_reasons` | `label` | `(tenant_id, code)` | `price_difference`, `missing_quantity`, `damaged_goods`, `incorrect_billing`, `tax_adjustment` |

### Cluster: Supplier CRM satellites

All three carry `id`, `tenant_id NOT NULL` (FK), `supplier_id` (scalar → `suppliers`),
`is_primary`, `is_active`, `created_at`, `updated_at`, `deleted_at?`, and index
`(tenant_id, supplier_id)`.

**`pod_supplier_contacts`** — `name` (req), `title?`, `email?`, `phone?`, `mobile?`, `notes?`.

**`pod_supplier_addresses`** — `address_type DEFAULT 'billing'`, `line1` (req), `line2?`,
`city?`, `state?`, `postal_code?`, `country_code?`.

**`pod_supplier_bank_accounts`** — `bank_name` (req), `account_name?`, `account_number?`, `iban?`,
`swift?`, `currency_code DEFAULT 'USD'`.

### Cluster: RFQ

**`pod_rfqs`** — RFQ header. Full audit set. Columns: `document_number` (req),
`status_code DEFAULT 'open'`, `title?`, `requisition_id?` (scalar → `purchase_requisitions`),
`warehouse_id?`, `currency_code DEFAULT 'USD'`, `issue_date DEFAULT now()`, `expiry_date?`,
`revision DEFAULT 1`, `awarded_supplier_id?`, `awarded_quotation_id?`, `buyer_profile_id?`,
`notes?`, `correlation_id?`.
- Unique `(tenant_id, document_number)`; index `(tenant_id, status_code)`.
- FKs: `tenant_id` only. All others scalar.

**`pod_rfq_items`** — RFQ line. `rfq_id` (**real FK → `pod_rfqs`**, cascade), `line_no`,
`product_id` (req scalar), `variant_id?`, `uom_id` (req scalar), `quantity DECIMAL(18,4)`,
`required_date?`, `specification?`, `notes?`, `created_at`.
- **Check:** `quantity >= 0`. Index `(tenant_id, rfq_id)`.

**`pod_rfq_suppliers`** — invited suppliers. `rfq_id` (**real FK → `pod_rfqs`**),
`supplier_id` (scalar), `status_code DEFAULT 'invited'`, `invited_at?`, `responded_at?`.
- **Unique** `(tenant_id, rfq_id, supplier_id)`; index `(tenant_id, supplier_id)`.

### Cluster: Supplier quotations

**`pod_supplier_quotations`** — quotation header. Full audit set. Key columns: `document_number`
(req), `rfq_id?` (scalar), `supplier_id` (req scalar), `status_code DEFAULT 'draft'`,
`quotation_date DEFAULT now()`, `valid_until?`, `currency_code DEFAULT 'USD'`,
`exchange_rate DECIMAL(19,8) DEFAULT 1`, `lead_time_days?`, `payment_terms?`,
`freight_amount`, `insurance_amount`, `discount_total`, `subtotal`, `tax_total`, `grand_total`
(all `DECIMAL(19,4) DEFAULT 0`; recomputed by trigger), `remarks?`, `revision DEFAULT 1`,
`approved_by_profile_id?`, `correlation_id?`.
- Unique `(tenant_id, document_number)`; indexes on `status_code`, `supplier_id`, `rfq_id`.

**`pod_supplier_quotation_items`** — quotation line. `quotation_id` (**real FK → quotation**,
cascade), `line_no`, `product_id` (req), `variant_id?`, `uom_id` (req), `quantity DECIMAL(18,4)`,
`unit_price DECIMAL(19,6)`, `discount_pct DECIMAL(9,6)?`, `discount_amount`,
`tax_rate_id?` (scalar), `tax_amount`, `net_amount` (req), `lead_time_days?`, `notes?`.
- **Check:** `quantity >= 0`. Index `(tenant_id, quotation_id)`.

### Cluster: Approval engine (generic, reusable by any module)

**`pod_approval_workflows`** — a routing definition. `code`, `name`, `entity_type`,
`min_amount?`/`max_amount?` (`DECIMAL(19,4)`), `currency_code?`, `auto_approve DEFAULT false`,
`notes?`, `is_active`, `created_at`, `updated_at`, `deleted_at?`. `tenant_id NOT NULL`.
- Unique `(tenant_id, code)`; index `(tenant_id, entity_type, is_active)`.

**`pod_approval_workflow_steps`** — ordered steps. `workflow_id` (**real FK → workflow**, cascade),
`step_order`, `name`, `approver_role_code?`, `approver_profile_id?` (scalar), `min_amount?`,
`condition JSONB?`, `is_final DEFAULT false`, `allow_delegate DEFAULT true`, `escalate_after_hours?`.
- **Unique** `(tenant_id, workflow_id, step_order)`; index `(tenant_id, workflow_id)`.

**`pod_approval_requests`** — a live approval instance over any entity. `company_id?`, `branch_id?`,
`workflow_id?` (scalar), `entity_type`, `entity_id`, `status_code DEFAULT 'pending'`,
`current_step_order DEFAULT 1`, `amount?`, `currency_code?`, `requested_by_profile_id?`,
`requested_at DEFAULT now()`, `completed_at?`, `correlation_id?`, `version_number`.
- Indexes: `(tenant_id, entity_type, entity_id)`, `(tenant_id, status_code)`. `version_number`
  bumped by trigger.

**`pod_approval_actions`** — the approval history / audit trail. `request_id`
(**real FK → request**, cascade), `step_order`, `action_code` (approve/reject/delegate/escalate/…),
`actor_profile_id?`, `delegated_to_profile_id?`, `comment?`, `acted_at DEFAULT now()`.
- Index `(tenant_id, request_id)`.

### Cluster: Supplier invoices (AP subledger) + 3-way match

**`pod_supplier_invoices`** — AP invoice header. Full audit set. Key columns: `document_number`
(req, internal), `supplier_invoice_number?` (the vendor's number), `supplier_id` (req scalar),
`purchase_order_id?` (scalar), three status codes — `status_code DEFAULT 'draft'`,
`match_status_code DEFAULT 'unmatched'`, `payment_status_code DEFAULT 'unpaid'` —
`invoice_date DEFAULT now()`, `due_date?`, `currency_code DEFAULT 'USD'`,
`exchange_rate DECIMAL(19,8) DEFAULT 1`; amounts (`DECIMAL(19,4) DEFAULT 0`): `subtotal`,
`discount_total`, `tax_total`, `retention_amount`, `withholding_tax_amount`, `freight_amount`,
`grand_total`, `paid_amount`, `outstanding_amount`; `notes?`, `approval_request_id?`,
`is_posted DEFAULT false`, `posted_at?`, `posted_by_profile_id?`, `correlation_id?`.
- Unique `(tenant_id, document_number)`; indexes on `supplier_id`, `status_code`, and
  `(tenant_id, payment_status_code, due_date)` for aging.
- **Checks:** `grand_total >= 0`, `paid_amount >= 0`.
- Header totals recomputed from items by `pod_recompute_invoice_totals()` trigger.

**`pod_supplier_invoice_items`** — invoice line. `invoice_id` (**real FK → invoice**, cascade),
`line_no`, `product_id?`, `variant_id?`, `description?`, `purchase_order_line_id?` (scalar),
`goods_receipt_line_id?` (scalar), `uom_id?`, `quantity DECIMAL(18,4)`, `unit_price DECIMAL(19,6)`,
`discount_amount`, `tax_rate_id?`, `tax_amount`, `net_amount` (req).
- Index `(tenant_id, invoice_id)`.

**`pod_supplier_invoice_matches`** — 3-way match rows (invoice ↔ PO line ↔ GRN line).
`invoice_id` (**real FK → invoice**, cascade), `invoice_item_id?`, `purchase_order_line_id?`,
`goods_receipt_line_id?` (all scalar), `matched_qty DECIMAL(18,4)`, `matched_amount DECIMAL(19,4)`,
`price_variance DECIMAL(19,4)`, `qty_variance DECIMAL(18,4)`.
- Index `(tenant_id, invoice_id)`. Drives `match_status_code` via `pod_three_way_match()`
  (tolerance `0.01`).

### Cluster: Debit notes

**`pod_debit_note_lines`** — line items that attach to an existing `financial_notes` header
(reused as the debit-note header). `financial_note_id` (scalar → `financial_notes`), `line_no`,
`reason_id?` (scalar → `pod_debit_note_reasons`), `product_id?`, `description?`,
`quantity DECIMAL(18,4)?`, `unit_cost DECIMAL(19,6)?`, `amount DECIMAL(19,4)` (req),
`tax_amount`, `purchase_return_id?` (scalar → `purchase_returns`).
- Index `(tenant_id, financial_note_id)`. FK: `tenant_id` only (header lives in `financial_notes`).

### Cluster: Landed cost

**`pod_landed_cost_vouchers`** — landed-cost voucher header. Full audit set. Key columns:
`document_number` (req), `status_code DEFAULT 'draft'`, `goods_receipt_id?`, `purchase_order_id?`,
`supplier_invoice_id?` (all scalar), `allocation_basis DEFAULT 'value'`,
`currency_code DEFAULT 'USD'`, `exchange_rate DECIMAL(19,8) DEFAULT 1`,
`total_charges DECIMAL(19,4) DEFAULT 0` (recomputed from charges), `notes?`,
`is_posted DEFAULT false`, `posted_at?`, `posted_by_profile_id?`, `correlation_id?`.
- Unique `(tenant_id, document_number)`; indexes on `status_code`, `goods_receipt_id`.

**`pod_landed_cost_charges`** — charge lines. `voucher_id` (**real FK → voucher**, cascade),
`line_no`, `cost_type_id?` (scalar → `pod_landed_cost_types`), `description?`,
`amount DECIMAL(19,4)` (req), `supplier_id?` (charge vendor), `tax_amount`.
- Index `(tenant_id, voucher_id)`. Triggers `pod_recompute_voucher_charges()`.

**`pod_landed_cost_allocations`** — allocation rows (charges distributed to receipt/PO lines).
`voucher_id` (**real FK → voucher**, cascade), `goods_receipt_line_id?`, `purchase_order_line_id?`,
`product_id?` (all scalar), `basis_value DECIMAL(19,4) DEFAULT 0`,
`allocated_amount DECIMAL(19,4) DEFAULT 0` (computed by `pod_allocate_landed_cost()`).
- Index `(tenant_id, voucher_id)`.

### Cluster: Supplier payments (AP)

**`pod_supplier_payments`** — payment header. Full audit set. Key columns: `document_number` (req),
`supplier_id` (req scalar), `status_code DEFAULT 'draft'`, `payment_method_id?` (scalar),
`payment_date DEFAULT now()`, `currency_code DEFAULT 'USD'`,
`exchange_rate DECIMAL(19,8) DEFAULT 1`, `amount DECIMAL(19,4)` (req),
`allocated_amount DECIMAL(19,4) DEFAULT 0`, `unallocated_amount DECIMAL(19,4) DEFAULT 0`,
`reference_number?`, `bank_account_id?` (scalar → `pod_supplier_bank_accounts`),
`is_advance DEFAULT false`, `notes?`, `is_posted DEFAULT false`, `posted_at?`,
`posted_by_profile_id?`, `correlation_id?`.
- Unique `(tenant_id, document_number)`; indexes on `supplier_id`, `status_code`.
- **Check:** `amount >= 0`.

**`pod_supplier_payment_allocations`** — applies a payment to invoices / financial notes.
`payment_id` (**real FK → payment**, cascade), `supplier_invoice_id?` (scalar),
`financial_note_id?` (scalar), `allocated_amount DECIMAL(19,4) DEFAULT 0`.
- Indexes `(tenant_id, payment_id)`, `(tenant_id, supplier_invoice_id)`.

### Cluster: Cross-cutting (attachments & custom fields)

**`pod_attachments`** — polymorphic file attachments. `entity_type`, `entity_id` (scalar),
`file_name`, `file_url` (req), `mime_type?`, `file_size?`, `category?`,
`uploaded_by_profile_id?`, `created_at`, `updated_at`, `deleted_at?`.
- Index `(tenant_id, entity_type, entity_id)`.

**`pod_custom_field_definitions`** — per-tenant custom field metadata (CRM pattern). `entity_type`,
`field_key`, `label`, `field_type`, `options_json JSONB?`, `is_required DEFAULT false`,
`display_order DEFAULT 0`, `is_active`, `created_at`, `updated_at`, `deleted_at?`.
- **Unique** `(tenant_id, entity_type, field_key)`.

**`pod_custom_field_values`** — the stored values. `definition_id` (**real FK → definition**,
cascade), `entity_type`, `entity_id` (scalar), `value_json JSONB` (req).
- **Unique** `(tenant_id, definition_id, entity_id)`; index `(tenant_id, entity_type, entity_id)`.

---

## Cross-cutting DB objects (summary — see `business-rules.md` / migration for detail)

- **Generated column:** `purchase_order_lines.remaining_qty` (STORED).
- **Functions:** `pod_set_tenant_context`, `pod_touch_updated_at`, `pod_bump_version`,
  `pod_capture_activity` (writes `audit_logs`), `pod_recompute_invoice_totals`,
  `pod_recompute_quotation_totals`, `pod_recompute_voucher_charges`, `pod_allocate_landed_cost`,
  `pod_recompute_supplier_balance`, `pod_three_way_match`, `pod_refresh_reporting_matviews`.
- **Triggers:** version bump on the 6 transactional headers; `updated_at` touch on lookups/
  satellites; activity capture on 5 document headers; total recompute on invoice/quotation items
  and landed-cost charges. **No inventory posting in triggers** (that stays in `movement-engine.ts`).
- **Views:** `pod_v_open_purchase_orders`, `pod_v_po_line_status`, `pod_v_outstanding_payables`
  (with aging bucket), `pod_v_supplier_balances`, `pod_v_three_way_match_variance`.
- **Materialized views:** `pod_mv_supplier_performance`, `pod_mv_spend_analysis`,
  `pod_mv_purchase_price_variance` (each with a unique index for `REFRESH … CONCURRENTLY`).
- **RLS:** `ENABLE` (not `FORCE`) on all `pod_*` tables with a tenant-isolation policy keyed on
  `current_setting('app.current_tenant_id', true)`; global lookup rows (`tenant_id IS NULL`) stay
  readable. Defense-in-depth; app-level scoping remains primary until the GUC is wired to the
  pooled runtime connection.

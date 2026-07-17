# Purchase Management — Performance & Scale (Spec 005)

Target: correct behaviour at **millions** of purchase documents per tenant without
degrading list/search/report latency.

## Indexing strategy (shipped in the migration)

Every `pod_*` table is indexed **tenant-first** so tenant-scoped queries stay on an index
prefix. Key indexes:

- Document lookup: `(tenant_id, document_number)` UNIQUE on every header (`pod_rfqs`,
  `pod_supplier_quotations`, `pod_supplier_invoices`, `pod_supplier_payments`,
  `pod_landed_cost_vouchers`).
- Worklists / filters: `(tenant_id, status_code)` on every document header;
  `(tenant_id, supplier_id)` on quotations/invoices/payments;
  `(tenant_id, payment_status_code, due_date)` on invoices for the payables/aging worklist.
- Line drill-down: `(tenant_id, <header_id>)` on every line table.
- Approval routing: `(tenant_id, entity_type, entity_id)` and `(tenant_id, status_code)` on
  `pod_approval_requests`.
- Polymorphic access: `(tenant_id, entity_type, entity_id)` on `pod_attachments` and
  `pod_custom_field_values`.
- Extended spine: `suppliers(tenant_id, category_id)`.

### Additional indexes to add as data grows (Phase 7)
- Partial index for open work: `CREATE INDEX ... ON pod_supplier_invoices (tenant_id, due_date) WHERE payment_status_code <> 'paid' AND is_posted`.
- Trigram/GIN on `suppliers(name)` and `document_number` if fuzzy search is exposed.
- Covering indexes (`INCLUDE (grand_total, outstanding_amount)`) for the payables list to enable index-only scans.

## Partitioning recommendations (deferred until volume warrants)

The append-heavy transactional tables are the partition candidates:

- **`pod_supplier_invoices`, `pod_supplier_payments`** — `RANGE` partition by `invoice_date` /
  `payment_date` (monthly or quarterly). Old periods become read-mostly; refreshes and aging
  queries touch only recent partitions.
- **`pod_approval_actions`, `pod_attachments`, `audit_logs`** (already large) — `RANGE` by
  `created_at`, or `BRIN` index on `created_at` (append-only, physically time-ordered) which is
  far cheaper than btree for this access pattern.
- Keep partition keys inside the composite PKs/uniques (`tenant_id` first) to preserve isolation.

Partitioning is a Phase-11-style optimization: the correctness invariants (totals, matching,
balances) do **not** depend on it, mirroring the inventory ledger's deferred partitioning note.

## Pagination & search

- Use **keyset (seek) pagination** on `(created_at, id)` or `(document_number)` for large lists
  rather than `OFFSET`, which degrades linearly.
- Always pass `tenant_id` (and, where relevant, `status_code`) so the planner uses the composite
  index prefix.
- Expose server-side filters (status, supplier, date range, aging bucket) so the DB, not the app,
  does the narrowing.

## Reporting: views vs materialized views

Real-time **views** (cheap, always current): `pod_v_open_purchase_orders`,
`pod_v_po_line_status`, `pod_v_outstanding_payables`, `pod_v_supplier_balances`,
`pod_v_three_way_match_variance`.

Heavy analytical **materialized views** (precomputed): `pod_mv_supplier_performance`,
`pod_mv_spend_analysis`, `pod_mv_purchase_price_variance`. Each has a UNIQUE index so it can be
refreshed with `REFRESH MATERIALIZED VIEW CONCURRENTLY` (via `pod_refresh_reporting_matviews()`)
without blocking readers.

- **First refresh must be non-concurrent** — the matviews are created `WITH NO DATA`; run one
  plain `REFRESH MATERIALIZED VIEW` before the concurrent helper is used.
- Schedule `pod_refresh_reporting_matviews()` off a cron/queue (e.g. every 15–60 min) or trigger
  it after posting batches. Do not refresh synchronously inside a posting transaction.

## Denormalization & triggers

Header totals (`subtotal`/`tax_total`/`grand_total`/`outstanding_amount`) are denormalized and
kept current by `AFTER` triggers on the line tables (`pod_recompute_invoice_totals`,
`pod_recompute_quotation_totals`, `pod_recompute_voucher_charges`). This trades a small write cost
for fast reads (no per-row aggregation on list screens). `remaining_qty` on
`purchase_order_lines` is a `GENERATED ALWAYS … STORED` column — computed once on write, free on read.

Inventory posting and costing stay in the application service layer (`movement-engine.ts`); they
are **not** in triggers, avoiding double-posting and keeping the hot path under the existing
`SELECT … FOR UPDATE` balance lock.

## RLS cost & posture

RLS is `ENABLE` (not `FORCE`): the owner/migration role used by the Prisma pooled connection
bypasses the policies, so there is **no per-row RLS overhead on the app's primary query path**.
Non-owner roles pay a cheap predicate (`tenant_id = current_setting('app.current_tenant_id')`),
which is index-supported by the tenant-first indexes. This is defense-in-depth; app-level tenant
scoping remains primary.

## Connection & transaction hygiene

- Reuse the shared pooled Prisma client (`src/server/db/client.ts`); never open ad-hoc pools.
- Posting operations: `RepeatableRead` isolation + 30s timeout, matching the inventory engine.
- Keep numbering (`nextDocumentNumber`) inside the posting transaction so the number and the
  document commit atomically (its `INSERT … ON CONFLICT DO UPDATE … RETURNING` avoids app locks).

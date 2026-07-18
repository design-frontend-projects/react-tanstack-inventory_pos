# Financial Management — Performance & Scale (Spec 006)

Target: correct double-entry behaviour at **tens of millions** of journal lines
per tenant without degrading posting latency or report reads. The engine is
designed so correctness never depends on any optimization below.

## Indexing strategy (shipped in the migration)

Every `fin_*` table is indexed **tenant-first** so tenant-scoped queries stay on
an index prefix. Key indexes:

- Document lookup: `(tenant_id, document_number)` UNIQUE on every numbered
  header (`fin_journal_entries`, `fin_ar_receipts`, `fin_payment_runs`,
  `fin_cash_transactions`, `fin_cheques`, …).
- **Idempotency (partial unique)** on `fin_journal_entries`:
  `(tenant_id, source_doc_type, source_doc_id, source_event_type)
  WHERE status_code = 'posted' AND reversal_of_entry_id IS NULL` — one posted
  entry per source event, while reversals and drafts stay unconstrained. This is
  the structural dedupe for the async queue; a violation surfaces as
  `DUPLICATE_SOURCE`, never a double posting.
- Ledger drill-down: `fin_journal_lines (tenant_id, account_id, entry_date)` and
  `(tenant_id, journal_entry_id)`; party lines `(tenant_id, party_type, party_id)`.
- **BRIN on `fin_journal_lines (created_at)`** — lines are append-only and
  physically time-ordered, so BRIN gives near-free time-range pruning at a tiny
  fraction of a B-tree's size/maintenance cost. Same treatment for
  `fin_tax_transactions` and the subledger entry tables.
- Subledger open items: `fin_customer_ledger_entries` /
  `fin_vendor_ledger_entries` get `(tenant_id, customer_id|supplier_id)` plus a
  **partial index** `(tenant_id, due_date) WHERE remaining_amount <> 0` — the
  aging/collection/payment-proposal worklists scan only open items.
- Balances: `fin_gl_balances` UNIQUE `(tenant_id, account_id, fiscal_period_id,
  currency_code)` — the upsert target and the trial-balance read path.
- Queue: `fin_posting_queue` dedupe UNIQUE `(tenant_id, source_doc_type,
  source_doc_id, source_event_type)` + drain index
  `(status_code, next_attempt_at)`.
- COA tree: `(tenant_id, path)` (materialized path, `text_pattern_ops`) makes
  subtree reads a prefix scan.

## fin_gl_balances — maintained summary vs recompute

The balance table is a **maintained summary**, updated by an atomic
`INSERT … ON CONFLICT DO UPDATE` (increment debit/credit totals) **inside the
posting transaction** — so balances are exactly as consistent as the ledger and
trial balance is O(accounts), not O(lines).

- The upsert touches one row per (account, period, currency) per entry — write
  amplification is bounded by distinct accounts on the entry (typically < 10).
- Contention: hot accounts (AR control, cash) serialize on their balance row
  within the posting tx. Acceptable at target volume because posting txs are
  short; if it ever measures, the escape hatch is per-posting-batch aggregation
  in the queue processor (accumulate deltas, one upsert per account per batch).
- **Repair path**: `fin_rebuild_gl_balances(p_tenant_id uuid)` (shipped in the
  migration) truncates and re-aggregates a tenant's balances from
  `fin_journal_lines` — the recovery tool after manual surgery or a suspected
  drift; never part of normal operation. Run in a maintenance window; it is a
  full-scan aggregate.

## Partitioning — DEFERRED (explicit thresholds)

Ship **unpartitioned** with B-tree + BRIN. Correctness (balance trigger,
idempotency index, upserts) does not depend on partitioning.

Trigger thresholds — revisit when **any** of:

- `fin_journal_lines` exceeds **~50M rows** (or ~50GB heap) per database, or
- p95 of the trial-balance/GL-detail queries degrades > 2× from baseline, or
- autovacuum on `fin_journal_lines` can no longer keep up (bloat > 30%).

Documented future path (no schema change required by callers):

1. Monthly `RANGE` partitioning of `fin_journal_lines` (and
   `fin_tax_transactions`) on `entry_date`/`created_at`, keys kept inside the
   PK/unique composites (`tenant_id` first).
2. Executed as hand-written SQL in a `migrate deploy` migration (this DB is
   drifted — **never** `migrate dev`, per project memory): create partitioned
   parent, attach current table as the historical partition, create forward
   partitions + a default, swap names in one transaction.
3. The partial idempotency index lives on `fin_journal_entries` (headers, far
   smaller) so header partitioning is not expected to be needed.
4. `pg_partman`-style forward-partition creation can be a scheduled job; until
   then a yearly migration adding 12 partitions suffices.

## Posting queue throughput

- **Batch drain**: the processor claims rows with
  `SELECT … WHERE status_code = 'pending' AND next_attempt_at <= now()
  ORDER BY created_at LIMIT n FOR UPDATE SKIP LOCKED` — multiple drainers never
  contend, ordering is best-effort (idempotency makes reordering safe).
- **Retry**: `attempt_count <= 5`, exponential backoff
  (`next_attempt_at = now() + interval '1 min' * 2^attempt_count`), then
  terminal `failed` → exceptions screen + `notify(...)`. Manual retry resets to
  `pending` with `attempt_count = 0`.
- **Dedupe unique** on the queue means the consumer can re-scan `domain_events`
  from an old cursor after a crash and insert-or-ignore — at-least-once event
  delivery collapses to exactly-once posting.
- One JE per source document (not per event-payload line) keeps queue volume at
  document granularity; a 50-line POS sale is still one queue row and one
  posting tx.
- Cursor lag (`fin_event_cursors` vs `domain_events` head) is the health metric;
  expose it on the exceptions screen. Period close requires drained-to-period
  lag = 0.

## Materialized AR/AP subledger — rationale & write amplification

`fin_customer_ledger_entries` / `fin_vendor_ledger_entries` are **tables written
by the posting engine in the same tx as the JE**, not views:

- A view would need giant `UNION ALL`s across heterogeneous documents
  (`sales_invoices`, `pos_sales`, `pod_supplier_invoices`, `financial_notes`,
  receipts, payment allocations) and still could not carry mutable open-item
  state (`remaining_amount`, application history).
- Cost: +1 row (entry) and +n rows (applications) per posting tx, plus a
  `remaining_amount` update per applied open item — bounded, index-supported,
  and read-side it converts aging/statements/credit checks from analytical
  queries into indexed range scans.
- Open-item mutation is confined to `remaining_amount` and application inserts;
  entry identity/amount columns are immutable → HOT updates, low bloat.

## Caching (per-tenant, in-process)

Read-mostly configuration is cached in-memory per tenant with **version
invalidation** (a `config_version` bumped on `fin_settings` /
posting-rule / COA / mapping writes; cache entries carry the version and
re-fetch on mismatch):

- `fin_settings` singleton (checked on every posting).
- COA resolution data (id → account meta, control flags, path).
- Posting rules + lines (system + tenant overlay, keyed by `sourceDocType`).
- Account-mapping walk results are **not** cached individually — the walk is a
  handful of PK lookups; cache the mapping table snapshot instead if profiling
  demands it.

The cache is per server process and advisory only; the posting tx re-validates
period status and account existence inside the transaction.

## Reporting strategy

- **Trial balance** — read `fin_gl_balances` for the period range: O(accounts),
  no line scans, always current (maintained in-tx).
- **P&L / balance sheet** — aggregate `fin_gl_balances` over account
  class/type + period range; current-year earnings computed dynamically (no
  physical rollover rows to reconcile).
- **GL detail / account statement** — `fin_journal_lines`
  `(tenant_id, account_id, entry_date)` index, keyset pagination on
  `(entry_date, id)` — never `OFFSET`.
- **AR/AP aging** — partial open-item index + `due_date`; bucketing
  (`current/1_30/31_60/61_90/90_plus`) computed in SQL over the indexed scan.
- **Customer/vendor statements** — subledger entries + applications by party
  index; no journal scan.
- **Dashboards / heavy analytics** — later phase may add matviews mirroring the
  `pod_mv_*` pattern (unique index + `REFRESH … CONCURRENTLY`, first refresh
  non-concurrent); not needed for Phase 1 correctness.

## Operational notes

- **Prisma client size**: the schema grows ~191 → ~277 models. `pnpm prisma
  generate` is noticeably slower; run it once after migrations, not per-test.
- **Typecheck heap**: `pnpm typecheck` requires
  `NODE_OPTIONS=--max-old-space-size=8192` (known, per project memory). The 3
  pre-existing test failures and prettier's repo-wide dirtiness are unrelated —
  don't chase them.
- **Migrations**: hand-written SQL applied with `pnpm prisma migrate deploy`
  only (drifted DB). The `DocumentType` enum extension ships in its **own**
  migration — added enum values cannot be used in the same transaction.
- Posting operations reuse the shared pooled Prisma client
  (`src/server/db/client.ts`), `RepeatableRead` + 30s timeout; numbering stays
  inside the posting tx (`nextDocumentNumber` upsert-returning, no app locks).
- RLS posture mirrors 005: `ENABLE` (not `FORCE`) — no per-row RLS cost on the
  app's pooled connection; tenant-first indexes support the non-owner predicate.

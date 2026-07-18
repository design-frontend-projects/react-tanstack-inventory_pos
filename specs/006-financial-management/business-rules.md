# Business Rules — Financial Management (Spec 006)

Validation and business rules per domain, the state-transition contract, and the mapping from
rule violations to the app's `DomainError` subclasses (`src/server/auth/errors.ts`:
`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`,
`ServiceUnavailableError`). Where a rule is enforced by the DB (CHECK constraint, partial unique
index, deferred constraint trigger) it is noted; the service layer validates the same rule ahead
of time to return a friendly `DomainError` rather than a raw Postgres error.

Throughout: **all tenant-scoped server functions chain the guards**
`requireAuth → requireTenantAccess → requirePermission` before any read/write. A missing guard is
a cross-tenant leak, since app-level scoping is the primary isolation boundary. The **posting
engine is the only writer** of `fin_journal_entries`, `fin_journal_lines`, `fin_gl_balances`,
subledger entries, and `fin_tax_transactions` — no other code path may touch them.

---

## BR-GL — General Ledger / Chart of Accounts

- **BR-GL-01** Only **leaf** accounts (`isLeaf = true`) accept journal lines; a line against a
  summary account → **`ValidationError`**.
- **BR-GL-02** Every account carries a normal balance side inherited from its class/type; reports
  present signs from it. Postings themselves are side-agnostic (any account may be debited or
  credited).
- **BR-GL-03** Accounts flagged `isControlAccount` reject **manual** journal lines; only the
  posting engine acting for the account's `controlDomain` subledger (AR, AP, inventory, GRNI, …)
  may post to them → violation **`ForbiddenError`**. Accounts with `allowManualJournal = false`
  likewise reject manual lines.
- **BR-GL-04** An account cannot be deactivated while its balance ≠ 0 in any open period or while
  it has active children → **`ConflictError`**. Deactivated accounts reject new lines.
- **BR-GL-05** Re-parenting an account rewrites its `level` / materialized `path` for the whole
  subtree in one transaction; a cycle (`parentAccountId` reachable from itself) →
  **`ValidationError`**.
- **BR-GL-06** An account with a currency restriction rejects lines in any other currency →
  **`ValidationError`**.
- **BR-GL-07** `(tenantId, accountCode)` is UNIQUE; a collision → **`ConflictError`**.
- **BR-GL-08** `fin_account_mappings` are unique per
  `(tenantId, entityType, entityId, mappingRole)`; the mapped account must be an active leaf in
  the same tenant → else **`ValidationError`**.

## BR-FY — Fiscal Management

- **BR-FY-01** A fiscal year generates 12 monthly periods + one adjustment period (13) with
  contiguous, non-overlapping date ranges; overlapping fiscal years for a tenant →
  **`ValidationError`**.
- **BR-FY-02** The fiscal period for a posting is resolved from the **entry date** (never
  "today"). A date matching no period → **`ValidationError`**; a `closed` or `locked` period →
  **`ConflictError`**.
- **BR-FY-03** A `fin_period_module_locks` row for `(period, sourceModule)` rejects postings from
  that module even while the period is open for others → **`ConflictError`**. Manual journals are
  a module (`manual`) and can be locked like any other.
- **BR-FY-04** Posting into the adjustment period requires `isAdjustment = true` on the entry
  **and** the adjustment permission → missing flag **`ValidationError`**, missing permission
  **`ForbiddenError`**.
- **BR-FY-05** Period status moves `future → open → closed → locked`. Reopen (`closed → open`) is
  allowed while the fiscal year is open; a `locked` period never reopens through the normal
  permission → **`ForbiddenError`** without the explicit unlock permission.
- **BR-FY-06** A period cannot be closed while unposted fin-native documents dated inside it
  remain in a posting-pending status, or while failed queue rows for it are unresolved →
  **`ConflictError`** (resolve or move them first).

## BR-JE — Journal Management

- **BR-JE-01** A journal entry cannot post unbalanced: Σ `baseDebitAmount` must equal
  Σ `baseCreditAmount` exactly. **Base amounts are the balancing authority** (transaction-currency
  totals may differ across mixed-currency lines). Enforced by app `assertBalanced` and the
  deferred DB trigger `fin_assert_journal_entry_balanced()` → **`ValidationError`**.
- **BR-JE-02** An entry must have **≥ 2 lines** → **`ValidationError`**.
- **BR-JE-03** Each line carries a debit XOR a credit, both non-negative — DB CHECKs
  `debit >= 0`, `credit >= 0`, `NOT (debit > 0 AND credit > 0)`; a line with both or neither →
  **`ValidationError`**.
- **BR-JE-04** Entries are auto-numbered from `document_sequences` (`journal_entry` DocumentType)
  inside the create transaction; `(tenantId, documentNumber)` UNIQUE → collision
  **`ConflictError`**. Numbering is gapless **per sequence** — numbers are only consumed by
  committed documents.
- **BR-JE-05** Journal types flagged for approval route the entry through `pod_approval_*` before
  posting; posting an unapproved entry of such a type → **`ConflictError`**.
- **BR-JE-06** **Posted entries and their lines are immutable.** Any UPDATE/DELETE of a posted
  entry's content → **`ConflictError`**. The only correction path is reversal (BR-POST-04).
- **BR-JE-07** Draft entries are editable; line replacement is delete-and-reinsert inside the
  header's transaction. Stale `versionNumber` on header update → **`ConflictError`**.
- **BR-JE-08** Every posted line must reference an active leaf account, a resolvable open period,
  and (where the account demands it) the required dimensions → else **`ValidationError`**.
- **BR-JE-09** `fin_gl_balances` are maintained only by the posting engine's atomic
  `INSERT … ON CONFLICT DO UPDATE`; the app never hand-writes balances.
  `fin_rebuild_gl_balances()` is the sole repair path.
- **BR-JE-10** Recurring schedules and templates generate **draft** entries only; generated
  entries pass through the same posting rules as manual ones.

## BR-POST — Posting Engine

- **BR-POST-01** Posting is **idempotent** per `(sourceDocType, sourceDocId, sourceEventType)`:
  the partial unique index (`WHERE status_code = 'posted' AND reversal_of_entry_id IS NULL`)
  guarantees at-most-once. A duplicate delivery is a logged no-op returning the existing entry —
  never an error surfaced to the queue.
- **BR-POST-02** **Account resolution order** is fixed: rule line fixed account →
  `fin_account_mappings` walk (product → category, walking parent categories → warehouse →
  branch → payment method → party group) → `fin_settings` named default → then
  `strictAccountResolution` ? **throw `ValidationError`** : **post to suspense + notify**.
  Fin-native documents default strict; async operational adapters default suspense.
- **BR-POST-03** Every posting writes, in one transaction: journal entry + lines, GL balance
  upserts, applicable subledger rows, applicable tax transactions, an `appendDomainEvent`, and a
  `createAuditLog`. A posting that cannot complete all of them rolls back entirely.
- **BR-POST-04** **Corrections are reversal-only**: reverse = mark the original reversed + post a
  mirror-image reversal entry cross-linked via `reversalOfEntryId` (+ optionally a new corrected
  entry). Reversing an already-reversed entry, or reversing a reversal entry →
  **`ConflictError`**. The reversal posts into the original's period if open, else the earliest
  open period (recorded on the reversal).
- **BR-POST-05** Operational documents post **asynchronously**: `domain_events` → finance
  consumer (advances `fin_event_cursors`) → `fin_posting_queue` → engine. A posting failure
  **never blocks, delays, or rolls back the operational document** — the queue row retries with
  backoff up to 5 attempts, then parks as `failed`, visible in the exceptions screen with a
  notification.
- **BR-POST-06** Inventory-affecting operations (receipt, issue, adjustment, transfer, count,
  manufacturing, COGS on sale) **always generate accounting entries** through their adapters —
  there is no "operational-only" inventory movement once the adapter phase ships. Queue failure
  semantics per BR-POST-05 apply.
- **BR-POST-07** Posting rules resolve tenant row first, system default (`tenantId IS NULL`)
  second; no active rule for a `(sourceDocType, sourceEventType)` → strict-mode
  **`ValidationError`** (fin-native) or parked queue row + notification (async).
- **BR-POST-08** The queue processor re-resolves period/rule/accounts at processing time (not
  enqueue time); a row parked by a closed period can succeed on retry after the period situation
  is corrected — it is never silently re-dated.

## BR-AR — Accounts Receivable

- **BR-AR-01** Every AR posting writes `fin_customer_ledger_entries` in the same transaction as
  its journal entry; `remainingAmount` starts at the entry amount and only applications change
  it.
- **BR-AR-02** A customer payment/receipt cannot be applied beyond an open item's
  `remainingAmount` → **`ValidationError`** — unless the tenant's overpayment policy is enabled,
  in which case the excess becomes an **advance / on-account** entry (a credit-side open item)
  rather than over-applying.
- **BR-AR-03** Each `fin_ar_receipt_allocations` row targets **exactly one** open item
  (sales invoice / POS sale / financial note) — DB CHECK; zero or multiple targets →
  **`ValidationError`**. Σ allocations ≤ receipt amount → violation **`ValidationError`**; the
  unallocated remainder stays on-account.
- **BR-AR-04** Applying a foreign-currency receipt to an open item at a different rate realizes
  FX gain/loss at application time, posted to the configured realized FX accounts in the same
  transaction (`fin_customer_ledger_applications` captures the amounts).
- **BR-AR-05** Statements and aging derive exclusively from the subledger; aging buckets key on
  `dueDate` (from payment terms). The AR control account balance must equal
  Σ subledger `remainingAmount` — guaranteed by BR-GL-03 + BR-POST-03, verified by the
  reconciliation report.
- **BR-AR-06** Dunning runs evaluate overdue open items against `fin_dunning_levels`
  (days overdue ascending); a customer is assigned the highest matching level, one
  `fin_dunning_run_entries` per customer per run, with a notification. Dunning fees (if
  configured) post as fee entries.

## BR-AP — AP Accounting

- **BR-AP-01** Posted operational AP documents (PodSupplierInvoice, PodSupplierPayment, debit
  notes, landed cost) are shadowed as `fin_vendor_ledger_entries` via async posting; the
  operational document and `pod_recompute_supplier_balance()` are never modified by fin.
- **BR-AP-02** Vendor applications mirror BR-AR-02/03/04: exactly one target per application,
  Σ ≤ source amount, no over-application beyond `remainingAmount`, realized FX gain/loss at
  application.
- **BR-AP-03** A payment run may only select **posted** vendor open items with
  `remainingAmount > 0` due by the cutoff; held/excluded lines are per-line flags. Run execution
  requires an approved run → **`ConflictError`** otherwise.
- **BR-AP-04** Run execution generates `pod_supplier_payments` (+allocations) through the
  existing operational service — never by writing pod tables directly; the resulting payment
  events flow back through the async pipeline to clear the vendor ledger.
- **BR-AP-05** WHT: when a supplier financial profile mandates withholding, payment posting
  splits the WHT portion to the WHT payable account and records a `fin_wht_certificates` row.
- **BR-AP-06** The AP control account balance must equal Σ vendor `remainingAmount`; manual
  postings to it are blocked (BR-GL-03).

## BR-CASH — Cash Management

- **BR-CASH-01** Every cashbox links to a dedicated GL cash account; two cashboxes cannot share
  an account → **`ValidationError`**.
- **BR-CASH-02** A cash disbursement cannot drive the cashbox GL balance negative →
  **`ValidationError`** (checked at posting). Float limits warn via notification when exceeded.
- **BR-CASH-03** POS session settlement posts cash transactions linked by `posSessionId`;
  settling the same session twice is blocked by posting idempotency (BR-POST-01).
- **BR-CASH-04** Funds transfers are **two-step**: dispatch posts source → in-transit;
  confirmation posts in-transit → destination. A transfer cannot confirm before dispatch, and
  cancelling a dispatched transfer posts the reversal → illegal step **`ConflictError`**.
- **BR-CASH-05** Every cash transaction carries a `fin_cash_flow_categories` classification for
  the cash-flow statement → missing on a posting **`ValidationError`**.

## BR-BANK — Banking

- **BR-BANK-01** Statement import dedupes by `externalId`: a line whose
  `(tenantId, bankAccountId, externalId)` already exists is skipped, not duplicated. Lines
  without an `externalId` fall back to a content hash for dedupe.
- **BR-BANK-02** Bank reconciliation only matches **posted** GL lines on the bank account —
  draft/unposted lines are never matchable → attempt **`ValidationError`**.
- **BR-BANK-03** A GL line or statement line participates in at most one confirmed match across
  reconciliations → duplicate match **`ConflictError`**. Auto-match proposals from
  `fin_bank_matching_rules` require explicit confirmation.
- **BR-BANK-04** A reconciliation completes only when statement closing balance = reconciled GL
  balance for the covered range → difference ≠ 0 **`ValidationError`**. A completed
  reconciliation is immutable → **`ConflictError`** on change.
- **BR-BANK-05** Cheque lifecycle: `issued → deposited → presented → cleared | bounced` (edges in
  `pod_status_transitions` for the fin cheque entity type); an illegal transition →
  **`ConflictError`**. Cheque numbers are unique per cheque book.
- **BR-BANK-06** A **PDC is not posted to the bank account before maturity/clearing** — until
  then it sits on the PDC receivable/payable holding account. Clearing moves holding → bank.
- **BR-BANK-07** A **bounced** cheque reverses its clearing entry and **reopens the underlying
  open item** (customer/vendor `remainingAmount` restored) in one transaction; bounce fees (if
  configured) post as separate entries.

## BR-TAX — Tax

- **BR-TAX-01** The applicable tax rate is the `fin_tax_code_rates` row effective on the
  **document date** (latest `effectiveFrom` ≤ document date, not expired); no effective rate →
  **`ValidationError`**.
- **BR-TAX-02** Existing `tax_rates` / `res_tax_configs` are never modified; operational tax
  postings resolve their fin tax code through `fin_tax_code_mappings`; an unmapped operational
  tax row follows the strict/suspense policy (BR-POST-02).
- **BR-TAX-03** `fin_tax_transactions` are immutable and written only in the posting transaction;
  corrections come from reversal entries producing negating tax transactions.
- **BR-TAX-04** A tax return aggregates tax transactions by reporting box for its period range;
  filing marks the covered transactions reported — a transaction cannot appear in two filed
  returns → **`ConflictError`**.
- **BR-TAX-05** WHT certificates are numbered documents issued per vendor; a certificate's total
  must equal the withheld amounts it covers → **`ValidationError`**.

## BR-FX — Multi-Currency

- **BR-FX-01** Base amount = transaction amount × exchange rate, computed per line at
  `Decimal(19,8)` rate precision, rounded to `(19,4)` money precision. The rate used is stored on
  the line.
- **BR-FX-02** Rounding residue (Σ base debits − Σ base credits after per-line rounding) is
  synthesized as a line to the configured **rounding account**, so every entry balances exactly.
  A residue above the configured tolerance (default 1.00 base) → **`ValidationError`** (wrong
  rate, not rounding).
- **BR-FX-03** Rate lookup: latest `fin_exchange_rates` row of the requested `rateType` with
  `effectiveDate` ≤ document date; base currency ↔ base currency is always rate 1. No rate →
  **`ValidationError`**.
- **BR-FX-04** Realized gain/loss posts at **application time** (BR-AR-04 / BR-AP-02) to the
  realized FX gain/loss accounts.
- **BR-FX-05** FX revaluation runs revalue open monetary balances (bank/AR/AP in foreign
  currency) at the closing rate, posting **unrealized** gain/loss entries that **auto-reverse in
  the next period** (the reversal entry is generated and posted with the run, dated day 1 of the
  next open period). Re-running a period's revaluation first reverses the prior run →
  overlapping active runs **`ConflictError`**.
- **BR-FX-06** The tenant base currency is fixed after the first posted entry →
  change attempt **`ConflictError`**.

## BR-DIM — Dimensions

- **BR-DIM-01** Cost center and project are explicit FK columns on journal lines; other
  dimensions attach via `fin_journal_line_dimensions` (unique per line + dimension).
- **BR-DIM-02** An account that requires a dimension rejects lines missing it →
  **`ValidationError`** at posting.
- **BR-DIM-03** A dimension value must be active and belong to its dimension and tenant →
  **`ValidationError`** / **`NotFoundError`**.
- **BR-DIM-04** Cost centers are hierarchical; deactivating one with active children or
  current-year postings → **`ConflictError`**.

## BR-BUD — Budgeting

- **BR-BUD-01** One active (approved) budget per fiscal year and budget scope; a new revision
  supersedes, never edits, the approved lines (`fin_budget_revisions` keeps history).
- **BR-BUD-02** Budget control evaluates at posting time per policy:
  `none` (skip), `warn` (post + notify), `block` (**`ValidationError`**) — with a tolerance
  percentage over the budget line before warn/block trips.
- **BR-BUD-03** Budget vs actual compares budget lines against `fin_gl_balances` (same
  account/period/cost-center/project keys); variance = actual − budget, absolute and %.
- **BR-BUD-04** Budget transfers move amount between lines of the same budget, must net to zero,
  and **require approval** via `pod_approval_*` before taking effect → unapproved transfer
  applied **`ConflictError`**.

## BR-FA — Fixed Assets

- **BR-FA-01** Capitalization generates the full `fin_asset_depreciation_schedules` from the
  category's (or overridden) method, useful life, and salvage value; schedule totals equal
  depreciable base → **`ValidationError`** otherwise.
- **BR-FA-02** A depreciation run posts one entry per due, unconsumed schedule row; already
  consumed rows are skipped (idempotent per asset/period). Runs post expense vs accumulated
  depreciation using category accounts.
- **BR-FA-03** **Depreciation cannot continue after disposal**: disposal catches up depreciation
  to the disposal date, then permanently excludes the asset from runs; a run touching a disposed
  asset skips it, and manual depreciation of a disposed asset → **`ConflictError`**.
- **BR-FA-04** Disposal computes gain/loss = proceeds − net book value (cost − accumulated
  depreciation) and posts it to the configured disposal gain/loss accounts; the asset's cost and
  accumulated depreciation are cleared from the balance sheet in the same entry.
- **BR-FA-05** Revaluation adjusts cost/NBV per the revaluation entry and regenerates the
  remaining schedule; transfers (branch/cost center) post the reclassification and keep full
  history. A disposed asset cannot be revalued or transferred → **`ConflictError`**.

## BR-CLOSE — Financial Closing

- **BR-CLOSE-01** Year close posts **one closing JE** zeroing all P&L account balances into
  retained earnings, plus **one opening JE** for the next year's balance-sheet accounts. During
  the year the balance sheet computes current-year earnings dynamically — no monthly physical
  rollover.
- **BR-CLOSE-02** Year close requires all 12 + adjustment periods `closed` → **`ConflictError`**
  otherwise. It is **reversible** (reversing both JEs and reopening) until next-year activity
  conflicts (postings depending on the opening entry) → then **`ConflictError`**.
- **BR-CLOSE-03** Opening balances are **staged** in `fin_opening_balance_batches` (+lines, incl.
  open AR/AP items with due dates), validated balanced (BR-JE-01), then **posted exactly once**;
  a posted batch is immutable → re-post / edit **`ConflictError`**.
- **BR-CLOSE-04** Allocation runs distribute a source account/cost-center balance across targets
  by fixed percentage (must sum to 100%) or statistical basis; Σ basis = 0 →
  **`ValidationError`** (no basis). Each run posts one allocation JE; re-running a period first
  reverses the prior run.
- **BR-CLOSE-05** Period close run tasks follow the template order; a period close run cannot
  complete with open mandatory tasks → **`ConflictError`**.

## BR-SET — Settings & Cross-cutting

- **BR-SET-01** `fin_settings` is a tenant singleton (unique on `tenantId`); finance bootstrap is
  idempotent — re-running it never duplicates settings, COA, periods, or journal types.
- **BR-SET-02** Every named default account in settings must reference an active leaf account in
  the same tenant → **`ValidationError`**. Posting fails fast (strict) or falls back to suspense
  per BR-POST-02 when a default is unset.
- **BR-SET-03** Payment terms drive `dueDate` on open items; a document without terms uses the
  party's profile default, then the tenant default.
- **BR-SET-04** Document numbering for all fin documents is issued atomically from
  `document_sequences` via the additive `DocumentType` values — gapless per sequence, unique per
  `(tenantId, documentNumber)` → collision **`ConflictError`**.
- **BR-SET-05** Status transitions for fin documents must exist as edges in
  `pod_status_transitions` for the fin entity type (tenant row first, global fallback); a missing
  edge → **`ConflictError`**; an edge's `requires_permission` unmet → **`ForbiddenError`**.
- **BR-SET-06** **Every posting writes an audit log and a domain event** in the posting
  transaction (BR-POST-03); Decimal values serialize to strings in event payloads and DTOs.
- **BR-SET-07** Mutable fin headers use optimistic locking (`versionNumber`); a stale update →
  **`ConflictError`**. Immutable ledger tables (journal lines, subledger entries, tax
  transactions, GL balances) have no soft delete and no update path outside the engine.
- **BR-SET-08** Any scalar reference (`accountId`, `periodId`, `customerId`, `supplierId`, …)
  must resolve within the same tenant → mismatch **`ValidationError`**, absent
  **`NotFoundError`**.

---

## Error-handling map

| Rule violated | Example | DomainError |
|---|---|---|
| Missing/invalid session token | no `accessToken` or expired | `UnauthorizedError` |
| Actor lacks permission | no `finance.journal_post`; manual line on a control account; locked-period unlock without permission; transition `requires_permission` unmet | `ForbiddenError` |
| Referenced entity not found in tenant | unknown `accountId`, `periodId`, open item, asset | `NotFoundError` |
| Input fails schema/business validation | unbalanced entry, < 2 lines, debit+credit on one line, summary-account line, missing required dimension, no effective tax rate/exchange rate, over-application, zero allocation basis, unresolvable account in strict mode | `ValidationError` |
| State/concurrency conflict | posting into a closed/locked period, editing/re-posting a posted entry, reversing a reversal, stale `versionNumber`, duplicate `documentNumber`, illegal status transition, deactivating an account with balance/children, year close with open periods, depreciating a disposed asset, completing an unbalanced reconciliation | `ConflictError` |
| Downstream dependency unavailable | numbering / queue processing failure | `ServiceUnavailableError` |

**Notes:**

- DB CHECKs (`debit >= 0`, `credit >= 0`, XOR), the partial unique idempotency index, and the
  deferred balance constraint trigger are the last line of defense; the service validates first
  and raises the mapped `DomainError` so the UI never sees a raw Postgres error.
- `ConflictError` is the canonical mapping for both optimistic-lock failures and illegal state
  transitions — "the world changed / the move isn't allowed from here".
- Async posting failures are **not** surfaced as user-facing errors on the operational document —
  they park in `fin_posting_queue` and surface via the exceptions screen + notifications
  (BR-POST-05).
- Every error carries a stable machine `code` and a user-facing message (see `errors.ts`); server
  logs retain full context, and messages never leak cross-tenant data.

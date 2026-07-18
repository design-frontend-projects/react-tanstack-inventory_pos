# Feature 006 — Enterprise Financial Management

## Summary

Financial Management is the **accounting engine** of the platform: a multi-tenant, double-entry
general ledger (chart of accounts, fiscal calendar, journals, GL balances) that every operational
module posts into, plus the surrounding financial domains — AR/AP subledgers, cash and banking,
tax, multi-currency, dimensions, budgets, fixed assets, and period/year closing — SAP B1 /
Dynamics BC / Odoo-class, auditable, PostgreSQL-optimized.

This is **not a greenfield operational build**. The ERP already ships mature operational modules
(inventory, purchasing `pod_`, sales/POS, restaurant `res_`, CRM `crm_`) — but **no accounting
layer**: there is no chart of accounts, no double-entry ledger, no fiscal calendar; currency is
denormalized text plus a per-document exchange rate; and the AP documents
(`pod_supplier_invoices` / `pod_supplier_payments`) update supplier balances via raw SQL without
GL postings. Spec 005 deliberately delivered "AP subledger without a GL" and emitted GL-ready
domain events for "a future double-entry GL"; Feature 006 **is** that subscriber.

Feature 006 adds the accounting layer as new `fin_`-prefixed tables (~86 tables across 15
domains). The `fin_` layer is **authoritative for accounting**; existing operational masters
(`tax_rates`, `pod_payment_methods`, `currencyCode` strings, supplier/customer balances) stay
untouched and are linked via mapping tables. **Zero breaking changes to existing modules.**

**Core principle.** Operational documents remain the system of record for operations; the ledger
is the system of record for accounting. Fin-native documents (manual journals, AR receipts, cash
transactions, depreciation runs) post **synchronously in-transaction**; operational documents
(inventory movements, purchase invoices/payments, POS sales, restaurant orders) post
**asynchronously** through the `domain_events` outbox → finance consumer → posting queue, so an
operational flow is never blocked by accounting. Posted entries are **immutable** — corrections
are reversal entries, never edits.

## Goals

- **A real double-entry general ledger.** Unlimited-depth chart of accounts with account classes,
  normal balance side, control-account protection, immutable journal entries/lines, per-period GL
  balances, trial balance always in equilibrium (Total Debit = Total Credit, enforced in three
  layers: app assertion, row CHECKs, deferred DB constraint trigger).
- **Fiscal discipline.** Fiscal years, 12 + adjustment periods, per-period open/closed/locked
  status, per-module soft locks, and a period/year close process that rolls P&L into retained
  earnings via explicit closing/opening journal entries.
- **A configurable posting engine.** Every operational event maps to debits/credits through
  `fin_posting_rules` (+lines) and `fin_account_mappings` — configurable per tenant **without code
  changes** — with a deterministic account resolution order, idempotent posting per source
  document/event, and strict-vs-suspense handling for unresolvable accounts.
- **AR/AP as materialized subledgers.** `fin_customer_ledger_entries` /
  `fin_vendor_ledger_entries` written by the posting engine in the same transaction as the journal
  entry, carrying open-item state (`remainingAmount`, `dueDate`), applications with FX gain/loss
  capture, statements, aging, dunning, and payment runs. Existing AP documents
  (PodSupplierInvoice/Payment, FinancialNote) remain the operational documents; `fin_` shadows
  them in the subledger.
- **Cash, banking, and instruments.** Cashboxes/petty cash, cash transactions linked to POS
  sessions, funds transfers with in-transit accounting, bank accounts, statement import with
  dedupe, reconciliation that only matches **posted** GL lines, cheque books, and the full
  issued/received cheque + post-dated cheque (PDC) lifecycle including bounce handling.
- **Tax, FX, and dimensions.** Authoritative `fin_tax_codes` with effective-dated rates and an
  immutable tax transaction subledger (existing `tax_rates` / `res_tax_configs` linked via
  zero-touch mapping tables); multi-currency journal lines with base-amount balancing, realized
  and auto-reversing unrealized FX gain/loss; cost centers, projects, and user-definable analysis
  dimensions on every journal line.
- **Budgets, assets, closing, reporting.** Budget vs actual with none/warn/block control
  policies; a fixed-asset register with depreciation runs, disposals, revaluations, and
  transfers; period-close checklists, allocation rules, staged opening balances, year-end close;
  trial balance, P&L, balance sheet, cash flow, aging, and statements.
- **Reuse, don't duplicate.** Numbering via `DocumentSequence` + `nextDocumentNumber` (additive
  `DocumentType` values); statuses via the existing `PodDocumentStatus` / `PodStatusTransition`
  registry (**no new Prisma enums**); approvals via the polymorphic `pod_approval_*` engine;
  notifications via `notify(tx, …)`; attachments/custom fields via `PodAttachment` /
  `PodCustomFieldDefinition`; events via the `appendDomainEvent` outbox; consumer cursors mirror
  `crm_projection_cursors`.

## Non-goals (this feature)

- **Payroll.** No payroll engine, payslips, or payroll postings; a future payroll module posts
  through the same posting engine.
- **Consolidation / multi-company elimination.** `companyId` scoping is carried, but group
  consolidation, intercompany elimination, and translation to a group currency are out of scope.
- **IFRS 16 lease accounting**, revenue recognition schedules (IFRS 15 contract assets), and
  hedge accounting.
- **Automated bank feeds.** Banking starts with manual entry + CSV statement import; Open
  Banking / aggregator feeds are a later integration.
- **Replacing operational documents.** `pod_supplier_invoices`, `pod_supplier_payments`,
  `sales_invoices`, `pos_sales`, `financial_notes`, and their services keep working exactly as
  today; `fin_` consumes their events and shadows them in subledgers.
- **Full AR/AP/cash/bank/tax/FX/budget/asset/closing services and UI in this pass.** This pass
  delivers the **complete spec + full `fin_` schema/migration + working GL core** (COA, fiscal,
  journals, posting engine, settings: repos/services/server functions/validation/RBAC/tests).
  Everything else is later phases tracked in `tasks.md`.
- **Table partitioning.** Deferred with documented thresholds (see `performance.md`); ship
  B-tree + BRIN indexes on `fin_journal_lines`.
- **Full E2E tests.** Unit tests accompany each phase; Playwright is a late-phase item.

## Domain-driven design framing

The module decomposes into bounded contexts, each with a consistency boundary, a lifecycle, and a
service that owns all writes inside one `prisma.$transaction`. The **Posting Engine** is the only
writer of journal entries, journal lines, GL balances, subledger entries, and tax transactions —
every other context (and every operational adapter) goes through it.

| Bounded context | Root aggregate(s) | Key members | Notes |
|-----------------|-------------------|-------------|-------|
| **General Ledger** | `fin_chart_of_accounts` | `fin_account_classes`, `fin_account_types`, `fin_account_mappings` | Unlimited hierarchy, normal balance, control accounts |
| **Fiscal Management** | `fin_fiscal_years` | `fin_fiscal_periods`, `fin_period_module_locks` | 12 + adjustment period; open/closed/locked |
| **Journal Management** | `fin_journal_entries` | `fin_journal_lines`, `fin_journal_types`, templates, recurring schedules, `fin_gl_balances` | Lines immutable; balances maintained atomically |
| **Accounts Receivable** | `fin_ar_receipts` | `fin_customer_ledger_entries`, applications, allocations, financial profiles, dunning | Open-item subledger |
| **AP Accounting** | `fin_payment_runs` | `fin_vendor_ledger_entries`, applications, supplier financial profiles | Shadows pod_ AP documents |
| **Cash Management** | `fin_cashboxes`, `fin_cash_transactions` | `fin_funds_transfers`, `fin_cash_flow_categories` | POS session settlement, petty cash, float |
| **Banking** | `fin_bank_accounts`, `fin_bank_reconciliations` | statements (+lines), matches, matching rules, cheque books, `fin_cheques` | PDC lifecycle |
| **Tax** | `fin_tax_codes` | authorities, types, effective-dated rates, mappings, `fin_tax_transactions`, returns, WHT certificates | Authoritative accounting tax master |
| **Multi-Currency** | `fin_currencies` | `fin_exchange_rates`, FX revaluation runs (+lines) | Base amounts are the balancing authority |
| **Cost Accounting** | `fin_cost_centers`, `fin_projects` | `fin_analysis_dimensions` (+values), journal-line dimension junction | Dimension accounting on every line |
| **Budgeting** | `fin_budgets` | lines, revisions, transfers, `fin_budget_control_policies` | Budget vs actual, none/warn/block |
| **Fixed Assets** | `fin_assets` | categories, depreciation methods/schedules/runs, disposals, revaluations, transfers | Capitalization from supplier invoices |
| **Financial Closing** | `fin_period_close_runs`, `fin_year_close_runs` | close task templates/tasks, opening balance batches (+lines), allocation rules/runs | Retained-earnings close |
| **Posting Engine** | `fin_posting_rules` | rule lines, `fin_posting_queue`, `fin_event_cursors` | Sole writer of the ledger |
| **Financial Settings** | `fin_settings` | `fin_payment_terms` | Tenant singleton: base currency + all default accounts |

Cross-cutting, non-aggregate concerns reused: `audit_logs`, `domain_events` (outbox),
`document_sequences` (numbering), `pod_approval_*` (approvals), `pod_notifications`
(notifications), `pod_attachments` / `pod_custom_field_*` (files, custom fields), and the
`pod_document_statuses` / `pod_status_transitions` status registry.

## The 15 sub-domains — reconciliation map

`A` = new `fin_` tables are **authoritative for accounting** · `S` = `fin_` **shadows** an
existing operational document (which stays the operational system of record) · `L` = existing
tables stay untouched and are **linked** via mapping tables. Nothing existing changes shape.

| # | Sub-domain | Disposition | What exists today → what fin_ adds |
|---|------------|-------------|-------------------------------------|
| 1 | General Ledger / COA | A | Nothing exists. `fin_account_classes`, `fin_account_types`, `fin_chart_of_accounts`, `fin_account_mappings` (generic entityType/entityId → account links for products, categories, warehouses, branches, payment methods, tax rates, POS registers, restaurant charges). |
| 2 | Fiscal Management | A | Nothing exists. `fin_fiscal_years`, `fin_fiscal_periods`, `fin_period_module_locks`. |
| 3 | Journal Management | A | Nothing exists. `fin_journal_types`, `fin_journal_entries` (+lines), templates, recurring schedules, `fin_gl_balances`. |
| 4 | Accounts Receivable | A + S | `sales_invoices`, `pos_sales`, `financial_notes` (credit notes) stay operational. `fin_customer_ledger_entries` shadow them as open items; `fin_ar_receipts` (+allocations targeting the operational docs), applications, customer financial profiles, dunning levels/runs are new fin-native. |
| 5 | AP Accounting | S | `pod_supplier_invoices` / `pod_supplier_payments` / `financial_notes` (debit notes) / landed cost **stay fully operational** — capture, 3-way match, allocation, and `pod_recompute_supplier_balance()` keep working. `fin_vendor_ledger_entries` (+applications) shadow them; `fin_supplier_financial_profiles` add AP control overrides + WHT; `fin_payment_runs` (+lines) batch-generate PodSupplierPayments. |
| 6 | Cash Management | A | POS sessions exist operationally. `fin_cashboxes`, `fin_cash_transactions` (link `posSessionId`), `fin_funds_transfers` (two-step in-transit JEs), `fin_cash_flow_categories`. |
| 7 | Banking | A | `pod_supplier_bank_accounts` (supplier-side) stays. `fin_bank_accounts` (own accounts), statements (+lines, externalId dedupe), reconciliations (+matches), matching rules, cheque books, `fin_cheques` (issued/received incl. PDC). |
| 8 | Tax | A + L | `tax_rates` (inventory/sales) and `res_tax_configs` (restaurant) **stay untouched** and keep driving operational tax math. `fin_tax_codes` (+authorities, types, effective-dated `fin_tax_code_rates`) are the accounting authority; `fin_tax_code_mappings` link the existing operational rows to fin codes — zero-touch. `fin_tax_transactions` subledger, `fin_tax_returns` (+lines), `fin_wht_certificates`. |
| 9 | Multi-Currency | A + L | Today: `currencyCode` strings + per-document `exchange_rate` columns — **all stay**. `fin_currencies` (ISO-seeded), `fin_exchange_rates` (effective-dated, spot/average/closing/budget), FX revaluation runs. Journal lines store txn + base amounts; base balances. |
| 10 | Cost Accounting (dimensions) | A | Nothing exists. `fin_cost_centers` (hierarchical), `fin_projects`, `fin_analysis_dimensions` (+values), `fin_journal_line_dimensions`. |
| 11 | Budgeting | A | Nothing exists. `fin_budgets`, lines, revisions, transfers, control policies. |
| 12 | Fixed Assets | A | Nothing exists (assets are bought as `products` today). `fin_asset_categories`, depreciation methods, `fin_assets` (capitalization from supplier invoices via sourceDoc), schedules, runs (+entries), disposals, revaluations, transfers. |
| 13 | Financial Closing | A | Nothing exists. Close task templates, period close runs (+tasks), year close runs, opening balance batches (+lines incl. open AR/AP items), allocation rules (+targets, runs). |
| 14 | Posting Engine | A | Spec 005 emits GL-ready `domain_events` — this is the promised subscriber. `fin_posting_rules` (+lines, system defaults with nullable tenantId), `fin_posting_queue`, `fin_event_cursors`. |
| 15 | Financial Settings | A | Nothing exists. `fin_settings` tenant singleton (base currency, all default accounts, `strictAccountResolution`, per-sourceDocType posting modes), `fin_payment_terms`. |

Cross-cutting foundations reused: document numbering (`document-number-service.ts` + additive
`DocumentType` values `journal_entry`, `ar_receipt`, `payment_run`, `cash_transaction`,
`funds_transfer`, `depreciation_run`, `fx_revaluation`, `tax_return`, `opening_balance`,
`allocation_run`, `asset`, `asset_disposal`, `cheque`, `dunning_run`), status registry
(`pod_document_statuses` / `pod_status_transitions` seeded for fin entity types), approvals
(`pod_approval_*`), notifications (`pod_notifications`), events (`domain_events`), audit
(`audit_logs`), attachments/custom fields (`pod_*`).

## User scenarios & testing *(mandatory)*

### User Story 1 (Priority: P1) — Accountant posts a manual journal entry

As an **accountant** holding `finance.journal_create` and `finance.journal_post`, I create a
balanced manual journal entry against leaf accounts in an open period, and post it so it becomes
immutable and hits the GL balances.

**Acceptance scenarios**
1. Given an open fiscal period and two active leaf accounts, when I create a draft JE with a
   debit line and an equal credit line, then a `fin_journal_entries` row is created
   (`statusCode = 'draft'`) with a unique `documentNumber` from the `journal_entry` sequence and
   `fin_journal_lines` carrying txn + base amounts and `exchangeRate`.
2. Given a draft JE whose Σ `baseDebitAmount` ≠ Σ `baseCreditAmount`, when I attempt to post,
   then posting is rejected with a validation error and nothing is written — the app assertion,
   row CHECKs, and the deferred DB constraint trigger all agree.
3. Given a balanced draft JE, when I post it, then `statusCode` moves `draft → posted`,
   `isPosted/postedAt/postedByProfileId` are stamped, `fin_gl_balances` rows for each
   account/period/currency are upserted atomically, a `fin_journal_entry.posted` domain event and
   an audit log are written — all in one transaction.
4. Given a posted JE, when I attempt to edit its lines, then the mutation is rejected; when I
   reverse it, then a mirror-image reversal entry is created and posted, the original is marked
   reversed, and GL balances net to zero.
5. Given a journal type configured to require approval, when I submit a JE above the workflow
   threshold, then a `pod_approval_requests` is raised and the JE cannot post until approved.

### User Story 2 (Priority: P1) — Controller manages the fiscal calendar and closes a period

As a **controller** holding `finance.fiscal_manage`, I create a fiscal year with generated
periods, soft-close modules, close periods, and lock them so nothing posts into history.

**Acceptance scenarios**
1. Given tenant finance is bootstrapped, when I create a fiscal year for 2026, then 12 monthly
   `fin_fiscal_periods` plus one adjustment period (13) are generated with contiguous,
   non-overlapping date ranges and `statusCode = 'future'`/`'open'` per configuration.
2. Given an open period, when I set a `fin_period_module_locks` row for `sourceModule = 'pos'`,
   then POS-sourced postings into that period are rejected while manual JEs still post.
3. Given an open period, when I close it, then any posting dated inside it is rejected with a
   closed-period error; when I lock it, then not even `finance.fiscal_manage` can reopen it
   without the explicit unlock permission.
4. Given the adjustment period, when a JE is flagged `isAdjustment` by a holder of the adjustment
   permission, then it posts into period 13; without the flag/permission it is rejected.

### User Story 3 (Priority: P1) — System auto-posts a POS sale through the async queue

As the **system**, when a POS sale settles, the finance consumer picks up the domain event,
resolves a posting rule, and posts revenue/tax/tender journal lines — without ever blocking the
sale.

**Acceptance scenarios**
1. Given an active posting rule for `sourceDocType = 'pos_sale'`, when a `pos_sale` settlement
   event lands in `domain_events`, then the finance consumer advances its `fin_event_cursors`
   row, enqueues a `fin_posting_queue` row (deduped by unique key), and the queue processor posts
   a balanced JE debiting the tender account (cash/card via payment-method mapping) and crediting
   revenue and output tax.
2. Given the same event is delivered twice, when the second delivery is processed, then the
   partial unique idempotency index on `(tenantId, sourceDocType, sourceDocId, sourceEventType)`
   makes the second post a no-op — exactly one posted JE exists.
3. Given a missing account mapping and `strictAccountResolution = false`, when the sale posts,
   then the unresolvable side posts to the suspense account and a notification is raised; the
   sale itself is never blocked or rolled back.
4. Given a posting failure (e.g. closed period), when the queue processor retries, then it backs
   off up to 5 attempts and then parks the row as `failed`, visible in the posting exceptions
   screen with a notification — the operational document is unaffected.

### User Story 4 (Priority: P2) — AP clerk runs a payment run

As an **AP clerk** holding `finance.payment_run_manage`, I select due vendor open items, generate
a payment run, approve it, and execute it — which creates the supplier payments and clears the
vendor ledger.

**Acceptance scenarios**
1. Given posted vendor open items (`fin_vendor_ledger_entries` with `remainingAmount > 0`) due by
   a cutoff date, when I create a payment run, then `fin_payment_run_lines` propose one line per
   vendor/open-item selection honoring payment terms and any AP-control override on
   `fin_supplier_financial_profiles`.
2. Given an approved run, when I execute it, then `pod_supplier_payments` (+allocations) are
   generated per line through the existing operational service, and the resulting payment events
   post to the ledger, reducing each open item's `remainingAmount` via
   `fin_vendor_ledger_applications`.
3. Given a partial payment line, when executed, then the open item's `remainingAmount` drops by
   exactly the applied amount and the item stays open; a full application closes it.
4. Given a foreign-currency open item, when the applied rate differs from the invoice rate, then
   realized FX gain/loss posts to the configured gain/loss accounts at application time.

### User Story 5 (Priority: P2) — Treasurer reconciles a bank statement

As a **treasurer** holding `finance.bank_reconcile`, I import a bank statement, match its lines
against posted GL activity on the bank account, and close the reconciliation at a zero
difference.

**Acceptance scenarios**
1. Given a CSV statement import, when lines carry `externalId`s already imported, then duplicates
   are skipped (dedupe) and only new `fin_bank_statement_lines` are created.
2. Given an open reconciliation, when I match a statement line to a GL line, then only **posted**
   journal lines on the bank GL account are matchable — draft entries never appear.
3. Given `fin_bank_matching_rules`, when auto-match runs, then rule-matched pairs are proposed
   and I confirm or reject each; confirmed matches write `fin_bank_reconciliation_matches`.
4. Given all lines matched and statement balance = reconciled GL balance, when I complete the
   reconciliation, then it becomes immutable and matched lines are excluded from future
   reconciliations.
5. Given a received cheque deposited but bounced, when I mark the cheque `bounced`, then the
   clearing entry reverses and the customer open item reopens.

### User Story 6 (Priority: P1) — CFO reads the trial balance and financial statements

As a **CFO** holding `finance.report_view`, I read a trial balance, P&L, and balance sheet for
any period range, in base currency, drilling from statement line to account to journal entry.

**Acceptance scenarios**
1. Given posted activity, when I run the trial balance for a period, then debit and credit column
   totals are exactly equal, every account's balance equals its `fin_gl_balances` aggregate, and
   opening + movement = closing per account.
2. Given the account-class/type hierarchy, when I run the P&L for a range, then revenue and
   expense accounts roll up by type/class and net income equals revenue − expenses.
3. Given a mid-year date, when I run the balance sheet, then Assets = Liabilities + Equity, with
   current-year earnings computed dynamically (no physical P&L rollover during the year).
4. Given a statement figure, when I drill down, then I reach the contributing accounts, then the
   journal lines, then the source document reference (`sourceDocType`/`sourceDocId`).

### User Story 7 (Priority: P2) — Accountant runs depreciation

As an **accountant** holding `finance.asset_manage`, I run monthly depreciation across the asset
register; each asset's schedule is consumed and depreciation posts to the GL, and disposal stops
depreciation for good.

**Acceptance scenarios**
1. Given capitalized assets with generated `fin_asset_depreciation_schedules`, when I execute a
   `fin_depreciation_runs` for a period, then one `fin_asset_depreciation_entries` per due
   schedule row is created and a JE posts depreciation expense against accumulated depreciation
   using the asset category's accounts.
2. Given a run for a period already run, when I re-execute, then already-depreciated schedule
   rows are skipped — the run is idempotent per asset/period.
3. Given an asset disposed mid-life, when I post the disposal, then depreciation up to the
   disposal date is caught up, gain/loss vs net book value posts to the configured accounts, and
   **no subsequent run ever depreciates that asset again**.
4. Given an asset capitalized from a supplier invoice, when created, then
   `sourceDocType/sourceDocId` reference the `pod_supplier_invoices` row.

### User Story 8 (Priority: P3) — Admin configures posting rules and account mappings

As a **tenant admin** holding `finance.posting_manage` and `finance.settings_manage`, I tailor
default accounts, account mappings, and posting rules so postings land where my accounting policy
wants them — without a code deploy.

**Acceptance scenarios**
1. Given the seeded system posting rules (`tenantId IS NULL`), when I clone one as a tenant rule
   and change a rule line's account source, then my tenant's postings use my rule while other
   tenants keep the system default.
2. Given a `fin_account_mappings` row for `entityType = 'product_category'` on a parent category,
   when a product in a child category posts, then resolution walks product → category → parent
   categories and finds my mapping.
3. Given `fin_settings.strictAccountResolution = true`, when a posting cannot resolve an account,
   then the post fails loudly (fin-native docs); with `false`, it posts to suspense and notifies
   (async adapters' default).
4. Given a change to a default account in `fin_settings`, when the next document posts, then the
   new default applies; already-posted entries are untouched.

### Edge cases

- **Unbalanced JE** → rejected at all three layers (app `assertBalanced`, row CHECKs
  `debit >= 0` / `credit >= 0` / not both > 0, deferred constraint trigger at commit). Nothing is
  written.
- **Posting into a closed/locked period** → rejected with a closed-period error; async adapters
  park the queue row as failed + notify rather than silently repost into the next open period.
- **Missing account mapping** → strict mode throws (fin-native documents); suspense mode posts
  the unresolvable side to the suspense account and raises a notification for later
  reclassification (async operational adapters' default).
- **FX rounding residue** → base amounts are computed per line at `Decimal(19,8)` rates; any
  penny residue from rounding is synthesized as a line to the configured rounding account so the
  entry balances exactly.
- **Reversal of a reversed entry** → rejected (`ConflictError`); an entry can be reversed at most
  once, and a reversal entry itself cannot be reversed — post a new correcting entry instead.
- **Duplicate event delivery** → the partial unique index on
  `(tenant_id, source_doc_type, source_doc_id, source_event_type) WHERE status_code = 'posted'
  AND reversal_of_entry_id IS NULL` guarantees at-most-once posting per source event; redelivery
  is a logged no-op.
- **Backdated entries** → allowed only into periods still `open` (and module-unlocked); the
  period is resolved from the entry date, never from "today".
- **Manual journal against a control account** → rejected; accounts flagged `isControlAccount`
  (AR control, AP control, inventory, GRNI…) accept postings only from their owning subledger via
  the posting engine, keeping subledger and GL reconciled by construction.
- **Deactivating an account with a non-zero balance or children** → rejected until the balance is
  cleared and children are re-parented/deactivated.
- **Tenant deletion** → all `fin_` rows cascade via the `tenantId` FK; immutable ledger tables
  have no soft delete by design.

## Requirements *(mandatory)*

### Functional requirements

#### General Ledger (FR-GL)

- **FR-GL-1** The chart of accounts MUST support unlimited hierarchy via `parentAccountId` with a
  maintained `level`, materialized `path`, and `isLeaf` flag; only **leaf** accounts accept
  journal lines.
- **FR-GL-2** Every account MUST belong to an account type and class carrying a **normal balance
  side** (debit/credit); reports derive sign presentation from it.
- **FR-GL-3** Accounts flagged `isControlAccount` MUST reject manual journal lines; only the
  posting engine acting for the owning subledger (`controlDomain`) may post to them.
  `allowManualJournal = false` MUST likewise block manual lines on any account.
- **FR-GL-4** Account deactivation MUST be blocked while the account has a non-zero balance in
  any open period or has active children.
- **FR-GL-5** `fin_account_mappings` MUST link operational entities (product, category,
  warehouse, branch, payment method, tax rate, POS register, restaurant charge, party group…) to
  accounts via generic `entityType`/`entityId`/`entityCode` + `mappingRole`, with no schema
  change needed for a new mapped entity kind.
- **FR-GL-6** A default COA template (EN + AR account names) MUST be seedable per tenant at
  finance bootstrap; account classes/types ship as system rows (`tenantId IS NULL`) overridable
  per tenant.
- **FR-GL-7** An account MAY restrict its posting currency; a journal line in another currency
  against it MUST be rejected.

#### Fiscal Management (FR-FY)

- **FR-FY-1** Fiscal years MUST generate 12 periods plus one adjustment period (13) with
  contiguous, non-overlapping ranges; period status is `future/open/closed/locked`.
- **FR-FY-2** Postings MUST resolve their fiscal period from the **entry date**; a date in a
  `closed` or `locked` period MUST be rejected.
- **FR-FY-3** `fin_period_module_locks` MUST support per-module soft close: a locked
  `sourceModule` rejects postings from that module while the period stays open for others.
- **FR-FY-4** Posting into the adjustment period MUST require an explicit `isAdjustment` flag
  plus the adjustment permission.
- **FR-FY-5** Closing a period MUST be reversible (reopen) while the year is open and the period
  is not `locked`; locking is the stronger, deliberate action.

#### Journal Management (FR-JE)

- **FR-JE-1** Every journal entry MUST have ≥ 2 lines, and each line MUST carry either a debit or
  a credit (XOR), non-negative, in both transaction and base currency.
- **FR-JE-2** A journal entry MUST NOT post unless Σ base debits = Σ base credits exactly —
  enforced in three layers (app assertion, row CHECKs, deferred DB constraint trigger).
- **FR-JE-3** Journal entries MUST be auto-numbered per journal type via `DocumentSequence`
  (`journal_entry` DocumentType); `(tenantId, documentNumber)` MUST be unique.
- **FR-JE-4** Journal types configured for approval MUST route entries through the existing
  `pod_approval_*` engine before posting.
- **FR-JE-5** Posted entries and their lines MUST be immutable; the only correction path is a
  reversal entry (mirror image, cross-linked via `reversalOfEntryId`), after which a corrected
  entry may be posted. A reversal entry MUST NOT itself be reversible.
- **FR-JE-6** `fin_gl_balances` MUST be maintained per account/period/currency by atomic
  `INSERT … ON CONFLICT DO UPDATE` inside the posting transaction; a repair function
  (`fin_rebuild_gl_balances()`) MUST be able to rebuild them from journal lines.
- **FR-JE-7** Journal templates and recurring schedules MUST generate draft entries; generated
  entries follow the same posting rules as manual ones.

#### Accounts Receivable (FR-AR)

- **FR-AR-1** Every AR-relevant posting MUST write `fin_customer_ledger_entries` open items
  (invoice, credit note, receipt, adjustment) in the same transaction as the journal entry,
  carrying `remainingAmount` and `dueDate`.
- **FR-AR-2** AR receipts MUST support allocation to specific open items (exactly one target per
  allocation row) with partial payment, overpayment, and unallocated **advance / on-account**
  amounts; over-allocation beyond an item's `remainingAmount` MUST be rejected unless the
  overpayment policy converts the excess to an advance.
- **FR-AR-3** Customer statements and aging (bucketed by `dueDate`) MUST be derivable entirely
  from the subledger.
- **FR-AR-4** Dunning MUST support configurable levels (days overdue, fee, template) and dunning
  runs that record per-customer entries and raise notifications.
- **FR-AR-5** Customer financial profiles MUST support an AR-control account override and default
  payment terms per customer.

#### AP Accounting (FR-AP)

- **FR-AP-1** Posted `pod_supplier_invoices` / `pod_supplier_payments` / debit notes / landed
  cost MUST be shadowed as `fin_vendor_ledger_entries` open items via async posting; the
  operational documents and `pod_recompute_supplier_balance()` continue to work unchanged.
- **FR-AP-2** Vendor applications (payment → invoice) MUST mirror AR application rules, including
  partial application and realized FX gain/loss at application time.
- **FR-AP-3** Payment runs MUST select due open items by cutoff/terms, support hold/exclude per
  line, require approval, and on execution generate `pod_supplier_payments` (+allocations)
  through the existing operational service.
- **FR-AP-4** Vendor statements and AP aging MUST be derivable entirely from the subledger, and
  MUST reconcile to the AP control account balance.
- **FR-AP-5** Supplier financial profiles MUST support AP-control override and withholding-tax
  defaults feeding `fin_wht_certificates`.

#### Cash Management (FR-CASH)

- **FR-CASH-1** Cashboxes MUST be GL-linked with a custodian and float limit; petty cash
  disbursements/expenses/receipts/floats post through `fin_cash_transactions`.
- **FR-CASH-2** POS session settlement MUST be postable into a cashbox via `posSessionId`-linked
  cash transactions (async adapter).
- **FR-CASH-3** Funds transfers (cash↔bank, cash↔cash) MUST post two-step through the in-transit
  account: dispatch and confirmation each post a JE.
- **FR-CASH-4** Cash flow categories MUST classify cash transactions for the cash-flow
  statement.

#### Banking (FR-BANK)

- **FR-BANK-1** Bank statement import MUST dedupe lines by `externalId`; re-importing a file
  creates no duplicates.
- **FR-BANK-2** Bank reconciliation MUST only match **posted** journal lines on the bank GL
  account; a completed reconciliation is immutable and its matched lines are excluded from later
  reconciliations.
- **FR-BANK-3** Matching rules MUST support auto-match proposals (amount/date/reference
  heuristics) with explicit user confirmation.
- **FR-BANK-4** Cheques (issued and received) MUST follow the lifecycle
  `issued → deposited → presented → cleared | bounced`; post-dated cheques MUST NOT post to the
  bank account before maturity/clearing (they sit on PDC holding accounts), and a bounce MUST
  reverse the clearing and reopen the underlying open item.
- **FR-BANK-5** Cheque books MUST track leaf ranges and prevent duplicate cheque numbers per
  book.

#### Tax (FR-TAX)

- **FR-TAX-1** `fin_tax_codes` MUST carry input/output account links and a reporting box;
  `fin_tax_code_rates` MUST be effective-dated, and the applicable rate is selected by the
  **document date**.
- **FR-TAX-2** Existing `tax_rates` and `res_tax_configs` MUST remain untouched;
  `fin_tax_code_mappings` link them to fin tax codes for posting (zero-touch integration).
- **FR-TAX-3** Every tax-bearing posting MUST write immutable `fin_tax_transactions` rows in the
  posting transaction; tax returns aggregate them by reporting box for a period range.
- **FR-TAX-4** Withholding tax MUST be capturable at payment with `fin_wht_certificates` issued
  per vendor/period.

#### Multi-Currency (FR-FX)

- **FR-FX-1** Every journal line MUST store transaction-currency amounts, base-currency amounts,
  and the `exchangeRate(19,8)` used; **base amounts are the balancing authority**.
- **FR-FX-2** Exchange rates MUST be effective-dated with `rateType`
  (spot/average/closing/budget); rate lookup takes the latest rate on or before the document
  date for the requested type.
- **FR-FX-3** Realized FX gain/loss MUST post at application time (receipt/payment applied to an
  open item at a different rate) to the configured realized gain/loss accounts.
- **FR-FX-4** FX revaluation runs MUST revalue open monetary balances at the closing rate,
  posting unrealized gain/loss entries that **auto-reverse** in the next period.
- **FR-FX-5** Rounding residue from base-amount computation MUST post to the configured rounding
  account so entries balance exactly.

#### Cost Accounting / Dimensions (FR-DIM)

- **FR-DIM-1** Cost center and project MUST be first-class FK columns on journal lines;
  additional user-defined dimensions attach via `fin_journal_line_dimensions`.
- **FR-DIM-2** Cost centers MUST support hierarchy for roll-up reporting.
- **FR-DIM-3** Accounts MAY require a dimension (e.g. expense accounts require a cost center); a
  line missing a required dimension MUST be rejected at posting.
- **FR-DIM-4** Analysis dimensions and their values MUST be tenant-definable without schema
  change.

#### Budgeting (FR-BUD)

- **FR-BUD-1** Budgets MUST be per fiscal year with lines by account/period and optional cost
  center/project, with revision history.
- **FR-BUD-2** Budget vs actual MUST compare budget lines against `fin_gl_balances` with variance
  amount and percentage.
- **FR-BUD-3** Budget control policies MUST support `none/warn/block` per account range/cost
  center with a tolerance percentage; `block` rejects the posting, `warn` posts and notifies.
- **FR-BUD-4** Budget transfers between lines MUST route through the approval engine.

#### Fixed Assets (FR-FA)

- **FR-FA-1** Assets MUST capitalize with category-defaulted accounts and depreciation method,
  optionally sourced from a supplier invoice (`sourceDocType/sourceDocId`).
- **FR-FA-2** Depreciation schedules MUST be generated at capitalization and consumed by
  depreciation runs; runs are idempotent per asset/period and post expense vs accumulated
  depreciation.
- **FR-FA-3** Depreciation MUST stop permanently at disposal; disposal catches up depreciation to
  the disposal date and posts gain/loss vs net book value.
- **FR-FA-4** Asset revaluations and transfers (between branches/cost centers) MUST post the
  corresponding entries and preserve full history.

#### Financial Closing (FR-CLOSE)

- **FR-CLOSE-1** Period close runs MUST instantiate configurable close-task checklists
  (templates → run tasks) with per-task status and assignee.
- **FR-CLOSE-2** Allocation rules MUST distribute source-account balances across targets by fixed
  percentages or statistical basis, posting an allocation JE per run.
- **FR-CLOSE-3** Year close MUST post a single closing JE zeroing P&L accounts into retained
  earnings, plus the next-year opening JE; the balance sheet computes current-year earnings
  dynamically during the year (no physical monthly rollover).
- **FR-CLOSE-4** Year close MUST be reversible until conflicting next-year activity exists.
- **FR-CLOSE-5** Opening balances MUST be staged in batches (+lines, incl. open AR/AP items),
  validated (balanced), then posted exactly once; a posted batch is immutable.

#### Posting Engine (FR-POST)

- **FR-POST-1** Posting rules (`fin_posting_rules` + lines) MUST define, per
  `sourceDocType`/event: line role, side, account source (fixed / mapping / settings default),
  amount selector, and multiplier — **configurable per tenant without code changes**, with
  system defaults (`tenantId IS NULL`) overridable per tenant.
- **FR-POST-2** Account resolution MUST follow the fixed order: rule line fixed account →
  `fin_account_mappings` walk (product → category (walking parents) → warehouse → branch →
  payment method → party group) → `fin_settings` named default → then `strictAccountResolution` ?
  throw : post to suspense + notify.
- **FR-POST-3** Posting MUST be idempotent per `(sourceDocType, sourceDocId, sourceEventType)`
  via a partial unique index scoped to posted, non-reversal entries.
- **FR-POST-4** Fin-native documents MUST post synchronously in-transaction; operational
  documents MUST post asynchronously via `domain_events` → `fin_event_cursors` →
  `fin_posting_queue` (retry ≤ 5 with backoff; failures parked visible + notified). Operational
  flows MUST never block on accounting.
- **FR-POST-5** Every posting MUST write, in one transaction: journal entry + lines, GL balance
  upserts, applicable subledger rows, applicable tax transactions, a domain event, and an audit
  log.

#### Financial Settings (FR-SET)

- **FR-SET-1** `fin_settings` MUST be a tenant singleton holding the base currency and every
  named default account (retained earnings, realized/unrealized FX gain/loss ×4, rounding,
  suspense, AR control, AP control, GRNI, inventory, COGS, bank clearing), plus
  `strictAccountResolution` and per-`sourceDocType` posting modes.
- **FR-SET-2** Payment terms MUST ship as system rows overridable per tenant and drive `dueDate`
  computation on open items.
- **FR-SET-3** A tenant finance bootstrap MUST create settings, the default COA, the first fiscal
  year + periods, and journal types in one idempotent operation.
- **FR-SET-4** Every `fin_` server function MUST chain
  `getCurrentUserContext → requireTenantAccess → requirePermission`, validate input with Zod, and
  write inside a single `prisma.$transaction`; every new `finance.*` permission MUST be
  registered in `rbac-catalog.ts` and linked in `module-catalog.ts`.
- **FR-SET-5** No new Prisma enums: `fin_` document statuses use string `statusCode` backed by
  `pod_document_statuses` / `pod_status_transitions` seeded for fin entity types; the additive
  `DocumentType` enum extension is the established numbering path.

### Key entities

GL/COA (`fin_account_classes`, `fin_account_types`, `fin_chart_of_accounts`,
`fin_account_mappings`), Fiscal (`fin_fiscal_years`, `fin_fiscal_periods`,
`fin_period_module_locks`), Journals (`fin_journal_types`, `fin_journal_entries`,
`fin_journal_lines`, `fin_journal_templates` (+lines), `fin_recurring_journal_schedules`,
`fin_gl_balances`), AR (`fin_customer_ledger_entries` (+applications), `fin_ar_receipts`
(+allocations), `fin_customer_financial_profiles`, `fin_dunning_levels/_runs/_run_entries`), AP
(`fin_vendor_ledger_entries` (+applications), `fin_supplier_financial_profiles`,
`fin_payment_runs` (+lines)), Cash (`fin_cashboxes`, `fin_cash_transactions`,
`fin_funds_transfers`, `fin_cash_flow_categories`), Banking (`fin_bank_accounts`,
`fin_bank_statements` (+lines), `fin_bank_reconciliations` (+matches),
`fin_bank_matching_rules`, `fin_cheque_books`, `fin_cheques`), Tax (`fin_tax_authorities`,
`fin_tax_types`, `fin_tax_codes` (+rates, mappings), `fin_tax_transactions`, `fin_tax_returns`
(+lines), `fin_wht_certificates`), Currency (`fin_currencies`, `fin_exchange_rates`,
`fin_fx_revaluation_runs` (+lines)), Dimensions (`fin_cost_centers`, `fin_projects`,
`fin_analysis_dimensions` (+values), `fin_journal_line_dimensions`), Budgets (`fin_budgets`
(+lines), `fin_budget_revisions`, `fin_budget_transfers`, `fin_budget_control_policies`), Assets
(`fin_asset_categories`, `fin_depreciation_methods`, `fin_assets`,
`fin_asset_depreciation_schedules`, `fin_depreciation_runs` (+entries), `fin_asset_disposals`,
`fin_asset_revaluations`, `fin_asset_transfers`), Closing (`fin_close_task_templates`,
`fin_period_close_runs` (+tasks), `fin_year_close_runs`, `fin_opening_balance_batches` (+lines),
`fin_allocation_rules` (+targets), `fin_allocation_runs`), Engine/Settings (`fin_settings`,
`fin_posting_rules` (+lines), `fin_posting_queue`, `fin_event_cursors`, `fin_payment_terms`).

## Success criteria

- `pnpm prisma validate` parses the schema; both hand-authored migrations (`DocumentType`
  additions, then the full `fin_` DDL + seeds) apply cleanly via `pnpm prisma migrate deploy`
  and `pnpm prisma generate` produces a type-correct client.
- Tenant finance bootstrap creates settings + default COA + fiscal year/periods + journal types;
  a balanced manual JE creates, posts, upserts `fin_gl_balances`, rejects an idempotent re-post,
  and reverses cleanly — all through the server functions with the guard chain.
- An unbalanced JE is rejected at the app layer, and — if forced past it — by the deferred DB
  constraint trigger at commit.
- `pnpm db:seed` seeds the new `finance.*` permissions; `catalog-rbac.test.ts` /
  `rbac-catalog.test.ts` stay green with the finance module/screens/links added.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck` and
  `pnpm vitest run tests/unit/fin-*.test.ts` are green; `pnpm smoke` overall green modulo the
  three known pre-existing failures.
- Changing a posting rule line or an account mapping for one tenant requires only data changes —
  no deploy — and does not affect other tenants.

## Assumptions

- The single `prisma/schema.prisma` continues to hold all models; the `fin_` section is grouped
  under one banner comment.
- **Company = `TenantAccount`; operational branch = `Warehouse`** — same convention as Spec 005;
  `companyId` / `branchId` are nullable scalar UUIDs.
- App-level tenant scoping via the guard chain stays the primary isolation boundary; whatever RLS
  treatment the 005 migration applied is mirrored for `fin_` tables (verified at implementation).
- The database has drifted from the migration history (`auth.uid()` defaults); migrations are
  hand-authored SQL applied with `pnpm prisma migrate deploy` — **never** `migrate dev`.
- The `domain_events` outbox, `pod_approval_*`, `pod_notifications`,
  `document-number-service.ts`, and the `pod_document_statuses` registry are the integration
  substrate; Feature 006 adds event types, statuses, transitions, and seed data — not new
  infrastructure.
- Money is `Decimal(19,4)`, unit cost `(19,6)`, rates `(9,6)`, FX rates `(19,8)`; Decimals are
  serialized to strings at the DTO boundary.
- Immutable ledger tables (journal lines, subledger entries, tax transactions, GL balances) have
  **no soft delete**; mutable headers carry `createdBy/updatedBy/deletedBy`, `versionNumber`,
  `deletedAt`.

## Glossary

- **Double-entry** — every transaction posts equal debits and credits; the ledger always
  balances.
- **Journal (entry)** — the atomic accounting document: a header plus ≥ 2 debit/credit lines.
- **Ledger / GL** — the general ledger: the full set of posted journal lines and the balances
  they produce per account.
- **COA** — chart of accounts; the tenant's account hierarchy.
- **Normal balance** — the side (debit or credit) on which an account naturally increases.
- **Control account** — a GL account whose balance is owned by a subledger (AR, AP, inventory);
  manual postings are blocked so GL and subledger reconcile by construction.
- **Subledger** — the detailed open-item ledger (customer/vendor entries) behind a control
  account.
- **Open item** — a subledger entry with `remainingAmount > 0` (unpaid invoice, unapplied
  receipt).
- **Application / allocation** — matching a payment/receipt/credit against specific open items.
- **Advance / on-account** — a received or paid amount not yet applied to any open item.
- **Trial balance** — per-account debit/credit totals for a range; must always foot equal.
- **Suspense account** — the configured account that absorbs postings whose target account could
  not be resolved, pending reclassification.
- **GRNI** — goods received not invoiced; the accrual account between goods receipt and supplier
  invoice.
- **PDC** — post-dated cheque; held on a PDC account and not posted to the bank until
  maturity/clearing.
- **WHT** — withholding tax deducted at payment and certified to the vendor.
- **Dunning** — the escalating overdue-reminder process for customer open items.
- **Realized / unrealized FX gain-loss** — currency difference recognized at application time
  (realized) vs revalued on open balances at period end (unrealized, auto-reversing).
- **Depreciation / NBV** — periodic expensing of an asset's cost; net book value = cost −
  accumulated depreciation.
- **Retained earnings** — the equity account receiving net income at year close.
- **Posting rule** — the configurable recipe translating an operational event into debit/credit
  lines.
- **Idempotent posting** — at-most-once posting per source document event, enforced by a partial
  unique index.
- **`fin_`** — table prefix for the Financial Management accounting layer (Spec 006).

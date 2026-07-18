# Financial Management — Task Breakdown (Spec 006)

Phased checklist. **Phases 0–1 are delivered in the current pass** (docs + full `fin_` schema/
migration + working GL core). Phases 2–14 build the async posting infrastructure, module
adapters, and remaining financial domains on top of the engine, reusing the existing
numbering/status/approval/notification/event infrastructure.

## Phase 0 — Docs, schema & catalog (this pass)

- [x] Author spec-kit docs (`spec/plan/business-rules/tasks` + `data-model` with EN+AR per-entity docs for all 86 tables, `erd` 16 mermaid diagrams, `integration`, `sequence-diagrams`, `state-diagrams`, `api`, `performance`).
- [x] Add `// FINANCE (fin_)` section to `prisma/schema.prisma` — all 86 `Fin*` models + `TenantAccount` back-relations.
- [x] Extend `DocumentType` enum with the 14 fin values (`journal_entry`, `ar_receipt`, `payment_run`, `cash_transaction`, `funds_transfer`, `depreciation_run`, `fx_revaluation`, `tax_return`, `opening_balance`, `allocation_run`, `asset`, `asset_disposal`, `cheque`, `dunning_run`, + `budget_transfer`). Implemented as `ADD VALUE IF NOT EXISTS` at the top of the single v1 migration (section 0) rather than a separate folder — the enum values are only *referenced by string* in later seeds, never used as an enum literal in the same statement, so a split migration was unnecessary.
- [x] Hand-author migration `prisma/migrations/20260718110000_financial_management_enterprise_v1/migration.sql` — all `fin_` tables/FKs (CREATE sections generated with `prisma migrate diff`) + hand-written CHECK constraints, partial unique idempotency index `fin_journal_entries_source_unique`, `fin_check_entry_balanced()` + two DEFERRABLE constraint triggers, `fin_rebuild_gl_balances()`, BRIN on journal lines, RLS block mirroring the 005 migration.
- [x] Seed in the migration: account classes/types, journal types, depreciation methods, cash-flow categories, tax types, payment terms, dunning levels, default posting rules + lines (AP invoice/payment, sales invoice, POS sale, restaurant order, sales return), `PodDocumentStatus`/`PodStatusTransition` rows for 17 fin entity types, 15 ISO currencies.
- [x] Add 9 `finance.*` permissions to `rbac-catalog.ts` + `finance_manager` role + `super_admin` grant.
- [x] Add `finance` module + 4 screens + `PERMISSION_LINKS` in `module-catalog.ts` (`catalog-rbac.test.ts` green).
- [x] Map new `DocumentType` prefixes in `document-number-service.ts` (`JV`, `ARR`, `PMR`, `CSH`, `FTR`, `DEP`, `FXR`, `TAXR`, `OB`, `ALC`, `FA`, `FAD`, `DUN`, `BTR`).
- [x] Add `fin_journal_entry.posted` / `.reversed` payload types to `domain-event-types.ts`.
- [x] Add nested `finance.*` i18n keys (`en` + `ar`).
- [x] `pnpm prisma validate` + `pnpm prisma generate` green. **Remaining (needs live DB — user runs):** `pnpm prisma migrate deploy` (NEVER `migrate dev`) → optional re-seed.

## Phase 1 — GL core (this pass)

- [x] Repos: `fin-account-repo.ts`, `fin-fiscal-repo.ts`, `fin-journal-repo.ts`, `fin-gl-balance-repo.ts` (upsert-increment + trial balance read), `fin-settings-repo.ts`, `fin-posting-rule-repo.ts` (rules/queue/cursors), `fin-currency-repo.ts` — pod style.
- [x] Pure helpers (no Prisma): `account-resolution.ts` (resolution walk, strict/suspense, rule select, amount select), `journal-balancing.ts` (balance assert, rounding synthesis, mixed currency, reversal lines), `period-resolution.ts` (date → period + status/lock checks, `generatePeriods`).
- [x] Services: `account-service.ts` (COA CRUD, path maintenance, deactivate guards), `coa-template.ts` (pure default COA, EN+AR names), `bootstrap-service.ts` (`initializeTenantFinance`, idempotent), `fiscal-service.ts`, `journal-service.ts` (draft/update/post/reverse orchestration, control-account protection), `posting-engine.ts` (`postJournalEntry(tx,…)` + `applyDraftPostingSideEffects` + `reverseJournalEntry`), `currency-service.ts` (+ pure `convertToBase`), `settings-service.ts`, `posting-context.ts` (adapter interface types).
- [x] Feature module `src/features/finance/` — `finance-validation.ts`, `account-server-functions.ts`, `fiscal-server-functions.ts`, `journal-server-functions.ts` (incl. trial balance), `settings-server-functions.ts` (incl. bootstrap/currency/posting-rules), `finance-dto.ts` (Decimal→string).
- [x] Unit tests: `fin-journal-balancing.test.ts`, `fin-account-resolution.test.ts`, `fin-period-resolution.test.ts` (incl. leap years + generatePeriods), `fin-coa-template.test.ts`, `fin-validation.test.ts` — **60 tests passing**. Opt-in real-DB posting-engine test still to add (needs the inventory-style harness + live DB).
- [ ] Manual smoke via server functions: bootstrap → fiscal year/periods → create+post balanced JE → verify `fin_gl_balances` + idempotent re-post rejection + reversal (needs live DB — user runs after `migrate deploy`).

## Phase 2 — Async posting infra + inventory adapter

- [ ] Finance event consumer over `domain_events` with `fin_event_cursors` (mirrors `crm_projection_cursors`).
- [ ] Queue processor for `fin_posting_queue` — dedupe unique, retry ≤ 5 with backoff, park as `failed` + notification; config-gated on-demand invocation (cron scheduler stays an infra follow-up).
- [ ] Posting exceptions surface: failed-queue list + suspense-balance report server functions.
- [ ] Inventory adapter: receipt/issue/adjustment/transfer/count/manufacturing events → inventory / GRNI / COGS postings via posting rules; suspense default (`strictAccountResolution = false`) for async.
- [ ] Tests: consumer cursor advance, queue retry/park semantics, duplicate-delivery no-op, inventory rule mapping.

## Phase 3 — AP subledger + purchasing adapters

- [ ] Repos: `fin-vendor-ledger-repo.ts`, `fin-payment-run-repo.ts`, `fin-supplier-financial-profile-repo.ts`.
- [ ] Purchasing adapters: `supplier_invoice.posted`, `supplier_payment.posted`, debit notes, landed cost → vendor ledger entries + applications + GL postings (GRNI clearing).
- [ ] Payment runs: select due open items by cutoff/terms + AP-control overrides, hold/exclude lines, approval via `pod_approval_*`, execute → generate `pod_supplier_payments` (+allocations) through the existing operational service.
- [ ] WHT capture at payment + `fin_wht_certificates`.
- [ ] Vendor statements + AP aging from the subledger; AP-control reconciliation report.
- [ ] Tests: shadow-entry creation, application caps, FX gain/loss at application, run selection/execution.

## Phase 4 — AR subledger + AR receipts + sales/POS adapters

- [ ] Repos: `fin-customer-ledger-repo.ts`, `fin-ar-receipt-repo.ts`, `fin-customer-financial-profile-repo.ts`, `fin-dunning-repo.ts`.
- [ ] `ar-receipt-service.ts` — capture, allocate (exactly-one-target, partial/over/advance per policy), post (sync); realized FX at application.
- [ ] Sales/POS adapters: SalesInvoice, returns, credit notes, PosSale/Payment/Session settlement → customer ledger + revenue/tax/tender postings.
- [ ] Customer statements + AR aging; dunning levels/runs + notifications.
- [ ] Tests: allocation rules, overpayment→advance, aging buckets, dunning level assignment, POS settlement idempotency.

## Phase 5 — Restaurant + CRM adapters

- [ ] Restaurant adapters: order payments/charges/tips/discounts → revenue/tip-liability postings via `res_` event mapping.
- [ ] Gift-card and loyalty liability postings (issue/redeem).
- [ ] CRM credit limits: expose fin AR exposure (open items + unposted) to the CRM credit check.
- [ ] Tests: tip liability, gift-card liability lifecycle, mapping fallbacks.

## Phase 6 — Cash management

- [ ] Repos + services: cashboxes (GL-linked, custodian, float limit), `fin_cash_transactions` (receipt/disbursement/expense/float, `posSessionId` link), `fin_funds_transfers` (two-step in-transit), cash-flow categories.
- [ ] Negative-balance guard, float-limit notifications, POS session settlement into cashboxes.
- [ ] Tests: two-step transfer states, negative-balance rejection, settlement idempotency.

## Phase 7 — Banking, reconciliation, cheques/PDC

- [ ] Repos + services: bank accounts, statement import (CSV, `externalId` dedupe), reconciliations + matches (posted-lines-only), `fin_bank_matching_rules` auto-match proposals.
- [ ] Cheque books + `fin_cheques`: issued/received lifecycle `issued → deposited → presented → cleared | bounced`; PDC holding accounts, maturity clearing, bounce → reverse clearing + reopen open item.
- [ ] Tests: import dedupe, posted-only matching, zero-difference completion, PDC maturity, bounce reversal.

## Phase 8 — Tax engine, returns, WHT

- [ ] Repos + services: authorities, types, `fin_tax_codes` + effective-dated rates, `fin_tax_code_mappings` (link `tax_rates` / `res_tax_configs`, zero-touch), immutable `fin_tax_transactions` written in posting tx.
- [ ] Tax returns: aggregate by reporting box per period range; filing marks transactions reported (no double-filing).
- [ ] WHT certificate issuance + numbering.
- [ ] Tests: effective-date rate selection, mapping fallback, return aggregation, double-filing guard.

## Phase 9 — FX revaluation

- [ ] `fx-revaluation-service.ts`: revalue open monetary balances (bank/AR/AP FX) at closing rate; post unrealized gain/loss + auto-reversal in next period; re-run reverses prior run.
- [ ] Tests: revaluation math, auto-reversal dating, re-run semantics, base-currency lock.

## Phase 10 — Dimensions + budgets

- [ ] Repos + services: cost centers (hierarchical), projects, analysis dimensions + values, `fin_journal_line_dimensions`; required-dimension enforcement at posting.
- [ ] Budgets: per-year budgets + lines, revisions, transfers (approval-gated, net-zero), control policies none/warn/block + tolerance evaluated at posting; budget vs actual + variance reads over `fin_gl_balances`.
- [ ] Tests: required-dimension rejection, control policy trip points, transfer approval gate, variance math.

## Phase 11 — Fixed assets

- [ ] Repos + services: categories + depreciation methods, asset register (capitalization incl. from supplier invoices via sourceDoc), schedule generation, depreciation runs (idempotent per asset/period), disposals (catch-up + gain/loss vs NBV, permanent stop), revaluations, transfers.
- [ ] Tests: schedule totals, run idempotency, post-disposal exclusion, disposal gain/loss.

## Phase 12 — Closing

- [ ] Close task templates + period close runs (+tasks, mandatory-task gate).
- [ ] Allocation rules (+targets) + runs: percentage/statistical basis, zero-basis guard, re-run reverses prior.
- [ ] Opening balance batches: stage → validate balanced → post once → immutable; open AR/AP items included.
- [ ] Year close: all-periods-closed gate, closing JE → retained earnings + opening JE, reversible until next-year activity conflicts.
- [ ] Tests: close gates, allocation math, batch immutability, year-close reversal window.

## Phase 13 — Reporting

- [ ] Trial balance (opening/movement/closing, always footing equal), P&L, balance sheet (dynamic current-year earnings), cash flow (via cash-flow categories), AR/AP aging, customer/vendor statements — server functions over `fin_gl_balances` + subledgers with drill-down to journal lines + source docs.
- [ ] Control-account vs subledger reconciliation reports; suspense-balance report.
- [ ] Finance dashboard aggregates (cash position, payables/receivables, budget variance).
- [ ] Tests: trial balance equilibrium, statement equation, drill-down integrity.

## Phase 14 — UI workspaces + navigation

- [ ] Finance nav section in `app-nav.ts` + full i18n labels (EN + AR, RTL-aware).
- [ ] Routes/workspaces: COA tree, fiscal calendar, journal entry (create/post/reverse), posting exceptions + suspense, AR/AP workspaces (receipts, payment runs, statements, aging, dunning), cash + banking (reconciliation, cheques), tax returns, budgets, assets, closing cockpit, reports.
- [ ] E2E flows (Playwright): bootstrap → JE post/reverse; invoice → payment → reconciliation; period close → year close.

## Cross-cutting definition of done (per phase)

- [ ] `pnpm smoke` green (lint + typecheck + test; `NODE_OPTIONS=--max-old-space-size=8192` for typecheck; 3 known pre-existing failures excepted).
- [ ] 80%+ unit coverage on new services/repos (pure helpers fully covered).
- [ ] Every tenant-scoped server function chains `requireAuth → requireTenantAccess → requirePermission`.
- [ ] No new Prisma enums (fin statuses via `pod_document_statuses`); Decimal serialized to string at the DTO/event boundary.
- [ ] EN + AR i18n keys added for every new user-facing surface.
- [ ] Spec docs (`data-model.md`, `api.md`, `integration.md`, this file) updated with what shipped.

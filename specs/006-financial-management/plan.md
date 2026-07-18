# Implementation Plan — Feature 006 (Enterprise Financial Management)

## Summary

Deliver an enterprise accounting engine as a new `fin_` layer that **consumes** the existing
operational modules instead of changing them. Phase 0 (this pass) lays the docs + DB foundation:
all ~86 `Fin*` Prisma models, two hand-authored migrations (`DocumentType` additions first, then
the full `fin_` DDL — tables, CHECKs, partial unique idempotency index, deferred balance
constraint trigger, rebuild function, seeds), RBAC/catalog wiring, and i18n keys. Phase 1 (also
this pass) builds the working **GL core**: account/fiscal/journal/GL-balance/settings repos, the
posting engine, bootstrap + COA template, server functions with the guard chain, and pure-function
unit tests. Phases 2–14 add the async posting infrastructure, module adapters (inventory,
purchasing, sales/POS, restaurant/CRM), and the remaining financial domains (cash, banking, tax,
FX, dimensions/budgets, assets, closing, reporting, UI) — each an independently migratable,
`smoke`-green increment. No phase rebuilds an operational module or moves inventory costing out of
`movement-engine.ts`.

## Technical context

- **Stack:** TanStack Start (SSR React 19), Prisma 7 (`prisma-client` generator →
  `src/server/db/generated/prisma`), PostgreSQL/Supabase, Zustand + TanStack Query, i18next
  (en/ar). pnpm; dev on :3005; Vitest for unit tests.
- **Conventions (copy the pod_ style exactly):** uuid PKs; `tenantId` + Cascade FK to
  `TenantAccount`; string `statusCode` backed by the existing `PodDocumentStatus` /
  `PodStatusTransition` registry — **NO new Prisma enums**; money `Decimal(19,4)`, unit cost
  `(19,6)`, rates `(9,6)`, FX `(19,8)`; `isPosted/postedAt/postedByProfileId`;
  `createdBy/updatedBy/deletedBy` + `versionNumber` + `deletedAt` on mutable headers; **no soft
  delete on immutable ledger tables** (journal lines, subledger entries, tax transactions, GL
  balances); tenant-scoped named uniques + tenant-leading indexes; `@@map` snake_case.
- **DocumentType:** extending the existing enum with additive values (`journal_entry`,
  `ar_receipt`, `payment_run`, `cash_transaction`, `funds_transfer`, `depreciation_run`,
  `fx_revaluation`, `tax_return`, `opening_balance`, `allocation_run`, `asset`,
  `asset_disposal`, `cheque`, `dunning_run`) is the established path — 005 did it. The "no new
  Prisma enums" rule forbids **new** enums only. Added enum values cannot be used in the same
  transaction, so the enum migration is a **separate, earlier** migration.
- **Migrations:** hand-authored SQL, applied with `pnpm prisma migrate deploy` only (drifted DB —
  never `migrate dev`), then `pnpm prisma generate`.
- **Testing:** pure-function unit tests (`tests/unit/fin-*.test.ts`, no Prisma mocking); an
  opt-in real-DB harness test for the posting engine mirroring
  `src/server/inventory/__tests__/harness.ts`.

## Constitution check

`.specify/memory/constitution.md` is the unfilled template; the de-facto constitution honored
here, drawn from features 001–005:

- Prisma is the single source of truth; snake_case `@map`/`@@map`; camelCase model fields; UUID
  PKs.
- Tenant isolation is app-enforced via the guard chain
  (`getCurrentUserContext → requireTenantAccess → requirePermission`); RLS is defense-in-depth
  only.
- Cross-aggregate/lookup references are bare scalar `@db.Uuid`; only `tenant` and header→line
  links are real relations (cascade). Fin relations stay one-directional where possible to limit
  `TenantAccount` back-relation sprawl.
- **Divergence, deliberate (extends the 005 exception):** the DB carries the deferred
  `fin_assert_journal_entry_balanced()` constraint trigger and `fin_rebuild_gl_balances()` repair
  function. These are **integrity backstops**, not business logic — posting decisions, account
  resolution, and all orchestration live in the service layer. This is a Decision-recorded
  exception, not a precedent for domain logic in the DB.
- New `fin_` documents use lookup-table statuses (`pod_document_statuses` seeded with fin entity
  types); no operational module's status mechanism changes.
- No hardcoded business rules — posting rules, account mappings, default accounts, tax codes,
  payment terms, dunning levels, budget policies, and approval thresholds are configuration.

## Reconciliation with existing modules

**Zero breaking changes.** No existing table changes shape; no existing service changes behavior.

- **Reuse as-is (FK / call, no new infra):** `document_sequences` +
  `document-number-service.ts` (numbering), `pod_document_statuses` / `pod_status_transitions`
  (status registry — seed fin entity types + transitions), `pod_approval_workflows/…/actions`
  (approvals via `approvalRequestId` columns), `pod_notifications` + `notify(tx, …)`
  (notifications), `pod_attachments` / `pod_custom_field_definitions/values` (files, custom
  fields), `domain_events` + `appendDomainEvent` (outbox), `audit_logs` (trail),
  `crm_projection_cursors` pattern (mirrored as `fin_event_cursors`).
- **Shadow, don't replace:** `pod_supplier_invoices` / `pod_supplier_payments` /
  `financial_notes` / landed cost stay the operational AP documents; `fin_vendor_ledger_entries`
  shadow them via async posting. `sales_invoices` / `pos_sales` are shadowed by
  `fin_customer_ledger_entries`. `pod_recompute_supplier_balance()` keeps running — the fin
  subledger is the accounting truth, the pod balance the operational cache.
- **Link, don't touch:** `tax_rates` / `res_tax_configs` → `fin_tax_code_mappings`;
  `pod_payment_methods`, POS registers, restaurant charges, products/categories, warehouses →
  `fin_account_mappings`; `currencyCode` strings and per-document `exchange_rate` columns stay —
  `fin_currencies` / `fin_exchange_rates` are the accounting masters.
- **Consume:** the Spec-005 GL-ready domain events (`supplier_invoice.posted`,
  `supplier_payment.posted`, `landed_cost.posted`, …) plus inventory movement, sales/POS, and
  restaurant events feed the finance consumer. Feature 006 is the subscriber Spec 005 promised.

## Project structure

```
specs/006-financial-management/
  spec.md                # business architecture, 15 sub-domains, user stories (done)
  plan.md                # this file
  business-rules.md      # numbered rules per domain
  tasks.md               # phased task checklist
  data-model.md          # per-entity EN+AR docs + column tables (Phase 0)
  erd.md                 # mermaid per domain cluster + cross-domain (Phase 0)
  integration.md         # per module: events consumed → posting rule → debit/credit tables (Phase 0)
  sequence-diagrams.md   # posting flows sync + async (Phase 0)
  state-diagrams.md      # fin document lifecycles (Phase 0)
  api.md                 # server-fn catalog: name/permission/schema/DTO (Phase 0)
  performance.md         # indexes, partitioning deferral + thresholds, queue throughput, heap notes (Phase 0)

prisma/
  schema.prisma                                                    # + // ===== FINANCE (fin_) ===== section, ~86 Fin* models
  migrations/20260718100000_fin_document_types/migration.sql       # ALTER TYPE "DocumentType" ADD VALUE … (separate, first)
  migrations/20260718110000_financial_management_enterprise_v1/migration.sql
                                                                   # all fin_ tables/FKs/CHECKs, idempotency index,
                                                                   # fin_assert_journal_entry_balanced() + deferred trigger,
                                                                   # fin_rebuild_gl_balances(), seeds (classes/types, journal
                                                                   # types, depreciation methods, cash-flow categories, tax
                                                                   # types, payment terms, dunning levels, posting rules+lines,
                                                                   # fin statuses/transitions, ISO currencies)
  seed.ts                                                          # picks up finance.* permissions automatically

src/
  server/repos/fin-account-repo.ts               # COA + classes/types + mappings
  server/repos/fin-fiscal-repo.ts                # years/periods/module locks
  server/repos/fin-journal-repo.ts               # entries/lines/types/templates
  server/repos/fin-gl-balance-repo.ts            # upsert-increment + trial balance read
  server/repos/fin-settings-repo.ts              # settings + payment terms
  server/repos/fin-posting-rule-repo.ts          # rules/lines + queue + cursors
  server/repos/fin-currency-repo.ts              # currencies + exchange rates
  server/finance/account-service.ts              # COA CRUD, path maintenance, deactivate guards
  server/finance/coa-template.ts                 # pure default COA (EN+AR names)
  server/finance/bootstrap-service.ts            # initializeTenantFinance
  server/finance/fiscal-service.ts               # + pure generatePeriods
  server/finance/journal-service.ts              # draft/update/post/reverse orchestration
  server/finance/posting-engine.ts               # postJournalEntry(tx, …), buildReversalEntry
  server/finance/account-resolution.ts           # pure: resolution walk
  server/finance/journal-balancing.ts            # pure: balance assert, rounding synthesis
  server/finance/period-resolution.ts            # pure: date → period + status checks
  server/finance/currency-service.ts             # + pure convertToBase
  server/finance/settings-service.ts
  server/finance/posting-context.ts              # adapter interface types (adapters land Phase 2+)
  features/finance/finance-validation.ts         # Zod (decimalInput union pattern)
  features/finance/account-server-functions.ts
  features/finance/fiscal-server-functions.ts
  features/finance/journal-server-functions.ts
  features/finance/settings-server-functions.ts
  features/finance/finance-dto.ts                # Decimal → string
  features/auth/rbac-catalog.ts                  # + finance.* permissions / role map
  features/auth/module-catalog.ts                # + finance module / screens / PERMISSION_LINKS
  server/inventory/document-number-service.ts    # + DEFAULT_PREFIX (JV, ARR, PMR, CSH, FTR, DEP, FXR, TAXR, OB, ALC, …)
  server/events/event-outbox.ts                  # + fin_journal_entry.posted / .reversed payload types
  lib/i18n/resources/{en,ar}/common.json         # + finance.* keys

tests/unit/fin-journal-balancing.test.ts         # balance assert, rounding synthesis, mixed currency
tests/unit/fin-account-resolution.test.ts        # priority, resolution walk, suspense/strict
tests/unit/fin-period-resolution.test.ts
tests/unit/fin-fiscal-service.test.ts            # generatePeriods incl. leap years
tests/unit/fin-coa-template.test.ts              # template integrity
tests/unit/fin-validation.test.ts                # Zod edge cases
```

## Canonical service transaction shape

Every fin write path follows one `prisma.$transaction` — guards first, status check, numbering,
posting, balances, subledger, event, audit, notify:

```
async function postXxx(context, tenantId, input) {
  // 0. guards (in the server function): getCurrentUserContext →
  //    requireTenantAccess(context, tenantId) → requirePermission(context, 'finance.journal_post')
  // 1. validate: Zod .inputValidator on the server function; service assumes trusted input
  return prisma.$transaction(async (tx) => {
    // 2. status check: assert current statusCode + legal transition via pod_status_transitions
    //    (fin entity types); period check via period-resolution (open, module-unlocked)
    // 3. numbering: nextDocumentNumber(tx, { tenantId, documentType: 'journal_entry' })
    const documentNumber = await nextDocumentNumber(tx, { tenantId, documentType })
    // 4. postJournalEntry(tx, { tenantId, sourceDocType, sourceDocId, sourceEventType, lines }):
    //      assertBalanced (base amounts; synthesize rounding line) → resolve accounts →
    //      idempotent insert (partial unique index) → write fin_journal_entries + fin_journal_lines
    // 5. GL balances: INSERT … ON CONFLICT DO UPDATE on fin_gl_balances per account/period/currency
    // 6. subledger rows in the same tx (fin_customer_ledger_entries / fin_vendor_ledger_entries /
    //    fin_tax_transactions) when the document touches AR/AP/tax
    // 7. appendDomainEvent(tx, { tenantId, eventType: 'fin_journal_entry.posted', payload /* Decimal→string */ })
    // 8. createAuditLog(tx, { tenantId, actionKey, entityType, entityId, … })
    // 9. notify(tx, …) when the flow warrants it (suspense fallback, approval routing, run completion)
    return serialize(result)  // Decimal→string via finance-dto.ts
  })
}
```

Notes: the deferred DB constraint trigger re-asserts balance at commit — the service never relies
on it as the primary check, and never duplicates GL-balance math outside `postJournalEntry`. The
posting engine is the **only** code path that writes journal entries, lines, GL balances,
subledger entries, and tax transactions.

## Posting engine design

- **Rule resolution.** For a `(sourceDocType, sourceEventType)` pair, pick the tenant's active
  `fin_posting_rules` row, falling back to the system default (`tenantId IS NULL`). Each
  `fin_posting_rule_lines` declares `lineRole`, side (debit/credit), `accountSource`
  (fixed / mapping / settings_default), `amountSelector` (which payload amount), and a
  multiplier. No rule → strict-mode error or parked queue row.
- **Account resolution order** (pure `account-resolution.ts`): rule line fixed account →
  `fin_account_mappings` walk — product → category (walking `parentId` chain) → warehouse →
  branch → payment method → party group — → `fin_settings` named default → then
  `strictAccountResolution` ? throw : post to **suspense** + `notify`. Strict is the default for
  fin-native documents; suspense is the default for async operational adapters (an operational
  flow never hard-fails on a missing mapping).
- **Idempotency.** Partial unique index on
  `(tenant_id, source_doc_type, source_doc_id, source_event_type)
  WHERE status_code = 'posted' AND reversal_of_entry_id IS NULL` — at-most-once posting per
  source event; redelivery and queue retries are safe no-ops.
- **Sync/async split.** Fin-native documents post synchronously inside their own transaction.
  Operational documents flow `domain_events` → finance consumer (advances `fin_event_cursors`) →
  `fin_posting_queue` (dedupe unique key, retry ≤ 5 with backoff) → posting engine. Failed rows
  park as `failed`, surface in the posting exceptions screen, and raise a notification. The
  operational document is never blocked, delayed, or rolled back by accounting.
- **Balance enforcement, 3 layers.** (1) pure `assertBalanced` on base amounts, synthesizing a
  rounding line to the rounding account when FX conversion leaves residue; (2) row CHECKs —
  `debit >= 0`, `credit >= 0`, not both > 0; (3) DB backstop:
  `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` running
  `fin_assert_journal_entry_balanced()` at commit.
- **Reversal-only corrections.** Posted entries are immutable. `buildReversalEntry` produces the
  mirror image, cross-links `reversalOfEntryId` both ways, marks the original reversed, and posts
  through the same engine (which exempts reversals from the idempotency index by design). A
  reversal cannot be reversed.
- **GL balances.** `fin_gl_balances` per account/period/currency, maintained by atomic
  `INSERT … ON CONFLICT DO UPDATE` in the posting tx; `fin_rebuild_gl_balances()` ships in the
  migration as the repair path. Partitioning of `fin_journal_lines` is deferred (documented in
  `performance.md` with a > 50M-line threshold); ship tenant-leading B-tree indexes +
  BRIN(created_at).

## Phasing (see tasks.md for the checklist)

| Phase | Domain | Key deliverable |
|-------|--------|-----------------|
| 0 | **Docs + DB foundation (this pass)** | 11 spec docs; `DocumentType` migration; full `fin_` migration + seeds; `pnpm prisma generate`; RBAC/module catalog + i18n |
| 1 | **GL core (this pass)** | repos, account/fiscal/journal/settings services, posting engine + pure helpers, bootstrap + COA template, server functions, unit tests |
| 2 | Async posting infra + inventory adapter | finance consumer, cursors, queue processor, exceptions surface; inventory movements → inventory/GRNI/COGS postings |
| 3 | AP subledger + purchasing adapters | vendor ledger + applications; PodSupplierInvoice/Payment, debit notes, landed cost adapters; payment runs |
| 4 | AR subledger + sales/POS adapters | customer ledger + applications; AR receipts + allocations; SalesInvoice, returns, credit notes, PosSale/Payment/Session settlement |
| 5 | Restaurant + CRM adapters | order payments/charges/tips/discounts; gift-card + loyalty liability; credit limits |
| 6 | Cash management | cashboxes, cash transactions, funds transfers (in-transit), POS session settlement into cash |
| 7 | Banking | bank accounts, statement import + dedupe, reconciliation + matching rules, cheques + PDC lifecycle |
| 8 | Tax engine | tax codes/rates/mappings, tax transactions, tax returns, WHT certificates |
| 9 | FX revaluation | revaluation runs, unrealized gain/loss, auto-reversal |
| 10 | Dimensions + budgets | cost centers, projects, analysis dimensions; budgets, budget vs actual, control policies, transfers |
| 11 | Fixed assets | register, depreciation schedules/runs, disposals, revaluations, transfers |
| 12 | Closing | close checklists, allocation rules/runs, opening balances, year-end close |
| 13 | Reporting | trial balance, P&L, balance sheet, cash flow, aging, statements, dashboards |
| 14 | UI workspaces + navigation | finance routes, nav section, workspaces per domain |

**Sequencing note:** Phase 2 (async infra) precedes every adapter phase. Phases 3–5 order by
integration value: purchasing already emits GL-ready events (005), sales/POS is the revenue side,
restaurant/CRM refine it. Phases 6–12 are largely independent of each other but all depend on the
Phase 1 engine. Phase 13 needs the subledgers (3–4) for aging/statements; Phase 14 lands last so
UI wires against stable server functions.

## Genuine gaps (called out, not hand-waved)

1. **No payroll.** Salaries post (if at all) as manual JEs until a payroll module exists; it will
   be another posting-engine client.
2. **No consolidation / intercompany elimination.** `companyId` is carried on fin documents, but
   group consolidation, elimination entries, and group-currency translation are out of scope.
3. **No IFRS 16 / revenue-recognition schedules.** Leases and contract-based revenue recognition
   are manual-JE territory for now.
4. **Bank feeds are manual/CSV only.** Statement import starts as CSV upload with `externalId`
   dedupe; Open Banking / aggregator feeds are a later integration behind the same
   statement-line shape.
5. **Partitioning deferred.** `fin_journal_lines` ships unpartitioned with B-tree + BRIN indexes;
   `performance.md` documents the > 50M-line threshold and the migration path.
6. **Queue processing cadence.** The posting queue processor is invoked on-demand/config-gated
   like `refreshPurchaseReportingServerFn`; a real cron/worker scheduler remains an infra
   follow-up (same gap 005 recorded for matview refresh).

## Risks & mitigations

- **Schema growth** (~191 → ~277 models) — `prisma generate` slows and typecheck needs
  `NODE_OPTIONS=--max-old-space-size=8192` (known, per memory). Mitigate: one banner-commented
  fin section, one-directional relations where possible, `data-model.md` as the human index.
  Don't chase the 3 pre-existing test failures or repo-wide prettier noise.
- **Enum migration ordering** — added `DocumentType` values can't be used in the same
  transaction; the enum migration is a separate, earlier migration and the main migration only
  references values after it. Verified by applying both with `migrate deploy` in order.
- **Drifted DB** — the database has drifted from migration history (`auth.uid()` defaults);
  hand-written SQL + `pnpm prisma migrate deploy` only, never `migrate dev`.
- **Suspense fallback semantics** — posting to suspense hides mapping gaps if unmonitored.
  Mitigate: every suspense post raises a notification, the exceptions screen lists suspense
  balances, and fin-native documents default to strict so a human-authored JE never silently
  lands in suspense.
- **Double bookkeeping confusion** — `pod_recompute_supplier_balance()` (operational cache) and
  `fin_vendor_ledger_entries` (accounting truth) coexist by design; documented here and in
  `integration.md` so contributors don't "unify" them.
- **Deferred trigger vs app check drift** — the SQL function and `journal-balancing.ts` must
  agree; the opt-in real-DB harness test posts through both layers to catch divergence.

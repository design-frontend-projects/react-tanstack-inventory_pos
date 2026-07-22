# Implementation Plan — Feature 007 (Enterprise HR / Human Capital Management)

## Summary

Deliver an enterprise HCM suite as a new `hr_` layer that is **authoritative for people data** while
**consuming** the existing operational and financial modules instead of changing them. HR-native
documents (an employee edit, a leave request, an attendance log) are the operational truth; every
event with a financial consequence — a posted payroll run, a loan disbursement, an expense
reimbursement — posts **through the Spec 006 `postJournalEntry`**, never by writing `fin_` tables
directly.

Phase 0 (this pass) lays the docs + DB foundation: all 88 `Hr*` Prisma models with `TenantAccount`
reverse relations, a single hand-authored migration (`DocumentType` additions via idempotent
`ADD VALUE IF NOT EXISTS`, then the full `hr_` DDL — 88 tables, 99 FKs — generated with
`prisma migrate diff` live-DB→schema), RBAC/catalog wiring (24 `hr.*` permissions, 3 roles),
navigation + icons, and en/ar i18n keys. Phase 1 (also this pass) builds the working
**Organization + Employee-master core** end-to-end: org/employee repos, the organization and
employee services with the acyclic-tree engine and append-only history, feature server functions
with the guard chain, workspaces/routes, and pure-function unit tests. Phases 2–14 add
recruitment/onboarding, time/attendance, leave, payroll (the sole HR caller of `postJournalEntry`),
loans/benefits/commissions, payroll→finance posting, performance, learning, career/workforce/
budgeting, self-service, assets/travel-expense, analytics, and reports/E2E — each an independently
migratable, `smoke`-green increment. No phase rebuilds an operational module, moves inventory
costing out of `movement-engine.ts`, or changes how the `fin_` engine posts.

## Technical context

- **Stack:** TanStack Start (SSR React 19), Prisma 7 (`prisma-client` generator →
  `src/server/db/generated/prisma`), PostgreSQL/Supabase, Zustand + TanStack Query, i18next
  (en/ar, RTL-aware). pnpm; dev on :3005; Vitest for unit tests.
- **Schema scale:** the single `prisma/schema.prisma` now holds **~385 models** (was ~297 after 006;
  +88 `Hr*` this feature). The `hr_` section is grouped under one banner comment; `TenantAccount`
  carries reverse relations for the `hr_` roots.
- **Conventions (copy the pod_/fin_ style exactly):** uuid PKs; `tenantId` + Cascade FK to
  `TenantAccount`; string `statusCode` backed by the existing `PodDocumentStatus` /
  `PodStatusTransition` registry — **NO new Prisma enums**; money `Decimal(19,4)`, rates `(9,6)`,
  hours `(9,2)`; `createdBy/updatedBy/deletedBy` + `versionNumber` + `deletedAt` on mutable headers;
  **no soft delete on append-only tables** (`hr_employee_history`, posted `hr_payroll_details` /
  `hr_payroll_component_details`); tenant-scoped named uniques + tenant-leading indexes; `@@map`
  snake_case; cross-aggregate references are bare scalar `@db.Uuid`, only `tenant` and header→line
  links are real relations.
- **DocumentType:** extended additively with 13 hr values (`employee`, `employee_contract`,
  `job_opening`, `job_offer`, `onboarding`, `timesheet`, `leave_request`, `payroll_run`, `loan`,
  `salary_advance`, `expense_claim`, `travel_request`, `performance_review`), implemented as
  `ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS …` at the top of the single v1 migration
  (idempotent enum adds) — the values are only referenced by string in later seeds, never used as
  an enum literal in the same statement, so a split migration was unnecessary.
- **Migrations:** hand-authored SQL, applied with `pnpm prisma migrate deploy` only (drifted DB on
  `auth.uid()` defaults — never `migrate dev`), then `pnpm prisma generate`. The Phase-0 migration is
  `prisma/migrations/20260722120000_hr_hcm_v1/migration.sql`.
- **Testing:** pure-function unit tests (`tests/unit/hr-*.test.ts`, no Prisma mocking); an opt-in
  real-DB harness test for the payroll posting engine is deferred to Phase 5 (mirrors the
  inventory-style `__tests__/harness.ts`).

## Constitution check

`.specify/memory/constitution.md` is the unfilled template; the de-facto constitution honored
here, drawn from features 001–006:

- Prisma is the single source of truth; snake_case `@map`/`@@map`; camelCase model fields; UUID PKs.
- Tenant isolation is app-enforced via the guard chain
  (`getCurrentUserContext → requireTenantAccess → requirePermission`); RLS is defense-in-depth only.
  HR adds a **planned** second scoping axis (MSS manager-of-team subtree + branch/department/
  cost-center data scoping) layered on top of the guard chain — see Risks.
- Cross-aggregate/lookup references are bare scalar `@db.Uuid`; only `tenant` and header→line links
  are real relations (cascade). `hr_` relations stay one-directional where possible to limit
  `TenantAccount` back-relation sprawl (already large after `fin_`).
- New `hr_` documents use lookup-table statuses (`pod_document_statuses` seeded with hr entity
  types); no operational module's status mechanism changes.
- **No divergence beyond 006.** HR adds no new DB triggers or functions; the append-only history and
  posted-run immutability are enforced in the service layer, and payroll balance enforcement rides on
  the existing Spec-006 `postJournalEntry` (pure `assertBalanced` + row CHECKs + the deferred
  `fin_assert_journal_entry_balanced()` trigger). HR writes no `fin_` tables directly.
- No hardcoded business rules — leave policies, salary components/structures, onboarding templates,
  shift definitions, budget lines, approval thresholds, and account mappings are configuration/data.

## Reconciliation with existing modules

**Zero breaking changes.** No existing table changes shape; no existing service changes behavior.
`hr_` is authoritative for people data; existing masters stay untouched and are linked by scalar FK
or mapping.

- **Reuse as-is (FK / call, no new infra):** `document_sequences` + `document-number-service.ts`
  (numbering — 13 hr prefixes added), `pod_document_statuses` / `pod_status_transitions` (status
  registry — hr entity types seeded), `pod_approval_workflows/…/actions` (approvals via
  `openApprovalRequest` / `actOnApproval`), `pod_notifications` + `notify(tx, …)` (notifications),
  `pod_attachments` + `registerAttachment` / `listAttachments` (employee/candidate docs, certificates,
  payslips), `audit_logs` + `createAuditLog` (trail).
- **Link, don't touch:** `hr_cost_centers` → `fin_cost_centers` (nullable scalar FK — HR cost
  attribution flows into the accounting dimension without duplicating it); `hr_employees.profileId`
  → `Profile` (optional login link); `companyId` MAY reference `TenantAccount`;
  `hr_employee_assets` → inventory asset / product; restaurant `res_` staffing shifts and CRM
  sales-employee commission / tip inputs link via `sourceModule` / `sourceRef` scalar columns.
- **Consume:** the Spec 006 posting engine (`postJournalEntry`) + `fin_cost_centers` +
  `fin_gl_balances` (payroll actuals reconcile HR budget). Feature 007 **is** the payroll module
  Feature 006 deferred ("a future payroll module posts through the same posting engine").
- **Shadow, don't replace:** identity stays `Profile` / `TenantUser` / RBAC; `hr_employees` is the
  people system of record and links to a login where one exists, but an employee need not have a
  login and a login need not be an employee.

## Project structure

```
specs/007-hr-hcm/
  spec.md                # business architecture, 18 sub-domains, user stories (done)
  plan.md                # this file
  tasks.md               # phased task checklist
  integration.md         # per module: how hr_ integrates (finance / approvals / notifications / …)

prisma/
  schema.prisma                                             # + // ===== HR / HCM (hr_) ===== section, 88 Hr* models
                                                            #   + TenantAccount reverse relations
  migrations/20260722120000_hr_hcm_v1/migration.sql         # ALTER TYPE DocumentType ADD VALUE IF NOT EXISTS x13 (idempotent);
                                                            #   88 hr_ tables + 99 FKs (CREATE generated via prisma migrate diff);
                                                            #   CHECKs, tenant-leading indexes, RLS block mirroring 006;
                                                            #   pod_document_statuses / pod_status_transitions for hr entity types
  seed.ts                                                    # picks up hr.* permissions + 3 roles automatically

src/
  server/repos/hr-organization-repo.ts            # companies/branches/units/divisions/departments/sections/positions/grades/cost-centers/reporting
  server/repos/hr-employee-repo.ts                # employees + sub-entities + append-only history
  server/hr/organization-service.ts               # org CRUD, acyclic tree, depth+path maintenance, deactivate guards
  server/hr/employee-service.ts                   # employee CRUD, profile-link guard, sub-entity CRUD
  server/hr/employee-history.ts                   # pure: append-only history diff/close/append (BR-EMP-1)
  server/hr/org-tree.ts                           # pure: acyclic check, depth+path recompute, headcount roll-up
  server/hr/hr-dto.ts                             # Decimal → string serialization
  features/hr/validation.ts                       # Zod (decimalInput union pattern)
  features/hr/server-functions.ts                 # org + employee server fns (guard chain)
  features/hr/use-organization.ts                 # TanStack Query hooks (org)
  features/hr/use-employees.ts                    # TanStack Query hooks (employees)
  features/hr/hr-dialogs.tsx                      # shared create/edit dialogs
  features/hr/organization-workspace.tsx          # org tree workspace
  features/hr/org-master-workspaces.tsx           # departments / positions / job-grades / cost-centers masters
  features/hr/employee-workspace.tsx              # employee list + create
  features/hr/employee-detail-page.tsx            # employee detail (sub-entities + history)
  features/hr/hr-overview-workspace.tsx           # HR overview / landing
  features/auth/rbac-catalog.ts                   # + 24 hr.* permissions / hr_manager, hr_officer, payroll_officer roles / super_admin grant
  features/auth/module-catalog.ts                 # + hr module / 7 screens / PERMISSION_LINKS
  lib/navigation/app-nav.ts                       # + HR nav section
  lib/navigation/icon-map.ts                      # + HR icons
  server/inventory/document-number-service.ts     # + DEFAULT_PREFIX (EMP, EMPC, JOB, OFR, ONB, TMS, LVR, PAY, LOAN, ADV, EXP, TRV, PRV)
  lib/i18n/resources/{en,ar}/common.json          # + hr.* keys

src/routes/_app/hr/
  index.tsx                                        # HR overview
  organization.tsx                                 # org tree
  departments.tsx                                  # departments master
  positions.tsx                                    # positions master
  job-grades.tsx                                   # job grades master
  cost-centers.tsx                                 # HR cost centers (fin link)
  employees.tsx                                    # employee list
  employees_.$employeeId.tsx                       # employee detail

tests/unit/hr-org-tree.test.ts                     # acyclic check, depth/path recompute, cycle rejection, headcount roll-up
tests/unit/hr-validation.test.ts                   # Zod edge cases
tests/unit/hr-employee-history.test.ts             # append-only diff/close/append (BR-EMP-1)
```

## Canonical service transaction shape

Every hr write path follows one `prisma.$transaction` — guards first, status check, numbering,
mutation, history/side-effects, event/audit, notify:

```
async function doXxx(context, tenantId, input) {
  // 0. guards (in the server function): getCurrentUserContext →
  //    requireTenantAccess(context, tenantId) → requirePermission(context, 'hr.<perm>')
  //    (+ planned MSS subtree / branch-department-cost-center scoping)
  // 1. validate: Zod .inputValidator on the server function; service assumes trusted input
  return prisma.$transaction(async (tx) => {
    // 2. status/precondition check: assert current statusCode + legal transition via
    //    pod_status_transitions (hr entity types); org acyclic check; leave balance check
    // 3. numbering (documents): nextDocumentNumber(tx, { tenantId, documentType: 'employee' | 'payroll_run' | … })
    // 4. mutate hr_ header/lines; for employees, append hr_employee_history (BR-EMP-1) — never overwrite
    // 5. accounting side-effect (payroll/loan/expense only): postJournalEntry(tx, {
    //      sourceDocType: 'hr_payroll_run' | 'hr_loan' | 'hr_expense_claim',
    //      sourceDocId, sourceEventType, lines /* cost-attributed via hr_cost_centers → fin_cost_centers */ })
    //      — idempotent per source doc; HR never writes fin_ tables directly
    // 6. approvals (leave/offer/loan/payroll/expense/travel): openApprovalRequest / actOnApproval
    // 7. createAuditLog(tx, { tenantId, actionKey, entityType, entityId, … })
    // 8. notify(tx, …) when the flow warrants it (approval routing, run completion, onboarding task)
    return serialize(result)  // Decimal→string via hr-dto.ts
  })
}
```

Notes: the **Payroll Run** aggregate is the only HR writer of payroll details and the only HR path
that calls `postJournalEntry`; the **Employee** aggregate is the only writer of
`hr_employee_history`. Posted payroll is immutable — corrections are off-cycle adjustment runs or
reversal entries, never edits.

## This-pass scope (Phases 0 + 1)

**Phase 0 — Docs, schema, catalog & migration (delivered).**

- Spec docs authored (`spec.md` complete; this `plan.md`, `tasks.md`, `integration.md`).
- `// HR / HCM (hr_)` section added to `prisma/schema.prisma` — all **88 `Hr*` models** +
  `TenantAccount` reverse relations.
- `DocumentType` enum extended with the **13 hr values** as idempotent
  `ALTER TYPE … ADD VALUE IF NOT EXISTS` at the top of the single v1 migration.
- Migration `prisma/migrations/20260722120000_hr_hcm_v1/migration.sql` hand-authored — **88 tables,
  99 FKs**, CHECK constraints, tenant-leading indexes, RLS block mirroring 006, and
  `pod_document_statuses` / `pod_status_transitions` rows for the hr entity types. The `CREATE`
  sections were generated via `prisma migrate diff` live-DB→schema, then hand-finished.
- **24 `hr.*` permissions** + **3 roles** (`hr_manager`, `hr_officer`, `payroll_officer`) + a
  `super_admin` grant added to `src/features/auth/rbac-catalog.ts`.
- `hr` module + **7 screens** + `PERMISSION_LINKS` added to `src/features/auth/module-catalog.ts`.
- HR nav section added to `src/lib/navigation/app-nav.ts`; icons in `src/lib/navigation/icon-map.ts`.
- en/ar i18n keys added; HR `DocumentType` prefixes added to
  `src/server/inventory/document-number-service.ts` (`EMP`, `EMPC`, `JOB`, `OFR`, `ONB`, `TMS`,
  `LVR`, `PAY`, `LOAN`, `ADV`, `EXP`, `TRV`, `PRV`).
- **Remaining (needs live DB — user runs):** `pnpm prisma migrate deploy` (NEVER `migrate dev`) then
  `pnpm db:seed`.

**Phase 1 — Organization + Employee core, end-to-end (delivered).**

- Repos `src/server/repos/hr-organization-repo.ts` + `hr-employee-repo.ts`.
- Services `src/server/hr/{organization-service, employee-service, employee-history, org-tree,
  hr-dto}.ts`. Org has an **acyclic** department/cost-center tree with maintained `depth` +
  materialized `path`; Employee has **append-only history** (`hr_employee_history`, BR-EMP-1) —
  every position/grade/salary/manager change appends a dated row; nothing is overwritten.
- Features `src/features/hr/{validation, server-functions, use-organization, use-employees,
  hr-dialogs, organization-workspace, org-master-workspaces, employee-workspace,
  employee-detail-page, hr-overview-workspace}.tsx?`.
- Routes `src/routes/_app/hr/{index, organization, departments, positions, job-grades,
  cost-centers, employees, employees_.$employeeId}.tsx`.
- Tests `tests/unit/{hr-org-tree, hr-validation, hr-employee-history}.test.ts` — **passing**.
- **Verification:** typecheck green with `NODE_OPTIONS=--max-old-space-size=8192`; lint green; full
  unit suite green **except the 2 known pre-existing localStorage failures** (`layout-store`,
  `preferences-store`).

## Phased roadmap (see tasks.md for the checklist)

| Phase | Domain | Key deliverable |
|-------|--------|-----------------|
| 0 | **Docs + DB foundation (this pass)** | spec docs; `DocumentType` additions; full `hr_` migration (88 tables/99 FKs) + status seeds; `prisma generate`; RBAC/module/nav/i18n |
| 1 | **Organization + Employee core (this pass)** | org/employee repos + services, acyclic tree, append-only history, server functions, workspaces/routes, unit tests |
| 2 | Recruitment / ATS + Onboarding | openings/candidates/interviews/feedback/offers/acceptance; onboarding templates/tasks/instances; offer → employee hand-off |
| 3 | Time & Attendance | shift definitions/patterns/assignments, attendance logs → daily materialization (dedup), timesheets, overtime, break logs; `res_` shift link |
| 4 | Leave + approval-engine generalization | leave types/policies/balances/requests/approvals; accrual; balance debit at approval; **extend `applyApprovalToDocument()` for `hr_leave_request`** |
| 5 | Payroll core | salary components/structures/assignments, periods, runs, details/component-details; deterministic compute engine; **first HR `postJournalEntry` caller**; opt-in real-DB harness |
| 6 | Loans / Advances / Benefits / Commissions | loans (+installments), salary advances, employee benefits, commissions; disbursement postings; single-recovery guard |
| 7 | Payroll → Finance posting | balanced run JE (salary/employer-contribution expense vs net-pay/statutory/loan/advance liabilities); cost-center attribution; idempotent per run; reversal-only corrections |
| 8 | Performance | KPIs, goals + progress, review templates, reviews, weighted scores; finalize + lock |
| 9 | Learning | courses/sessions/records/certificates; enrollment → completion → certificate (attachment) |
| 10 | Career / Workforce / Budgeting | career paths, successors, promotions (write history); skills, employee skills, workforce plans/requirements/skill-requirements; HR budget years/departments/positions/actuals |
| 11 | ESS / MSS | employee requests/notifications/announcements/shared-docs; manager-of-team subtree scoping (no new tables) |
| 12 | Assets + Travel / Expense | employee-asset custody trail (inventory link); travel requests, expense claims + lines + caps, reimbursements posting via payroll net-pay or AP |
| 13 | HR Analytics | headcount / turnover / cost / absence read models (no new tables); MSS-scoped manager dashboards |
| 14 | Reports + E2E | payslips, org chart, headcount/turnover/cost/leave reports; Playwright flows (bootstrap → employee → payroll post/reverse; leave request → approve; expense → reimburse) |

**Sequencing note:** Phases 2–3 are independent people-lifecycle additions on the Phase 1 core.
Phase 4 must generalize the approval engine before leave (and every later approval-gated document)
works. Phase 5 (payroll compute) precedes Phase 7 (payroll posting); Phase 6 feeds recovery inputs
into the run. Phases 8–10 are talent/planning additions largely independent of payroll. Phase 11
(ESS/MSS) needs the aggregates it scopes over; Phase 13 (analytics) needs them populated. Phase 14
lands last so reports/E2E wire against stable server functions.

## Genuine gaps (called out, not hand-waved)

1. **Async payroll posting deferred.** Payroll posts **directly** through `postJournalEntry` in the
   run transaction. Registering payroll as a `fin_` async posting adapter (via `domain_events` →
   finance consumer → `fin_posting_queue`) is deferred — the Spec-006 finance async adapters are
   themselves unregistered, so there is no consumer to enqueue into yet.
2. **No per-jurisdiction statutory engines.** Payroll ships a configurable component/formula model
   (fixed/percentage/slab/formula); country tax and social-insurance tables are seedable **data**,
   not built-in code packs.
3. **No biometric/hardware clock drivers.** Attendance starts with manual + CSV/API-ingested
   `hr_attendance_logs`; device terminals are a later adapter behind the same log shape.
4. **No full LMS.** Learning tracks courses/sessions/records/certificates + completion; it is not a
   SCORM player or content authoring/hosting system.
5. **MSS/analytics data scoping is planned, not yet enforced.** The Phase-1 core enforces the guard
   chain (`requireAuth → requireTenantAccess → requirePermission`); manager-of-team subtree and
   branch/department/cost-center data scoping land in Phase 11/13.
6. **Queue/scheduler cadence.** No cron/worker — payroll runs, accruals, and daily materialization
   are invoked on-demand/config-gated (same infra gap 005/006 recorded for matview/queue refresh).

## Risks & mitigations

- **Schema growth** (~297 → ~385 models) — `prisma generate` slows and **typecheck needs
  `NODE_OPTIONS=--max-old-space-size=8192`** (known, per memory; heap pressure grows each feature).
  Mitigate: one banner-commented `hr_` section, one-directional relations where possible,
  `spec.md` / `data-model` as the human index. Don't chase the 2 pre-existing localStorage test
  failures or repo-wide prettier noise.
- **Approval-engine coupling (the primary integration gap).** `applyApprovalToDocument()` in
  `src/server/purchasing/approval-engine.ts` is a **hard-coded switch over purchasing entity types**,
  and it emits a purchasing-specific `purchase_approval.decided` domain event and audit keys (lines
  ~37, ~167, ~333–344). Reusing the engine for HR requires: (a) adding
  `hr_leave_request` / `hr_loan` / `hr_payroll_run` / `hr_expense_claim` / `hr_travel_request` /
  `hr_job_offer` branches to the switch (each applying the approved/rejected transition to the HR
  document in-tx), and (b) **generalizing the event/audit keys** so the emitted event/audit reflect
  the actual entity type rather than always `purchase_approval.decided`. Land this in Phase 4 before
  the first approval-gated HR document. Mitigate: keep the switch dispatch table-driven so later
  modules extend by registration, not by editing a monolith.
- **Finance async adapters unregistered** — payroll therefore posts **directly** (gap #1). Documented
  in `integration.md` so contributors don't wire payroll into a non-existent `fin_posting_queue`
  consumer; the direct path is idempotent per `hr_payroll_run.id` and reversal-only, matching the
  Spec-006 posting contract.
- **Payroll balance / rounding** — the run assembles Σ Dr = Σ Cr before `postJournalEntry`; residue
  from rounding component amounts is synthesized to the configured rounding account so the entry
  balances exactly, and the Spec-006 deferred balance trigger re-asserts at commit. HR never
  duplicates GL-balance math outside `postJournalEntry`.
- **Double loan/advance recovery** — an `hr_loan_installments` row is recoverable by **at most one**
  posted run; the compute engine marks installments scheduled-for-recovery and the post is idempotent
  per run id, so a re-run or overlapping run never recovers the same installment twice.
- **Append-only history drift** — the employee current-value cache and the latest
  `hr_employee_history` row must agree; `hr-employee-history.ts` is pure and unit-tested
  (`hr-employee-history.test.ts`) so the diff/close/append logic is verified independent of Prisma.
- **Drifted DB** — the database has drifted from migration history (`auth.uid()` defaults);
  hand-written SQL + `pnpm prisma migrate deploy` only, **never** `migrate dev`.

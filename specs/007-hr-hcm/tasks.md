# HR / HCM — Task Breakdown (Spec 007)

Phased checklist. **Phases 0–1 are delivered in the current pass** (docs + full `hr_` schema/
migration + working Organization and Employee-master core). Phases 2–14 build the remaining 16
sub-domains on top of that core, reusing the existing numbering/status/approval/notification/
attachment/audit infrastructure and the Spec 006 posting engine (`postJournalEntry`) +
`fin_cost_centers`.

## Phase 0 — Docs, schema, catalog & migration (this pass)

- [x] Author spec-kit docs: `spec.md` (18 sub-domains, 8 user stories, FR-* per domain) + `plan.md`,
  `tasks.md`, `integration.md`.
- [x] Add `// HR / HCM (hr_)` section to `prisma/schema.prisma` — all **88 `Hr*` models** +
  `TenantAccount` reverse relations.
- [x] Extend `DocumentType` with the 13 hr values (`employee`, `employee_contract`, `job_opening`,
  `job_offer`, `onboarding`, `timesheet`, `leave_request`, `payroll_run`, `loan`, `salary_advance`,
  `expense_claim`, `travel_request`, `performance_review`) as idempotent
  `ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS …` at the top of the single v1 migration — the
  values are only referenced by string in later seeds, never used as an enum literal in the same
  statement, so a split migration was unnecessary.
- [x] Hand-author migration `prisma/migrations/20260722120000_hr_hcm_v1/migration.sql` — **88 `hr_`
  tables, 99 FKs** (CREATE sections generated via `prisma migrate diff` live-DB→schema) + CHECK
  constraints, tenant-leading indexes, RLS block mirroring the 006 migration.
- [x] Seed in the migration: `PodDocumentStatus` / `PodStatusTransition` rows for the hr entity types
  (`employee`, `employee_contract`, `job_opening`, `job_offer`, `onboarding`, `timesheet`,
  `leave_request`, `payroll_period`, `payroll_run`, `loan`, `salary_advance`, `expense_claim`,
  `travel_request`, `performance_review`).
- [x] Add **24 `hr.*` permissions** + **3 roles** (`hr_manager`, `hr_officer`, `payroll_officer`) +
  `super_admin` grant to `src/features/auth/rbac-catalog.ts`.
- [x] Add `hr` module + **7 screens** + `PERMISSION_LINKS` in `src/features/auth/module-catalog.ts`
  (`catalog-rbac.test.ts` / `rbac-catalog.test.ts` green).
- [x] Wire HR nav section in `src/lib/navigation/app-nav.ts` + icons in
  `src/lib/navigation/icon-map.ts`.
- [x] Map new `DocumentType` prefixes in `src/server/inventory/document-number-service.ts` (`EMP`,
  `EMPC`, `JOB`, `OFR`, `ONB`, `TMS`, `LVR`, `PAY`, `LOAN`, `ADV`, `EXP`, `TRV`, `PRV`).
- [x] Add nested `hr.*` i18n keys (`en` + `ar`).
- [x] `pnpm prisma validate` + `pnpm prisma generate` green. **Remaining (needs live DB — user
  runs):** `pnpm prisma migrate deploy` (NEVER `migrate dev`) → `pnpm db:seed`.

## Phase 1 — Organization + Employee core (this pass)

- [x] Repos: `src/server/repos/hr-organization-repo.ts` (companies/branches/business-units/divisions/
  departments/sections/positions/job-grades/cost-centers/reporting-structure),
  `src/server/repos/hr-employee-repo.ts` (employees + sub-entities + append-only history) — pod
  style.
- [x] Pure helpers (no Prisma): `src/server/hr/org-tree.ts` (acyclic check, depth+path recompute,
  cycle rejection, headcount roll-up), `src/server/hr/employee-history.ts` (append-only diff/close/
  append per BR-EMP-1).
- [x] Services: `src/server/hr/organization-service.ts` (org CRUD, tree maintenance, deactivate
  guards for active employees/children), `src/server/hr/employee-service.ts` (employee CRUD, unique
  `employeeNumber` from the `employee` sequence, profile-link uniqueness guard, sub-entity CRUD),
  `src/server/hr/hr-dto.ts` (Decimal→string).
- [x] Feature module `src/features/hr/` — `validation.ts` (Zod, decimalInput union),
  `server-functions.ts` (org + employee, guard chain), `use-organization.ts`, `use-employees.ts`,
  `hr-dialogs.tsx`, `organization-workspace.tsx`, `org-master-workspaces.tsx`,
  `employee-workspace.tsx`, `employee-detail-page.tsx`, `hr-overview-workspace.tsx`.
- [x] Routes: `src/routes/_app/hr/{index, organization, departments, positions, job-grades,
  cost-centers, employees, employees_.$employeeId}.tsx`.
- [x] Unit tests: `tests/unit/hr-org-tree.test.ts`, `tests/unit/hr-validation.test.ts`,
  `tests/unit/hr-employee-history.test.ts` — **passing**. Typecheck green with
  `NODE_OPTIONS=--max-old-space-size=8192`; lint green; full unit suite green **except the 2 known
  pre-existing localStorage failures** (`layout-store`, `preferences-store`).
- [ ] Manual smoke via server functions: HR bootstrap → company/branch/department/position → create
  employee → edit position (verify appended `hr_employee_history`) → cycle rejection (needs live DB —
  user runs after `migrate deploy`).

## Phase 2 — Recruitment / ATS + Onboarding

- [ ] Repos: `hr-recruitment-repo.ts` (openings/candidates/candidate-documents/interviews/feedback/
  offers/acceptance), `hr-onboarding-repo.ts` (templates/tasks/instances).
- [ ] Services: `recruitment-service.ts` (pipeline stages, open-headcount decrement on accepted
  offer, offer approval via `openApprovalRequest`), `onboarding-service.ts` (instantiate template per
  hire, per-task status), `offer-to-employee.ts` (accepted offer → `hr_employees` pre-populated +
  onboarding instance).
- [ ] Server functions + `use-recruitment.ts` / `use-onboarding.ts` hooks; workspaces + routes
  (`recruitment.tsx`, `onboarding.tsx`).
- [ ] Candidate documents / offers via `registerAttachment`; task completion via `notify`.
- [ ] Tests: `hr-recruitment.test.ts` (headcount decrement, one-feedback-per-interviewer,
  offer→employee mapping), `hr-onboarding.test.ts` (template instantiation, completion derivation).

## Phase 3 — Time & Attendance

- [ ] Repos: `hr-time-repo.ts` (shift-definitions/patterns/assignments, attendance-logs,
  attendance-daily, timesheets, overtime-requests, break-logs).
- [ ] Services: `attendance-service.ts` (raw-log ingest manual + CSV, dedup by employee/timestamp/
  source), `attendance-daily.ts` (pure: materialize worked/late/early/overtime vs shift definition),
  `timesheet-service.ts` (period aggregation, approval routing), `overtime-service.ts` (approved-only
  payable gate).
- [ ] Server functions + hooks + workspaces/routes (`attendance.tsx`, `timesheets.tsx`,
  `shifts.tsx`).
- [ ] `res_` staffing shift link via `sourceModule` / `sourceRef` (shift→payroll pipeline).
- [ ] Tests: `hr-attendance-daily.test.ts` (materialization + dedup, late/OT flags),
  `hr-timesheet.test.ts` (aggregation, approved-OT-only).

## Phase 4 — Leave + approval-engine generalization

- [ ] **Generalize the approval engine (integration gap):** extend `applyApprovalToDocument()` in
  `src/server/purchasing/approval-engine.ts` with an `hr_leave_request` branch (and prepare the
  dispatch for `hr_loan` / `hr_payroll_run` / `hr_expense_claim` / `hr_travel_request` /
  `hr_job_offer`), and **generalize the purchasing-specific `purchase_approval.decided` event/audit
  keys** so the emitted event + audit reflect the actual entity type. Keep the switch table-driven.
- [ ] Repos: `hr-leave-repo.ts` (types/policies/balances/requests/approvals).
- [ ] Services: `leave-service.ts` (working-day calc per policy calendar, `openApprovalRequest` at
  submit, **balance debit at approval** in the same tx as `actOnApproval`, overlap conflict guard,
  cancel → credit-back), `leave-accrual.ts` (pure: accrual method, carry-over, negative-balance
  policy).
- [ ] Server functions + hooks + workspace/route (`leave.tsx`).
- [ ] Tests: `hr-leave-accrual.test.ts` (accrual/carry-over/negative policy), `hr-leave-service`
  approval-debit + overlap + cancel-credit semantics.

## Phase 5 — Payroll core (compute engine)

- [ ] Repos: `hr-payroll-repo.ts` (salary-components/structures/employee-salary-components, periods,
  runs, details, component-details).
- [ ] Services: `salary-structure-service.ts` (component types fixed/percentage/slab/formula, taxable
  / pre-post-tax flags, effective-dated assignments), `payroll-compute.ts` (pure: deterministic
  gross/deduction/employer-contribution/net per employee from assigned components + timesheet/
  commission inputs), `payroll-run-service.ts` (period `open/computing/closed`, compute run →
  details + component-details).
- [ ] Server functions + hooks + workspaces/routes (`payroll.tsx`, `salary-structures.tsx`).
- [ ] Opt-in real-DB harness test mirroring `src/server/inventory/__tests__/harness.ts` for the run.
- [ ] Tests: `hr-payroll-compute.test.ts` (component-type math, slab/formula, taxable ordering,
  determinism).

## Phase 6 — Loans / Advances / Benefits / Commissions

- [ ] Repos: `hr-loan-repo.ts` (loans + installments), `hr-benefit-repo.ts` (employee benefits),
  `hr-commission-repo.ts` (commissions).
- [ ] Services: `loan-service.ts` (amortize into `hr_loan_installments`, disbursement posting,
  single-recovery guard — an installment recovered by at most one posted run), `advance-service.ts`
  (`hr_salary_advances` full/scheduled recovery), `benefit-service.ts` (enrollment as payroll
  employer-contribution component), `commission-service.ts` (CRM sales-employee commission +
  restaurant tip inputs via `sourceModule`/`sourceRef` → variable run components).
- [ ] Server functions + hooks + workspaces/routes (`loans.tsx`, `benefits.tsx`).
- [ ] Tests: `hr-loan-amortization.test.ts` (schedule, single-recovery guard), `hr-commission.test.ts`
  (source-ref mapping).

## Phase 7 — Payroll → Finance posting

- [ ] `payroll-posting.ts`: assemble one **balanced** JE per run (Dr salary + employer-contribution
  expense, Cr net-pay / statutory / loan-recovery / advance-recovery liabilities), cost-attributed
  via `hr_cost_centers` → `fin_cost_centers`, rounding residue → configured rounding account; post
  through `postJournalEntry(tx, { sourceDocType: 'hr_payroll_run', sourceDocId: runId, … })`.
- [ ] Idempotent per `hr_payroll_run.id` (one posted JE per run); posted run + detail rows immutable;
  corrections = off-cycle adjustment run or reversal of the run's JE.
- [ ] Loan disbursement / advance payout postings (Dr loan/advance receivable, Cr cash/bank);
  expense reimbursement postings deferred to Phase 12.
- [ ] Account mapping: HR posting roles (`salary_expense`, `employer_contribution_expense`,
  `net_pay_liability`, `statutory_liability`, `loan_recovery`, `advance_recovery`) resolved via
  `fin_account_mappings` + `fin_settings` defaults (reuse Spec-006 resolution).
- [ ] Tests: `hr-payroll-posting.test.ts` (balance/rounding, idempotent re-post no-op, edit-of-posted
  rejection, reversal), opt-in real-DB post-and-verify.

## Phase 8 — Performance

- [ ] Repos + services: `hr-performance-repo.ts`, `performance-service.ts` — KPIs, goals +
  `hr_goal_progress`, review templates (scored sections/competencies + weights), reviews +
  `hr_review_scores`; finalize → weighted overall rating + lock (immutable).
- [ ] Server functions + hooks + workspace/route (`performance.tsx`).
- [ ] Tests: `hr-performance.test.ts` (weighted rating, finalize-lock).

## Phase 9 — Learning

- [ ] Repos + services: `hr-learning-repo.ts`, `learning-service.ts` — courses, sessions (capacity),
  records (enrollment → attendance → completion), certificates (expiry, `registerAttachment`,
  satisfies skill/certification requirement).
- [ ] Server functions + hooks + workspace/route (`learning.tsx`).
- [ ] Tests: `hr-learning.test.ts` (capacity, completion → certificate).

## Phase 10 — Career / Workforce / Budgeting

- [ ] Repos + services: `hr-career-repo.ts` (career paths, successors, promotions — promotion writes
  `hr_employee_history`), `hr-workforce-repo.ts` (skills, employee-skills, workforce plans/
  requirements/skill-requirements), `hr-budget-repo.ts` (budget years/departments/positions/actuals).
- [ ] Services: `career-service.ts`, `workforce-service.ts` (skill-gap + open-requirement derivation),
  `hr-budget-service.ts` (headcount+cost roll-up, `hr_budget_actuals` vs `fin_gl_balances` variance).
- [ ] Server functions + hooks + workspaces/routes (`career.tsx`, `workforce.tsx`, `budget.tsx`).
- [ ] Tests: `hr-workforce.test.ts` (skill gaps), `hr-budget.test.ts` (variance math, fin
  reconciliation).

## Phase 11 — ESS / MSS

- [ ] Repos + services: `hr-ess-repo.ts` (employee requests/notifications/announcements/
  shared-documents), `ess-service.ts` (typed requests → approval/HR queue, mirror to
  `pod_notifications` via `notify`, scoped broadcasts, payslip/letter sharing with access control).
- [ ] **MSS scoping (no new tables):** `mss-scope.ts` — resolve manager-of-team subtree via
  `hr_reporting_structure` path and enforce in the server-function guard chain over Employee / Time /
  Leave / Performance aggregates.
- [ ] Server functions + hooks + workspaces/routes (`self-service.ts`, `team.tsx`).
- [ ] Tests: `hr-mss-scope.test.ts` (subtree resolution, out-of-team rejection).

## Phase 12 — Assets + Travel / Expense

- [ ] Repos + services: `hr-asset-repo.ts` (employee-asset custody, inventory item link, issue/return/
  reassign closes prior + opens new), `hr-expense-repo.ts` (travel requests, expense claims + lines,
  reimbursements).
- [ ] Services: `asset-assignment-service.ts`, `expense-service.ts` (claim totals from lines,
  per-category caps → elevated approval via `openApprovalRequest`, reimbursement posts via
  `postJournalEntry` — Dr expense by category, Cr net-pay or AP liability — attributed to the
  employee's cost center; payroll-routed reimbursements add a non-taxable net-pay component).
- [ ] Server functions + hooks + workspaces/routes (`assets.tsx`, `expenses.tsx`).
- [ ] Tests: `hr-asset-custody.test.ts` (issue/return/reassign trail), `hr-expense.test.ts` (line
  totals, cap → elevated approval, posting).

## Phase 13 — HR Analytics

- [ ] Read models (no new tables): headcount (by org node/grade/status), turnover (hires/
  terminations), payroll cost (by cost center/department), absence (leave/attendance) — server
  functions over the `hr_` aggregates.
- [ ] MSS-scoped manager dashboards must not bypass team scoping.
- [ ] Dashboard workspace + route (`analytics.tsx`) with recharts (mirror the inventory dashboards).
- [ ] Tests: `hr-analytics.test.ts` (headcount/turnover/cost aggregation, scope enforcement).

## Phase 14 — Reports + E2E

- [ ] Reports: payslip (per employee/run), org chart, headcount/turnover/cost, leave balances/absence
  — server functions + printable artifacts (reuse the shared document kit).
- [ ] Full i18n labels (EN + AR, RTL-aware) for every new user-facing surface.
- [ ] E2E flows (Playwright): HR bootstrap → build org → create employee → edit (history);
  leave request → manager approve → balance debit; timesheet → payroll compute → post → reverse;
  expense claim → approve → reimburse.

## Cross-cutting definition of done (per phase)

- [ ] `pnpm smoke` green (lint + typecheck + test; `NODE_OPTIONS=--max-old-space-size=8192` for
  typecheck; the 2 known pre-existing localStorage failures excepted).
- [ ] 80%+ unit coverage on new services/repos (pure helpers — org-tree, history, accrual, compute,
  posting — fully covered).
- [ ] Every tenant-scoped server function chains `requireAuth → requireTenantAccess →
  requirePermission` (+ MSS subtree / data scoping where the phase applies it).
- [ ] No new Prisma enums (hr statuses via `pod_document_statuses`); Decimal serialized to string at
  the DTO boundary; append-only tables have no soft delete.
- [ ] Every HR event with an accounting consequence posts through `postJournalEntry` — HR writes no
  `fin_journal_entries` / `fin_journal_lines` / `fin_gl_balances` directly.
- [ ] Approvals route through `pod_approval_*` via `openApprovalRequest` / `actOnApproval` (engine
  generalized in Phase 4 before the first approval-gated HR document).
- [ ] EN + AR i18n keys added for every new user-facing surface.
- [ ] Spec docs (`plan.md`, `tasks.md`, `integration.md`, and the data-model as it grows) updated
  with what shipped.

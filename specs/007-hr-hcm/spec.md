# Feature 007 — Enterprise HR / Human Capital Management

## Summary

Human Capital Management is the **people engine** of the platform: a multi-tenant, full-lifecycle
HCM suite — organization structure, employee master, recruitment/ATS, onboarding, time and
attendance, leave, payroll, benefits, performance, learning, career/succession, workforce
planning, HR budgeting, employee/manager self-service, asset assignment, and travel/expense —
SAP SuccessFactors / Oracle HCM / Odoo-Enterprise-class, auditable, PostgreSQL-optimized, and
tightly integrated with the accounting engine (Spec 006) it posts into.

This is **not a greenfield operational build**. The ERP already ships mature operational and
financial modules (inventory, purchasing `pod_`, sales/POS, restaurant `res_`, CRM `crm_`, and the
`fin_` accounting layer) — but **no people layer**: there are `Profile` and `TenantUser` identity
rows for application login, yet no employee master, no organizational hierarchy, no payroll, no
leave, no attendance. Feature 006 explicitly deferred payroll and stated "a future payroll module
posts through the same posting engine"; Feature 007 **is** that module — and far more.

Feature 007 adds the HCM layer as new `hr_`-prefixed tables (88 tables across 18 sub-domains). The
`hr_` layer is **authoritative for people data**; existing masters (`Profile`, `TenantUser`,
`fin_cost_centers`, `fin_chart_of_accounts`, inventory assets, CRM contacts) stay untouched and are
linked by scalar FK or mapping. **Zero breaking changes to existing modules.**

**Core principle.** The employee master is the system of record for people; the general ledger
(Spec 006) remains the system of record for accounting. HR-native documents (an employee edit, a
leave request, an attendance log) are the operational truth; every event with a financial
consequence — a posted payroll run, a benefit accrual, a loan disbursement, an expense
reimbursement — posts **through `postJournalEntry`**, never by writing `fin_` tables directly.
Approvals route through the polymorphic `pod_approval_*` engine via `openApprovalRequest` /
`actOnApproval`; notifications flow through `notify(tx, …)`; attachments through
`registerAttachment`. Posted payroll is **immutable** — corrections are off-cycle adjustment runs
or reversal entries, never edits.

## Goals

- **A real organizational backbone.** Legal companies, branches, business units, divisions,
  departments, sections, positions, and job grades, wired into an **acyclic reporting structure**
  with maintained depth and materialized path, cost-center linkage into `fin_cost_centers`, and
  headcount roll-up at every node.
- **A complete employee master.** `hr_employees` with contacts, addresses, documents, bank
  accounts, dependents, education, experience, certifications, languages, and **append-only
  history** (`hr_employee_history`) so every change to grade/position/salary/manager is a dated,
  immutable record — never an in-place overwrite (BR-EMP-1).
- **Hire-to-retire lifecycle.** Recruitment/ATS (job openings → candidates → interviews →
  feedback → offers → acceptance), templated onboarding, and a contract lifecycle
  (`hr_employee_contracts`) covering probation, fixed-term, renewal, and termination.
- **Time discipline.** Shift definitions and patterns, shift assignments, raw attendance logs,
  materialized `hr_attendance_daily`, timesheets, overtime requests, and break logs — feeding
  both payroll and the restaurant staffing surfaces (waiter/chef/cashier shift → payroll).
- **Configurable leave.** Leave types and policies, accrual-driven `hr_leave_balances`, requests
  with multi-level `hr_leave_approvals` through the approval engine, and balance impact computed
  at approval, never at request.
- **Payroll that posts.** Salary components and structures, per-employee assignments, payroll
  periods and runs, line-and-component detail, loans and installments, salary advances, benefits,
  and commissions — with a deterministic run engine that produces **balanced journal entries**
  (salary expense vs net-pay/statutory/loan-recovery liabilities) posted through the Spec 006
  posting engine, idempotent per run.
- **Talent and workforce.** KPIs, goals and progress, review templates and cycles, scored
  performance reviews; training courses/sessions/records/certificates; career paths, successors,
  and promotions; skills and skill gaps; workforce plans, requirements, and skill requirements;
  and an HR budget (years, department/position budgets, budget-vs-actual) that reconciles against
  `fin_` actuals.
- **Self-service and analytics.** Employee self-service (requests, notifications, announcements,
  shared documents), manager self-service (scoped views/permissions, no new tables), asset
  assignment (link into inventory), travel and expense (requests → claims → reimbursements posting
  through payroll or AP), and HR analytics dashboards (headcount, turnover, cost, absence).
- **Reuse, don't duplicate.** Numbering via `DocumentSequence` + `nextDocumentNumber` (additive
  `DocumentType` values); statuses via the existing `PodDocumentStatus` / `PodStatusTransition`
  registry (**no new Prisma enums**); approvals via `pod_approval_*`; notifications via
  `notify(tx, …)`; attachments via `registerAttachment`; accounting via `postJournalEntry`;
  cost centers via `fin_cost_centers`.

## Non-goals (this feature)

- **Statutory tax/social-insurance calculation engines per jurisdiction.** Payroll ships a
  **configurable component/formula model** (fixed, percentage, slab, and formula components) and
  jurisdiction-specific statutory tables are **data**, not code; no built-in country tax packs
  beyond the seedable examples.
- **Biometric / hardware clock device drivers.** Attendance starts with manual entry + CSV /
  API-ingested `hr_attendance_logs`; direct device integration (fingerprint/face terminals) is a
  later adapter behind the same log shape.
- **Full LMS content delivery.** Learning tracks courses/sessions/records/certificates and
  completion; it is **not** a SCORM player or content authoring/hosting system.
- **Replacing identity.** `Profile` / `TenantUser` / RBAC stay the application login and
  authorization mechanism; `hr_employees.profileId` links an employee to a login where one exists,
  but an employee need not have a login and a login need not be an employee.
- **Full 18-domain services and UI in this pass.** This pass delivers the **complete spec + full
  `hr_` schema/migration + working Organization and Employee-master core** (repos / services /
  server functions / validation / RBAC / tests). Everything else is later phases tracked in
  `tasks.md`.
- **Async payroll posting adapters.** Payroll posts **directly** through `postJournalEntry` in the
  run transaction in this design; registering payroll as a `fin_` async posting adapter (via
  `domain_events` → finance consumer) is deferred (see Risks).
- **Full E2E tests.** Unit tests accompany each phase; Playwright is a late-phase item.

## Domain-driven design framing

The module decomposes into bounded contexts, each with a consistency boundary, a lifecycle, and a
service that owns all writes inside one `prisma.$transaction`. The **Payroll Run** aggregate is the
only writer of payroll details and the only HR path that calls `postJournalEntry`; the **Employee**
aggregate is the only writer of `hr_employee_history`, and every field change that BR-EMP-1 tracks
flows through it.

| Bounded context | Root aggregate(s) | Key members | Notes |
|-----------------|-------------------|-------------|-------|
| **Organization** | `hr_companies` | `hr_branches`, `hr_business_units`, `hr_divisions`, `hr_departments`, `hr_sections`, `hr_positions`, `hr_job_grades`, `hr_cost_centers`, `hr_reporting_structure` | Acyclic tree; depth + materialized path; `fin_cost_centers` link |
| **Employee** | `hr_employees` | contacts, addresses, documents, bank accounts, contracts, dependents, education, experience, certifications, languages, `hr_employee_history` | Append-only history (BR-EMP-1) |
| **Recruitment / ATS** | `hr_job_openings` | `hr_candidates`, candidate documents, `hr_interviews`, interview feedback, `hr_job_offers`, `hr_offer_acceptance` | Pipeline; offer → hire hand-off |
| **Onboarding** | `hr_employee_onboarding` | `hr_onboarding_templates`, `hr_onboarding_tasks` | Templated checklists per new hire |
| **Time & Attendance** | `hr_timesheets` | shift definitions/patterns/assignments, `hr_attendance_logs`, `hr_attendance_daily`, `hr_overtime_requests`, `hr_break_logs` | Raw logs → daily materialization → timesheet |
| **Leave** | `hr_leave_requests` | `hr_leave_types`, `hr_leave_policies`, `hr_leave_balances`, `hr_leave_approvals` | Accrual balances; multi-level approval |
| **Payroll** | `hr_payroll_runs` | `hr_salary_components`, `hr_salary_structures`, `hr_employee_salary_components`, `hr_payroll_periods`, `hr_payroll_details`, `hr_payroll_component_details`, `hr_loans` (+installments), `hr_salary_advances`, `hr_employee_benefits`, `hr_commissions` | Sole caller of `postJournalEntry` from HR |
| **Benefits** | `hr_employee_benefits` | (shares payroll components) | Enrollment + accrual, posts via payroll |
| **Performance** | `hr_performance_reviews` | `hr_kpis`, `hr_goals`, `hr_goal_progress`, `hr_review_templates`, `hr_review_scores` | Review cycle; scored templates |
| **Learning** | `hr_training_sessions` | `hr_training_courses`, `hr_training_records`, `hr_training_certificates` | Enrollment → completion → certificate |
| **Career / Succession** | `hr_career_paths` | `hr_successors`, `hr_promotions` | Successor pools; promotion writes history |
| **Workforce Planning** | `hr_workforce_plans` | `hr_skills`, `hr_employee_skills`, `hr_workforce_requirements`, `hr_skill_requirements` | Demand vs supply; skill gaps |
| **HR Budgeting** | `hr_budget_years` | `hr_budget_departments`, `hr_budget_positions`, `hr_budget_actuals` | Headcount + cost budget vs `fin_` actual |
| **Employee Self-Service (ESS)** | `hr_employee_requests` | `hr_employee_notifications`, `hr_employee_announcements`, `hr_employee_documents_shared` | Self-service portal surface |
| **Manager Self-Service (MSS)** | *(no tables)* | scoped views + `hr.*` permissions | Manager-of team scoping over existing aggregates |
| **Asset Assignment** | `hr_employee_assets` | (links inventory asset / product) | Issue / return; custody trail |
| **Travel & Expense** | `hr_expense_claims` | `hr_travel_requests`, `hr_expense_claim_lines`, `hr_expense_reimbursements` | Posts via payroll net-pay or AP |
| **HR Analytics** | *(no tables)* | read models over the above | Headcount, turnover, cost, absence |

Cross-cutting, non-aggregate concerns reused: `audit_logs`, `document_sequences` (numbering),
`pod_approval_*` (approvals via `openApprovalRequest`/`actOnApproval`), `pod_notifications`
(`notify`), `pod_attachments` (`registerAttachment`), the `pod_document_statuses` /
`pod_status_transitions` status registry, and the Spec 006 posting engine (`postJournalEntry`) plus
`fin_cost_centers` for cost attribution.

## The 18 sub-domains — reconciliation map

`A` = new `hr_` tables are **authoritative for people data** · `L` = existing tables stay untouched
and are **linked** by scalar FK / mapping · `V` = **views/permissions only**, no new tables.
Nothing existing changes shape.

| # | Sub-domain | Disposition | What exists today → what hr_ adds |
|---|------------|-------------|------------------------------------|
| 1 | Organization | A + L | Nothing exists for org structure. `hr_companies`, `hr_branches`, `hr_business_units`, `hr_divisions`, `hr_departments`, `hr_sections`, `hr_positions`, `hr_job_grades`, `hr_cost_centers`, `hr_reporting_structure` (acyclic tree, depth+path). `hr_cost_centers` **link** to `fin_cost_centers` (zero-touch); `companyId` may reference `TenantAccount`. |
| 2 | Employee | A + L | `Profile`/`TenantUser` are login identity only. `hr_employees` (+contacts, addresses, documents, bank_accounts, contracts, dependents, education, experience, certifications, languages) plus append-only `hr_employee_history`. `hr_employees.profileId` **links** an optional login. |
| 3 | Recruitment / ATS | A | Nothing exists. `hr_job_openings`, `hr_candidates` (+documents), `hr_interviews` (+feedback), `hr_job_offers`, `hr_offer_acceptance`. Accepted offer seeds an `hr_employees` create. |
| 4 | Onboarding | A | Nothing exists. `hr_onboarding_templates`, `hr_onboarding_tasks`, `hr_employee_onboarding`. |
| 5 | Time & Attendance | A + L | Nothing exists in HR. `hr_shift_definitions`, `hr_shift_patterns`, `hr_shift_assignments`, `hr_attendance_logs`, `hr_attendance_daily`, `hr_timesheets`, `hr_overtime_requests`, `hr_break_logs`. Restaurant `res_` staffing shifts **link** in via `sourceModule/sourceRef` for shift→payroll. |
| 6 | Leave | A | Nothing exists. `hr_leave_types`, `hr_leave_policies`, `hr_leave_balances`, `hr_leave_requests`, `hr_leave_approvals`. Approvals route through `pod_approval_*`. |
| 7 | Payroll | A + L | Nothing exists. `hr_salary_components`, `hr_salary_structures`, `hr_employee_salary_components`, `hr_payroll_periods`, `hr_payroll_runs`, `hr_payroll_details`, `hr_payroll_component_details`, `hr_loans` (+installments), `hr_salary_advances`, `hr_employee_benefits`, `hr_commissions`. Posts through `postJournalEntry` (**links** `fin_`); CRM/restaurant commission & tip inputs **link** via `sourceModule/sourceRef`. |
| 8 | Benefits | A | Uses `hr_employee_benefits` (no separate tables); enrollment + accrual expressed as payroll components. |
| 9 | Performance | A | Nothing exists. `hr_kpis`, `hr_goals`, `hr_goal_progress`, `hr_review_templates`, `hr_performance_reviews`, `hr_review_scores`. |
| 10 | Learning | A | Nothing exists. `hr_training_courses`, `hr_training_sessions`, `hr_training_records`, `hr_training_certificates`. Certificates may `registerAttachment`. |
| 11 | Career / Succession | A | Nothing exists. `hr_career_paths`, `hr_successors`, `hr_promotions`. A promotion writes `hr_employee_history`. |
| 12 | Workforce Planning | A | Nothing exists. `hr_skills`, `hr_employee_skills`, `hr_workforce_plans`, `hr_workforce_requirements`, `hr_skill_requirements`. |
| 13 | HR Budgeting | A + L | Nothing exists in HR. `hr_budget_years`, `hr_budget_departments`, `hr_budget_positions`, `hr_budget_actuals`. Actuals reconcile against `fin_gl_balances` / payroll postings (**link**). |
| 14 | ESS | A | Nothing exists. `hr_employee_requests`, `hr_employee_notifications`, `hr_employee_announcements`, `hr_employee_documents_shared`. Cross-posts to `pod_notifications` via `notify`. |
| 15 | MSS | V | No new tables — manager-of-team scoped views + `hr.*` permissions over Employee/Time/Leave/Performance aggregates. |
| 16 | Asset Assignment | A + L | Inventory assets/products exist. `hr_employee_assets` (**links** the inventory item) tracks issue/return custody. |
| 17 | Travel & Expense | A + L | Nothing exists in HR. `hr_travel_requests`, `hr_expense_claims`, `hr_expense_claim_lines`, `hr_expense_reimbursements`. Reimbursement posts via payroll net-pay or `fin_` AP (**link**). |
| 18 | HR Analytics | V | No new tables — read models/dashboards over the `hr_` aggregates (headcount, turnover, cost, absence). |

Cross-cutting foundations reused: document numbering (`document-number-service.ts` + additive
`DocumentType` values `employee`, `employee_contract`, `job_opening`, `job_offer`,
`onboarding`, `timesheet`, `leave_request`, `payroll_run`, `loan`, `salary_advance`,
`expense_claim`, `travel_request`, `performance_review`), status registry
(`pod_document_statuses` / `pod_status_transitions` seeded for hr entity types), approvals
(`pod_approval_*`), notifications (`pod_notifications`), attachments (`pod_attachments`), audit
(`audit_logs`), and the Spec 006 posting engine + `fin_cost_centers`.

## User scenarios & testing *(mandatory)*

### User Story 1 (Priority: P1) — HR admin builds the organization and hires an employee

As an **HR administrator** holding `hr.org_manage` and `hr.employee_manage`, I build the company →
branch → department → position hierarchy and create an employee assigned to a position, grade, and
manager — with every subsequent change captured as immutable history.

**Acceptance scenarios**
1. Given a tenant with HR bootstrapped, when I create a company, a branch under it, and a
   department under the branch, then each node stores a maintained `depth` and materialized `path`,
   and `hr_reporting_structure` records the parent→child edge without introducing a cycle.
2. Given a department and an active position/grade, when I create an `hr_employees` row with a
   unique `employeeNumber` from the `employee` sequence, a hire date, position, grade, and manager,
   then the employee is `statusCode = 'active'` and an initial `hr_employee_history` row snapshots
   the starting position/grade/salary/manager.
3. Given an existing employee, when I change their position or grade, then a **new**
   `hr_employee_history` row is appended (effective-dated) and the prior row is closed — the
   employee row reflects current values but no history row is ever overwritten (BR-EMP-1).
4. Given an attempt to set a department's parent to one of its own descendants, when I save, then
   the write is rejected with a cycle error and the tree is unchanged.
5. Given an employee with a login, when I set `profileId`, then the link resolves to an existing
   `Profile`; setting it to a profile already linked to another active employee is rejected.

### User Story 2 (Priority: P1) — Payroll officer runs monthly payroll and it posts to the GL

As a **payroll officer** holding `hr.payroll_run` and `hr.payroll_post`, I open the current payroll
period, compute a run across eligible employees, review the results, and post it — producing one
balanced journal entry through the Spec 006 posting engine.

**Acceptance scenarios**
1. Given an open `hr_payroll_periods` row and employees with assigned `hr_salary_structures` /
   `hr_employee_salary_components`, when I compute a `hr_payroll_runs`, then `hr_payroll_details`
   (one per employee) and `hr_payroll_component_details` (one per component) are produced with
   gross, deductions, employer contributions, and net computed deterministically from the
   component model.
2. Given active `hr_loans` with due `hr_loan_installments` and open `hr_salary_advances` for an
   employee, when the run computes, then the installment/advance recovery is deducted and the
   installment marked scheduled-for-recovery — never double-recovered across runs.
3. Given a computed run, when I post it, then exactly one **balanced** journal entry is created via
   `postJournalEntry` (Dr salary + employer-contribution expense, Cr net-pay / statutory /
   loan-recovery / advance-recovery liabilities), cost-attributed to each employee's
   `hr_cost_centers` → `fin_cost_centers`, and the run moves `computed → posted` and becomes
   immutable.
4. Given a posted run, when I attempt to recompute or edit a detail, then the mutation is rejected;
   corrections are an off-cycle adjustment run or a reversal of the run's journal entry.
5. Given the same posted run, when a re-post is attempted, then it is a no-op — posting is
   idempotent per `hr_payroll_runs.id` (one posted JE per run).

### User Story 3 (Priority: P1) — Employee requests leave and a manager approves it

As an **employee** using self-service, I request annual leave for a date range; my manager approves
it through the approval engine, and my leave balance is debited only on approval.

**Acceptance scenarios**
1. Given an active leave policy and a positive `hr_leave_balances` for the leave type, when I
   submit an `hr_leave_requests` for N working days, then the request is `statusCode = 'submitted'`,
   the balance is **not** yet reduced, and an `openApprovalRequest` is raised against the request.
2. Given the request routes to my manager, when the manager approves via `actOnApproval`, then an
   `hr_leave_approvals` row records the decision, the request moves to `approved`, and the balance
   is debited by exactly N days in the same transaction.
3. Given a request for more days than the available balance and a policy that disallows negative
   balances, when I submit, then it is rejected with an insufficient-balance error.
4. Given an approved future-dated request, when I cancel it before it starts, then the balance is
   credited back and the request moves to `cancelled`.
5. Given overlapping approved leave for the same employee and dates, when a second request overlaps,
   then it is rejected as a conflict.

### User Story 4 (Priority: P2) — Recruiter runs the hiring pipeline to an accepted offer

As a **recruiter** holding `hr.recruitment_manage`, I open a requisition, screen candidates,
schedule interviews, collect feedback, extend an offer, and on acceptance hand off to onboarding.

**Acceptance scenarios**
1. Given an approved `hr_job_openings` tied to a position, when I add candidates and schedule
   `hr_interviews`, then each interview can collect one `hr_interview_feedback` per interviewer with
   a recommendation.
2. Given a candidate in final stage, when I create an `hr_job_offers` and the candidate accepts via
   `hr_offer_acceptance`, then the opening decrements its open headcount and an onboarding
   hand-off is available.
3. Given an accepted offer, when I convert it to an employee, then an `hr_employees` row is created
   pre-populated from the candidate/offer (position, grade, salary), and an `hr_employee_onboarding`
   is instantiated from the default `hr_onboarding_templates`.
4. Given an opening whose headcount is fully filled, when another offer is accepted against it,
   then it is rejected unless the opening headcount is increased.

### User Story 5 (Priority: P2) — Employee clocks time and a timesheet is approved

As an **employee**, my attendance is logged, materialized into daily records with worked/overtime
hours, rolled into a timesheet, and approved so it can feed payroll.

**Acceptance scenarios**
1. Given a shift assignment for a day, when clock-in/out `hr_attendance_logs` are ingested (manual
   or CSV), then `hr_attendance_daily` materializes worked hours, late/early flags, and overtime
   against the shift definition, deduping repeated raw logs.
2. Given approved `hr_overtime_requests`, when the daily record computes, then only approved
   overtime counts toward payable overtime; unapproved overtime is recorded but not payable.
3. Given a pay period's daily records, when I submit a `hr_timesheets`, then it aggregates worked
   and overtime hours and routes for approval; an approved timesheet is an input to the payroll
   run's variable components.
4. Given a restaurant `res_` shift closed for a waiter, when it links via `sourceModule = 'res'`,
   then its worked hours and tips surface in the same daily/timesheet pipeline for shift→payroll.

### User Story 6 (Priority: P2) — Manager runs a performance review cycle

As a **manager** holding `hr.performance_manage`, I set goals and KPIs, open a review from a
template, score it, and finalize — feeding succession and (optionally) a pay/promotion action.

**Acceptance scenarios**
1. Given assigned `hr_kpis` and `hr_goals` with `hr_goal_progress` updates, when I open an
   `hr_performance_reviews` from a `hr_review_templates`, then `hr_review_scores` are seeded per
   template section/competency.
2. Given a scored review, when I finalize it, then an overall rating is computed from the weighted
   `hr_review_scores` and the review is locked.
3. Given a finalized high rating, when I nominate the employee to a `hr_career_paths` successor
   pool, then an `hr_successors` row is created; a resulting `hr_promotions` writes a new
   `hr_employee_history` row.

### User Story 7 (Priority: P2) — Employee submits an expense claim and is reimbursed

As an **employee** holding self-service, I file a travel request, submit an expense claim with
lines, get it approved, and receive a reimbursement that posts to accounting.

**Acceptance scenarios**
1. Given an approved `hr_travel_requests`, when I file an `hr_expense_claims` with
   `hr_expense_claim_lines`, then the claim totals from its lines and routes through
   `openApprovalRequest`.
2. Given an approved claim, when finance processes an `hr_expense_reimbursements`, then a balanced
   journal entry posts through `postJournalEntry` (Dr expense by line category, Cr net-pay or AP
   liability) attributed to the employee's cost center.
3. Given reimbursement via payroll, when the next `hr_payroll_runs` computes, then the reimbursement
   amount is added as a non-taxable component to net pay and the claim is marked reimbursed.
4. Given a claim line exceeding a policy cap, when submitted, then the over-cap portion is flagged
   and requires an elevated approval level.

### User Story 8 (Priority: P3) — HR planner budgets headcount and tracks variance

As an **HR planner** holding `hr.budget_manage`, I set a headcount and cost budget per department
and position for a budget year and track actuals against it.

**Acceptance scenarios**
1. Given a `hr_budget_years`, when I set `hr_budget_departments` and `hr_budget_positions`
   headcount and cost lines, then a total planned headcount and cost roll up the org tree.
2. Given posted payroll and filled positions, when `hr_budget_actuals` refresh, then actual
   headcount and cost are compared to budget with variance amount and percentage, reconciling to
   `fin_gl_balances` for the payroll accounts.
3. Given a workforce plan with `hr_workforce_requirements` and `hr_skill_requirements`, when I
   compare to `hr_employee_skills`, then skill gaps and open-requirement counts are derived for the
   plan horizon.

### Edge cases

- **History overwrite attempt** → any update to an existing `hr_employee_history` row is rejected;
  history is append-only, and the current employee snapshot is a derived read of the latest row
  (BR-EMP-1). Nothing overwrites a dated record.
- **Org cycle** → setting a node's parent to itself or a descendant is rejected via the acyclic
  check (depth/path recomputation detects the cycle); the tree is left unchanged.
- **Re-post / recompute of a posted payroll run** → rejected (`ConflictError`); a run posts exactly
  one journal entry, enforced idempotent per run id — corrections are an adjustment run or a
  reversal entry, never an edit.
- **Unbalanced payroll journal** → the run's JE is assembled to balance (Σ Dr = Σ Cr) before
  `postJournalEntry`; any residue from rounding component amounts is synthesized to the configured
  rounding account so the entry balances exactly, and the Spec 006 deferred balance trigger
  re-asserts at commit.
- **Leave balance underflow** → a request that would drive the balance negative under a
  no-negative policy is rejected; balances are debited at approval, never at submission, so a
  rejected/cancelled request never leaks balance.
- **Double loan/advance recovery** → a `hr_loan_installments` row can be recovered by at most one
  posted payroll run; a re-run or overlapping run never recovers the same installment twice.
- **Overlapping leave / double booking** → an approved leave that overlaps existing approved leave
  for the same employee is rejected as a conflict.
- **Terminated employee in a run** → an employee terminated before the period start is excluded
  from the run; terminated mid-period is prorated per policy; a final-settlement run handles
  end-of-service.
- **Duplicate attendance logs** → repeated raw `hr_attendance_logs` for the same
  employee/timestamp/source are deduped into `hr_attendance_daily`; re-ingesting a CSV creates no
  duplicate daily records.
- **Deactivating an org node with active employees or children** → rejected until employees are
  reassigned and children re-parented/deactivated.
- **Tenant deletion** → all `hr_` rows cascade via the `tenantId` FK; append-only history and
  posted payroll detail tables have no soft delete by design.

## Requirements *(mandatory)*

### Functional requirements

#### Organization (FR-ORG)

- **FR-ORG-1** The organization MUST model `hr_companies` → `hr_branches` → `hr_business_units` →
  `hr_divisions` → `hr_departments` → `hr_sections` as a hierarchy, plus `hr_positions`,
  `hr_job_grades`, and `hr_cost_centers` as cross-cutting masters.
- **FR-ORG-2** The reporting/org tree (`hr_reporting_structure` and each node's `parentId`) MUST be
  **acyclic**, with a maintained `depth` and materialized `path`; a change introducing a cycle MUST
  be rejected.
- **FR-ORG-3** `hr_cost_centers` MUST link to `fin_cost_centers` (nullable scalar FK) so HR cost
  attribution flows into the accounting dimension without duplicating it.
- **FR-ORG-4** `companyId` MAY reference `TenantAccount`; a node deactivation MUST be blocked while
  it has active employees or active children.
- **FR-ORG-5** Positions MUST carry a target headcount and grade band; headcount MUST roll up the
  org tree for planning and analytics.
- **FR-ORG-6** A default org scaffold (company + root department + default grades) MUST be seedable
  per tenant at HR bootstrap.

#### Employee (FR-EMP)

- **FR-EMP-1** Every change to an employee's **position, grade, salary, department, or manager**
  MUST append an effective-dated `hr_employee_history` row; history is **append-only** and MUST
  NOT be overwritten (BR-EMP-1). The employee row holds current values as a derived cache.
- **FR-EMP-2** `hr_employees` MUST carry a unique `employeeNumber` (per tenant) from the `employee`
  `DocumentSequence`, a hire date, status, position, grade, department, and optional manager.
- **FR-EMP-3** Employee sub-entities (`hr_employee_contacts`, `_addresses`, `_documents`,
  `_bank_accounts`, `_contracts`, `_dependents`, `_education`, `_experience`, `_certifications`,
  `_languages`) MUST each be independently CRUD-able and tenant-scoped; documents MAY
  `registerAttachment`.
- **FR-EMP-4** `hr_employee_contracts` MUST model probation, fixed-term, and open-ended contracts
  with start/end, renewal linkage, and a termination reason; the active contract drives payroll
  eligibility.
- **FR-EMP-5** `hr_employees.profileId` MUST link at most one `Profile` (application login); an
  employee MAY exist without a login and a login MAY exist without an employee.
- **FR-EMP-6** Bank accounts MUST support a primary flag; the primary account is the payroll payee
  target and MUST be present before a run pays that employee by bank.

#### Recruitment / ATS (FR-ATS)

- **FR-ATS-1** `hr_job_openings` MUST tie to a position with a target headcount and an approval
  before publishing; open headcount MUST decrement on accepted offers.
- **FR-ATS-2** `hr_candidates` MUST progress through pipeline stages; `hr_candidate_documents` MAY
  `registerAttachment` (CV, portfolio).
- **FR-ATS-3** `hr_interviews` MUST support multiple rounds; `hr_interview_feedback` MUST allow one
  scored recommendation per interviewer per interview.
- **FR-ATS-4** `hr_job_offers` MUST capture compensation terms and route through
  `openApprovalRequest`; `hr_offer_acceptance` records the candidate decision and timestamp.
- **FR-ATS-5** An accepted offer MUST be convertible to an `hr_employees` row pre-populated from the
  candidate/offer, seeding an onboarding instance.

#### Onboarding (FR-ONB)

- **FR-ONB-1** `hr_onboarding_templates` MUST define ordered `hr_onboarding_tasks` (with role,
  due-offset, and category) reusable across hires.
- **FR-ONB-2** `hr_employee_onboarding` MUST instantiate a template per new hire, tracking per-task
  status and assignee; task completion MAY raise `notify`.
- **FR-ONB-3** Onboarding completion MUST be derivable from task states and MUST NOT block employee
  activation (activation is an explicit HR action).

#### Time & Attendance (FR-TIME)

- **FR-TIME-1** `hr_shift_definitions` and `hr_shift_patterns` MUST define working windows, breaks,
  and rotation; `hr_shift_assignments` bind employees to shifts by date range.
- **FR-TIME-2** `hr_attendance_logs` MUST accept manual and CSV/API-ingested clock events;
  `hr_attendance_daily` MUST materialize worked/late/early/overtime per day, deduping repeated raw
  logs.
- **FR-TIME-3** `hr_overtime_requests` MUST gate payable overtime — only approved overtime is
  payable; `hr_break_logs` record intra-shift breaks.
- **FR-TIME-4** `hr_timesheets` MUST aggregate daily records for a pay period, route for approval,
  and expose worked/overtime hours as payroll inputs.
- **FR-TIME-5** Restaurant `res_` staffing shifts MUST be linkable via `sourceModule`/`sourceRef`
  so waiter/chef/cashier hours and tips flow through the same daily/timesheet pipeline.

#### Leave (FR-LEAVE)

- **FR-LEAVE-1** `hr_leave_types` and `hr_leave_policies` MUST configure accrual method, carry-over,
  negative-balance allowance, and eligibility.
- **FR-LEAVE-2** `hr_leave_balances` MUST be accrual-driven per employee/type/period; the balance
  is the source of truth for availability.
- **FR-LEAVE-3** `hr_leave_requests` MUST compute working days per the policy calendar and route
  through `openApprovalRequest`; the balance is debited **only at approval**, in the same
  transaction as `actOnApproval` recording `hr_leave_approvals`.
- **FR-LEAVE-4** A request that would breach a no-negative policy MUST be rejected; overlapping
  approved leave for the same employee MUST be rejected as a conflict.
- **FR-LEAVE-5** Cancelling an approved, not-yet-started request MUST credit the balance back
  atomically.

#### Payroll (FR-PAY)

- **FR-PAY-1** `hr_salary_components` MUST support fixed, percentage, slab, and formula types, each
  flagged earning/deduction/employer-contribution, taxable/non-taxable, and pre/post-tax;
  `hr_salary_structures` group components and `hr_employee_salary_components` assign them per
  employee with effective dates.
- **FR-PAY-2** `hr_payroll_periods` MUST have `open/computing/closed` states; a `hr_payroll_runs`
  computes `hr_payroll_details` (per employee) and `hr_payroll_component_details` (per component)
  deterministically from assigned components plus timesheet/commission inputs.
- **FR-PAY-3** A posted run MUST create **exactly one balanced** journal entry via
  `postJournalEntry` (Dr salary + employer-contribution expense, Cr net-pay/statutory/loan/advance
  liabilities), cost-attributed via `hr_cost_centers` → `fin_cost_centers`, and MUST be idempotent
  per run id.
- **FR-PAY-4** `hr_loans` MUST amortize into `hr_loan_installments`; `hr_salary_advances` recover in
  full or by schedule. A given installment/advance MUST be recovered by at most one posted run — no
  double recovery.
- **FR-PAY-5** Posted runs and their detail rows MUST be immutable; corrections are an off-cycle
  adjustment run or a reversal of the run's journal entry, never an edit.
- **FR-PAY-6** `hr_commissions` MUST accept CRM sales-employee commission and restaurant tip inputs
  via `sourceModule`/`sourceRef` and feed the run as variable components.
- **FR-PAY-7** Loan disbursement and salary advance payout MUST post through `postJournalEntry`
  (Dr loan/advance receivable, Cr cash/bank) when disbursed.

#### Benefits (FR-BEN)

- **FR-BEN-1** `hr_employee_benefits` MUST model enrollment (plan, coverage, employee/employer
  cost, effective dates) expressed as payroll components.
- **FR-BEN-2** Benefit employer cost MUST accrue through the payroll run as an
  employer-contribution component posting to the configured expense/liability accounts.

#### Performance (FR-PERF)

- **FR-PERF-1** `hr_kpis` and `hr_goals` MUST be assignable per employee with weights;
  `hr_goal_progress` records dated updates.
- **FR-PERF-2** `hr_review_templates` MUST define scored sections/competencies with weights;
  `hr_performance_reviews` instantiate them and `hr_review_scores` capture per-item scores.
- **FR-PERF-3** Finalizing a review MUST compute a weighted overall rating and lock the review and
  its scores (immutable thereafter).

#### Learning (FR-LEARN)

- **FR-LEARN-1** `hr_training_courses` and `hr_training_sessions` MUST schedule learning with
  capacity; `hr_training_records` track enrollment → attendance → completion.
- **FR-LEARN-2** Completion MAY issue an `hr_training_certificates` (with expiry) that MAY
  `registerAttachment` and MAY satisfy a `hr_skill_requirements`/certification requirement.

#### Career / Succession (FR-CAR)

- **FR-CAR-1** `hr_career_paths` MUST define progression between positions/grades; `hr_successors`
  nominate employees into a successor pool with a readiness level.
- **FR-CAR-2** `hr_promotions` MUST record a promotion action that appends an `hr_employee_history`
  row (position/grade/salary change) — never an in-place edit.

#### Workforce Planning (FR-WFP)

- **FR-WFP-1** `hr_skills` MUST be a tenant-definable catalog; `hr_employee_skills` rate an
  employee's proficiency per skill.
- **FR-WFP-2** `hr_workforce_plans` MUST hold `hr_workforce_requirements` (demand by
  position/period) and `hr_skill_requirements` (required skills/levels).
- **FR-WFP-3** Skill-gap and open-requirement analytics MUST be derivable by comparing requirements
  to current `hr_employee_skills` and filled positions.

#### HR Budgeting (FR-BUD)

- **FR-BUD-1** `hr_budget_years` MUST scope `hr_budget_departments` and `hr_budget_positions`
  headcount + cost lines per department/position.
- **FR-BUD-2** `hr_budget_actuals` MUST compare planned vs actual headcount and cost with variance
  amount and percentage, reconciling to `fin_gl_balances` for payroll accounts.
- **FR-BUD-3** Budget headcount MUST roll up the org tree and be comparable against workforce-plan
  demand.

#### Employee Self-Service (FR-ESS)

- **FR-ESS-1** `hr_employee_requests` MUST let an employee raise typed requests (leave, document,
  data change, expense) that route to the appropriate approval/HR queue.
- **FR-ESS-2** `hr_employee_notifications` MUST surface HR notifications to the employee and MAY
  mirror to `pod_notifications` via `notify`.
- **FR-ESS-3** `hr_employee_announcements` MUST support tenant/department-scoped broadcasts;
  `hr_employee_documents_shared` MUST share payslips/letters/policies to an employee with access
  control.

#### Manager Self-Service (FR-MSS)

- **FR-MSS-1** MSS MUST expose **manager-of-team** scoped read/act views over Employee, Time,
  Leave, and Performance aggregates using `hr.*` permissions — **no new tables**.
- **FR-MSS-2** A manager MUST only see and act on employees in their reporting subtree (resolved via
  `hr_reporting_structure` path), enforced in the server-function guard chain.

#### Asset Assignment (FR-ASSET)

- **FR-ASSET-1** `hr_employee_assets` MUST link an inventory asset/product to an employee with
  issue/return dates and condition — a custody trail — without changing inventory tables.
- **FR-ASSET-2** Returning or reassigning an asset MUST close the prior custody record and (for
  reassignment) open a new one.

#### Travel & Expense (FR-EXP)

- **FR-EXP-1** `hr_travel_requests` MUST capture trip details and route through `openApprovalRequest`
  before booking/spend.
- **FR-EXP-2** `hr_expense_claims` with `hr_expense_claim_lines` MUST total from lines, support
  per-category policy caps (over-cap → elevated approval), and route for approval.
- **FR-EXP-3** `hr_expense_reimbursements` MUST post a balanced journal entry through
  `postJournalEntry` (Dr expense by category, Cr net-pay or AP liability) attributed to the
  employee's cost center; payroll-routed reimbursements add a non-taxable net-pay component.

#### HR Analytics (FR-AN)

- **FR-AN-1** Analytics MUST provide headcount (by org node/grade/status), turnover
  (hires/terminations), payroll cost (by cost center/department), and absence (leave/attendance)
  read models — **no new tables**, derived from the `hr_` aggregates.
- **FR-AN-2** Analytics reads MUST be tenant-scoped through the guard chain and MUST NOT bypass MSS
  team scoping for manager-role dashboards.

#### Cross-cutting platform requirements (FR-SET)

- **FR-SET-1** Every `hr_` server function MUST chain
  `getCurrentUserContext → requireTenantAccess → requirePermission`, validate input with Zod via
  `.inputValidator(...)`, and write inside a single `prisma.$transaction`.
- **FR-SET-2** Every new `hr.*` permission MUST be registered in `rbac-catalog.ts`, linked in
  `module-catalog.ts` (`PERMISSION_LINKS`), and the HR nav section wired in `app-nav.ts` +
  `icon-map.ts` with en/ar i18n keys.
- **FR-SET-3** No new Prisma enums: `hr_` document statuses use string `statusCode` backed by
  `pod_document_statuses` / `pod_status_transitions` seeded for hr entity types; the additive
  `DocumentType` enum extension is the established numbering path.
- **FR-SET-4** Approvals MUST route through `pod_approval_*` via `openApprovalRequest` /
  `actOnApproval` for the entity types `hr_leave_request`, `hr_job_offer`, `hr_loan`,
  `hr_payroll_run`, `hr_expense_claim`, and `hr_travel_request`.
- **FR-SET-5** Every HR event with an accounting consequence MUST post through the Spec 006
  `postJournalEntry` — HR code MUST NOT write `fin_journal_entries`/`fin_journal_lines`/
  `fin_gl_balances` directly.
- **FR-SET-6** A tenant HR bootstrap MUST create the default org scaffold, default job grades,
  default leave types/policies, a default onboarding template, and the base salary components in one
  idempotent operation.

### Key entities

Organization (`hr_companies`, `hr_branches`, `hr_business_units`, `hr_divisions`,
`hr_departments`, `hr_sections`, `hr_positions`, `hr_job_grades`, `hr_cost_centers`,
`hr_reporting_structure`), Employee (`hr_employees`, `hr_employee_contacts`,
`hr_employee_addresses`, `hr_employee_documents`, `hr_employee_bank_accounts`,
`hr_employee_contracts`, `hr_employee_history`, `hr_employee_dependents`, `hr_employee_education`,
`hr_employee_experience`, `hr_employee_certifications`, `hr_employee_languages`), Recruitment
(`hr_job_openings`, `hr_candidates`, `hr_candidate_documents`, `hr_interviews`,
`hr_interview_feedback`, `hr_job_offers`, `hr_offer_acceptance`), Onboarding
(`hr_onboarding_templates`, `hr_onboarding_tasks`, `hr_employee_onboarding`), Time
(`hr_shift_definitions`, `hr_shift_patterns`, `hr_shift_assignments`, `hr_attendance_logs`,
`hr_attendance_daily`, `hr_timesheets`, `hr_overtime_requests`, `hr_break_logs`), Leave
(`hr_leave_types`, `hr_leave_policies`, `hr_leave_balances`, `hr_leave_requests`,
`hr_leave_approvals`), Payroll (`hr_salary_components`, `hr_salary_structures`,
`hr_employee_salary_components`, `hr_payroll_periods`, `hr_payroll_runs`, `hr_payroll_details`,
`hr_payroll_component_details`, `hr_loans`, `hr_loan_installments`, `hr_salary_advances`,
`hr_employee_benefits`, `hr_commissions`), Performance (`hr_kpis`, `hr_goals`, `hr_goal_progress`,
`hr_review_templates`, `hr_performance_reviews`, `hr_review_scores`), Learning
(`hr_training_courses`, `hr_training_sessions`, `hr_training_records`, `hr_training_certificates`),
Career (`hr_career_paths`, `hr_successors`, `hr_promotions`), Workforce (`hr_skills`,
`hr_employee_skills`, `hr_workforce_plans`, `hr_workforce_requirements`, `hr_skill_requirements`),
Budgeting (`hr_budget_years`, `hr_budget_departments`, `hr_budget_positions`, `hr_budget_actuals`),
ESS (`hr_employee_requests`, `hr_employee_notifications`, `hr_employee_announcements`,
`hr_employee_documents_shared`), Assets (`hr_employee_assets`), Travel & Expense
(`hr_travel_requests`, `hr_expense_claims`, `hr_expense_claim_lines`, `hr_expense_reimbursements`).
MSS and HR Analytics add **no tables** (views/permissions only). 88 `hr_` tables total.

## Success criteria

- `pnpm prisma validate` parses the schema; both hand-authored migrations (`DocumentType`
  additions, then the full `hr_` DDL + seeds) apply cleanly via `pnpm prisma migrate deploy` (NEVER
  `migrate dev` — the DB has drifted on `auth.uid()` defaults) and `pnpm prisma generate` produces a
  type-correct client.
- Tenant HR bootstrap creates the default org scaffold + grades + leave types + onboarding template
  + base salary components; an employee create/edit produces append-only `hr_employee_history`
  rows, and the org tree rejects cycles — all through the server functions with the guard chain.
- A computed payroll run assembles a balanced journal entry and posts exactly once through
  `postJournalEntry`; a re-post is a no-op and an edit of a posted run is rejected.
- `pnpm db:seed` seeds the new `hr.*` permissions and the three roles (`hr_manager`, `hr_officer`,
  `payroll_officer`); `catalog-rbac.test.ts` / `rbac-catalog.test.ts` stay green with the HR
  module/screens/links added.
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck` and
  `pnpm vitest run tests/unit/hr-*.test.ts` are green (`hr-org-tree.test.ts`,
  `hr-validation.test.ts`, `hr-employee-history.test.ts`); `pnpm smoke` overall green modulo the
  known pre-existing failures.
- Adding a salary component, leave policy, or onboarding template for one tenant requires only data
  changes — no deploy — and does not affect other tenants.

## Assumptions

- The single `prisma/schema.prisma` continues to hold all models; the `hr_` section is grouped
  under one banner comment, and `TenantAccount` carries reverse relations for the `hr_` roots.
- **Company = `hr_companies` (may reference `TenantAccount`); operational branch = `hr_branches`** —
  `companyId` / `branchId` / `costCenterId` are nullable scalar UUIDs; `hr_cost_centers` links to
  `fin_cost_centers`.
- App-level tenant scoping via the guard chain stays the primary isolation boundary; whatever RLS
  treatment prior migrations applied is mirrored for `hr_` tables (verified at implementation).
- The database has drifted from the migration history (`auth.uid()` defaults); migrations are
  hand-authored SQL applied with `pnpm prisma migrate deploy` — **never** `migrate dev`.
- The `pod_approval_*` engine (`openApprovalRequest`/`actOnApproval`), `pod_notifications`
  (`notify`), `pod_attachments` (`registerAttachment`), `document-number-service.ts`, the
  `pod_document_statuses` registry, and the Spec 006 posting engine (`postJournalEntry`) +
  `fin_cost_centers` are the integration substrate; Feature 007 adds entity types, statuses,
  transitions, and seed data — not new infrastructure.
- Money is `Decimal(19,4)`, rates `(9,6)`, hours `(9,2)`; Decimals are serialized to strings at the
  DTO boundary.
- Append-only tables (`hr_employee_history`, posted `hr_payroll_details`/
  `hr_payroll_component_details`) have **no soft delete**; mutable headers carry
  `createdBy/updatedBy/deletedBy`, `versionNumber`, `deletedAt`.

## Glossary

- **HCM** — human capital management; the full people lifecycle from hire to retire.
- **Employee master** — `hr_employees` plus its sub-entities; the system of record for people.
- **Append-only history** — `hr_employee_history`: every position/grade/salary/manager change is a
  dated, immutable row; the employee record's current values are a derived cache (BR-EMP-1).
- **Org tree** — the acyclic company→branch→…→section hierarchy plus `hr_reporting_structure`, with
  maintained depth and materialized path.
- **Position vs grade** — a position is a staffed role in the org; a job grade is a
  compensation/seniority band a position sits in.
- **ATS** — applicant tracking system; the recruitment pipeline (openings → candidates → interviews
  → offers → acceptance).
- **Shift / roster** — a defined working window; assignments bind employees to shifts by date.
- **Attendance daily** — `hr_attendance_daily`: the materialized per-day worked/late/overtime
  record derived (deduped) from raw `hr_attendance_logs`.
- **Timesheet** — a pay-period aggregation of daily records, approved as a payroll input.
- **Leave balance** — accrual-driven available days per employee/type; debited only at approval.
- **Salary component / structure** — the building blocks (earnings, deductions, employer
  contributions) and their grouping into a structure assigned to employees.
- **Payroll run** — the computation over a period that produces per-employee details and posts one
  balanced journal entry through the Spec 006 posting engine.
- **Loan / salary advance** — amounts disbursed to an employee and recovered through payroll
  deductions; each installment recovered by at most one posted run.
- **Employer contribution** — a payroll cost borne by the employer (e.g. benefits, statutory)
  posted as expense/liability, not deducted from the employee.
- **Successor / succession** — a candidate pool for a position's future vacancy with readiness
  levels.
- **Skill gap** — the shortfall between workforce-plan skill requirements and current employee
  skills.
- **ESS / MSS** — employee / manager self-service surfaces; MSS is scoped to the manager's
  reporting subtree.
- **`postJournalEntry`** — the Spec 006 posting-engine entry point; the **only** way HR touches the
  ledger.
- **`hr_`** — table prefix for the HR / Human Capital Management layer (Spec 007).

# Business Rules — HR / HCM (Spec 007)

Validation and business rules per sub-domain, the state-transition contracts, and the mapping from
rule violations to the app's `DomainError` subclasses (`src/server/auth/errors.ts`:
`UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `ValidationError`,
`ServiceUnavailableError`). Where a rule is enforced by the DB (CHECK constraint, partial unique
index, deferred constraint trigger) it is noted; the service layer validates the same rule ahead of
time to return a friendly `DomainError` rather than a raw Postgres error.

Throughout: **all tenant-scoped server functions chain the guards**
`getCurrentUserContext → requireTenantAccess → requirePermission` before any read/write. A missing
guard is a cross-tenant leak, since app-level scoping is the primary isolation boundary. The **HR
history writer is the only path** that appends `hr_employee_history` rows, and the **finance posting
engine (`postJournalEntry`) is the only writer** of the general ledger — HR never writes journal
tables directly; it hands finance a `sourceDocType='hr_payroll_run'` / `'hr_expense_claim'` and lets
the engine own the ledger.

All 88 tables use the `hr_` prefix; Prisma models are `Hr*` (camelCase fields, `snake_case` `@map`
columns). Money and hours serialize as `Decimal`→string at the DTO/event boundary.

---

## BR-ORG — Organization, Hierarchy & Cost Centers

- **BR-ORG-01** The company → branch → department tree and the cost-center tree are each
  **acyclic**: a node's `parentId` must never be reachable from itself. A re-parent that would
  introduce a cycle → **`ValidationError`**.
- **BR-ORG-02** Each hierarchical node maintains a **materialized `path`** and integer `depth`,
  rewritten for the **whole subtree in one transaction** on insert/move. Path/depth are derived,
  never client-supplied; a mismatch is repaired, not trusted.
- **BR-ORG-03** `(tenantId, code)` is UNIQUE for companies, branches, departments, positions, job
  grades, and cost centers → collision **`ConflictError`**.
- **BR-ORG-04** A node cannot be deactivated/soft-deleted while it has **active children** or is
  referenced by an **active employee assignment** (department/position/cost-center) →
  **`ConflictError`**.
- **BR-ORG-05** An employee's current assignment must resolve, in the **same tenant**, to an active
  **branch + department + position + cost-center + manager**; any missing/foreign reference →
  **`ValidationError`** (absent) / **`NotFoundError`** (unknown id).
- **BR-ORG-06** A **manager must be an active employee** of the same tenant (`status = active`,
  not soft-deleted); assigning a terminated/draft/foreign employee as manager →
  **`ValidationError`**.
- **BR-ORG-07** The reporting (manager) chain is itself **acyclic** — an employee may not appear in
  their own management chain → **`ValidationError`**. `org-tree.ts` resolves the chain with a
  visited-set guard.
- **BR-ORG-08** A position belongs to a department and carries a job grade; headcount limits, where
  configured, are **advisory** (warn via notification), not a hard post-time block, unless workforce
  budgeting sets them to `block` (see BR-WFP/BR-BUD).
- **BR-ORG-09** A cost center referenced by HR posting (payroll/expense) must be an **active leaf**
  compatible with the finance dimension model; deactivating a cost center with current-period HR
  postings → **`ConflictError`**.

## BR-EMP — Employee Master & History (CRITICAL)

- **BR-EMP-01** **Employee history is append-only.** No process may overwrite or delete a historical
  fact. `hr_employee_history` rows are **immutable** — no update path, no hard delete →
  attempt **`ConflictError`**.
- **BR-EMP-02** **Every material change appends an `hr_employee_history` row in the *same
  transaction* as the update.** Material fields are: `departmentId`, `positionId`, `jobGradeId`,
  `managerId`, `branchId`, `costCenterId`, `status`, `employmentType`, and `workLocation`. The row
  captures `effectiveDate`, `changeType`, old→new values, actor, and reason. A committed update to
  any material field **without** a matching history row is a rule violation caught in tests and code
  review; the writer (`employee-history.ts`) is the single chokepoint enforcing it.
- **BR-EMP-03** `(tenantId, employeeCode)` is UNIQUE → collision **`ConflictError`**. Employee code
  is issued atomically from `document_sequences` (HR prefix) or accepted from import, but never
  duplicated within a tenant.
- **BR-EMP-04** Non-material profile edits (contact, address, dependents, education, bank account,
  documents) update in place and do **not** append history, but versioned/expiring records
  (contracts, documents with expiry) keep their own row history and never overwrite superseded rows.
- **BR-EMP-05** **Contract changes are append-only supersession**, not edits: a new
  `hr_employee_contract` supersedes the prior active one (closing its `endDate`), and appends an
  `hr_employee_history` row (`changeType='contract'`). Exactly one contract may be active per
  employee at a time → overlap **`ConflictError`**.
- **BR-EMP-06** **Termination** sets `status='terminated'` (with `terminationDate`, reason, type),
  appends an `hr_employee_history` row, and closes dependent open records (active assets pending
  return flagged, ESS access revoked at the app layer). Termination never deletes the employee.
- **BR-EMP-07** **Soft delete only.** Employees (and all lifecycle aggregates) carry `deletedAt`;
  there is no hard delete from HR services. A soft-deleted employee is excluded from active reads,
  payroll selection, and org validation, but their history is retained.
- **BR-EMP-08** Status transitions (`draft → active → on_leave → suspended → terminated`, plus
  `active ↔ on_leave`) must exist as edges in the HR status-transition map; an illegal transition →
  **`ConflictError`**. Re-hire creates a new employment span, not a resurrection of the old row.
- **BR-EMP-09** Any scalar reference on an employee (`branchId`, `departmentId`, `positionId`,
  `jobGradeId`, `costCenterId`, `managerId`, `userId`) must resolve within the same tenant →
  mismatch **`ValidationError`**, absent **`NotFoundError`**.

## BR-ATS — Recruitment / Applicant Tracking

- **BR-ATS-01** A candidate advances through **ordered pipeline stages**
  (`applied → screening → interview → offer → hired | rejected | withdrawn`); skipping a stage or a
  backward jump not permitted by the stage map → **`ConflictError`**.
- **BR-ATS-02** **Interview feedback is required before advancing** past an interview stage: a stage
  transition out of `interview` with no recorded `hr_interview_feedback` for the scheduled
  interview(s) → **`ValidationError`**.
- **BR-ATS-03** A job opening carries approved headcount; the number of `hired` candidates against
  an opening may not exceed its headcount → **`ConflictError`** (opening auto-closes when filled).
- **BR-ATS-04** An **offer → acceptance → hiring creates an employee**: accepting an offer and
  marking the candidate `hired` runs employee creation in **one transaction** (copying candidate
  master data, issuing `employeeCode`, seeding the initial contract + first `hr_employee_history`
  row). Hiring the same accepted offer twice is blocked by idempotency on
  `(offerId)` → **`ConflictError`**.
- **BR-ATS-05** An offer is a numbered document (`HR_JOB_OFFER`) with lifecycle
  `draft → sent → accepted | rejected | expired`; only an `accepted` offer may trigger hiring, and
  offer approval (where configured) routes through the approval engine before `sent`.
- **BR-ATS-06** A candidate rejected or hired is **read-only** in the pipeline; further stage edits
  → **`ConflictError`**. Rejection reasons are captured for analytics.

## BR-ONB — Onboarding

- **BR-ONB-01** Hiring seeds an `hr_employee_onboarding` from the applicable **onboarding
  template**; tasks are generated with due dates relative to the join date.
- **BR-ONB-02** Onboarding completion is **advisory** and does not gate payroll, but a task flagged
  `blocksAccess` keeps ESS/system access provisioning pending until closed (app-layer gate, not a
  posting block).
- **BR-ONB-03** Onboarding tasks are per-employee and per-template-task unique; re-generating a
  template never duplicates an existing open task (idempotent seed).

## BR-TIME — Time & Attendance

- **BR-TIME-01** Raw punches land in `hr_attendance_logs` (append-only, source-tagged: device /
  biometric / manual / mobile). Logs are **never edited**; corrections are new logs with a
  correction flag. `hr_attendance_daily` is a **derived** roll-up computed from logs + the assigned
  shift.
- **BR-TIME-02** `hr_attendance_daily` is **unique per `(tenantId, employeeId, workDate)`** —
  DB partial unique index; a second daily row for the same day → **`ConflictError`**. Recalculation
  upserts the existing row, never inserts a duplicate.
- **BR-TIME-03** Daily calculation derives worked hours, late-in/early-out, absence, and raw
  overtime from the shift definition (fixed / **night** / **split** / **rotational**), handling
  **night shifts that cross midnight** (attributed to the shift's business date) and split-shift
  gaps. The rules live in a **pure calculator** (`attendance-calc.ts`) so they are fully unit-tested
  without a DB.
- **BR-TIME-04** **Overtime requires approval**: raw overtime computed by the calculator is *not*
  payable until an `hr_overtime_request` is approved (employee → manager). Only **approved** OT
  hours flow to payroll; unapproved OT is reported but pays zero → premature payout blocked at
  payroll calc.
- **BR-TIME-05** A locked attendance period (post-payroll cutoff) rejects new manual logs / daily
  recalculation for dates inside it → **`ConflictError`**; corrections after lock go through an
  adjustment with permission.
- **BR-TIME-06** Rotational/roster assignments resolve the effective shift **per date**; a day with
  no resolvable shift falls back to the employee's default shift or is flagged unscheduled (reported,
  not an error).

## BR-LEAVE — Leave Management

- **BR-LEAVE-01** A leave balance **never goes negative** unless the leave type's policy permits it
  (`allowNegative` / advance grant); an approval that would drive the balance below its floor →
  **`ValidationError`**.
- **BR-LEAVE-02** **Balance is deducted on approval, not on request.** Request days are computed by a
  **pure calculator** honoring weekends, public holidays (calendar), half-days, and the leave type's
  counting rule (working vs calendar days). Deduction and the request status change happen in **one
  transaction**.
- **BR-LEAVE-03** Workflow is **employee → manager → HR** via the approval engine
  (`applyApprovalToDocument` extended for `hr_leave_request`); a request may only reach `approved`
  through the configured chain, and posting a non-approved request to balance → **`ConflictError`**.
- **BR-LEAVE-04** **Cancellation / rejection after approval restores** the deducted balance in one
  transaction (append the compensating balance movement; balances are ledgered, not overwritten).
- **BR-LEAVE-05** Approved leave **affects attendance** (marks covered `hr_attendance_daily` days as
  on-leave, not absent) **and payroll** (paid/unpaid per leave type; unpaid leave reduces payable
  days). These effects are derived at calc time from approved leave, never double-counted.
- **BR-LEAVE-06** Leave accrual runs credit balances per policy (monthly/annual, pro-rated on join /
  termination); accrual is **idempotent per `(employee, leaveType, accrualPeriod)`** → re-running a
  period never double-credits.
- **BR-LEAVE-07** Overlapping approved leave for the same employee/date range is rejected →
  **`ConflictError`**.

## BR-PAY — Payroll

- **BR-PAY-01** **Payroll never stores duplicated salary source data.** A payroll line is
  **calculated** from contract (base + fixed components), attendance (payable/absent days),
  approved leave, **approved** overtime, benefits, active loans/advances, and commissions — read at
  run time. The run stores the *computed result and its inputs snapshot*, not an editable copy of the
  contract's salary.
- **BR-PAY-02** **Net pay = gross + earnings − deductions**, where
  gross is derived from contract + attendance/leave proration, earnings add approved OT / benefits /
  commissions / allowances, and deductions cover taxes, social insurance, loan installments,
  advances, and unpaid-leave clawback. The identity
  `net = gross + Σ earnings − Σ deductions` must hold per detail line → violation
  **`ValidationError`** (calc bug guard).
- **BR-PAY-03** Payroll run states move **`draft → calculated → approved → posted → paid`**. Each
  transition is guarded; an illegal jump (e.g. `draft → posted`, `paid → calculated`) →
  **`ConflictError`**.
- **BR-PAY-04** **`calculated` is fully re-runnable**: re-calculating a draft/calculated run
  discards and recomputes its detail rows from source (never accumulates). Once **`approved`**, the
  numbers are frozen; recalculation requires reverting to `draft` (permission-gated) which is blocked
  after posting.
- **BR-PAY-05** **Posted runs are immutable.** Any edit/delete of a posted run or its details →
  **`ConflictError`**. Correction is reverse-and-rerun (a reversing finance entry + a new run), never
  in-place mutation — mirroring finance BR-POST-04.
- **BR-PAY-06** **Posting is idempotent per source document**: posting a run calls finance
  `postJournalEntry` with `sourceDocType='hr_payroll_run'`, `sourceDocId=runId`; the finance partial
  unique idempotency index guarantees at-most-once, so a duplicate post is a logged no-op returning
  the existing journal entry, never a double debit.
- **BR-PAY-07** Posting requires an **`approved`** run and the `hr.payroll_post` permission; posting
  routes GL amounts (salary expense, statutory payables, net-pay payable, loan-recovery clearing)
  through the finance engine per the HR posting rules → unmet approval **`ConflictError`**, missing
  permission **`ForbiddenError`**.
- **BR-PAY-08** **Loan installments are recovered via payroll.** The run pulls each active loan's due
  installment as a deduction and, on posting, marks those `hr_loan_installments` recovered in the
  same transaction as the run posting; a loan's Σ recovered may never exceed its principal +
  interest → **`ValidationError`**.
- **BR-PAY-09** A payroll run selects only **active, non-soft-deleted** employees with an active
  contract for the run's `hr_payroll_period`; the same employee may not appear twice in one run →
  **`ConflictError`**. A period may host multiple runs (off-cycle) but each `(period, employee,
  runType)` is unique.
- **BR-PAY-10** `paid` records the disbursement (bank file / cash) and is terminal; it does not
  re-post to the GL (payment clearing is the finance cash/bank concern via the net-pay payable).

## BR-LOAN — Loans, Advances, Benefits, Commissions

- **BR-LOAN-01** A loan (`hr_loan`) is a numbered, approval-gated document; disbursement generates an
  **amortization schedule** (`hr_loan_installments`) whose Σ installments = principal + interest →
  otherwise **`ValidationError`**.
- **BR-LOAN-02** Installments are recovered through payroll (BR-PAY-08); manual early settlement
  posts the remaining balance and closes the loan. A fully recovered loan is `closed` and immutable →
  further recovery **`ConflictError`**.
- **BR-LOAN-03** A **salary advance** (`hr_salary_advance`) is a single-installment loan variant;
  it is recovered in the next run(s) and follows the same approval + idempotent-recovery rules.
- **BR-LOAN-04** Employee benefits/allowances (`hr_employee_benefit`) are effective-dated; a benefit
  contributes to payroll only for periods its effective range covers, and overlapping active
  instances of the same benefit type → **`ConflictError`**.
- **BR-LOAN-05** Commissions feed payroll as earnings for the period they are attributed to; a
  commission already consumed by a posted run cannot be re-attributed → **`ConflictError`**.

## BR-PERF — Performance

- **BR-PERF-01** A review cycle defines the period, template, and rating scale; reviews are created
  per employee within an active cycle and cannot be filed outside it → **`ValidationError`**.
- **BR-PERF-02** Review workflow `draft → self_review → manager_review → calibration → finalized`;
  a finalized review is **immutable** → edit **`ConflictError`**. Advancing requires the prior
  stage's required inputs (self-assessment before manager review) → **`ValidationError`**.
- **BR-PERF-03** Goals/KPIs (`hr_goal`) roll up to a weighted score; goal weights within a review
  must sum to 100% (± tolerance) → **`ValidationError`**.
- **BR-PERF-04** A finalized rating may feed compensation/succession but never rewrites payroll
  retroactively; any merit change flows as a new contract/benefit (append-only per BR-EMP-05).

## BR-LEARN — Learning & Development

- **BR-LEARN-01** A training course/session has capacity; enrollments beyond capacity →
  **`ConflictError`** (waitlist where configured).
- **BR-LEARN-02** Completion records are append-only and drive `hr_employee_certification` /
  `hr_employee_skill` updates; an expiring certification keeps its history and supersedes rather than
  overwrites.
- **BR-LEARN-03** Training cost, where reimbursable, flows as an expense claim (BR-EXP), never
  directly to the GL from the learning module.

## BR-CAR — Career, Succession & Development

- **BR-CAR-01** A career path / succession plan references active positions and employees in the same
  tenant; a "ready-now" successor must be an active employee → **`ValidationError`**.
- **BR-CAR-02** A promotion executed from a succession plan is an **employee assignment change**
  (department/position/grade) and therefore appends `hr_employee_history` per BR-EMP-02 — the plan
  never mutates the employee directly outside the history writer.

## BR-WFP — Workforce Planning

- **BR-WFP-01** A workforce plan sets target headcount per org unit/period; variance = actual
  (active employees) − planned, computed at read time, never stored denormalized.
- **BR-WFP-02** New-hire / requisition approval may consult the plan; when the plan's enforcement is
  `block`, exceeding planned headcount blocks the requisition → **`ValidationError`** (see BR-BUD-01
  for the none/warn/block contract this shares).

## BR-BUD — HR Budgeting (Headcount / Cost)

- **BR-BUD-01** HR budget control evaluates at the gated action (requisition / payroll approval) per
  policy: **`none`** (skip), **`warn`** (proceed + notify), **`block`** (**`ValidationError`**) —
  with a tolerance percentage over the budget line before warn/block trips.
- **BR-BUD-02** Budget vs actual compares budget lines against realized HR cost (posted payroll +
  approved commitments) for the same org-unit/period keys; variance is absolute and %.
- **BR-BUD-03** One active (approved) HR budget per fiscal period and scope; a revision supersedes
  the approved lines (history kept), never edits them in place.

## BR-ESS — Employee / Manager Self-Service

- **BR-ESS-01** ESS scopes strictly to the **requesting employee's own** records
  (`employee.userId = actor`); reading another employee's data through ESS →
  **`ForbiddenError`**. MSS (manager self-service) scopes to the actor's **direct/indirect reports**
  resolved via the reporting chain.
- **BR-ESS-02** ESS requests (`hr_employee_request`: leave, loan, advance, expense, data-change,
  document) enter the **same approval workflows** as their back-office equivalents — ESS is a
  submission surface, not a bypass of BR-LEAVE/BR-LOAN/BR-EXP rules.
- **BR-ESS-03** ESS/MSS still chains `getCurrentUserContext → requireTenantAccess →
  requirePermission`; the self-scope check is **in addition to**, not instead of, tenant + permission
  guards.

## BR-ASSET — Asset Assignment

- **BR-ASSET-01** An asset assignment (`hr_employee_asset`) **links an inventory item/product**; the
  assigned quantity is reserved/tracked through the existing inventory layer — HR does not
  double-maintain stock, it references it.
- **BR-ASSET-02** **Return closes the assignment**: setting `returnedDate` + condition closes the
  `hr_employee_asset` row and releases the inventory link in one transaction. An asset cannot be
  returned twice, and returning an unassigned asset → **`ConflictError`**.
- **BR-ASSET-03** Termination (BR-EMP-06) flags an employee's still-open asset assignments for return
  as part of offboarding (advisory, surfaced in the clearance checklist).

## BR-EXP — Travel & Expense

- **BR-EXP-01** Lifecycle is **claim → approval → reimbursement → finance posting**: an expense
  claim (`hr_expense_claim`) is submitted with lines + attachments, routed through the approval engine
  (`applyApprovalToDocument` extended for `hr_expense_claim`), and only an **approved** claim may be
  reimbursed → premature reimbursement **`ConflictError`**.
- **BR-EXP-02** Reimbursement posts to finance via `postJournalEntry`
  (`sourceDocType='hr_expense_claim'`), idempotent per claim id; posting is at-most-once and a
  duplicate post is a logged no-op.
- **BR-EXP-03** A travel request (`hr_travel_request`) is approval-gated and may pre-authorize a
  budget; the settling expense claim reconciles against the travel advance, and net reimbursement /
  recovery flows accordingly.
- **BR-EXP-04** Claim line amounts must be non-negative and Σ lines = claim total →
  **`ValidationError`**; a claim already posted is immutable → **`ConflictError`**.

## BR-SEC — Security & Tenant Scoping

- **BR-SEC-01** **Every** tenant-scoped HR server function chains
  `getCurrentUserContext({ accessToken, tenantId }) → requireTenantAccess(context, tenantId) →
  requirePermission(context, 'hr.<code>')` before any read/write. A missing guard is a cross-tenant
  data leak — this is the primary isolation boundary.
- **BR-SEC-02** Each of the **24 `hr.*` permission codes** gates its screens/actions
  (`hr.analytics_view`, `hr.org_view`, `hr.org_manage`, `hr.employee_view`, `hr.employee_manage`,
  `hr.recruitment_view`, `hr.recruitment_manage`, `hr.attendance_view`, `hr.attendance_manage`,
  `hr.leave_view`, `hr.leave_request`, `hr.leave_approve`, `hr.payroll_view`, `hr.payroll_run`,
  `hr.payroll_post`, `hr.loan_manage`, `hr.performance_view`, `hr.performance_manage`,
  `hr.training_manage`, `hr.expense_view`, `hr.expense_manage`, `hr.expense_approve`,
  `hr.settings_manage`). View vs manage vs approve/run/post are distinct grants; a read permission
  never implies a write.
- **BR-SEC-03** Sensitive actions require their dedicated permission beyond the module view grant:
  `hr.payroll_post` for posting, `hr.leave_approve` / `hr.expense_approve` for approvals,
  `hr.settings_manage` for policy/config. Unmet → **`ForbiddenError`**.
- **BR-SEC-04** All data access is **scoped by tenant**. **Finer-grained scoping**
  (branch / department / cost-center / manager-subtree row filtering) is a **documented future
  refinement**: the reporting chain and org path are already materialized to support it, but the
  current release enforces tenant + permission scoping only (ESS/MSS self-scope per BR-ESS is the
  one exception already enforced).
- **BR-SEC-05** PII (salary, bank, national id, documents) never leaks cross-tenant; DTOs strip
  fields the actor's permission set does not authorize, and server logs never contain another
  tenant's PII.

## BR-INT — Integrations & Cross-cutting

- **BR-INT-01** **Financial postings** are the finance engine's job: HR calls `postJournalEntry` with
  an HR `sourceDocType` (`hr_payroll_run`, `hr_expense_claim`) and never writes
  `fin_journal_entries` / `fin_journal_lines` / `fin_gl_balances` itself. Idempotency, period
  resolution, balancing, and audit are inherited from finance (BR-POST-01/03).
- **BR-INT-02** **Approval-engine reuse**: `applyApprovalToDocument()` **must be extended** to handle
  the new HR document types `hr_leave_request`, `hr_loan`, `hr_payroll_run`, and `hr_expense_claim`
  (plus `hr_overtime_request`, `hr_job_offer`, `hr_travel_request` where approval is configured).
  Until extended, those approvals cannot complete — this is a tracked Phase-4 prerequisite.
- **BR-INT-03** **Status transitions** for HR documents must exist as edges in the HR
  status-transition map (tenant row first, global fallback); a missing edge → **`ConflictError`**, an
  edge's `requires_permission` unmet → **`ForbiddenError`**.
- **BR-INT-04** **Document numbering** for all HR documents is issued atomically from
  `document_sequences` via the additive `DocumentType` values (13: `hr_employee`, `hr_job_opening`,
  `hr_candidate`, `hr_job_offer`, `hr_leave_request`, `hr_overtime_request`, `hr_timesheet`,
  `hr_payroll_run`, `hr_loan`, `hr_salary_advance`, `hr_performance_review`, `hr_travel_request`,
  `hr_expense_claim`) — gapless per sequence, unique per `(tenantId, documentNumber)` → collision
  **`ConflictError`**.
- **BR-INT-05** **Notifications** fire on approvals, rejections, payroll completion, document expiry
  (contract / document / certification), leave decisions, and posting exceptions — reusing the
  existing notification infrastructure; no bespoke HR delivery channel.
- **BR-INT-06** **Attachments** (employee documents, expense receipts, offer letters) reuse the
  shared attachment infrastructure; HR stores references, not blobs, and enforces the same
  tenant-scoped access.
- **BR-INT-07** **Every material HR mutation writes an audit log and, where applicable, a domain
  event** in the same transaction as the change (hiring, termination, contract change, payroll
  post, leave/expense approval). Decimal values serialize to strings in event payloads and DTOs.
- **BR-INT-08** **Asset assignment** integrates the inventory module (BR-ASSET); HR references
  inventory products/items rather than duplicating stock state.

## BR-STATE — Optimistic Locking & Immutability

- **BR-STATE-01** Mutable HR headers (employee, contract-in-draft, payroll run in draft/calculated,
  claim in draft) use optimistic locking (`versionNumber`); a stale update → **`ConflictError`**.
- **BR-STATE-02** Immutable/append-only tables — `hr_employee_history`, `hr_attendance_logs`, posted
  `hr_payroll_run` + details, posted `hr_expense_claim`, finalized reviews, recovered loan
  installments — have **no update path and no hard delete**; any mutation attempt →
  **`ConflictError`**.

---

## Error-handling map

| Rule violated | Example | DomainError |
|---|---|---|
| Missing/invalid session token | no `accessToken` or expired | `UnauthorizedError` |
| Actor lacks permission | no `hr.payroll_post`; approving without `hr.leave_approve`; ESS reading another employee; transition `requires_permission` unmet | `ForbiddenError` |
| Referenced entity not found in tenant | unknown `employeeId`, `departmentId`, `costCenterId`, `offerId`, `loanId` | `NotFoundError` |
| Input fails schema/business validation | history row missing on material change, negative leave balance, unbalanced net-pay identity, goal weights ≠ 100%, Σ installments ≠ principal+interest, missing interview feedback, foreign/inactive manager, org cycle, no resolvable shift-pay for approved OT | `ValidationError` |
| State/concurrency conflict | editing posted payroll/claim, illegal payroll/leave/offer transition, hiring an offer twice, duplicate employee in a run, returning an asset twice, deactivating an org node with children/assignments, mutating append-only history, stale `versionNumber`, duplicate `documentNumber` | `ConflictError` |
| Downstream dependency unavailable | numbering / finance posting / notification dispatch failure | `ServiceUnavailableError` |

**Notes:**

- DB partial unique indexes (`hr_attendance_daily` per employee/day, finance posting idempotency),
  CHECK constraints, and append-only tables are the last line of defense; the service validates first
  and raises the mapped `DomainError` so the UI never sees a raw Postgres error.
- `ConflictError` is the canonical mapping for both optimistic-lock failures and illegal state
  transitions — "the world changed / the move isn't allowed from here".
- **Append-only employee history (BR-EMP-01/02) is the load-bearing invariant of this module** — it is
  enforced through a single writer, covered by dedicated unit tests, and must be re-verified in code
  review for every path that touches a material employee field.
- Every error carries a stable machine `code` and a user-facing message (see `errors.ts`); server
  logs retain full context, and messages never leak cross-tenant PII.
</content>
</invoke>

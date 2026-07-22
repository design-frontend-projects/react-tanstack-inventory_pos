# State Diagrams — HR / HCM (Spec 007)

Lifecycle diagrams for every stateful `hr_` document. As in the 006 module, HR
uses the **lookup-table status regime**: free-string `status_code` /
`stage_code` / `employment_status` columns validated against the shared
`pod_document_statuses` registry with legal edges in `pod_status_transitions`
— **no new Prisma enums**. A `NULL`-tenant status row is the global default;
a tenant may extend a lifecycle without a code change, and a
`requires_permission` transition row gates an edge (e.g. only `hr.payroll_post`
may post a run, only `hr.leave_approve` may approve a leave request).

Append-only rows carry **no status** — `hr_employee_history`,
posted `hr_payroll_details` / `hr_payroll_component_details`, and
`hr_goal_progress` exist or they don't; corrections are new rows or reversals.
Every transition that touches the general ledger does so through the Spec 006
`postJournalEntry` engine — HR never writes `fin_journal_*` directly, and a
posted document is immutable (correction = reversal).

---

## Employee — `hr_employees.employment_status`

Initial: `probation` (or `active` for a direct/senior hire). Terminal:
`terminated`. `on_leave` and `suspended` are reversible operational states that
return to `active`. Every edge appends an effective-dated `hr_employee_history`
row (BR-EMP-02) in the same transaction. A terminated employee flagged
`is_rehire_eligible` can be brought back through the **rehire** edge, which
starts a fresh employment spell (new contract, new history row).

```mermaid
stateDiagram-v2
    [*] --> probation: hire (probationary)
    [*] --> active: hire (direct / senior — no probation)
    probation --> active: confirm (probation_end / confirmation_date)
    probation --> terminated: fail probation
    active --> on_leave: long leave / secondment starts
    on_leave --> active: return from leave
    active --> suspended: disciplinary hold
    suspended --> active: reinstate
    suspended --> terminated: dismissal upheld
    active --> terminated: resignation / termination
    on_leave --> terminated: termination while on leave
    terminated --> probation: rehire (is_rehire_eligible — new spell)
    terminated --> [*]
    note right of terminated: every edge appends hr_employee_history (append-only)
```

---

## Candidate — `hr_candidates.stage_code`

Initial: `applied`. Terminal: `hired`, `rejected`, `withdrawn`. The stage
ladder advances one step at a time (`screening → interview → offer`); a
candidate may be `rejected` from any active stage, or self-`withdrawn`.
`hired` is only reachable once an offer is accepted
(`hr_offer_acceptance.decision = accepted`) and triggers `HrEmployee` creation.

```mermaid
stateDiagram-v2
    [*] --> applied
    applied --> screening: shortlist (hr.recruitment_manage)
    screening --> interview: advance to interview
    interview --> offer: offer extended (hr_job_offers)
    offer --> hired: offer accepted → create HrEmployee
    applied --> rejected
    screening --> rejected
    interview --> rejected
    offer --> rejected: offer declined / lapsed
    applied --> withdrawn
    screening --> withdrawn
    interview --> withdrawn
    offer --> withdrawn
    hired --> [*]
    rejected --> [*]
    withdrawn --> [*]
```

---

## Job Opening — `hr_job_openings.status_code`

Initial: `draft`. Terminal: `closed`, `cancelled`. A requisition opens only
after its `approval_request_id` resolves approved. `on_hold` freezes sourcing
without losing the pipeline; `filled` is reached when vacancies are met, then
`closed` archives it. Cancellation is available before it is filled.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> open: publish (requisition approved)
    draft --> cancelled: discard draft
    open --> on_hold: freeze sourcing
    on_hold --> open: resume
    open --> filled: all vacancies filled (hires complete)
    open --> cancelled: requisition withdrawn
    on_hold --> cancelled
    filled --> closed: archive requisition
    open --> closed: close without fill (expired)
    closed --> [*]
    cancelled --> [*]
```

---

## Leave Request — `hr_leave_requests.status_code`

Initial: `draft`. Terminal: `approved`, `rejected`, `cancelled`. Submission
raises an `openApprovalRequest`; the request climbs a two-step ladder
(`manager_approved → hr_approved`) recorded in `hr_leave_approvals`, and only
the final `approved` transition **debits `hr_leave_balances`** — in the same
transaction as the last `actOnApproval` (FR-LEA). Rejection at any step, or
employee cancellation before final approval, releases the pending days.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted: submit (hr.leave_request) → openApprovalRequest, pending_days held
    submitted --> manager_approved: manager actOnApproval (hr.leave_approve)
    manager_approved --> hr_approved: HR actOnApproval (hr.leave_approve)
    hr_approved --> approved: finalize → deduct hr_leave_balances (same tx)
    submitted --> rejected: rejected at manager step
    manager_approved --> rejected: rejected at HR step
    submitted --> cancelled: employee cancels
    manager_approved --> cancelled
    draft --> cancelled: discard draft
    approved --> cancelled: post-approval cancellation (restore balance)
    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
    note right of approved: balance debited only here — never on submit
```

---

## Payroll Run — `hr_payroll_runs.status_code`

Initial: `draft`. Terminal: `paid`. `calculated` writes
`hr_payroll_details` + `hr_payroll_component_details`; recompute is allowed only
while `draft`/`calculated`. `approved` locks the figures (via
`openApprovalRequest` on `hr_payroll_run`). `posted` calls `postJournalEntry`
(`sourceDocType='hr_payroll_run'`, idempotent per run id) and is **immutable** —
no edit, no re-post; corrections happen through a reversal + off-cycle run.
`paid` marks disbursement of the net amounts.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> calculated: compute hr_payroll_details + component details
    calculated --> draft: recompute (discard figures)
    calculated --> approved: approval resolves (hr.payroll_run)
    approved --> calculated: rejected — returned for edit
    approved --> posted: postJournalEntry (hr.payroll_post, idempotent per run)
    posted --> paid: disburse net pay (bank / payroll route)
    paid --> [*]
    note right of posted: immutable — corrections via reversal + off-cycle run
```

---

## Loan — `hr_loans.status_code`

Initial: `draft`. Terminal: `settled`, `cancelled`. Approval routes through
`openApprovalRequest` (`hr_loan`). `active` is reached on **disbursement**,
which posts through `postJournalEntry` (Dr loan receivable, Cr net-pay/bank);
installments then recover against successive payroll runs
(`hr_loan_installments.payroll_run_id`) until the outstanding amount hits zero
→ `settled`. A loan may be `cancelled` before disbursement.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> approved: approval resolves (hr.loan_manage)
    draft --> cancelled: discard / withdrawn
    approved --> cancelled: rejected before disbursement
    approved --> active: disburse — postJournalEntry (Dr receivable)
    active --> settled: outstanding_amount reaches zero (installments recovered)
    settled --> [*]
    cancelled --> [*]
```

---

## Salary Advance — `hr_salary_advances.status_code`

Initial: `draft`. Terminal: `recovered`. Approval via `openApprovalRequest`;
payout posts through `postJournalEntry`. `recovering` deducts a slice each
payroll run over `recovery_months` until `recovered_amount = amount` →
`recovered`.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> approved: approval resolves (hr.loan_manage)
    approved --> recovering: payout — postJournalEntry, recovery schedule begins
    recovering --> recovered: recovered_amount reaches full amount
    recovered --> [*]
```

---

## Expense Claim — `hr_expense_claims.status_code`

Initial: `draft`. Terminal: `posted`, `rejected`. Submission routes through
`openApprovalRequest` (`hr_expense_claim`). `approved` sets `approved_amount`;
`reimbursed` disburses (direct payment or via a payroll run); `posted` records
the accounting through `postJournalEntry` (Dr expense by line category, Cr
net-pay or AP liability). Rejection is terminal from the submitted state.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted: submit (hr.expense_manage) → openApprovalRequest
    submitted --> approved: actOnApproval (hr.expense_approve) → approved_amount set
    submitted --> rejected: rejected
    approved --> reimbursed: pay (direct or payroll route)
    reimbursed --> posted: postJournalEntry (Dr expense, Cr net-pay / AP)
    posted --> [*]
    rejected --> [*]
```

---

## Performance Review — `hr_performance_reviews.status_code`

Initial: `draft`. Terminal: `finalized` (with an optional `acknowledged`
follow-up by the employee). The cycle moves through `self_review` (employee),
`manager_review` (reviewer scores `hr_review_scores`), `calibrated`
(cross-team normalization), then `finalized` — which may append an
`hr_employee_history` row if the outcome drives a grade/salary action.
`acknowledged` records the employee sign-off on the finalized result.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> self_review: open cycle → employee self-assessment
    self_review --> manager_review: manager scores hr_review_scores (hr.performance_manage)
    manager_review --> calibrated: calibration / normalization
    calibrated --> finalized: publish overall_score + rating_label
    manager_review --> self_review: returned for revision
    finalized --> acknowledged: employee acknowledges
    acknowledged --> [*]
    finalized --> [*]
```

---

## Onboarding Task — `hr_employee_onboarding.status_code`

Per-task instance materialized from an `hr_onboarding_templates` /
`hr_onboarding_tasks` checklist. Initial: `pending`. Terminal: `completed`,
`skipped`. `skipped` is only permitted for non-mandatory tasks
(`hr_onboarding_tasks.is_mandatory = false`); mandatory tasks must reach
`completed`.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> in_progress: assignee starts (assigned_to_id)
    in_progress --> completed: task done (completed_at set)
    pending --> completed: single-step task
    pending --> skipped: skip (non-mandatory only)
    in_progress --> skipped: skip (non-mandatory only)
    completed --> [*]
    skipped --> [*]
```

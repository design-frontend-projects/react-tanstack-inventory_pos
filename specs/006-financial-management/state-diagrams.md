# State Diagrams — Financial Management (Spec 006)

Lifecycle diagrams for every fin_ document. All fin documents use the
**lookup-table status regime**: `statusCode` strings backed by
`PodDocumentStatus` (per `entity_type`) with legal edges in
`PodStatusTransition` — no new Prisma enums. Each diagram below mirrors exactly
the rows seeded in the fin migration
(`20260718110000_financial_management_enterprise_v1`).

A `NULL`-tenant status row is the global default; tenants may extend a lifecycle
without a code change. `requires_permission` on a transition row gates an edge
(e.g. only `finance.journal_post` may post). Immutable ledger rows
(`fin_journal_lines`, `fin_customer/vendor_ledger_entries`,
`fin_tax_transactions`, `fin_gl_balances`) carry **no status** — they exist or
they don't; corrections are reversals.

---

## Journal Entry — `entity_type = 'journal_entry'`

Initial: `draft`. Terminal: `reversed`, `cancelled`. `posted` is immutable —
the only outgoing edge is reversal (which creates a mirror entry, itself born
`posted`). Async-sourced entries are created directly in `posted` by the
posting engine (no draft stage).

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> posted: post (finance.journal_post)
    draft --> cancelled: discard draft
    posted --> reversed: reverse (finance.journal_reverse)
    note right of posted: immutable — lines can never be edited
    reversed --> [*]
    cancelled --> [*]
```

---

## Fiscal Period — `entity_type = 'fiscal_period'`

Initial: `future`. Terminal: `locked`. `closed → open` is the controlled reopen
path (`finance.fiscal_manage`); `locked` is the hard close with **no** reopen
edge. Module-level soft close rides alongside in `fin_period_module_locks` and
is independent of the header status.

```mermaid
stateDiagram-v2
    [*] --> future
    future --> open: open period (finance.fiscal_manage)
    open --> closed: close (all checklist tasks done)
    closed --> open: reopen (finance.fiscal_manage, audit-logged)
    closed --> locked: lock (hard close)
    locked --> [*]
```

---

## AR Receipt — `entity_type = 'ar_receipt'`

Initial: `draft`. Terminal: `voided`. Posting writes the JE + customer ledger
entry + applications in one tx; `voided` reverses all three (reversal JE,
applications unwound, open items restored).

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> posted: post (finance.ar_receipt_post)
    draft --> voided: discard draft
    posted --> voided: void (reversal JE + unapply)
    voided --> [*]
```

---

## Payment Run — `entity_type = 'payment_run'`

Initial: `draft`. Terminal: `executed`, `cancelled`. Approval is routed through
`pod_approval_*` (`entity_type = payment_run`); the run holds at `proposed`
until the request resolves. Execution generates `PodSupplierPayment` documents,
which then follow their own Spec-005 lifecycle.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> proposed: propose lines (finance.payment_run_manage)
    draft --> cancelled
    proposed --> approved: approval request resolves approved
    proposed --> cancelled: rejected / withdrawn
    approved --> executed: execute — generate supplier payments
    approved --> cancelled
    executed --> [*]
    cancelled --> [*]
```

---

## Cheque — `entity_type = 'cheque'`

Covers both directions (`chequeDirection` issued | received), including
post-dated cheques (PDC): a received PDC sits at `received` until its due date,
then is deposited. Terminal: `cleared`, `replaced`, `cancelled`. Each transition
posts its JE (deposit → cheque-in-transit, clear → bank, bounce → reverse +
bounce fee).

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> issued: issue outgoing cheque
    draft --> received: register incoming cheque
    draft --> cancelled
    received --> deposited: deposit to bank (due date reached for PDC)
    issued --> presented: presented by payee
    deposited --> presented: sent for clearing
    presented --> cleared: bank confirms (reconciliation)
    presented --> bounced: returned unpaid
    bounced --> replaced: replacement cheque received
    bounced --> cancelled: written back
    cleared --> [*]
    replaced --> [*]
    cancelled --> [*]
```

---

## Fixed Asset — `entity_type = 'asset'`

Initial: `draft` (register entry, possibly capitalized from a supplier invoice
via `sourceDoc`). Terminal: `disposed`, `written_off`. `fully_depreciated`
assets remain on the register (NBV = residual) until disposal.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> active: capitalize (finance.asset_manage)
    draft --> [*]: discard
    active --> fully_depreciated: schedule exhausted (depreciation runs)
    active --> disposed: dispose — sale or scrap
    active --> written_off: impairment write-off
    fully_depreciated --> disposed
    fully_depreciated --> written_off
    disposed --> [*]
    written_off --> [*]
```

---

## Budget — `entity_type = 'budget'`

Initial: `draft`. Terminal: `closed`. Approval via `pod_approval_*`
(`entity_type = budget`). Only one `active` budget per fiscal year + budget type;
revisions clone into a new `draft` linked via `fin_budget_revisions`.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted: submit (finance.budget_manage)
    submitted --> approved: approval resolves
    submitted --> draft: returned for edit
    approved --> active: activate for control checks
    active --> closed: fiscal year closed / superseded by revision
    closed --> [*]
```

---

## Tax Return — `entity_type = 'tax_return'`

Initial: `draft` (lines aggregated from `fin_tax_transactions` by reporting
box). Terminal: `paid` unless amended; `amended` spawns a fresh `draft` return
linked to the original.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> filed: file with authority (finance.tax_manage)
    filed --> paid: settle liability (payment JE)
    filed --> amended: amendment required
    paid --> amended: post-payment correction
    amended --> [*]: superseding return takes over
    paid --> [*]
```

---

## Bank Reconciliation — `entity_type = 'bank_reconciliation'`

Initial: `draft`. Terminal: `completed`. Completion requires difference = 0
(adjustment JEs for fees/interest may be posted from within the draft).
A completed reconciliation is immutable; corrections happen in the next one.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> completed: difference zero (finance.bank_manage)
    draft --> [*]: discarded — matches released
    completed --> [*]
```

---

## Posting Queue Row — `entity_type = 'posting_queue'`

Initial: `pending`. Terminal: `posted`, `skipped`, and `failed` once
`attemptCount` reaches 5 (visible in the exceptions screen; a manual retry
resets it to `pending`). `skipped` = idempotency hit (`DUPLICATE_SOURCE`) or
event type configured off in `fin_settings.postingModes`.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> processing: drained by queue processor
    processing --> posted: JE committed (journalEntryId set)
    processing --> failed: error captured (attemptCount incremented)
    processing --> skipped: duplicate source / posting disabled
    failed --> pending: retry with backoff while attemptCount below 5
    failed --> pending: manual retry from exceptions screen
    posted --> [*]
    skipped --> [*]
    failed --> [*]: attempts exhausted — notify + exceptions screen
```

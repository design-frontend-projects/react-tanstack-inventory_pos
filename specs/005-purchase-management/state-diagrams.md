# State Diagrams — Purchase Management (Spec 005)

Lifecycle diagrams for every procurement document. Two status regimes coexist:

- **Spec-002 spine documents** (`purchase_requisitions`, `purchase_orders`,
  `goods_receipts`, `purchase_returns`) keep their **native Postgres enums** and
  the code-defined guard in `src/server/inventory/state-machine.ts`
  (`assertTransition(machine, from, to)`).
- **New `pod_` documents** (RFQ, supplier quotation, supplier invoice, supplier
  payment, landed-cost voucher, approval request) use **lookup-table statuses**:
  `pod_document_statuses` (per `entity_type`) enumerates the states and
  `pod_status_transitions` enumerates the legal `from_code → to_code` edges. Each
  diagram below mirrors exactly the rows seeded in the migration
  (`20260717090000_purchase_management_enterprise_v1`).

A `pod_` status is customizable per tenant: a `NULL`-tenant row is the global
default; a tenant may insert its own `entity_type`-scoped rows to extend a
lifecycle without a code change. `requires_permission` on a transition row lets
admins gate an edge (e.g. only `purchase.quotation_award` may award).

---

## RFQ — `entity_type = 'rfq'` (lookup-table)

Initial: `open`. Terminal: `expired`, `cancelled`. `awarded` has no outgoing
edge (effectively final; the RFQ is closed once a quotation is awarded).

```mermaid
stateDiagram-v2
    [*] --> open
    open --> awarded: award (purchase.quotation_award)
    open --> expired: expiry_date passed
    open --> cancelled: cancel (purchase.rfq_manage)
    awarded --> [*]
    expired --> [*]
    cancelled --> [*]
```

Per-supplier participation (`pod_rfq_suppliers.status_code`) tracks the invite
fan-out independently of the RFQ header: `invited → responded` (declined is
modelled by leaving `responded_at` null and closing the RFQ).

```mermaid
stateDiagram-v2
    [*] --> invited
    invited --> responded: quotation received
    invited --> [*]: RFQ closed without response
    responded --> [*]
```

---

## Supplier Quotation — `entity_type = 'supplier_quotation'` (lookup-table)

Initial: `draft`. Terminal: `rejected`, `expired`, `cancelled`. `awarded` is the
success sink (a PO is raised from it; `purchase_orders.quotation_id` back-links).

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> submitted: submit (purchase.quotation_manage)
    draft --> cancelled: cancel
    submitted --> under_review: begin review
    submitted --> expired: valid_until passed
    under_review --> approved: approve
    under_review --> rejected: reject
    approved --> awarded: award (purchase.quotation_award)
    rejected --> [*]
    expired --> [*]
    cancelled --> [*]
    awarded --> [*]
```

---

## Purchase Order — enum lifecycle (`state-machine.ts` key `purchaseOrder`)

Native enum. Server functions call `assertTransition('purchaseOrder', from, to)`
before persisting. `partially_received` is re-entrant (multiple partial GRNs).
Terminal: `closed`, `cancelled`, `rejected`.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending_approval: submit for approval
    draft --> approved: direct approve
    draft --> cancelled
    pending_approval --> approved: approve (purchase.po_approve)
    pending_approval --> rejected: reject
    pending_approval --> cancelled
    approved --> confirmed: confirm / send to supplier
    approved --> cancelled
    confirmed --> partially_received: partial GRN (purchase.po_receive)
    confirmed --> received: full GRN
    confirmed --> cancelled
    partially_received --> partially_received: further partial GRN
    partially_received --> received: final GRN
    partially_received --> closed
    received --> closed
    closed --> [*]
    cancelled --> [*]
    rejected --> [*]
```

Approval routing is externalized: when the amount exceeds an
`pod_approval_workflows` threshold the PO holds at `pending_approval` and a
`pod_approval_requests` row drives the multi-step decision (see the Approval
Request diagram). `purchase_orders.approval_request_id` links the two.

---

## Goods Receipt — enum lifecycle (`state-machine.ts` key `goodsReceipt`)

Native enum. Inventory is posted by `movement-engine.ts` on the transition into a
stock-affecting state (`received`/`completed`) — never by a DB trigger. Terminal:
`completed`, `rejected`. `goods_receipts.inspection_status_code` (nullable text)
carries the QC outcome parallel to the header status.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> received: receive lines (purchase.po_receive)
    draft --> completed: receive + auto-complete
    draft --> rejected
    received --> quality_check: route to QC
    received --> put_away: no QC required
    received --> completed
    quality_check --> put_away: QC pass
    quality_check --> rejected: QC fail
    put_away --> completed
    completed --> [*]
    rejected --> [*]
```

---

## Supplier Invoice — `entity_type = 'supplier_invoice'` (lookup-table)

Header `status_code` is the workflow state; **two orthogonal sub-statuses** ride
alongside it and are recomputed by DB functions, not by the header transition:

- `match_status_code` ∈ `unmatched | partially_matched | matched | variance` —
  set by `pod_three_way_match(invoice_id)` from `pod_supplier_invoice_matches`.
- `payment_status_code` ∈ `unpaid | partially_paid | paid` — advanced as
  `pod_supplier_payment_allocations` are applied and `paid_amount`/
  `outstanding_amount` recomputed.

Header lifecycle — Initial: `draft`. Terminal: `cancelled`. `posted` is the AP
sink (subledger balance recognized; `pod_recompute_supplier_balance` fires on
posted invoices).

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending_approval: submit
    draft --> cancelled
    pending_approval --> approved: approve (purchase.invoice_manage)
    pending_approval --> draft: return for edit
    approved --> posted: post to AP (purchase.invoice_manage)
    approved --> disputed: raise dispute
    disputed --> approved: resolve dispute
    posted --> [*]
    cancelled --> [*]
```

Match sub-status (independent of header state, driven by `pod_three_way_match`):

```mermaid
stateDiagram-v2
    [*] --> unmatched
    unmatched --> partially_matched: some lines matched
    unmatched --> matched: fully matched within tolerance
    partially_matched --> matched: remaining lines matched
    partially_matched --> variance: price/qty variance > 0.01
    matched --> variance: variance detected on re-match
    variance --> matched: variance resolved / re-matched
```

Payment sub-status (independent of header state, driven by payment allocations):

```mermaid
stateDiagram-v2
    [*] --> unpaid
    unpaid --> partially_paid: allocation < outstanding
    unpaid --> paid: full allocation
    partially_paid --> paid: remaining allocated
```

---

## Supplier Payment — `entity_type = 'supplier_payment'` (lookup-table)

Initial: `draft`. Terminal: `cancelled`. `posted` reduces supplier balance via
`pod_recompute_supplier_balance` and moves `unallocated_amount` (advances) onto
the subledger.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending_approval: submit
    draft --> cancelled
    pending_approval --> approved: approve (purchase.payment_manage)
    approved --> posted: post (purchase.payment_manage)
    posted --> [*]
    cancelled --> [*]
```

---

## Landed-Cost Voucher — `entity_type = 'landed_cost'` (lookup-table)

Initial: `draft`. Terminal: `cancelled`. `allocated` runs
`pod_allocate_landed_cost(voucher_id)` (distributes `total_charges` across
`pod_landed_cost_allocations` by basis); `posted` applies the per-line landed
cost to inventory average cost at the **service layer** (`movement-engine.ts` /
costing), never a trigger.

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> allocated: allocate charges (pod_allocate_landed_cost)
    draft --> cancelled
    allocated --> posted: post to inventory cost (purchase.landed_cost_manage)
    posted --> [*]
    cancelled --> [*]
```

---

## Approval Request — `entity_type = 'approval_request'` (lookup-table)

Generic engine reused by any gated entity (`entity_type` + `entity_id`). Initial:
`pending`. Terminal: `approved`, `rejected`, `cancelled`. `escalated` is a
non-terminal holding state entered when a step's `escalate_after_hours` elapses.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> approved: final step approved
    pending --> rejected: any step rejected
    pending --> escalated: SLA breach (escalate_after_hours)
    pending --> cancelled: source doc withdrawn
    escalated --> approved: escalated approver approves
    escalated --> rejected: escalated approver rejects
    approved --> [*]
    rejected --> [*]
    cancelled --> [*]
```

Multi-step advance (within `pending`) is tracked by
`pod_approval_requests.current_step_order` against `pod_approval_workflow_steps`;
each decision writes a `pod_approval_actions` row (`action_code` ∈
`approve | reject | delegate | escalate | comment`). When the final step
(`is_final = true`) approves, the request resolves and the source document's own
transition fires (PO → `approved`, invoice → `approved`, …).

# Sequence Diagrams — Purchase Management (Spec 005)

End-to-end flows through the canonical layering:

```
Client → server function (guard chain) → service ($transaction) → repos + engines → outbox + audit
```

**Guard chain** (every tenant-scoped server function, per
`src/features/purchasing/server-functions.ts` `resolveContext`):

```
getCurrentUserContext({ accessToken, tenantId })
  → requireAuth(context)
  → requireTenantAccess(context, tenantId)
  → requirePermission(context, '<purchase.*>')
```

**Canonical service `$transaction` shape** (all mutating services follow it):

```
nextDocumentNumber(tx)                         # document-number-service.ts
  → assertTransition(...) / pod_status_transitions check   # state guard
  → repo write (header + lines)                # src/server/repos/*
  → postMovement(tx, ...)                       # movement-engine.ts (only where stock moves)
  → appendDomainEvent(tx, ...)                  # event-outbox.ts (atomic outbox)
  → createAuditLog(tx, ...)                      # audit-log-repo.ts
```

Everything runs inside one Prisma `$transaction`; the outbox row and audit row
commit atomically with the business write. Money/quantity values in event
payloads are serialized to strings.

---

## (a) Requisition → RFQ → Quotation → Award → PO

```mermaid
sequenceDiagram
    autonumber
    actor U as Buyer (client)
    participant SF as Server Fn (guard chain)
    participant RQ as Requisition Svc
    participant RF as RFQ Svc
    participant QT as Quotation Svc
    participant PO as PO Svc
    participant DB as Prisma $transaction
    participant OUT as Outbox + Audit

    U->>SF: createRequisition(input)
    SF->>SF: requirePermission('purchase.requisition_manage')
    SF->>RQ: createRequisition(ctx, tenantId, input)
    RQ->>DB: nextDocumentNumber(PURCHASE_REQUISITION) + insert PR
    RQ->>OUT: createAuditLog(purchase_requisition.created)
    RQ-->>U: requisition DTO

    U->>SF: createRfq({ requisitionId, supplierIds })
    SF->>SF: requirePermission('purchase.rfq_manage')
    SF->>RF: createRfq(ctx, tenantId, input)
    RF->>DB: nextDocumentNumber(rfq) + insert pod_rfqs + pod_rfq_items + pod_rfq_suppliers
    RF->>OUT: appendDomainEvent('rfq.issued') + createAuditLog
    RF-->>U: rfq DTO (status open)

    U->>SF: submitQuotation({ rfqId, supplierId, lines })
    SF->>SF: requirePermission('purchase.quotation_manage')
    SF->>QT: submitQuotation(ctx, tenantId, input)
    QT->>DB: nextDocumentNumber(supplier_quotation) + insert header + items
    Note over DB: pod_recompute_quotation_totals trigger sets subtotal/tax/grand_total
    QT->>DB: update pod_rfq_suppliers.status_code = responded
    QT->>OUT: appendDomainEvent('supplier_quotation.submitted') + audit
    QT-->>U: quotation DTO (status submitted)

    U->>SF: awardQuotation({ rfqId, quotationId })
    SF->>SF: requirePermission('purchase.quotation_award')
    SF->>QT: awardQuotation(ctx, tenantId, input)
    QT->>DB: assert transition approved→awarded (pod_status_transitions)
    QT->>DB: set quotation.awarded, rfq.status_code=awarded, awarded_quotation_id
    QT->>OUT: appendDomainEvent('rfq.awarded')
    QT->>PO: createPurchaseOrderFromQuotation(tx, quotation)
    PO->>DB: nextDocumentNumber(PURCHASE_ORDER) + insert PO (quotation_id set)
    PO->>OUT: createAuditLog(purchase_order.created)
    QT-->>U: { rfq: awarded, purchaseOrder }
```

---

## (b) PO → Goods Receipt → inventory movement posting

Stock is posted **only** by `movement-engine.postMovement`, inside the GRN
posting transaction. `MovementType = PURCHASE_RECEIPT` (direction `IN`); a
`PURCHASE_RETURN` posts `OUT`. WAC/FIFO costing and lot/serial enforcement happen
inside the engine.

```mermaid
sequenceDiagram
    autonumber
    actor U as Receiver (client)
    participant SF as Server Fn (guard chain)
    participant GR as GoodsReceipt Svc
    participant SM as state-machine.ts
    participant ME as movement-engine.ts
    participant DB as Prisma $transaction
    participant OUT as Outbox + Audit

    U->>SF: postGoodsReceipt({ id })
    SF->>SF: requirePermission('purchase.po_receive')
    SF->>GR: postGoodsReceipt(ctx, tenantId, id)
    GR->>DB: load GRN + lines + PO lines (FOR UPDATE)
    GR->>SM: assertTransition('goodsReceipt', draft, received)
    loop each received line
        GR->>ME: postMovement(tx, PURCHASE_RECEIPT, IN, qty, unitCost, lot/serial)
        ME->>DB: lock StockBalance, applyMovement (WAC), insert InventoryMovement
        ME->>DB: update StockBalance (onHand, avgUnitCost, totalValue), open cost layer
        ME-->>GR: { movementId, avgUnitCost, onHand }
    end
    GR->>DB: update GRN.status, PO lines received_qty (+ remaining_qty regenerated)
    Note over DB: PO header rolls to partially_received / received per remaining_qty
    GR->>OUT: appendDomainEvent(goods_receipt.posted) + createAuditLog
    GR-->>U: goods receipt DTO (posted)
```

---

## (c) Supplier Invoice — 3-way match (PO ↔ GRN ↔ Invoice)

`pod_three_way_match(invoice_id)` recomputes `match_status_code` from the
`pod_supplier_invoice_matches` rows (variance tolerance 0.01). Posting recognizes
the payable and recomputes the supplier balance.

```mermaid
sequenceDiagram
    autonumber
    actor U as AP Clerk (client)
    participant SF as Server Fn (guard chain)
    participant IV as Invoice Svc
    participant DB as Prisma $transaction
    participant FN as pod_three_way_match()
    participant BAL as pod_recompute_supplier_balance()
    participant OUT as Outbox + Audit

    U->>SF: createSupplierInvoice({ supplierId, poId, lines })
    SF->>SF: requirePermission('purchase.invoice_manage')
    SF->>IV: createInvoice(ctx, tenantId, input)
    IV->>DB: nextDocumentNumber(supplier_invoice) + insert header + items
    Note over DB: pod_recompute_invoice_totals trigger sets subtotal/tax/grand_total/outstanding
    IV-->>U: invoice DTO (draft, match=unmatched)

    U->>SF: matchInvoice({ id, matchRows })
    SF->>SF: requirePermission('purchase.invoice_match')
    SF->>IV: matchInvoice(ctx, tenantId, id, rows)
    loop each match row (invoice line ↔ PO line ↔ GRN line)
        IV->>DB: insert pod_supplier_invoice_matches (matched_qty, matched_amount, price_variance, qty_variance)
    end
    IV->>FN: SELECT pod_three_way_match(id)
    FN->>DB: set match_status_code = matched | partially_matched | variance | unmatched
    IV->>OUT: appendDomainEvent('supplier_invoice.matched')
    IV-->>U: invoice DTO (match status)

    U->>SF: postSupplierInvoice({ id })
    SF->>SF: requirePermission('purchase.invoice_manage')
    SF->>IV: postInvoice(ctx, tenantId, id)
    IV->>DB: assert approved→posted (pod_status_transitions), set is_posted, posted_at
    IV->>BAL: SELECT pod_recompute_supplier_balance(tenantId, supplierId)
    BAL->>DB: suppliers.current_balance = Σ posted outstanding − Σ unallocated advances
    IV->>OUT: appendDomainEvent('supplier_invoice.posted') + createAuditLog
    IV-->>U: invoice DTO (posted)
```

---

## (d) Landed-Cost Voucher → allocation → inventory cost update

Allocation math is a DB function; the **inventory average-cost update stays in the
service layer** (calls `movement-engine` / costing) so posting is never
double-applied by a trigger.

```mermaid
sequenceDiagram
    autonumber
    actor U as Cost Accountant (client)
    participant SF as Server Fn (guard chain)
    participant LC as LandedCost Svc
    participant DB as Prisma $transaction
    participant AL as pod_allocate_landed_cost()
    participant ME as movement-engine.ts / costing
    participant OUT as Outbox + Audit

    U->>SF: createLandedCostVoucher({ grnId, charges })
    SF->>SF: requirePermission('purchase.landed_cost_manage')
    SF->>LC: createVoucher(ctx, tenantId, input)
    LC->>DB: nextDocumentNumber(landed_cost) + insert voucher + charges + allocation rows (basis_value)
    Note over DB: pod_recompute_voucher_charges trigger sets total_charges
    LC-->>U: voucher DTO (draft)

    U->>SF: allocateVoucher({ id })
    SF->>LC: allocateVoucher(ctx, tenantId, id)
    LC->>AL: SELECT pod_allocate_landed_cost(id)
    AL->>DB: allocated_amount = round(total_charges * basis_value / Σ basis, 4) per row
    LC->>DB: set status_code = allocated
    LC-->>U: voucher DTO (allocated, per-line amounts)

    U->>SF: postVoucher({ id })
    SF->>LC: postVoucher(ctx, tenantId, id)
    LC->>DB: assert allocated→posted
    loop each allocation row
        LC->>ME: apply landed amount to product average cost (cost-only revaluation movement)
        ME->>DB: update StockBalance.avgUnitCost / totalValue, cost layer
    end
    LC->>DB: set is_posted, posted_at
    LC->>OUT: appendDomainEvent('landed_cost.posted') + createAuditLog
    LC-->>U: voucher DTO (posted)
```

---

## (e) Supplier Payment → allocation → supplier balance recompute

```mermaid
sequenceDiagram
    autonumber
    actor U as AP Clerk (client)
    participant SF as Server Fn (guard chain)
    participant PY as Payment Svc
    participant DB as Prisma $transaction
    participant BAL as pod_recompute_supplier_balance()
    participant OUT as Outbox + Audit

    U->>SF: createSupplierPayment({ supplierId, amount, allocations })
    SF->>SF: requirePermission('purchase.payment_manage')
    SF->>PY: createPayment(ctx, tenantId, input)
    PY->>DB: nextDocumentNumber(supplier_payment) + insert pod_supplier_payments
    loop each allocation (→ invoice or financial_note)
        PY->>DB: insert pod_supplier_payment_allocations (allocated_amount)
        PY->>DB: bump invoice.paid_amount, recompute outstanding_amount + payment_status_code
    end
    PY->>DB: set allocated_amount, unallocated_amount (= amount − Σ allocated; advance if > 0)
    PY-->>U: payment DTO (draft)

    U->>SF: postSupplierPayment({ id })
    SF->>SF: requirePermission('purchase.payment_manage')
    SF->>PY: postPayment(ctx, tenantId, id)
    PY->>DB: assert approved→posted, set is_posted, posted_at
    PY->>BAL: SELECT pod_recompute_supplier_balance(tenantId, supplierId)
    BAL->>DB: suppliers.current_balance recomputed
    PY->>OUT: appendDomainEvent('supplier_payment.posted') + createAuditLog
    PY-->>U: payment DTO (posted)
```

---

## (f) Approval routing with escalation

Amount-threshold workflow (`pod_approval_workflows` + `_steps`). The source
document (PO/invoice/payment) holds at its `pending_approval` state until the
final step resolves; each decision writes a `pod_approval_actions` row and emits
`purchase_approval.decided`.

```mermaid
sequenceDiagram
    autonumber
    actor R as Requester (client)
    actor A1 as Approver L1
    actor A2 as Approver L2
    participant SF as Server Fn (guard chain)
    participant AP as Approval Svc
    participant DB as Prisma $transaction
    participant SCH as Scheduler (SLA)
    participant OUT as Outbox + Audit

    R->>SF: submitForApproval(entityType, entityId, amount)
    SF->>AP: openRequest(ctx, tenantId, input)
    AP->>DB: pick pod_approval_workflows by entity_type + amount band
    AP->>DB: insert pod_approval_requests (status=pending, current_step_order=1)
    AP->>DB: link source doc.approval_request_id
    AP-->>R: request DTO (pending, step 1)

    A1->>SF: actOnApproval({ requestId, action: approve })
    SF->>SF: requirePermission('purchase.approval_action')
    SF->>AP: act(ctx, tenantId, requestId, approve)
    AP->>DB: insert pod_approval_actions (step 1, approve)
    AP->>DB: advance current_step_order = 2 (step 1 not is_final)
    AP->>OUT: appendDomainEvent('purchase_approval.decided', status=pending)

    Note over SCH,DB: step 2 escalate_after_hours elapses with no action
    SCH->>AP: escalate(requestId)
    AP->>DB: assert pending→escalated, insert action (escalate)
    AP->>OUT: appendDomainEvent('purchase_approval.decided', status=escalated)

    A2->>SF: actOnApproval({ requestId, action: approve })
    SF->>AP: act(ctx, tenantId, requestId, approve)
    AP->>DB: insert action (step 2, approve); step2.is_final = true
    AP->>DB: set request.status=approved, completed_at
    AP->>DB: transition source doc pending_approval → approved
    AP->>OUT: appendDomainEvent('purchase_approval.decided', status=approved) + audit
    AP-->>A2: request DTO (approved)
```

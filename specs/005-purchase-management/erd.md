# Entity Relationship Diagrams — Purchase Management (Spec 005)

Mermaid ERDs grouped by logical cluster. Only **intra-module composition** (header → line) and the
**tenant** relationship are drawn as crow's-foot lines, because they are the only real DB foreign
keys. Every other reference — to the Spec-002 spine (`suppliers`, `purchase_orders`,
`goods_receipts`, `financial_notes`, `purchase_returns`, `purchase_requisitions`) and to inventory
core (`products`, `tenant_accounts`, lookups) — is a **bare scalar UUID** with app-enforced
integrity, drawn as a dashed/annotated `FK` link, matching the inventory/CRM convention.

Every `pod_*` table also carries `tenant_id → tenant_accounts` (real FK, cascade); it is shown once
in the overview and omitted elsewhere for readability.

## Tenant scope (applies to every table)

```mermaid
erDiagram
  tenant_accounts ||--o{ pod_rfqs : owns
  tenant_accounts ||--o{ pod_supplier_quotations : owns
  tenant_accounts ||--o{ pod_supplier_invoices : owns
  tenant_accounts ||--o{ pod_supplier_payments : owns
  tenant_accounts ||--o{ pod_landed_cost_vouchers : owns
  tenant_accounts ||--o{ pod_approval_requests : owns
  tenant_accounts ||--o{ pod_document_statuses : "owns (nullable=global)"
  tenant_accounts ||--o{ pod_supplier_categories : owns
```

## Supplier CRM

```mermaid
erDiagram
  suppliers ||..o{ pod_supplier_contacts : "FK supplier_id"
  suppliers ||..o{ pod_supplier_addresses : "FK supplier_id"
  suppliers ||..o{ pod_supplier_bank_accounts : "FK supplier_id"
  pod_supplier_categories ||..o{ suppliers : "FK category_id"
  pod_supplier_categories ||..o{ pod_supplier_categories : "FK parent_id"
```

## RFQ / Quotation

```mermaid
erDiagram
  pod_rfqs ||--o{ pod_rfq_items : contains
  pod_rfqs ||--o{ pod_rfq_suppliers : invites
  pod_supplier_quotations ||--o{ pod_supplier_quotation_items : contains
  pod_rfqs ||..o{ pod_supplier_quotations : "FK rfq_id"
  pod_rfqs ||..o| purchase_requisitions : "FK requisition_id"
  suppliers ||..o{ pod_rfq_suppliers : "FK supplier_id"
  suppliers ||..o{ pod_supplier_quotations : "FK supplier_id"
  pod_supplier_quotations ||..o| purchase_orders : "FK quotation_id (award->PO)"
  products ||..o{ pod_rfq_items : "FK product_id"
  products ||..o{ pod_supplier_quotation_items : "FK product_id"
```

## Approval engine (generic)

```mermaid
erDiagram
  pod_approval_workflows ||--o{ pod_approval_workflow_steps : defines
  pod_approval_requests ||--o{ pod_approval_actions : history
  pod_approval_workflows ||..o{ pod_approval_requests : "FK workflow_id"
  pod_approval_requests }o..o| purchase_orders : "FK entity (polymorphic)"
  pod_approval_requests }o..o| pod_supplier_invoices : "FK entity (polymorphic)"
  pod_approval_requests }o..o| pod_supplier_payments : "FK entity (polymorphic)"
```

## Invoicing / AP + 3-way match

```mermaid
erDiagram
  pod_supplier_invoices ||--o{ pod_supplier_invoice_items : contains
  pod_supplier_invoices ||--o{ pod_supplier_invoice_matches : matches
  suppliers ||..o{ pod_supplier_invoices : "FK supplier_id"
  purchase_orders ||..o{ pod_supplier_invoices : "FK purchase_order_id"
  purchase_order_lines ||..o{ pod_supplier_invoice_matches : "FK po_line_id"
  goods_receipts ||..o{ pod_supplier_invoice_matches : "FK grn_line_id"
  pod_supplier_invoice_items ||..o| pod_supplier_invoice_matches : "FK invoice_item_id"
  financial_notes ||--o{ pod_debit_note_lines : "debit-note lines"
  purchase_returns ||..o{ pod_debit_note_lines : "FK purchase_return_id"
```

## Landed cost

```mermaid
erDiagram
  pod_landed_cost_vouchers ||--o{ pod_landed_cost_charges : charges
  pod_landed_cost_vouchers ||--o{ pod_landed_cost_allocations : allocates
  goods_receipts ||..o{ pod_landed_cost_vouchers : "FK goods_receipt_id"
  purchase_orders ||..o{ pod_landed_cost_vouchers : "FK purchase_order_id"
  pod_supplier_invoices ||..o{ pod_landed_cost_vouchers : "FK supplier_invoice_id"
  pod_landed_cost_types ||..o{ pod_landed_cost_charges : "FK cost_type_id"
  purchase_order_lines ||..o{ pod_landed_cost_allocations : "FK po_line_id"
```

## Payments (AP)

```mermaid
erDiagram
  pod_supplier_payments ||--o{ pod_supplier_payment_allocations : allocates
  suppliers ||..o{ pod_supplier_payments : "FK supplier_id"
  pod_payment_methods ||..o{ pod_supplier_payments : "FK payment_method_id"
  pod_supplier_bank_accounts ||..o{ pod_supplier_payments : "FK bank_account_id"
  pod_supplier_invoices ||..o{ pod_supplier_payment_allocations : "FK supplier_invoice_id"
  financial_notes ||..o{ pod_supplier_payment_allocations : "FK financial_note_id"
```

## Cross-cutting (status lookups, attachments, custom fields)

```mermaid
erDiagram
  pod_document_statuses ||..o{ pod_status_transitions : "codes per entity_type"
  pod_custom_field_definitions ||--o{ pod_custom_field_values : values
  pod_attachments }o..o| pod_rfqs : "polymorphic entity"
  pod_attachments }o..o| pod_supplier_invoices : "polymorphic entity"
  pod_custom_field_values }o..o| pod_supplier_quotations : "polymorphic entity"
```

## Reporting projections (views / matviews)

```mermaid
erDiagram
  purchase_orders ||..o{ pod_v_open_purchase_orders : "view"
  pod_supplier_invoices ||..o{ pod_v_outstanding_payables : "view (aging)"
  suppliers ||..o{ pod_v_supplier_balances : "view"
  pod_supplier_invoices ||..o{ pod_v_three_way_match_variance : "view"
  purchase_orders ||..o{ pod_mv_supplier_performance : "matview"
  purchase_orders ||..o{ pod_mv_spend_analysis : "matview"
  pod_supplier_invoice_items ||..o{ pod_mv_purchase_price_variance : "matview"
```

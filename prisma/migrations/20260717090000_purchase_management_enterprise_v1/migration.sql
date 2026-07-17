-- ============================================================================
-- Purchase Management — Spec 005 (enterprise procurement layer)
--
-- Extends the existing Spec-002 purchasing spine (suppliers, purchase_*,
-- goods_receipts, financial_notes) with pod_* enterprise tables: supplier CRM,
-- RFQ, quotations, generic approval engine, supplier invoices + 3-way match,
-- landed cost, supplier payments, attachments, custom fields, and
-- admin-customizable status/lookup tables. Also adds cross-cutting DB objects:
-- generated columns, functions, triggers, reporting views + materialized views,
-- and Row Level Security (defense-in-depth).
--
-- Ordering: (0) enum additions, (1) non-breaking ALTERs on the spine,
-- (2) pod_* CREATE TABLE + constraints, (3) indexes, (4) foreign keys,
-- (5) functions, (6) triggers, (7) views + matviews, (8) RLS, (9) seed data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (0) Document numbering enum additions (additive only)
-- ---------------------------------------------------------------------------
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'rfq';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'supplier_quotation';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'supplier_invoice';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'supplier_payment';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'landed_cost';

-- ---------------------------------------------------------------------------
-- (1) Non-breaking extensions to the existing spine (all nullable / defaulted)
-- ---------------------------------------------------------------------------
ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "category_id" UUID,
  ADD COLUMN IF NOT EXISTS "status_code" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS "lead_time_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_preferred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tags" JSONB,
  ADD COLUMN IF NOT EXISTS "company_id" UUID,
  ADD COLUMN IF NOT EXISTS "branch_id" UUID,
  ADD COLUMN IF NOT EXISTS "version_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "created_by" UUID,
  ADD COLUMN IF NOT EXISTS "updated_by" UUID,
  ADD COLUMN IF NOT EXISTS "deleted_by" UUID;

ALTER TABLE "purchase_requisitions"
  ADD COLUMN IF NOT EXISTS "priority" TEXT,
  ADD COLUMN IF NOT EXISTS "required_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "source_type" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_id" UUID,
  ADD COLUMN IF NOT EXISTS "company_id" UUID,
  ADD COLUMN IF NOT EXISTS "approval_request_id" UUID;

ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "branch_id" UUID,
  ADD COLUMN IF NOT EXISTS "company_id" UUID,
  ADD COLUMN IF NOT EXISTS "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "incoterms" TEXT,
  ADD COLUMN IF NOT EXISTS "delivery_address_json" JSONB,
  ADD COLUMN IF NOT EXISTS "billing_address_json" JSONB,
  ADD COLUMN IF NOT EXISTS "buyer_profile_id" UUID,
  ADD COLUMN IF NOT EXISTS "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "approval_request_id" UUID,
  ADD COLUMN IF NOT EXISTS "quotation_id" UUID,
  ADD COLUMN IF NOT EXISTS "version_number" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "purchase_order_lines"
  ADD COLUMN IF NOT EXISTS "rejected_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "returned_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancelled_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_pct" DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gross_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- remaining_qty as a STORED generated column (read-only; app never writes it)
ALTER TABLE "purchase_order_lines"
  ADD COLUMN IF NOT EXISTS "remaining_qty" DECIMAL(18,4)
  GENERATED ALWAYS AS ("ordered_qty" - "received_qty" - "rejected_qty" - "returned_qty" - "cancelled_qty") STORED;

ALTER TABLE "goods_receipts"
  ADD COLUMN IF NOT EXISTS "inspection_status_code" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_id" UUID;

-- ---------------------------------------------------------------------------
-- (2) pod_* tables
-- ---------------------------------------------------------------------------

-- Status & classification lookup tables ------------------------------------
CREATE TABLE "pod_document_statuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "entity_type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_document_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_status_transitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "entity_type" TEXT NOT NULL,
    "from_code" TEXT NOT NULL,
    "to_code" TEXT NOT NULL,
    "requires_permission" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_status_transitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_supplier_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_return_reasons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requires_inspection" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_return_reasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_payment_methods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_landed_cost_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "default_allocation_basis" TEXT NOT NULL DEFAULT 'value',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_landed_cost_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_incoterms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_incoterms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_debit_note_reasons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_debit_note_reasons_pkey" PRIMARY KEY ("id")
);

-- Supplier CRM satellites ---------------------------------------------------
CREATE TABLE "pod_supplier_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_supplier_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "address_type" TEXT NOT NULL DEFAULT 'billing',
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_supplier_bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- RFQ -----------------------------------------------------------------------
CREATE TABLE "pod_rfqs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "document_number" TEXT NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT,
    "requisition_id" UUID,
    "warehouse_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "awarded_supplier_id" UUID,
    "awarded_quotation_id" UUID,
    "buyer_profile_id" UUID,
    "notes" TEXT,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_rfqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_rfq_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "required_date" TIMESTAMP(3),
    "specification" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_rfq_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pod_rfq_items_quantity_check" CHECK ("quantity" >= 0)
);

CREATE TABLE "pod_rfq_suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rfq_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'invited',
    "invited_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_rfq_suppliers_pkey" PRIMARY KEY ("id")
);

-- Supplier quotations -------------------------------------------------------
CREATE TABLE "pod_supplier_quotations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "document_number" TEXT NOT NULL,
    "rfq_id" UUID,
    "supplier_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "quotation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER,
    "payment_terms" TEXT,
    "freight_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "insurance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "approved_by_profile_id" UUID,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_supplier_quotation_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,6) NOT NULL,
    "discount_pct" DECIMAL(9,6),
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_rate_id" UUID,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(19,4) NOT NULL,
    "lead_time_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_supplier_quotation_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pod_supplier_quotation_items_quantity_check" CHECK ("quantity" >= 0)
);

-- Generic approval engine ---------------------------------------------------
CREATE TABLE "pod_approval_workflows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "min_amount" DECIMAL(19,4),
    "max_amount" DECIMAL(19,4),
    "currency_code" TEXT,
    "auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_approval_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_approval_workflow_steps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_role_code" TEXT,
    "approver_profile_id" UUID,
    "min_amount" DECIMAL(19,4),
    "condition" JSONB,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "allow_delegate" BOOLEAN NOT NULL DEFAULT true,
    "escalate_after_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_approval_workflow_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_approval_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "workflow_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "current_step_order" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4),
    "currency_code" TEXT,
    "requested_by_profile_id" UUID,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "correlation_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_approval_actions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "action_code" TEXT NOT NULL,
    "actor_profile_id" UUID,
    "delegated_to_profile_id" UUID,
    "comment" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_approval_actions_pkey" PRIMARY KEY ("id")
);

-- Supplier invoices (AP) + 3-way match --------------------------------------
CREATE TABLE "pod_supplier_invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "document_number" TEXT NOT NULL,
    "supplier_invoice_number" TEXT,
    "supplier_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "match_status_code" TEXT NOT NULL DEFAULT 'unmatched',
    "payment_status_code" TEXT NOT NULL DEFAULT 'unpaid',
    "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "retention_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "withholding_tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "freight_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "approval_request_id" UUID,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pod_supplier_invoices_grand_total_check" CHECK ("grand_total" >= 0),
    CONSTRAINT "pod_supplier_invoices_paid_amount_check" CHECK ("paid_amount" >= 0)
);

CREATE TABLE "pod_supplier_invoice_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "description" TEXT,
    "purchase_order_line_id" UUID,
    "goods_receipt_line_id" UUID,
    "uom_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(19,6) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_rate_id" UUID,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_supplier_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_supplier_invoice_matches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "invoice_item_id" UUID,
    "purchase_order_line_id" UUID,
    "goods_receipt_line_id" UUID,
    "matched_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "matched_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "price_variance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "qty_variance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_supplier_invoice_matches_pkey" PRIMARY KEY ("id")
);

-- Debit note line items (attach to existing financial_notes header) ---------
CREATE TABLE "pod_debit_note_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "financial_note_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "reason_id" UUID,
    "product_id" UUID,
    "description" TEXT,
    "quantity" DECIMAL(18,4),
    "unit_cost" DECIMAL(19,6),
    "amount" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "purchase_return_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_debit_note_lines_pkey" PRIMARY KEY ("id")
);

-- Landed cost ---------------------------------------------------------------
CREATE TABLE "pod_landed_cost_vouchers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "document_number" TEXT NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "goods_receipt_id" UUID,
    "purchase_order_id" UUID,
    "supplier_invoice_id" UUID,
    "allocation_basis" TEXT NOT NULL DEFAULT 'value',
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "total_charges" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_landed_cost_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_landed_cost_charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "cost_type_id" UUID,
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "supplier_id" UUID,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_landed_cost_charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_landed_cost_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "goods_receipt_line_id" UUID,
    "purchase_order_line_id" UUID,
    "product_id" UUID,
    "basis_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "allocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_landed_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- Supplier payments (AP) ----------------------------------------------------
CREATE TABLE "pod_supplier_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "branch_id" UUID,
    "document_number" TEXT NOT NULL,
    "supplier_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "payment_method_id" UUID,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4) NOT NULL,
    "allocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "unallocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reference_number" TEXT,
    "bank_account_id" UUID,
    "is_advance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_supplier_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pod_supplier_payments_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "pod_supplier_payment_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "supplier_invoice_id" UUID,
    "financial_note_id" UUID,
    "allocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- Cross-cutting: attachments & custom fields --------------------------------
CREATE TABLE "pod_attachments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "category" TEXT,
    "uploaded_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_custom_field_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options_json" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pod_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pod_custom_field_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pod_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- (3) Indexes & unique constraints
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "pod_document_statuses_scope_unique" ON "pod_document_statuses"("tenant_id", "entity_type", "code");
CREATE INDEX "pod_document_statuses_tenant_entity_idx" ON "pod_document_statuses"("tenant_id", "entity_type");
CREATE UNIQUE INDEX "pod_status_transitions_scope_unique" ON "pod_status_transitions"("tenant_id", "entity_type", "from_code", "to_code");
CREATE INDEX "pod_status_transitions_tenant_entity_idx" ON "pod_status_transitions"("tenant_id", "entity_type");
CREATE UNIQUE INDEX "pod_supplier_categories_tenant_code_unique" ON "pod_supplier_categories"("tenant_id", "code");
CREATE INDEX "pod_supplier_categories_tenant_active_idx" ON "pod_supplier_categories"("tenant_id", "is_active");
CREATE UNIQUE INDEX "pod_return_reasons_tenant_code_unique" ON "pod_return_reasons"("tenant_id", "code");
CREATE UNIQUE INDEX "pod_payment_methods_tenant_code_unique" ON "pod_payment_methods"("tenant_id", "code");
CREATE UNIQUE INDEX "pod_landed_cost_types_tenant_code_unique" ON "pod_landed_cost_types"("tenant_id", "code");
CREATE UNIQUE INDEX "pod_incoterms_tenant_code_unique" ON "pod_incoterms"("tenant_id", "code");
CREATE UNIQUE INDEX "pod_debit_note_reasons_tenant_code_unique" ON "pod_debit_note_reasons"("tenant_id", "code");
CREATE INDEX "pod_supplier_contacts_tenant_supplier_idx" ON "pod_supplier_contacts"("tenant_id", "supplier_id");
CREATE INDEX "pod_supplier_addresses_tenant_supplier_idx" ON "pod_supplier_addresses"("tenant_id", "supplier_id");
CREATE INDEX "pod_supplier_bank_accounts_tenant_supplier_idx" ON "pod_supplier_bank_accounts"("tenant_id", "supplier_id");
CREATE UNIQUE INDEX "pod_rfqs_tenant_number_unique" ON "pod_rfqs"("tenant_id", "document_number");
CREATE INDEX "pod_rfqs_tenant_status_idx" ON "pod_rfqs"("tenant_id", "status_code");
CREATE INDEX "pod_rfq_items_rfq_idx" ON "pod_rfq_items"("tenant_id", "rfq_id");
CREATE UNIQUE INDEX "pod_rfq_suppliers_grain_unique" ON "pod_rfq_suppliers"("tenant_id", "rfq_id", "supplier_id");
CREATE INDEX "pod_rfq_suppliers_tenant_supplier_idx" ON "pod_rfq_suppliers"("tenant_id", "supplier_id");
CREATE UNIQUE INDEX "pod_supplier_quotations_tenant_number_unique" ON "pod_supplier_quotations"("tenant_id", "document_number");
CREATE INDEX "pod_supplier_quotations_tenant_status_idx" ON "pod_supplier_quotations"("tenant_id", "status_code");
CREATE INDEX "pod_supplier_quotations_tenant_supplier_idx" ON "pod_supplier_quotations"("tenant_id", "supplier_id");
CREATE INDEX "pod_supplier_quotations_tenant_rfq_idx" ON "pod_supplier_quotations"("tenant_id", "rfq_id");
CREATE INDEX "pod_supplier_quotation_items_quotation_idx" ON "pod_supplier_quotation_items"("tenant_id", "quotation_id");
CREATE UNIQUE INDEX "pod_approval_workflows_tenant_code_unique" ON "pod_approval_workflows"("tenant_id", "code");
CREATE INDEX "pod_approval_workflows_tenant_entity_idx" ON "pod_approval_workflows"("tenant_id", "entity_type", "is_active");
CREATE UNIQUE INDEX "pod_approval_workflow_steps_grain_unique" ON "pod_approval_workflow_steps"("tenant_id", "workflow_id", "step_order");
CREATE INDEX "pod_approval_workflow_steps_workflow_idx" ON "pod_approval_workflow_steps"("tenant_id", "workflow_id");
CREATE INDEX "pod_approval_requests_entity_idx" ON "pod_approval_requests"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "pod_approval_requests_tenant_status_idx" ON "pod_approval_requests"("tenant_id", "status_code");
CREATE INDEX "pod_approval_actions_request_idx" ON "pod_approval_actions"("tenant_id", "request_id");
CREATE UNIQUE INDEX "pod_supplier_invoices_tenant_number_unique" ON "pod_supplier_invoices"("tenant_id", "document_number");
CREATE INDEX "pod_supplier_invoices_tenant_supplier_idx" ON "pod_supplier_invoices"("tenant_id", "supplier_id");
CREATE INDEX "pod_supplier_invoices_tenant_status_idx" ON "pod_supplier_invoices"("tenant_id", "status_code");
CREATE INDEX "pod_supplier_invoices_payment_due_idx" ON "pod_supplier_invoices"("tenant_id", "payment_status_code", "due_date");
CREATE INDEX "pod_supplier_invoice_items_invoice_idx" ON "pod_supplier_invoice_items"("tenant_id", "invoice_id");
CREATE INDEX "pod_supplier_invoice_matches_invoice_idx" ON "pod_supplier_invoice_matches"("tenant_id", "invoice_id");
CREATE INDEX "pod_debit_note_lines_note_idx" ON "pod_debit_note_lines"("tenant_id", "financial_note_id");
CREATE UNIQUE INDEX "pod_landed_cost_vouchers_tenant_number_unique" ON "pod_landed_cost_vouchers"("tenant_id", "document_number");
CREATE INDEX "pod_landed_cost_vouchers_tenant_status_idx" ON "pod_landed_cost_vouchers"("tenant_id", "status_code");
CREATE INDEX "pod_landed_cost_vouchers_grn_idx" ON "pod_landed_cost_vouchers"("tenant_id", "goods_receipt_id");
CREATE INDEX "pod_landed_cost_charges_voucher_idx" ON "pod_landed_cost_charges"("tenant_id", "voucher_id");
CREATE INDEX "pod_landed_cost_allocations_voucher_idx" ON "pod_landed_cost_allocations"("tenant_id", "voucher_id");
CREATE UNIQUE INDEX "pod_supplier_payments_tenant_number_unique" ON "pod_supplier_payments"("tenant_id", "document_number");
CREATE INDEX "pod_supplier_payments_tenant_supplier_idx" ON "pod_supplier_payments"("tenant_id", "supplier_id");
CREATE INDEX "pod_supplier_payments_tenant_status_idx" ON "pod_supplier_payments"("tenant_id", "status_code");
CREATE INDEX "pod_supplier_payment_allocations_payment_idx" ON "pod_supplier_payment_allocations"("tenant_id", "payment_id");
CREATE INDEX "pod_supplier_payment_allocations_invoice_idx" ON "pod_supplier_payment_allocations"("tenant_id", "supplier_invoice_id");
CREATE INDEX "pod_attachments_entity_idx" ON "pod_attachments"("tenant_id", "entity_type", "entity_id");
CREATE UNIQUE INDEX "pod_custom_field_definitions_scope_unique" ON "pod_custom_field_definitions"("tenant_id", "entity_type", "field_key");
CREATE UNIQUE INDEX "pod_custom_field_values_grain_unique" ON "pod_custom_field_values"("tenant_id", "definition_id", "entity_id");
CREATE INDEX "pod_custom_field_values_entity_idx" ON "pod_custom_field_values"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "suppliers_tenant_category_idx" ON "suppliers"("tenant_id", "category_id");

-- ---------------------------------------------------------------------------
-- (4) Foreign keys (tenant scope + header->line composition only, matching the
--     app-enforced-integrity convention used elsewhere in this schema)
-- ---------------------------------------------------------------------------
ALTER TABLE "pod_document_statuses" ADD CONSTRAINT "pod_document_statuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_status_transitions" ADD CONSTRAINT "pod_status_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_categories" ADD CONSTRAINT "pod_supplier_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_return_reasons" ADD CONSTRAINT "pod_return_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_payment_methods" ADD CONSTRAINT "pod_payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_types" ADD CONSTRAINT "pod_landed_cost_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_incoterms" ADD CONSTRAINT "pod_incoterms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_debit_note_reasons" ADD CONSTRAINT "pod_debit_note_reasons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_contacts" ADD CONSTRAINT "pod_supplier_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_addresses" ADD CONSTRAINT "pod_supplier_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_bank_accounts" ADD CONSTRAINT "pod_supplier_bank_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_rfqs" ADD CONSTRAINT "pod_rfqs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_rfq_items" ADD CONSTRAINT "pod_rfq_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_rfq_items" ADD CONSTRAINT "pod_rfq_items_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "pod_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_rfq_suppliers" ADD CONSTRAINT "pod_rfq_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_rfq_suppliers" ADD CONSTRAINT "pod_rfq_suppliers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "pod_rfqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_quotations" ADD CONSTRAINT "pod_supplier_quotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_quotation_items" ADD CONSTRAINT "pod_supplier_quotation_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_quotation_items" ADD CONSTRAINT "pod_supplier_quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "pod_supplier_quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_workflows" ADD CONSTRAINT "pod_approval_workflows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_workflow_steps" ADD CONSTRAINT "pod_approval_workflow_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_workflow_steps" ADD CONSTRAINT "pod_approval_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "pod_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_requests" ADD CONSTRAINT "pod_approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_actions" ADD CONSTRAINT "pod_approval_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_approval_actions" ADD CONSTRAINT "pod_approval_actions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "pod_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_invoices" ADD CONSTRAINT "pod_supplier_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_invoice_items" ADD CONSTRAINT "pod_supplier_invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_invoice_items" ADD CONSTRAINT "pod_supplier_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "pod_supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_invoice_matches" ADD CONSTRAINT "pod_supplier_invoice_matches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_invoice_matches" ADD CONSTRAINT "pod_supplier_invoice_matches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "pod_supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_debit_note_lines" ADD CONSTRAINT "pod_debit_note_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_vouchers" ADD CONSTRAINT "pod_landed_cost_vouchers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_charges" ADD CONSTRAINT "pod_landed_cost_charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_charges" ADD CONSTRAINT "pod_landed_cost_charges_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "pod_landed_cost_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_allocations" ADD CONSTRAINT "pod_landed_cost_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_landed_cost_allocations" ADD CONSTRAINT "pod_landed_cost_allocations_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "pod_landed_cost_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_payments" ADD CONSTRAINT "pod_supplier_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_payment_allocations" ADD CONSTRAINT "pod_supplier_payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_supplier_payment_allocations" ADD CONSTRAINT "pod_supplier_payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "pod_supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_attachments" ADD CONSTRAINT "pod_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_custom_field_definitions" ADD CONSTRAINT "pod_custom_field_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_custom_field_values" ADD CONSTRAINT "pod_custom_field_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pod_custom_field_values" ADD CONSTRAINT "pod_custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "pod_custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- (5) Functions
--
-- NOTE: inventory posting and costing remain in the application service layer
-- (movement-engine.ts). These DB functions cover cross-cutting concerns only:
-- timestamps, optimistic-lock versioning, activity capture, denormalized total
-- recomputation, landed-cost allocation math, and 3-way-match status.
-- ---------------------------------------------------------------------------

-- Session tenant context helper for RLS (call when connecting as a non-owner role)
CREATE OR REPLACE FUNCTION pod_set_tenant_context(p_tenant_id UUID)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.current_tenant_id', p_tenant_id::text, false);
$$;

-- BEFORE UPDATE: touch updated_at
CREATE OR REPLACE FUNCTION pod_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- BEFORE UPDATE: optimistic-lock version bump + touch updated_at
CREATE OR REPLACE FUNCTION pod_bump_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version_number := COALESCE(OLD.version_number, 0) + 1;
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- AFTER INSERT/UPDATE/DELETE: append an activity row into audit_logs
CREATE OR REPLACE FUNCTION pod_capture_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_tenant UUID;
  v_entity UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_tenant := OLD.tenant_id; v_entity := OLD.id; v_old := to_jsonb(OLD); v_new := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_tenant := NEW.tenant_id; v_entity := NEW.id; v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  ELSE
    v_tenant := NEW.tenant_id; v_entity := NEW.id; v_old := NULL; v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO "audit_logs" ("id", "tenant_id", "action_key", "entity_type", "entity_id", "old_values", "new_values", "created_at")
  VALUES (gen_random_uuid(), v_tenant, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, v_entity, v_old, v_new, CURRENT_TIMESTAMP);

  RETURN NULL;
END;
$$;

-- Recompute supplier-invoice header totals from its items
CREATE OR REPLACE FUNCTION pod_recompute_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_invoice UUID := COALESCE(NEW.invoice_id, OLD.invoice_id);
BEGIN
  UPDATE "pod_supplier_invoices" inv
  SET "subtotal" = agg.subtotal,
      "tax_total" = agg.tax_total,
      "discount_total" = agg.discount_total,
      "grand_total" = agg.subtotal + agg.tax_total + inv."freight_amount" - agg.discount_total - inv."retention_amount" - inv."withholding_tax_amount",
      "outstanding_amount" = (agg.subtotal + agg.tax_total + inv."freight_amount" - agg.discount_total - inv."retention_amount" - inv."withholding_tax_amount") - inv."paid_amount"
  FROM (
    SELECT COALESCE(SUM("net_amount"), 0) AS subtotal,
           COALESCE(SUM("tax_amount"), 0) AS tax_total,
           COALESCE(SUM("discount_amount"), 0) AS discount_total
    FROM "pod_supplier_invoice_items" WHERE "invoice_id" = v_invoice
  ) agg
  WHERE inv."id" = v_invoice;
  RETURN NULL;
END;
$$;

-- Recompute quotation header totals from its items
CREATE OR REPLACE FUNCTION pod_recompute_quotation_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_q UUID := COALESCE(NEW.quotation_id, OLD.quotation_id);
BEGIN
  UPDATE "pod_supplier_quotations" q
  SET "subtotal" = agg.subtotal,
      "tax_total" = agg.tax_total,
      "discount_total" = agg.discount_total,
      "grand_total" = agg.subtotal + agg.tax_total + q."freight_amount" + q."insurance_amount" - agg.discount_total
  FROM (
    SELECT COALESCE(SUM("net_amount"), 0) AS subtotal,
           COALESCE(SUM("tax_amount"), 0) AS tax_total,
           COALESCE(SUM("discount_amount"), 0) AS discount_total
    FROM "pod_supplier_quotation_items" WHERE "quotation_id" = v_q
  ) agg
  WHERE q."id" = v_q;
  RETURN NULL;
END;
$$;

-- Recompute landed-cost voucher total from its charges
CREATE OR REPLACE FUNCTION pod_recompute_voucher_charges()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_voucher UUID := COALESCE(NEW.voucher_id, OLD.voucher_id);
BEGIN
  UPDATE "pod_landed_cost_vouchers" v
  SET "total_charges" = (
    SELECT COALESCE(SUM("amount" + "tax_amount"), 0)
    FROM "pod_landed_cost_charges" WHERE "voucher_id" = v_voucher
  )
  WHERE v."id" = v_voucher;
  RETURN NULL;
END;
$$;

-- Distribute a voucher's total charges across its allocation rows by basis_value
CREATE OR REPLACE FUNCTION pod_allocate_landed_cost(p_voucher_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_total NUMERIC;
  v_basis NUMERIC;
BEGIN
  SELECT "total_charges" INTO v_total FROM "pod_landed_cost_vouchers" WHERE "id" = p_voucher_id;
  SELECT COALESCE(SUM("basis_value"), 0) INTO v_basis FROM "pod_landed_cost_allocations" WHERE "voucher_id" = p_voucher_id;
  IF v_basis > 0 THEN
    UPDATE "pod_landed_cost_allocations"
    SET "allocated_amount" = ROUND(v_total * ("basis_value" / v_basis), 4)
    WHERE "voucher_id" = p_voucher_id;
  END IF;
END;
$$;

-- Recompute supplier running balance = posted invoices outstanding - unallocated advances
CREATE OR REPLACE FUNCTION pod_recompute_supplier_balance(p_tenant_id UUID, p_supplier_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "suppliers" s
  SET "current_balance" = COALESCE((
        SELECT SUM("outstanding_amount") FROM "pod_supplier_invoices"
        WHERE "tenant_id" = p_tenant_id AND "supplier_id" = p_supplier_id AND "is_posted" = true
      ), 0)
    - COALESCE((
        SELECT SUM("unallocated_amount") FROM "pod_supplier_payments"
        WHERE "tenant_id" = p_tenant_id AND "supplier_id" = p_supplier_id AND "is_posted" = true
      ), 0)
  WHERE s."id" = p_supplier_id AND s."tenant_id" = p_tenant_id;
END;
$$;

-- Set 3-way-match status on an invoice from its match rows (variance tolerance 0.01)
CREATE OR REPLACE FUNCTION pod_three_way_match(p_invoice_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_matched NUMERIC;
  v_grand NUMERIC;
  v_variance NUMERIC;
BEGIN
  SELECT COALESCE(SUM("matched_amount"), 0), COALESCE(SUM(ABS("price_variance")), 0)
    INTO v_matched, v_variance
    FROM "pod_supplier_invoice_matches" WHERE "invoice_id" = p_invoice_id;
  SELECT "grand_total" INTO v_grand FROM "pod_supplier_invoices" WHERE "id" = p_invoice_id;

  UPDATE "pod_supplier_invoices"
  SET "match_status_code" = CASE
        WHEN v_matched = 0 THEN 'unmatched'
        WHEN v_variance > 0.01 THEN 'variance'
        WHEN v_matched >= v_grand - 0.01 THEN 'matched'
        ELSE 'partially_matched'
      END
  WHERE "id" = p_invoice_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- (6) Triggers
-- ---------------------------------------------------------------------------

-- version bump (optimistic lock) on the transactional document headers
CREATE TRIGGER pod_rfqs_version BEFORE UPDATE ON "pod_rfqs" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();
CREATE TRIGGER pod_supplier_quotations_version BEFORE UPDATE ON "pod_supplier_quotations" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();
CREATE TRIGGER pod_supplier_invoices_version BEFORE UPDATE ON "pod_supplier_invoices" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();
CREATE TRIGGER pod_supplier_payments_version BEFORE UPDATE ON "pod_supplier_payments" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();
CREATE TRIGGER pod_landed_cost_vouchers_version BEFORE UPDATE ON "pod_landed_cost_vouchers" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();
CREATE TRIGGER pod_approval_requests_version BEFORE UPDATE ON "pod_approval_requests" FOR EACH ROW EXECUTE FUNCTION pod_bump_version();

-- touch updated_at on the master/satellite/lookup tables
CREATE TRIGGER pod_supplier_categories_touch BEFORE UPDATE ON "pod_supplier_categories" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();
CREATE TRIGGER pod_supplier_contacts_touch BEFORE UPDATE ON "pod_supplier_contacts" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();
CREATE TRIGGER pod_supplier_addresses_touch BEFORE UPDATE ON "pod_supplier_addresses" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();
CREATE TRIGGER pod_supplier_bank_accounts_touch BEFORE UPDATE ON "pod_supplier_bank_accounts" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();
CREATE TRIGGER pod_approval_workflows_touch BEFORE UPDATE ON "pod_approval_workflows" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();
CREATE TRIGGER pod_custom_field_definitions_touch BEFORE UPDATE ON "pod_custom_field_definitions" FOR EACH ROW EXECUTE FUNCTION pod_touch_updated_at();

-- activity capture on the document headers (complements service-layer audit)
CREATE TRIGGER pod_rfqs_activity AFTER INSERT OR UPDATE OR DELETE ON "pod_rfqs" FOR EACH ROW EXECUTE FUNCTION pod_capture_activity();
CREATE TRIGGER pod_supplier_quotations_activity AFTER INSERT OR UPDATE OR DELETE ON "pod_supplier_quotations" FOR EACH ROW EXECUTE FUNCTION pod_capture_activity();
CREATE TRIGGER pod_supplier_invoices_activity AFTER INSERT OR UPDATE OR DELETE ON "pod_supplier_invoices" FOR EACH ROW EXECUTE FUNCTION pod_capture_activity();
CREATE TRIGGER pod_supplier_payments_activity AFTER INSERT OR UPDATE OR DELETE ON "pod_supplier_payments" FOR EACH ROW EXECUTE FUNCTION pod_capture_activity();
CREATE TRIGGER pod_landed_cost_vouchers_activity AFTER INSERT OR UPDATE OR DELETE ON "pod_landed_cost_vouchers" FOR EACH ROW EXECUTE FUNCTION pod_capture_activity();

-- denormalized total recomputation from line changes
CREATE TRIGGER pod_supplier_invoice_items_totals AFTER INSERT OR UPDATE OR DELETE ON "pod_supplier_invoice_items" FOR EACH ROW EXECUTE FUNCTION pod_recompute_invoice_totals();
CREATE TRIGGER pod_supplier_quotation_items_totals AFTER INSERT OR UPDATE OR DELETE ON "pod_supplier_quotation_items" FOR EACH ROW EXECUTE FUNCTION pod_recompute_quotation_totals();
CREATE TRIGGER pod_landed_cost_charges_totals AFTER INSERT OR UPDATE OR DELETE ON "pod_landed_cost_charges" FOR EACH ROW EXECUTE FUNCTION pod_recompute_voucher_charges();

-- ---------------------------------------------------------------------------
-- (7) Reporting views + materialized views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW "pod_v_open_purchase_orders" AS
SELECT po."id", po."tenant_id", po."document_number", po."supplier_id", po."warehouse_id",
       po."status", po."order_date", po."expected_date", po."currency_code", po."grand_total",
       COALESCE(SUM(pol."remaining_qty"), 0) AS "open_qty"
FROM "purchase_orders" po
LEFT JOIN "purchase_order_lines" pol ON pol."purchase_order_id" = po."id"
WHERE po."status" NOT IN ('closed', 'cancelled', 'rejected')
GROUP BY po."id";

CREATE OR REPLACE VIEW "pod_v_po_line_status" AS
SELECT pol."id", pol."tenant_id", pol."purchase_order_id", pol."product_id", pol."ordered_qty",
       pol."received_qty", pol."rejected_qty", pol."returned_qty", pol."cancelled_qty",
       pol."remaining_qty", pol."net_amount", pol."gross_amount"
FROM "purchase_order_lines" pol;

CREATE OR REPLACE VIEW "pod_v_outstanding_payables" AS
SELECT inv."id", inv."tenant_id", inv."supplier_id", inv."document_number", inv."supplier_invoice_number",
       inv."invoice_date", inv."due_date", inv."currency_code", inv."grand_total", inv."paid_amount",
       inv."outstanding_amount", inv."payment_status_code",
       CASE
         WHEN inv."due_date" IS NULL THEN 'current'
         WHEN inv."due_date" >= CURRENT_DATE THEN 'current'
         WHEN inv."due_date" >= CURRENT_DATE - INTERVAL '30 days' THEN '1_30'
         WHEN inv."due_date" >= CURRENT_DATE - INTERVAL '60 days' THEN '31_60'
         WHEN inv."due_date" >= CURRENT_DATE - INTERVAL '90 days' THEN '61_90'
         ELSE '90_plus'
       END AS "aging_bucket"
FROM "pod_supplier_invoices" inv
WHERE inv."is_posted" = true AND inv."payment_status_code" <> 'paid' AND inv."deleted_at" IS NULL;

CREATE OR REPLACE VIEW "pod_v_supplier_balances" AS
SELECT s."id" AS "supplier_id", s."tenant_id", s."code", s."name", s."currency_code",
       s."credit_limit", s."current_balance",
       COALESCE(inv.open_count, 0) AS "open_invoice_count",
       COALESCE(inv.outstanding, 0) AS "total_outstanding"
FROM "suppliers" s
LEFT JOIN (
  SELECT "tenant_id", "supplier_id", COUNT(*) AS open_count, SUM("outstanding_amount") AS outstanding
  FROM "pod_supplier_invoices"
  WHERE "is_posted" = true AND "payment_status_code" <> 'paid'
  GROUP BY "tenant_id", "supplier_id"
) inv ON inv."supplier_id" = s."id" AND inv."tenant_id" = s."tenant_id";

CREATE OR REPLACE VIEW "pod_v_three_way_match_variance" AS
SELECT inv."id" AS "invoice_id", inv."tenant_id", inv."supplier_id", inv."document_number",
       inv."match_status_code", inv."grand_total",
       COALESCE(SUM(m."matched_amount"), 0) AS "matched_amount",
       COALESCE(SUM(m."price_variance"), 0) AS "price_variance",
       COALESCE(SUM(m."qty_variance"), 0) AS "qty_variance"
FROM "pod_supplier_invoices" inv
LEFT JOIN "pod_supplier_invoice_matches" m ON m."invoice_id" = inv."id"
GROUP BY inv."id";

-- Materialized views (refresh on a schedule or after posting batches)
CREATE MATERIALIZED VIEW "pod_mv_supplier_performance" AS
SELECT po."tenant_id", po."supplier_id",
       COUNT(DISTINCT po."id") AS "po_count",
       COALESCE(SUM(po."grand_total"), 0) AS "total_spend",
       AVG(EXTRACT(EPOCH FROM (gr."receipt_date" - po."order_date")) / 86400.0) AS "avg_lead_time_days",
       AVG(CASE WHEN gr."receipt_date" <= po."expected_date" THEN 1.0 ELSE 0.0 END) AS "on_time_ratio"
FROM "purchase_orders" po
LEFT JOIN "goods_receipts" gr ON gr."purchase_order_id" = po."id" AND gr."is_posted" = true
GROUP BY po."tenant_id", po."supplier_id"
WITH NO DATA;

CREATE UNIQUE INDEX "pod_mv_supplier_performance_pk" ON "pod_mv_supplier_performance"("tenant_id", "supplier_id");

CREATE MATERIALIZED VIEW "pod_mv_spend_analysis" AS
SELECT po."tenant_id", po."supplier_id", po."currency_code",
       DATE_TRUNC('month', po."order_date") AS "period",
       COUNT(*) AS "order_count",
       COALESCE(SUM(po."grand_total"), 0) AS "spend"
FROM "purchase_orders" po
WHERE po."status" NOT IN ('draft', 'cancelled', 'rejected')
GROUP BY po."tenant_id", po."supplier_id", po."currency_code", DATE_TRUNC('month', po."order_date")
WITH NO DATA;

CREATE UNIQUE INDEX "pod_mv_spend_analysis_pk" ON "pod_mv_spend_analysis"("tenant_id", "supplier_id", "currency_code", "period");

CREATE MATERIALIZED VIEW "pod_mv_purchase_price_variance" AS
SELECT ii."tenant_id", inv."supplier_id", ii."product_id",
       AVG(pol."unit_cost") AS "avg_po_cost",
       AVG(ii."unit_price") AS "avg_invoice_price",
       AVG(ii."unit_price" - pol."unit_cost") AS "avg_price_variance"
FROM "pod_supplier_invoice_items" ii
JOIN "pod_supplier_invoices" inv ON inv."id" = ii."invoice_id"
JOIN "purchase_order_lines" pol ON pol."id" = ii."purchase_order_line_id"
WHERE ii."product_id" IS NOT NULL
GROUP BY ii."tenant_id", inv."supplier_id", ii."product_id"
WITH NO DATA;

CREATE UNIQUE INDEX "pod_mv_purchase_price_variance_pk" ON "pod_mv_purchase_price_variance"("tenant_id", "supplier_id", "product_id");

-- Concurrent refresh helper (call from a scheduled job / after posting batches)
CREATE OR REPLACE FUNCTION pod_refresh_reporting_matviews()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "pod_mv_supplier_performance";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "pod_mv_spend_analysis";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "pod_mv_purchase_price_variance";
END;
$$;

-- ---------------------------------------------------------------------------
-- (8) Row Level Security (defense-in-depth)
--
-- ENABLE (not FORCE) RLS: the table owner / migration role (used by the Prisma
-- pooled connection in this app) bypasses these policies, so the existing
-- app-level tenant scoping continues to be the primary boundary and nothing
-- breaks. Non-owner roles (e.g. Supabase authenticated/anon) are constrained to
-- their tenant via the app.current_tenant_id GUC set by pod_set_tenant_context().
-- Global lookup rows (tenant_id IS NULL) stay readable to everyone.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pod_document_statuses','pod_status_transitions','pod_supplier_categories','pod_return_reasons',
    'pod_payment_methods','pod_landed_cost_types','pod_incoterms','pod_debit_note_reasons',
    'pod_supplier_contacts','pod_supplier_addresses','pod_supplier_bank_accounts',
    'pod_rfqs','pod_rfq_items','pod_rfq_suppliers','pod_supplier_quotations','pod_supplier_quotation_items',
    'pod_approval_workflows','pod_approval_workflow_steps','pod_approval_requests','pod_approval_actions',
    'pod_supplier_invoices','pod_supplier_invoice_items','pod_supplier_invoice_matches','pod_debit_note_lines',
    'pod_landed_cost_vouchers','pod_landed_cost_charges','pod_landed_cost_allocations',
    'pod_supplier_payments','pod_supplier_payment_allocations',
    'pod_attachments','pod_custom_field_definitions','pod_custom_field_values'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
      USING (tenant_id IS NULL OR tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    $p$, t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- (9) Seed data — global (tenant_id NULL) status & classification lookups.
--     Admins may add tenant-scoped rows to customize. The default per-tenant
--     approval workflow is seeded by the application seed (prisma/seed.ts),
--     since pod_approval_workflows.tenant_id is NOT NULL.
-- ---------------------------------------------------------------------------

INSERT INTO "pod_document_statuses" ("id","tenant_id","entity_type","code","name","sort_order","is_initial","is_terminal") VALUES
  (gen_random_uuid(), NULL, 'rfq', 'open', 'Open', 10, true, false),
  (gen_random_uuid(), NULL, 'rfq', 'awarded', 'Awarded', 20, false, false),
  (gen_random_uuid(), NULL, 'rfq', 'expired', 'Expired', 30, false, true),
  (gen_random_uuid(), NULL, 'rfq', 'cancelled', 'Cancelled', 40, false, true),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'draft', 'Draft', 10, true, false),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'submitted', 'Submitted', 20, false, false),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'under_review', 'Under Review', 30, false, false),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'approved', 'Approved', 40, false, false),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'rejected', 'Rejected', 50, false, true),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'expired', 'Expired', 60, false, true),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'awarded', 'Awarded', 70, false, false),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'cancelled', 'Cancelled', 80, false, true),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'draft', 'Draft', 10, true, false),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'pending_approval', 'Pending Approval', 20, false, false),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'approved', 'Approved', 30, false, false),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'posted', 'Posted', 40, false, false),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'disputed', 'Disputed', 50, false, false),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'cancelled', 'Cancelled', 60, false, true),
  (gen_random_uuid(), NULL, 'supplier_payment', 'draft', 'Draft', 10, true, false),
  (gen_random_uuid(), NULL, 'supplier_payment', 'pending_approval', 'Pending Approval', 20, false, false),
  (gen_random_uuid(), NULL, 'supplier_payment', 'approved', 'Approved', 30, false, false),
  (gen_random_uuid(), NULL, 'supplier_payment', 'posted', 'Posted', 40, false, false),
  (gen_random_uuid(), NULL, 'supplier_payment', 'cancelled', 'Cancelled', 50, false, true),
  (gen_random_uuid(), NULL, 'landed_cost', 'draft', 'Draft', 10, true, false),
  (gen_random_uuid(), NULL, 'landed_cost', 'allocated', 'Allocated', 20, false, false),
  (gen_random_uuid(), NULL, 'landed_cost', 'posted', 'Posted', 30, false, false),
  (gen_random_uuid(), NULL, 'landed_cost', 'cancelled', 'Cancelled', 40, false, true),
  (gen_random_uuid(), NULL, 'approval_request', 'pending', 'Pending', 10, true, false),
  (gen_random_uuid(), NULL, 'approval_request', 'escalated', 'Escalated', 20, false, false),
  (gen_random_uuid(), NULL, 'approval_request', 'approved', 'Approved', 30, false, true),
  (gen_random_uuid(), NULL, 'approval_request', 'rejected', 'Rejected', 40, false, true),
  (gen_random_uuid(), NULL, 'approval_request', 'cancelled', 'Cancelled', 50, false, true);

INSERT INTO "pod_status_transitions" ("id","tenant_id","entity_type","from_code","to_code") VALUES
  (gen_random_uuid(), NULL, 'rfq', 'open', 'awarded'),
  (gen_random_uuid(), NULL, 'rfq', 'open', 'expired'),
  (gen_random_uuid(), NULL, 'rfq', 'open', 'cancelled'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'draft', 'submitted'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'submitted', 'under_review'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'under_review', 'approved'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'under_review', 'rejected'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'approved', 'awarded'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'submitted', 'expired'),
  (gen_random_uuid(), NULL, 'supplier_quotation', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'draft', 'pending_approval'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'pending_approval', 'approved'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'pending_approval', 'draft'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'approved', 'posted'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'approved', 'disputed'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'disputed', 'approved'),
  (gen_random_uuid(), NULL, 'supplier_invoice', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'supplier_payment', 'draft', 'pending_approval'),
  (gen_random_uuid(), NULL, 'supplier_payment', 'pending_approval', 'approved'),
  (gen_random_uuid(), NULL, 'supplier_payment', 'approved', 'posted'),
  (gen_random_uuid(), NULL, 'supplier_payment', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'landed_cost', 'draft', 'allocated'),
  (gen_random_uuid(), NULL, 'landed_cost', 'allocated', 'posted'),
  (gen_random_uuid(), NULL, 'landed_cost', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'approval_request', 'pending', 'approved'),
  (gen_random_uuid(), NULL, 'approval_request', 'pending', 'rejected'),
  (gen_random_uuid(), NULL, 'approval_request', 'pending', 'escalated'),
  (gen_random_uuid(), NULL, 'approval_request', 'escalated', 'approved'),
  (gen_random_uuid(), NULL, 'approval_request', 'escalated', 'rejected'),
  (gen_random_uuid(), NULL, 'approval_request', 'pending', 'cancelled');

INSERT INTO "pod_return_reasons" ("id","tenant_id","code","label","requires_inspection") VALUES
  (gen_random_uuid(), NULL, 'damaged', 'Damaged Goods', true),
  (gen_random_uuid(), NULL, 'expired', 'Expired Goods', true),
  (gen_random_uuid(), NULL, 'wrong_item', 'Wrong Item', false),
  (gen_random_uuid(), NULL, 'quantity_difference', 'Quantity Difference', false),
  (gen_random_uuid(), NULL, 'quality_issue', 'Quality Issue', true);

INSERT INTO "pod_payment_methods" ("id","tenant_id","code","label") VALUES
  (gen_random_uuid(), NULL, 'cash', 'Cash'),
  (gen_random_uuid(), NULL, 'bank_transfer', 'Bank Transfer'),
  (gen_random_uuid(), NULL, 'cheque', 'Cheque'),
  (gen_random_uuid(), NULL, 'credit_card', 'Credit Card'),
  (gen_random_uuid(), NULL, 'online', 'Online');

INSERT INTO "pod_landed_cost_types" ("id","tenant_id","code","label","default_allocation_basis") VALUES
  (gen_random_uuid(), NULL, 'freight', 'Freight', 'weight'),
  (gen_random_uuid(), NULL, 'shipping', 'Shipping', 'weight'),
  (gen_random_uuid(), NULL, 'insurance', 'Insurance', 'value'),
  (gen_random_uuid(), NULL, 'import_duty', 'Import Duty', 'value'),
  (gen_random_uuid(), NULL, 'customs', 'Customs', 'value'),
  (gen_random_uuid(), NULL, 'broker_fee', 'Broker Fee', 'value'),
  (gen_random_uuid(), NULL, 'handling', 'Handling', 'quantity'),
  (gen_random_uuid(), NULL, 'port_charges', 'Port Charges', 'quantity'),
  (gen_random_uuid(), NULL, 'other', 'Other Charges', 'value');

INSERT INTO "pod_incoterms" ("id","tenant_id","code","label") VALUES
  (gen_random_uuid(), NULL, 'EXW', 'Ex Works'),
  (gen_random_uuid(), NULL, 'FCA', 'Free Carrier'),
  (gen_random_uuid(), NULL, 'FOB', 'Free On Board'),
  (gen_random_uuid(), NULL, 'CFR', 'Cost and Freight'),
  (gen_random_uuid(), NULL, 'CIF', 'Cost, Insurance and Freight'),
  (gen_random_uuid(), NULL, 'CPT', 'Carriage Paid To'),
  (gen_random_uuid(), NULL, 'CIP', 'Carriage and Insurance Paid To'),
  (gen_random_uuid(), NULL, 'DAP', 'Delivered At Place'),
  (gen_random_uuid(), NULL, 'DPU', 'Delivered At Place Unloaded'),
  (gen_random_uuid(), NULL, 'DDP', 'Delivered Duty Paid');

INSERT INTO "pod_debit_note_reasons" ("id","tenant_id","code","label") VALUES
  (gen_random_uuid(), NULL, 'price_difference', 'Price Difference'),
  (gen_random_uuid(), NULL, 'missing_quantity', 'Missing Quantity'),
  (gen_random_uuid(), NULL, 'damaged_goods', 'Damaged Goods'),
  (gen_random_uuid(), NULL, 'incorrect_billing', 'Incorrect Billing'),
  (gen_random_uuid(), NULL, 'tax_adjustment', 'Tax Adjustment');



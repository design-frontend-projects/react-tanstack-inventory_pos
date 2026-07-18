-- ============================================================================
-- Financial Management — Spec 006 (enterprise accounting engine v1)
--
-- Adds the fin_* accounting layer: chart of accounts, fiscal calendar,
-- double-entry journals + GL balances, AR/AP subledgers, cash, banking,
-- tax, multi-currency, dimensions, budgets, fixed assets, closing, and the
-- configurable posting engine (rules + queue + cursors). Zero breaking
-- changes to existing modules: operational masters (tax_rates,
-- pod_payment_methods, currencyCode strings) are linked via mapping tables.
--
-- Ordering: (0) DocumentType enum additions, (1) fin_* CREATE TABLE,
-- (2) indexes, (3) foreign keys, (5) check constraints, (6) idempotency +
-- BRIN indexes, (7) functions + deferred balance triggers, (8) RLS,
-- (9) seed data. Sections 1-3 are generated with `prisma migrate diff`
-- from the datamodel; sections 5-9 are hand-written.
--
-- Apply with `pnpm prisma migrate deploy` (never `migrate dev` on this DB).
-- ============================================================================

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'journal_entry';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ar_receipt';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'payment_run';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'cash_transaction';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'funds_transfer';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'depreciation_run';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'fx_revaluation';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'tax_return';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'opening_balance';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'allocation_run';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'asset';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'asset_disposal';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'dunning_run';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'budget_transfer';

-- AlterEnum

-- CreateTable
CREATE TABLE "fin_account_classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "normal_balance_side" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_account_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_account_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "account_class_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "is_control_type" BOOLEAN NOT NULL DEFAULT false,
    "control_domain" TEXT,
    "cash_flow_section" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_account_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "description" TEXT,
    "parent_account_id" UUID,
    "account_type_id" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "path" TEXT NOT NULL DEFAULT '',
    "is_leaf" BOOLEAN NOT NULL DEFAULT true,
    "is_control_account" BOOLEAN NOT NULL DEFAULT false,
    "control_domain" TEXT,
    "allow_manual_journal" BOOLEAN NOT NULL DEFAULT true,
    "currency_code" TEXT,
    "cash_flow_category_id" UUID,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_account_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "entity_code" TEXT,
    "mapping_role" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_fiscal_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by_profile_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_fiscal_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "period_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'future',
    "is_adjustment_period" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_period_module_locks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "module_code" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by_profile_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_period_module_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "document_type" TEXT NOT NULL,
    "default_prefix" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_journal_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entry_number" TEXT NOT NULL,
    "journal_type_id" UUID NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "source_event_type" TEXT,
    "reference_number" TEXT,
    "memo" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "total_base_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_base_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reversal_of_entry_id" UUID,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "approval_request_id" UUID,
    "correlation_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_id" UUID NOT NULL,
    "description" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "party_type" TEXT,
    "party_id" UUID,
    "cost_center_id" UUID,
    "project_id" UUID,
    "branch_id" UUID,
    "warehouse_id" UUID,
    "tax_code_id" UUID,
    "source_line_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "journal_type_id" UUID,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_journal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_template_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_id" UUID NOT NULL,
    "side" TEXT NOT NULL,
    "amount_formula" TEXT NOT NULL DEFAULT 'fixed',
    "fixed_amount" DECIMAL(19,4),
    "percent_of_total" DECIMAL(9,6),
    "description" TEXT,
    "cost_center_id" UUID,
    "project_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_journal_template_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_recurring_journal_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency_code" TEXT NOT NULL,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "next_run_date" TIMESTAMP(3) NOT NULL,
    "last_run_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_recurring_journal_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_gl_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "currency_code" TEXT NOT NULL,
    "opening_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "opening_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_opening_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_opening_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_period_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_period_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_gl_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_customer_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "journal_entry_id" UUID,
    "journal_line_id" UUID,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "document_type" TEXT NOT NULL,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "document_number" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4) NOT NULL,
    "base_amount" DECIMAL(19,4) NOT NULL,
    "remaining_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_customer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_customer_ledger_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_entry_id" UUID NOT NULL,
    "to_entry_id" UUID NOT NULL,
    "applied_amount" DECIMAL(19,4) NOT NULL,
    "applied_base_amount" DECIMAL(19,4) NOT NULL,
    "fx_gain_loss_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "application_date" TIMESTAMP(3) NOT NULL,
    "journal_entry_id" UUID,
    "unapplied_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_customer_ledger_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_ar_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method_code" TEXT,
    "bank_account_id" UUID,
    "cashbox_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4) NOT NULL,
    "allocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "unallocated_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "reference_number" TEXT,
    "is_advance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "journal_entry_id" UUID,
    "approval_request_id" UUID,
    "correlation_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_ar_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_ar_receipt_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "sales_invoice_id" UUID,
    "pos_sale_id" UUID,
    "financial_note_id" UUID,
    "customer_ledger_entry_id" UUID,
    "allocated_amount" DECIMAL(19,4) NOT NULL,
    "discount_taken" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_ar_receipt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_customer_financial_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "ar_control_account_id" UUID,
    "payment_term_id" UUID,
    "credit_hold" BOOLEAN NOT NULL DEFAULT false,
    "dunning_level_id" UUID,
    "statement_delivery" TEXT,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_customer_financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_dunning_levels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "level_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "days_overdue" INTEGER NOT NULL,
    "fee_amount" DECIMAL(19,4),
    "block_sales" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_dunning_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_dunning_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "run_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "executed_by_profile_id" UUID,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_dunning_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_dunning_run_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "ledger_entry_id" UUID,
    "dunning_level_id" UUID,
    "amount_due" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notification_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_dunning_run_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_vendor_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "journal_entry_id" UUID,
    "journal_line_id" UUID,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "document_type" TEXT NOT NULL,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "document_number" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4) NOT NULL,
    "base_amount" DECIMAL(19,4) NOT NULL,
    "remaining_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_vendor_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_vendor_ledger_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_entry_id" UUID NOT NULL,
    "to_entry_id" UUID NOT NULL,
    "applied_amount" DECIMAL(19,4) NOT NULL,
    "applied_base_amount" DECIMAL(19,4) NOT NULL,
    "fx_gain_loss_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "application_date" TIMESTAMP(3) NOT NULL,
    "journal_entry_id" UUID,
    "unapplied_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_vendor_ledger_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_supplier_financial_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "ap_control_account_id" UUID,
    "default_expense_account_id" UUID,
    "payment_term_id" UUID,
    "wht_applicable" BOOLEAN NOT NULL DEFAULT false,
    "wht_tax_code_id" UUID,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_supplier_financial_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_payment_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "run_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bank_account_id" UUID,
    "payment_method_code" TEXT,
    "selection_criteria" JSONB,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "total_proposed" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_executed" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approval_request_id" UUID,
    "executed_at" TIMESTAMP(3),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_payment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_payment_run_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_invoice_id" UUID,
    "financial_note_id" UUID,
    "vendor_ledger_entry_id" UUID,
    "due_date" TIMESTAMP(3),
    "outstanding_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "proposed_amount" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'proposed',
    "resulting_supplier_payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_payment_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cashboxes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "gl_account_id" UUID NOT NULL,
    "branch_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "custodian_profile_id" UUID,
    "float_limit" DECIMAL(19,4),
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_cashboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cash_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "cashbox_id" UUID NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "counter_account_id" UUID,
    "party_type" TEXT,
    "party_id" UUID,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "pos_session_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "journal_entry_id" UUID,
    "correlation_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_funds_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_bank_account_id" UUID,
    "from_cashbox_id" UUID,
    "to_bank_account_id" UUID,
    "to_cashbox_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "from_currency_code" TEXT NOT NULL DEFAULT 'USD',
    "to_currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "received_amount" DECIMAL(19,4),
    "in_transit_account_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "journal_entry_id" UUID,
    "completion_journal_entry_id" UUID,
    "notes" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_funds_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cash_flow_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_cash_flow_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT NOT NULL,
    "iban" TEXT,
    "swift_code" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "gl_account_id" UUID NOT NULL,
    "branch_id" UUID,
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_statements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "statement_date" TIMESTAMP(3) NOT NULL,
    "reference_number" TEXT,
    "opening_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "import_source" TEXT NOT NULL DEFAULT 'manual',
    "status_code" TEXT NOT NULL DEFAULT 'open',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_statement_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "line_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "balance_after" DECIMAL(19,4),
    "match_status_code" TEXT NOT NULL DEFAULT 'unmatched',
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_reconciliations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "statement_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gl_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "unreconciled_difference" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "completed_at" TIMESTAMP(3),
    "completed_by_profile_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_reconciliation_matches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reconciliation_id" UUID NOT NULL,
    "statement_line_id" UUID,
    "journal_line_id" UUID,
    "adjustment_journal_entry_id" UUID,
    "matched_amount" DECIMAL(19,4) NOT NULL,
    "match_type" TEXT NOT NULL DEFAULT 'manual',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_bank_reconciliation_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_bank_matching_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "match_field" TEXT NOT NULL DEFAULT 'description',
    "counter_account_id" UUID,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_bank_matching_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cheque_books" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "book_number" TEXT NOT NULL,
    "start_number" INTEGER NOT NULL,
    "end_number" INTEGER NOT NULL,
    "next_number" INTEGER,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_cheque_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cheques" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cheque_number" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "bank_account_id" UUID,
    "cheque_book_id" UUID,
    "party_type" TEXT,
    "party_id" UUID,
    "payee_name" TEXT,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "cheque_date" TIMESTAMP(3) NOT NULL,
    "maturity_date" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "memo" TEXT,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "clearing_journal_entry_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_authorities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "registration_number" TEXT,
    "payable_account_id" UUID,
    "receivable_account_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_tax_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'both',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_tax_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_codes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "tax_type_id" UUID,
    "authority_id" UUID,
    "input_account_id" UUID,
    "output_account_id" UUID,
    "reporting_box_code" TEXT,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_code_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_tax_code_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_code_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tax_rate_id" UUID,
    "res_tax_config_id" UUID,
    "tax_code_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_tax_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "journal_line_id" UUID,
    "tax_code_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "taxable_base_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "party_type" TEXT,
    "party_id" UUID,
    "tax_return_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_tax_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "return_number" TEXT NOT NULL,
    "authority_id" UUID,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "filed_at" TIMESTAMP(3),
    "filed_by_profile_id" UUID,
    "net_payable" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "payment_journal_entry_id" UUID,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_tax_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_tax_return_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "box_code" TEXT NOT NULL,
    "description" TEXT,
    "taxable_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_tax_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_wht_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "certificate_number" TEXT NOT NULL,
    "supplier_id" UUID,
    "customer_id" UUID,
    "tax_code_id" UUID,
    "base_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "wht_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_code" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_wht_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_currencies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "symbol" TEXT,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_exchange_rates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_currency_code" TEXT NOT NULL,
    "to_currency_code" TEXT NOT NULL,
    "rate_date" TIMESTAMP(3) NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "rate_type" TEXT NOT NULL DEFAULT 'spot',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_fx_revaluation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "rate_type" TEXT NOT NULL DEFAULT 'closing',
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "journal_entry_id" UUID,
    "reversal_journal_entry_id" UUID,
    "total_gain_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_loss_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_fx_revaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_fx_revaluation_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "party_type" TEXT,
    "party_id" UUID,
    "currency_code" TEXT NOT NULL,
    "foreign_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "old_rate" DECIMAL(19,8),
    "new_rate" DECIMAL(19,8),
    "old_base_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "new_base_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gain_loss_base" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_fx_revaluation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_cost_centers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "parent_cost_center_id" UUID,
    "manager_profile_id" UUID,
    "branch_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_projects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "customer_id" UUID,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "budget_amount" DECIMAL(19,4),
    "manager_profile_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_analysis_dimensions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "is_required_on_posting" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_analysis_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_analysis_dimension_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_analysis_dimension_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_journal_line_dimensions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "journal_line_id" UUID NOT NULL,
    "dimension_id" UUID NOT NULL,
    "dimension_value_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_journal_line_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budgets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "fiscal_year_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "approval_request_id" UUID,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budget_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "project_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budget_revisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "reason" TEXT,
    "revised_by_profile_id" UUID,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_budget_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budget_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "transfer_number" TEXT NOT NULL,
    "from_budget_line_id" UUID NOT NULL,
    "to_budget_line_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reason" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "approval_request_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_budget_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_budget_control_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID,
    "account_type_id" UUID,
    "cost_center_id" UUID,
    "control_action" TEXT NOT NULL DEFAULT 'warn',
    "tolerance_rate" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_budget_control_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "asset_account_id" UUID,
    "accum_depreciation_account_id" UUID,
    "depreciation_expense_account_id" UUID,
    "disposal_gain_loss_account_id" UUID,
    "default_method_code" TEXT,
    "default_useful_life_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_depreciation_methods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "calculation_strategy" TEXT NOT NULL DEFAULT 'straight_line',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_depreciation_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "category_id" UUID NOT NULL,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "in_service_date" TIMESTAMP(3),
    "acquisition_cost" DECIMAL(19,4) NOT NULL,
    "salvage_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "depreciation_method_code" TEXT NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "branch_id" UUID,
    "warehouse_id" UUID,
    "cost_center_id" UUID,
    "custodian_profile_id" UUID,
    "serial_number" TEXT,
    "source_doc_type" TEXT,
    "source_doc_id" UUID,
    "accumulated_depreciation" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "capitalization_journal_entry_id" UUID,
    "disposed_at" TIMESTAMP(3),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_depreciation_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "planned_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "posted_amount" DECIMAL(19,4),
    "status_code" TEXT NOT NULL DEFAULT 'planned',
    "posted_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_asset_depreciation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_depreciation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "journal_entry_id" UUID,
    "asset_count" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_depreciation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_depreciation_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "schedule_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "accumulated_after" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "book_value_after" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_asset_depreciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_disposals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "disposal_number" TEXT NOT NULL,
    "asset_id" UUID NOT NULL,
    "disposal_date" TIMESTAMP(3) NOT NULL,
    "disposal_type" TEXT NOT NULL,
    "proceeds_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_book_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gain_loss_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_revaluations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "revaluation_date" TIMESTAMP(3) NOT NULL,
    "old_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "new_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "reason" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_asset_revaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_asset_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "from_branch_id" UUID,
    "to_branch_id" UUID,
    "from_cost_center_id" UUID,
    "to_cost_center_id" UUID,
    "from_custodian_profile_id" UUID,
    "to_custodian_profile_id" UUID,
    "journal_entry_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_asset_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_close_task_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "module_code" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_close_task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_period_close_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "closed_by_profile_id" UUID,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_period_close_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_period_close_run_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "close_run_id" UUID NOT NULL,
    "template_id" UUID,
    "code" TEXT,
    "name" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "completed_by_profile_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_period_close_run_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_year_close_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fiscal_year_id" UUID NOT NULL,
    "retained_earnings_account_id" UUID,
    "closing_journal_entry_id" UUID,
    "opening_journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "total_pl_swept" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "executed_at" TIMESTAMP(3),
    "executed_by_profile_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_year_close_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_opening_balance_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_number" TEXT NOT NULL,
    "as_of_date" TIMESTAMP(3) NOT NULL,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "journal_entry_id" UUID,
    "total_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_opening_balance_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_opening_balance_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "party_type" TEXT,
    "party_id" UUID,
    "source_doc_ref" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "exchange_rate" DECIMAL(19,8) NOT NULL DEFAULT 1,
    "debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_debit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "base_credit_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_opening_balance_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_allocation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "source_account_id" UUID NOT NULL,
    "allocation_basis" TEXT NOT NULL DEFAULT 'fixed_percent',
    "journal_type_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_allocation_rule_targets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "cost_center_id" UUID,
    "project_id" UUID,
    "percentage" DECIMAL(9,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_allocation_rule_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_allocation_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "rule_id" UUID,
    "fiscal_period_id" UUID,
    "source_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "journal_entry_id" UUID,
    "executed_at" TIMESTAMP(3),
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_allocation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "base_currency_code" TEXT NOT NULL DEFAULT 'USD',
    "retained_earnings_account_id" UUID,
    "fx_realized_gain_account_id" UUID,
    "fx_realized_loss_account_id" UUID,
    "fx_unrealized_gain_account_id" UUID,
    "fx_unrealized_loss_account_id" UUID,
    "rounding_account_id" UUID,
    "suspense_account_id" UUID,
    "default_ar_control_account_id" UUID,
    "default_ap_control_account_id" UUID,
    "grni_account_id" UUID,
    "inventory_account_id" UUID,
    "cogs_account_id" UUID,
    "sales_revenue_account_id" UUID,
    "sales_discount_account_id" UUID,
    "bank_clearing_account_id" UUID,
    "write_off_account_id" UUID,
    "strict_account_resolution" BOOLEAN NOT NULL DEFAULT false,
    "posting_modes" JSONB,
    "finance_start_date" TIMESTAMP(3),
    "is_initialized" BOOLEAN NOT NULL DEFAULT false,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_posting_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "event_type" TEXT NOT NULL,
    "source_doc_type" TEXT,
    "journal_type_code" TEXT,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fin_posting_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_posting_rule_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "rule_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL DEFAULT 0,
    "line_role" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "account_source" TEXT NOT NULL DEFAULT 'mapping',
    "account_id" UUID,
    "mapping_entity_type" TEXT,
    "mapping_role" TEXT,
    "settings_field" TEXT,
    "amount_selector" TEXT NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_posting_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_posting_queue" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "domain_event_id" UUID,
    "event_type" TEXT NOT NULL,
    "source_doc_type" TEXT NOT NULL,
    "source_doc_id" UUID NOT NULL,
    "payload" JSONB,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "journal_entry_id" UUID,
    "next_attempt_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_posting_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_event_cursors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "last_event_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_event_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fin_payment_terms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "due_days" INTEGER NOT NULL DEFAULT 0,
    "discount_days" INTEGER,
    "discount_rate" DECIMAL(9,6),
    "is_end_of_month" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fin_payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fin_account_classes_tenant_code_unique" ON "fin_account_classes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_account_types_tenant_class_idx" ON "fin_account_types"("tenant_id", "account_class_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_account_types_tenant_code_unique" ON "fin_account_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_accounts_tenant_parent_idx" ON "fin_accounts"("tenant_id", "parent_account_id");

-- CreateIndex
CREATE INDEX "fin_accounts_tenant_type_idx" ON "fin_accounts"("tenant_id", "account_type_id");

-- CreateIndex
CREATE INDEX "fin_accounts_tenant_active_idx" ON "fin_accounts"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fin_accounts_tenant_code_unique" ON "fin_accounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_account_mappings_tenant_role_idx" ON "fin_account_mappings"("tenant_id", "entity_type", "mapping_role");

-- CreateIndex
CREATE UNIQUE INDEX "fin_account_mappings_scope_unique" ON "fin_account_mappings"("tenant_id", "entity_type", "entity_id", "entity_code", "mapping_role");

-- CreateIndex
CREATE INDEX "fin_fiscal_years_tenant_start_idx" ON "fin_fiscal_years"("tenant_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_fiscal_years_tenant_code_unique" ON "fin_fiscal_years"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_fiscal_periods_tenant_range_idx" ON "fin_fiscal_periods"("tenant_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "fin_fiscal_periods_tenant_status_idx" ON "fin_fiscal_periods"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_fiscal_periods_year_number_unique" ON "fin_fiscal_periods"("tenant_id", "fiscal_year_id", "period_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_period_module_locks_scope_unique" ON "fin_period_module_locks"("tenant_id", "fiscal_period_id", "module_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_types_tenant_code_unique" ON "fin_journal_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_journal_entries_tenant_date_idx" ON "fin_journal_entries"("tenant_id", "entry_date");

-- CreateIndex
CREATE INDEX "fin_journal_entries_period_status_idx" ON "fin_journal_entries"("tenant_id", "fiscal_period_id", "status_code");

-- CreateIndex
CREATE INDEX "fin_journal_entries_source_idx" ON "fin_journal_entries"("tenant_id", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_entries_tenant_number_unique" ON "fin_journal_entries"("tenant_id", "entry_number");

-- CreateIndex
CREATE INDEX "fin_journal_lines_tenant_account_idx" ON "fin_journal_lines"("tenant_id", "account_id");

-- CreateIndex
CREATE INDEX "fin_journal_lines_tenant_party_idx" ON "fin_journal_lines"("tenant_id", "party_type", "party_id");

-- CreateIndex
CREATE INDEX "fin_journal_lines_tenant_cost_center_idx" ON "fin_journal_lines"("tenant_id", "cost_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_lines_entry_line_unique" ON "fin_journal_lines"("entry_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_templates_tenant_code_unique" ON "fin_journal_templates"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_template_lines_template_line_unique" ON "fin_journal_template_lines"("template_id", "line_number");

-- CreateIndex
CREATE INDEX "fin_recurring_schedules_due_idx" ON "fin_recurring_journal_schedules"("tenant_id", "status_code", "next_run_date");

-- CreateIndex
CREATE INDEX "fin_gl_balances_tenant_period_idx" ON "fin_gl_balances"("tenant_id", "fiscal_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_gl_balances_scope_unique" ON "fin_gl_balances"("tenant_id", "account_id", "fiscal_period_id", "currency_code");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_open_idx" ON "fin_customer_ledger_entries"("tenant_id", "customer_id", "is_open");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_due_idx" ON "fin_customer_ledger_entries"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_entry_idx" ON "fin_customer_ledger_entries"("tenant_id", "journal_entry_id");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_source_idx" ON "fin_customer_ledger_entries"("tenant_id", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_apps_from_idx" ON "fin_customer_ledger_applications"("tenant_id", "from_entry_id");

-- CreateIndex
CREATE INDEX "fin_customer_ledger_apps_to_idx" ON "fin_customer_ledger_applications"("tenant_id", "to_entry_id");

-- CreateIndex
CREATE INDEX "fin_ar_receipts_tenant_customer_idx" ON "fin_ar_receipts"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "fin_ar_receipts_tenant_status_idx" ON "fin_ar_receipts"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_ar_receipts_tenant_number_unique" ON "fin_ar_receipts"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "fin_ar_receipt_allocations_receipt_idx" ON "fin_ar_receipt_allocations"("tenant_id", "receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_customer_financial_profiles_unique" ON "fin_customer_financial_profiles"("tenant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_dunning_levels_tenant_level_unique" ON "fin_dunning_levels"("tenant_id", "level_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_dunning_runs_tenant_number_unique" ON "fin_dunning_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE INDEX "fin_dunning_run_entries_run_idx" ON "fin_dunning_run_entries"("tenant_id", "run_id");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_open_idx" ON "fin_vendor_ledger_entries"("tenant_id", "supplier_id", "is_open");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_due_idx" ON "fin_vendor_ledger_entries"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_entry_idx" ON "fin_vendor_ledger_entries"("tenant_id", "journal_entry_id");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_source_idx" ON "fin_vendor_ledger_entries"("tenant_id", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_apps_from_idx" ON "fin_vendor_ledger_applications"("tenant_id", "from_entry_id");

-- CreateIndex
CREATE INDEX "fin_vendor_ledger_apps_to_idx" ON "fin_vendor_ledger_applications"("tenant_id", "to_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_supplier_financial_profiles_unique" ON "fin_supplier_financial_profiles"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "fin_payment_runs_tenant_status_idx" ON "fin_payment_runs"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_payment_runs_tenant_number_unique" ON "fin_payment_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE INDEX "fin_payment_run_lines_run_idx" ON "fin_payment_run_lines"("tenant_id", "run_id");

-- CreateIndex
CREATE INDEX "fin_payment_run_lines_supplier_idx" ON "fin_payment_run_lines"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cashboxes_tenant_code_unique" ON "fin_cashboxes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_cash_transactions_cashbox_date_idx" ON "fin_cash_transactions"("tenant_id", "cashbox_id", "transaction_date");

-- CreateIndex
CREATE INDEX "fin_cash_transactions_tenant_status_idx" ON "fin_cash_transactions"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cash_transactions_tenant_number_unique" ON "fin_cash_transactions"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "fin_funds_transfers_tenant_status_idx" ON "fin_funds_transfers"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_funds_transfers_tenant_number_unique" ON "fin_funds_transfers"("tenant_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cash_flow_categories_tenant_code_unique" ON "fin_cash_flow_categories"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_bank_accounts_tenant_code_unique" ON "fin_bank_accounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_bank_statements_account_date_idx" ON "fin_bank_statements"("tenant_id", "bank_account_id", "statement_date");

-- CreateIndex
CREATE INDEX "fin_bank_statement_lines_match_idx" ON "fin_bank_statement_lines"("tenant_id", "match_status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_bank_statement_lines_external_unique" ON "fin_bank_statement_lines"("tenant_id", "statement_id", "external_id");

-- CreateIndex
CREATE INDEX "fin_bank_reconciliations_account_date_idx" ON "fin_bank_reconciliations"("tenant_id", "bank_account_id", "as_of_date");

-- CreateIndex
CREATE INDEX "fin_bank_reconciliation_matches_recon_idx" ON "fin_bank_reconciliation_matches"("tenant_id", "reconciliation_id");

-- CreateIndex
CREATE INDEX "fin_bank_matching_rules_account_idx" ON "fin_bank_matching_rules"("tenant_id", "bank_account_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cheque_books_scope_unique" ON "fin_cheque_books"("tenant_id", "bank_account_id", "book_number");

-- CreateIndex
CREATE INDEX "fin_cheques_status_maturity_idx" ON "fin_cheques"("tenant_id", "status_code", "maturity_date");

-- CreateIndex
CREATE INDEX "fin_cheques_account_number_idx" ON "fin_cheques"("tenant_id", "bank_account_id", "cheque_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_tax_authorities_tenant_code_unique" ON "fin_tax_authorities"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_tax_types_tenant_code_unique" ON "fin_tax_types"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_tax_codes_tenant_code_unique" ON "fin_tax_codes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_tax_code_rates_effective_unique" ON "fin_tax_code_rates"("tenant_id", "tax_code_id", "effective_from");

-- CreateIndex
CREATE INDEX "fin_tax_code_mappings_tax_rate_idx" ON "fin_tax_code_mappings"("tenant_id", "tax_rate_id");

-- CreateIndex
CREATE INDEX "fin_tax_code_mappings_tax_code_idx" ON "fin_tax_code_mappings"("tenant_id", "tax_code_id");

-- CreateIndex
CREATE INDEX "fin_tax_transactions_code_date_idx" ON "fin_tax_transactions"("tenant_id", "tax_code_id", "transaction_date");

-- CreateIndex
CREATE INDEX "fin_tax_transactions_return_idx" ON "fin_tax_transactions"("tenant_id", "tax_return_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_tax_returns_tenant_number_unique" ON "fin_tax_returns"("tenant_id", "return_number");

-- CreateIndex
CREATE INDEX "fin_tax_return_lines_return_idx" ON "fin_tax_return_lines"("tenant_id", "return_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_wht_certificates_tenant_number_unique" ON "fin_wht_certificates"("tenant_id", "certificate_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_currencies_tenant_code_unique" ON "fin_currencies"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_exchange_rates_tenant_date_idx" ON "fin_exchange_rates"("tenant_id", "rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "fin_exchange_rates_scope_unique" ON "fin_exchange_rates"("tenant_id", "from_currency_code", "to_currency_code", "rate_date", "rate_type");

-- CreateIndex
CREATE UNIQUE INDEX "fin_fx_revaluation_runs_tenant_number_unique" ON "fin_fx_revaluation_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE INDEX "fin_fx_revaluation_lines_run_idx" ON "fin_fx_revaluation_lines"("tenant_id", "run_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_cost_centers_tenant_code_unique" ON "fin_cost_centers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_projects_tenant_code_unique" ON "fin_projects"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_analysis_dimensions_tenant_code_unique" ON "fin_analysis_dimensions"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_analysis_dimension_values_scope_unique" ON "fin_analysis_dimension_values"("tenant_id", "dimension_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_journal_line_dimensions_unique" ON "fin_journal_line_dimensions"("journal_line_id", "dimension_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_budgets_scope_unique" ON "fin_budgets"("tenant_id", "fiscal_year_id", "code", "revision_number");

-- CreateIndex
CREATE INDEX "fin_budget_lines_account_period_idx" ON "fin_budget_lines"("tenant_id", "account_id", "fiscal_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_budget_lines_scope_unique" ON "fin_budget_lines"("budget_id", "account_id", "fiscal_period_id", "cost_center_id", "project_id");

-- CreateIndex
CREATE INDEX "fin_budget_revisions_budget_idx" ON "fin_budget_revisions"("tenant_id", "budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_budget_transfers_tenant_number_unique" ON "fin_budget_transfers"("tenant_id", "transfer_number");

-- CreateIndex
CREATE INDEX "fin_budget_control_policies_account_idx" ON "fin_budget_control_policies"("tenant_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_asset_categories_tenant_code_unique" ON "fin_asset_categories"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_depreciation_methods_tenant_code_unique" ON "fin_depreciation_methods"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_assets_tenant_category_idx" ON "fin_assets"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "fin_assets_tenant_status_idx" ON "fin_assets"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "fin_assets_tenant_number_unique" ON "fin_assets"("tenant_id", "asset_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_asset_depreciation_schedules_unique" ON "fin_asset_depreciation_schedules"("asset_id", "fiscal_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_depreciation_runs_tenant_number_unique" ON "fin_depreciation_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE INDEX "fin_asset_depreciation_entries_run_idx" ON "fin_asset_depreciation_entries"("tenant_id", "run_id");

-- CreateIndex
CREATE INDEX "fin_asset_depreciation_entries_asset_idx" ON "fin_asset_depreciation_entries"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "fin_asset_disposals_asset_idx" ON "fin_asset_disposals"("tenant_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_asset_disposals_tenant_number_unique" ON "fin_asset_disposals"("tenant_id", "disposal_number");

-- CreateIndex
CREATE INDEX "fin_asset_revaluations_asset_idx" ON "fin_asset_revaluations"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "fin_asset_transfers_asset_idx" ON "fin_asset_transfers"("tenant_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_close_task_templates_tenant_code_unique" ON "fin_close_task_templates"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_period_close_runs_period_idx" ON "fin_period_close_runs"("tenant_id", "fiscal_period_id");

-- CreateIndex
CREATE INDEX "fin_period_close_run_tasks_run_idx" ON "fin_period_close_run_tasks"("tenant_id", "close_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_year_close_runs_tenant_year_unique" ON "fin_year_close_runs"("tenant_id", "fiscal_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_opening_balance_batches_tenant_number_unique" ON "fin_opening_balance_batches"("tenant_id", "batch_number");

-- CreateIndex
CREATE INDEX "fin_opening_balance_lines_batch_idx" ON "fin_opening_balance_lines"("tenant_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_allocation_rules_tenant_code_unique" ON "fin_allocation_rules"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "fin_allocation_rule_targets_rule_idx" ON "fin_allocation_rule_targets"("tenant_id", "rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_allocation_runs_tenant_number_unique" ON "fin_allocation_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE UNIQUE INDEX "fin_settings_tenant_unique" ON "fin_settings"("tenant_id");

-- CreateIndex
CREATE INDEX "fin_posting_rules_event_idx" ON "fin_posting_rules"("tenant_id", "event_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fin_posting_rules_scope_unique" ON "fin_posting_rules"("tenant_id", "event_type", "priority");

-- CreateIndex
CREATE INDEX "fin_posting_rule_lines_rule_idx" ON "fin_posting_rule_lines"("rule_id");

-- CreateIndex
CREATE INDEX "fin_posting_queue_pending_idx" ON "fin_posting_queue"("tenant_id", "status_code", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "fin_posting_queue_source_unique" ON "fin_posting_queue"("tenant_id", "event_type", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_event_cursors_consumer_unique" ON "fin_event_cursors"("tenant_id", "consumer_name");

-- CreateIndex
CREATE UNIQUE INDEX "fin_payment_terms_tenant_code_unique" ON "fin_payment_terms"("tenant_id", "code");

-- AddForeignKey
ALTER TABLE "fin_account_classes" ADD CONSTRAINT "fin_account_classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_account_types" ADD CONSTRAINT "fin_account_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_account_types" ADD CONSTRAINT "fin_account_types_account_class_id_fkey" FOREIGN KEY ("account_class_id") REFERENCES "fin_account_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_accounts" ADD CONSTRAINT "fin_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_accounts" ADD CONSTRAINT "fin_accounts_parent_account_id_fkey" FOREIGN KEY ("parent_account_id") REFERENCES "fin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_accounts" ADD CONSTRAINT "fin_accounts_account_type_id_fkey" FOREIGN KEY ("account_type_id") REFERENCES "fin_account_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_account_mappings" ADD CONSTRAINT "fin_account_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_account_mappings" ADD CONSTRAINT "fin_account_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fiscal_years" ADD CONSTRAINT "fin_fiscal_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fiscal_periods" ADD CONSTRAINT "fin_fiscal_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fiscal_periods" ADD CONSTRAINT "fin_fiscal_periods_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fin_fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_period_module_locks" ADD CONSTRAINT "fin_period_module_locks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_period_module_locks" ADD CONSTRAINT "fin_period_module_locks_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fin_fiscal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_types" ADD CONSTRAINT "fin_journal_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_entries" ADD CONSTRAINT "fin_journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_entries" ADD CONSTRAINT "fin_journal_entries_journal_type_id_fkey" FOREIGN KEY ("journal_type_id") REFERENCES "fin_journal_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_entries" ADD CONSTRAINT "fin_journal_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fin_fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_entries" ADD CONSTRAINT "fin_journal_entries_reversal_of_entry_id_fkey" FOREIGN KEY ("reversal_of_entry_id") REFERENCES "fin_journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_lines" ADD CONSTRAINT "fin_journal_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_lines" ADD CONSTRAINT "fin_journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "fin_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_lines" ADD CONSTRAINT "fin_journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_templates" ADD CONSTRAINT "fin_journal_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_template_lines" ADD CONSTRAINT "fin_journal_template_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_template_lines" ADD CONSTRAINT "fin_journal_template_lines_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "fin_journal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurring_journal_schedules" ADD CONSTRAINT "fin_recurring_journal_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_recurring_journal_schedules" ADD CONSTRAINT "fin_recurring_journal_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "fin_journal_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_gl_balances" ADD CONSTRAINT "fin_gl_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_gl_balances" ADD CONSTRAINT "fin_gl_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "fin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_gl_balances" ADD CONSTRAINT "fin_gl_balances_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fin_fiscal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_customer_ledger_entries" ADD CONSTRAINT "fin_customer_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_customer_ledger_applications" ADD CONSTRAINT "fin_customer_ledger_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_customer_ledger_applications" ADD CONSTRAINT "fin_customer_ledger_applications_from_entry_id_fkey" FOREIGN KEY ("from_entry_id") REFERENCES "fin_customer_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_customer_ledger_applications" ADD CONSTRAINT "fin_customer_ledger_applications_to_entry_id_fkey" FOREIGN KEY ("to_entry_id") REFERENCES "fin_customer_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_ar_receipts" ADD CONSTRAINT "fin_ar_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_ar_receipt_allocations" ADD CONSTRAINT "fin_ar_receipt_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_ar_receipt_allocations" ADD CONSTRAINT "fin_ar_receipt_allocations_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "fin_ar_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_customer_financial_profiles" ADD CONSTRAINT "fin_customer_financial_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_dunning_levels" ADD CONSTRAINT "fin_dunning_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_dunning_runs" ADD CONSTRAINT "fin_dunning_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_dunning_run_entries" ADD CONSTRAINT "fin_dunning_run_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_dunning_run_entries" ADD CONSTRAINT "fin_dunning_run_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fin_dunning_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_vendor_ledger_entries" ADD CONSTRAINT "fin_vendor_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_vendor_ledger_applications" ADD CONSTRAINT "fin_vendor_ledger_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_vendor_ledger_applications" ADD CONSTRAINT "fin_vendor_ledger_applications_from_entry_id_fkey" FOREIGN KEY ("from_entry_id") REFERENCES "fin_vendor_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_vendor_ledger_applications" ADD CONSTRAINT "fin_vendor_ledger_applications_to_entry_id_fkey" FOREIGN KEY ("to_entry_id") REFERENCES "fin_vendor_ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_supplier_financial_profiles" ADD CONSTRAINT "fin_supplier_financial_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payment_runs" ADD CONSTRAINT "fin_payment_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payment_run_lines" ADD CONSTRAINT "fin_payment_run_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payment_run_lines" ADD CONSTRAINT "fin_payment_run_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fin_payment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cashboxes" ADD CONSTRAINT "fin_cashboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cash_transactions" ADD CONSTRAINT "fin_cash_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cash_transactions" ADD CONSTRAINT "fin_cash_transactions_cashbox_id_fkey" FOREIGN KEY ("cashbox_id") REFERENCES "fin_cashboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_funds_transfers" ADD CONSTRAINT "fin_funds_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cash_flow_categories" ADD CONSTRAINT "fin_cash_flow_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_accounts" ADD CONSTRAINT "fin_bank_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statements" ADD CONSTRAINT "fin_bank_statements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statements" ADD CONSTRAINT "fin_bank_statements_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statement_lines" ADD CONSTRAINT "fin_bank_statement_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_statement_lines" ADD CONSTRAINT "fin_bank_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "fin_bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_reconciliations" ADD CONSTRAINT "fin_bank_reconciliations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_reconciliations" ADD CONSTRAINT "fin_bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_reconciliation_matches" ADD CONSTRAINT "fin_bank_reconciliation_matches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_reconciliation_matches" ADD CONSTRAINT "fin_bank_reconciliation_matches_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "fin_bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_bank_matching_rules" ADD CONSTRAINT "fin_bank_matching_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheque_books" ADD CONSTRAINT "fin_cheque_books_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheque_books" ADD CONSTRAINT "fin_cheque_books_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fin_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheques" ADD CONSTRAINT "fin_cheques_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cheques" ADD CONSTRAINT "fin_cheques_cheque_book_id_fkey" FOREIGN KEY ("cheque_book_id") REFERENCES "fin_cheque_books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_authorities" ADD CONSTRAINT "fin_tax_authorities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_types" ADD CONSTRAINT "fin_tax_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_codes" ADD CONSTRAINT "fin_tax_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_code_rates" ADD CONSTRAINT "fin_tax_code_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_code_rates" ADD CONSTRAINT "fin_tax_code_rates_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "fin_tax_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_code_mappings" ADD CONSTRAINT "fin_tax_code_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_transactions" ADD CONSTRAINT "fin_tax_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_transactions" ADD CONSTRAINT "fin_tax_transactions_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "fin_tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_returns" ADD CONSTRAINT "fin_tax_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_return_lines" ADD CONSTRAINT "fin_tax_return_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_tax_return_lines" ADD CONSTRAINT "fin_tax_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "fin_tax_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_wht_certificates" ADD CONSTRAINT "fin_wht_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_currencies" ADD CONSTRAINT "fin_currencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_exchange_rates" ADD CONSTRAINT "fin_exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fx_revaluation_runs" ADD CONSTRAINT "fin_fx_revaluation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fx_revaluation_lines" ADD CONSTRAINT "fin_fx_revaluation_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_fx_revaluation_lines" ADD CONSTRAINT "fin_fx_revaluation_lines_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fin_fx_revaluation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cost_centers" ADD CONSTRAINT "fin_cost_centers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_cost_centers" ADD CONSTRAINT "fin_cost_centers_parent_cost_center_id_fkey" FOREIGN KEY ("parent_cost_center_id") REFERENCES "fin_cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_projects" ADD CONSTRAINT "fin_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_analysis_dimensions" ADD CONSTRAINT "fin_analysis_dimensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_analysis_dimension_values" ADD CONSTRAINT "fin_analysis_dimension_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_analysis_dimension_values" ADD CONSTRAINT "fin_analysis_dimension_values_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "fin_analysis_dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_line_dimensions" ADD CONSTRAINT "fin_journal_line_dimensions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_line_dimensions" ADD CONSTRAINT "fin_journal_line_dimensions_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "fin_journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_line_dimensions" ADD CONSTRAINT "fin_journal_line_dimensions_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "fin_analysis_dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_journal_line_dimensions" ADD CONSTRAINT "fin_journal_line_dimensions_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "fin_analysis_dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budgets" ADD CONSTRAINT "fin_budgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_lines" ADD CONSTRAINT "fin_budget_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_lines" ADD CONSTRAINT "fin_budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "fin_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_revisions" ADD CONSTRAINT "fin_budget_revisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_revisions" ADD CONSTRAINT "fin_budget_revisions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "fin_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_transfers" ADD CONSTRAINT "fin_budget_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_budget_control_policies" ADD CONSTRAINT "fin_budget_control_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_categories" ADD CONSTRAINT "fin_asset_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_depreciation_methods" ADD CONSTRAINT "fin_depreciation_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_assets" ADD CONSTRAINT "fin_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_assets" ADD CONSTRAINT "fin_assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "fin_asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_depreciation_schedules" ADD CONSTRAINT "fin_asset_depreciation_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_depreciation_schedules" ADD CONSTRAINT "fin_asset_depreciation_schedules_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fin_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_depreciation_runs" ADD CONSTRAINT "fin_depreciation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_depreciation_entries" ADD CONSTRAINT "fin_asset_depreciation_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_depreciation_entries" ADD CONSTRAINT "fin_asset_depreciation_entries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fin_depreciation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_disposals" ADD CONSTRAINT "fin_asset_disposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_revaluations" ADD CONSTRAINT "fin_asset_revaluations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_asset_transfers" ADD CONSTRAINT "fin_asset_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_close_task_templates" ADD CONSTRAINT "fin_close_task_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_period_close_runs" ADD CONSTRAINT "fin_period_close_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_period_close_run_tasks" ADD CONSTRAINT "fin_period_close_run_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_period_close_run_tasks" ADD CONSTRAINT "fin_period_close_run_tasks_close_run_id_fkey" FOREIGN KEY ("close_run_id") REFERENCES "fin_period_close_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_year_close_runs" ADD CONSTRAINT "fin_year_close_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_opening_balance_batches" ADD CONSTRAINT "fin_opening_balance_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_opening_balance_lines" ADD CONSTRAINT "fin_opening_balance_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_opening_balance_lines" ADD CONSTRAINT "fin_opening_balance_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "fin_opening_balance_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_allocation_rules" ADD CONSTRAINT "fin_allocation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_allocation_rule_targets" ADD CONSTRAINT "fin_allocation_rule_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_allocation_rule_targets" ADD CONSTRAINT "fin_allocation_rule_targets_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "fin_allocation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_allocation_runs" ADD CONSTRAINT "fin_allocation_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_settings" ADD CONSTRAINT "fin_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_posting_rules" ADD CONSTRAINT "fin_posting_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_posting_rule_lines" ADD CONSTRAINT "fin_posting_rule_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_posting_rule_lines" ADD CONSTRAINT "fin_posting_rule_lines_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "fin_posting_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_posting_queue" ADD CONSTRAINT "fin_posting_queue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_event_cursors" ADD CONSTRAINT "fin_event_cursors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fin_payment_terms" ADD CONSTRAINT "fin_payment_terms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ---------------------------------------------------------------------------
-- (5) Check constraints (data-integrity backstops the ORM cannot express)
-- ---------------------------------------------------------------------------
ALTER TABLE "fin_journal_lines"
  ADD CONSTRAINT "fin_journal_lines_debit_nonneg_check" CHECK ("debit_amount" >= 0 AND "base_debit_amount" >= 0),
  ADD CONSTRAINT "fin_journal_lines_credit_nonneg_check" CHECK ("credit_amount" >= 0 AND "base_credit_amount" >= 0),
  ADD CONSTRAINT "fin_journal_lines_single_side_check" CHECK (NOT ("debit_amount" > 0 AND "credit_amount" > 0)),
  ADD CONSTRAINT "fin_journal_lines_base_single_side_check" CHECK (NOT ("base_debit_amount" > 0 AND "base_credit_amount" > 0));

ALTER TABLE "fin_journal_entries"
  ADD CONSTRAINT "fin_journal_entries_totals_nonneg_check" CHECK ("total_base_debit" >= 0 AND "total_base_credit" >= 0);

ALTER TABLE "fin_fiscal_years"
  ADD CONSTRAINT "fin_fiscal_years_range_check" CHECK ("start_date" < "end_date");

ALTER TABLE "fin_fiscal_periods"
  ADD CONSTRAINT "fin_fiscal_periods_range_check" CHECK ("start_date" <= "end_date");

ALTER TABLE "fin_ar_receipt_allocations"
  ADD CONSTRAINT "fin_ar_receipt_allocations_target_check" CHECK (
    (CASE WHEN "sales_invoice_id" IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "pos_sale_id" IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "financial_note_id" IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN "customer_ledger_entry_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

ALTER TABLE "fin_funds_transfers"
  ADD CONSTRAINT "fin_funds_transfers_endpoints_check" CHECK (
    ("from_bank_account_id" IS NOT NULL OR "from_cashbox_id" IS NOT NULL)
    AND ("to_bank_account_id" IS NOT NULL OR "to_cashbox_id" IS NOT NULL)
  );

ALTER TABLE "fin_exchange_rates"
  ADD CONSTRAINT "fin_exchange_rates_positive_check" CHECK ("rate" > 0);

ALTER TABLE "fin_allocation_rule_targets"
  ADD CONSTRAINT "fin_allocation_rule_targets_pct_check" CHECK ("percentage" > 0 AND "percentage" <= 100);

ALTER TABLE "fin_posting_rule_lines"
  ADD CONSTRAINT "fin_posting_rule_lines_side_check" CHECK ("side" IN ('debit', 'credit')),
  ADD CONSTRAINT "fin_posting_rule_lines_source_check" CHECK ("account_source" IN ('fixed', 'mapping', 'settings_default'));

-- ---------------------------------------------------------------------------
-- (6) Posting-engine idempotency: one posted, non-reversal journal entry per
--     (source doc, event). Reversal entries and reversed originals are exempt
--     so a corrected re-post can claim the slot again.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "fin_journal_entries_source_unique"
  ON "fin_journal_entries" ("tenant_id", "source_doc_type", "source_doc_id", "source_event_type")
  WHERE "status_code" = 'posted' AND "reversal_of_entry_id" IS NULL AND "source_doc_id" IS NOT NULL;

-- Append-heavy ledger: BRIN keeps time-range scans cheap at scale.
CREATE INDEX "fin_journal_lines_created_brin" ON "fin_journal_lines" USING BRIN ("created_at");

-- ---------------------------------------------------------------------------
-- (7) Functions + deferred constraint trigger (DB backstop for double-entry)
-- ---------------------------------------------------------------------------

-- Shared balance assertion. Only posted entries are validated so drafts can be
-- edited freely; the app-level assertBalanced() remains the primary guard.
CREATE OR REPLACE FUNCTION fin_check_entry_balanced(p_entry_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $fn$
DECLARE
  v_status TEXT;
  v_header_debit NUMERIC;
  v_header_credit NUMERIC;
  v_debit NUMERIC;
  v_credit NUMERIC;
BEGIN
  SELECT status_code, total_base_debit, total_base_credit
    INTO v_status, v_header_debit, v_header_credit
    FROM fin_journal_entries WHERE id = p_entry_id;

  IF v_status IS NULL OR v_status <> 'posted' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(base_debit_amount), 0), COALESCE(SUM(base_credit_amount), 0)
    INTO v_debit, v_credit
    FROM fin_journal_lines WHERE entry_id = p_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'fin_journal_entries %: unbalanced entry (base debit % <> base credit %)',
      p_entry_id, v_debit, v_credit;
  END IF;

  IF v_header_debit <> v_debit OR v_header_credit <> v_credit THEN
    RAISE EXCEPTION 'fin_journal_entries %: header totals (% / %) do not match lines (% / %)',
      p_entry_id, v_header_debit, v_header_credit, v_debit, v_credit;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION fin_journal_lines_balance_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM fin_check_entry_balanced(COALESCE(NEW.entry_id, OLD.entry_id));
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION fin_journal_entries_balance_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM fin_check_entry_balanced(NEW.id);
  RETURN NULL;
END;
$fn$;

-- Deferred to commit so multi-statement posting transactions can insert the
-- header, then the lines, then flip the status without tripping mid-flight.
CREATE CONSTRAINT TRIGGER fin_journal_lines_balance_ct
  AFTER INSERT OR UPDATE OR DELETE ON "fin_journal_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fin_journal_lines_balance_trigger();

CREATE CONSTRAINT TRIGGER fin_journal_entries_balance_ct
  AFTER INSERT OR UPDATE ON "fin_journal_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fin_journal_entries_balance_trigger();

-- Repair/rebuild: recompute the period movement columns of fin_gl_balances for
-- one tenant + fiscal year from posted journal lines. Opening columns are
-- rolled forward by the period-close job, not here.
CREATE OR REPLACE FUNCTION fin_rebuild_gl_balances(p_tenant_id UUID, p_fiscal_year_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $fn$
BEGIN
  DELETE FROM fin_gl_balances b
  USING fin_fiscal_periods p
  WHERE b.fiscal_period_id = p.id
    AND b.tenant_id = p_tenant_id
    AND p.tenant_id = p_tenant_id
    AND p.fiscal_year_id = p_fiscal_year_id;

  INSERT INTO fin_gl_balances (
    id, tenant_id, account_id, fiscal_period_id, currency_code,
    period_debit, period_credit, base_period_debit, base_period_credit,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(), l.tenant_id, l.account_id, e.fiscal_period_id, l.currency_code,
    SUM(l.debit_amount), SUM(l.credit_amount),
    SUM(l.base_debit_amount), SUM(l.base_credit_amount),
    now(), now()
  FROM fin_journal_lines l
  JOIN fin_journal_entries e ON e.id = l.entry_id
  JOIN fin_fiscal_periods p ON p.id = e.fiscal_period_id
  WHERE l.tenant_id = p_tenant_id
    AND p.fiscal_year_id = p_fiscal_year_id
    AND e.status_code = 'posted'
  GROUP BY l.tenant_id, l.account_id, e.fiscal_period_id, l.currency_code;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- (8) Row Level Security (defense-in-depth, same posture as the pod_ layer:
--     ENABLE not FORCE — the migration/pooled owner role bypasses policies and
--     app-level guards stay the primary boundary; non-owner roles are scoped
--     by the app.current_tenant_id GUC. Global rows (tenant_id IS NULL) stay
--     readable to everyone.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fin_account_classes','fin_account_types','fin_accounts','fin_account_mappings',
    'fin_fiscal_years','fin_fiscal_periods','fin_period_module_locks',
    'fin_journal_types','fin_journal_entries','fin_journal_lines',
    'fin_journal_templates','fin_journal_template_lines','fin_recurring_journal_schedules','fin_gl_balances',
    'fin_customer_ledger_entries','fin_customer_ledger_applications','fin_ar_receipts','fin_ar_receipt_allocations',
    'fin_customer_financial_profiles','fin_dunning_levels','fin_dunning_runs','fin_dunning_run_entries',
    'fin_vendor_ledger_entries','fin_vendor_ledger_applications','fin_supplier_financial_profiles',
    'fin_payment_runs','fin_payment_run_lines',
    'fin_cashboxes','fin_cash_transactions','fin_funds_transfers','fin_cash_flow_categories',
    'fin_bank_accounts','fin_bank_statements','fin_bank_statement_lines',
    'fin_bank_reconciliations','fin_bank_reconciliation_matches','fin_bank_matching_rules',
    'fin_cheque_books','fin_cheques',
    'fin_tax_authorities','fin_tax_types','fin_tax_codes','fin_tax_code_rates','fin_tax_code_mappings',
    'fin_tax_transactions','fin_tax_returns','fin_tax_return_lines','fin_wht_certificates',
    'fin_currencies','fin_exchange_rates','fin_fx_revaluation_runs','fin_fx_revaluation_lines',
    'fin_cost_centers','fin_projects','fin_analysis_dimensions','fin_analysis_dimension_values','fin_journal_line_dimensions',
    'fin_budgets','fin_budget_lines','fin_budget_revisions','fin_budget_transfers','fin_budget_control_policies',
    'fin_asset_categories','fin_depreciation_methods','fin_assets','fin_asset_depreciation_schedules',
    'fin_depreciation_runs','fin_asset_depreciation_entries','fin_asset_disposals','fin_asset_revaluations','fin_asset_transfers',
    'fin_close_task_templates','fin_period_close_runs','fin_period_close_run_tasks','fin_year_close_runs',
    'fin_opening_balance_batches','fin_opening_balance_lines',
    'fin_allocation_rules','fin_allocation_rule_targets','fin_allocation_runs',
    'fin_settings','fin_posting_rules','fin_posting_rule_lines','fin_posting_queue','fin_event_cursors','fin_payment_terms'
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
-- (8b) updated_at defaults. Prisma's `@updatedAt` sets updated_at at runtime,
--      not via a DB default, so raw seed INSERTs below (which omit the column)
--      would violate NOT NULL. Give every fin_ updated_at column a
--      CURRENT_TIMESTAMP default — matching how the pod_ layer's migration was
--      generated. Harmless drift: the ORM still overwrites it on every update.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
      AND table_name LIKE 'fin\_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- (9) Seed data — global (tenant_id NULL) lookups. Tenants may add their own
--     rows to override. Tenant-specific bootstrap (default COA, fiscal year,
--     fin_settings) is created by initializeTenantFinance() at runtime.
-- ---------------------------------------------------------------------------

INSERT INTO "fin_account_classes" ("id","tenant_id","code","name","name_ar","normal_balance_side","display_order") VALUES
  (gen_random_uuid(), NULL, 'asset',     'Assets',      'الأصول',            'debit',  10),
  (gen_random_uuid(), NULL, 'liability', 'Liabilities', 'الالتزامات',        'credit', 20),
  (gen_random_uuid(), NULL, 'equity',    'Equity',      'حقوق الملكية',      'credit', 30),
  (gen_random_uuid(), NULL, 'revenue',   'Revenue',     'الإيرادات',         'credit', 40),
  (gen_random_uuid(), NULL, 'expense',   'Expenses',    'المصروفات',         'debit',  50);

INSERT INTO "fin_account_types" ("id","tenant_id","account_class_id","code","name","name_ar","is_control_type","control_domain","cash_flow_section","display_order") VALUES
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'cash', 'Cash on Hand', 'نقدية بالصندوق', false, 'cash', 'operating', 10),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'bank', 'Bank', 'حسابات بنكية', false, 'bank', 'operating', 20),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'ar_control', 'Accounts Receivable', 'ذمم العملاء', true, 'ar', 'operating', 30),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'inventory', 'Inventory', 'المخزون', true, 'inventory', 'operating', 40),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'prepaid_expense', 'Prepaid Expenses', 'مصروفات مدفوعة مقدماً', false, NULL, 'operating', 50),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'wip', 'Work In Progress', 'إنتاج تحت التشغيل', false, 'inventory', 'operating', 60),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'fixed_asset', 'Fixed Assets', 'الأصول الثابتة', false, NULL, 'investing', 70),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'accumulated_depreciation', 'Accumulated Depreciation', 'مجمع الإهلاك', false, NULL, 'investing', 80),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='asset'), 'other_asset', 'Other Assets', 'أصول أخرى', false, NULL, NULL, 90),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'ap_control', 'Accounts Payable', 'ذمم الموردين', true, 'ap', 'operating', 100),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'grni', 'Goods Received Not Invoiced', 'بضاعة مستلمة لم تصل فاتورتها', true, 'ap', 'operating', 110),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'tax_payable', 'Tax Payable', 'ضرائب مستحقة', true, 'tax', 'operating', 120),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'wht_payable', 'Withholding Tax Payable', 'ضريبة خصم من المنبع', true, 'tax', 'operating', 130),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'accrued_liability', 'Accrued Liabilities', 'التزامات مستحقة', false, NULL, 'operating', 140),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'gift_card_liability', 'Gift Card Liability', 'التزامات بطاقات الهدايا', false, NULL, 'operating', 150),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'loyalty_liability', 'Loyalty Liability', 'التزامات نقاط الولاء', false, NULL, 'operating', 160),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='liability'), 'long_term_liability', 'Long-term Liabilities', 'التزامات طويلة الأجل', false, NULL, 'financing', 170),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='equity'), 'capital', 'Capital', 'رأس المال', false, NULL, 'financing', 180),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='equity'), 'retained_earnings', 'Retained Earnings', 'الأرباح المحتجزة', false, NULL, NULL, 190),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='revenue'), 'sales_revenue', 'Sales Revenue', 'إيرادات المبيعات', false, NULL, 'operating', 200),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='revenue'), 'service_revenue', 'Service Revenue', 'إيرادات الخدمات', false, NULL, 'operating', 210),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='revenue'), 'sales_returns', 'Sales Returns (Contra)', 'مردودات المبيعات', false, NULL, 'operating', 220),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='revenue'), 'other_income', 'Other Income', 'إيرادات أخرى', false, NULL, 'operating', 230),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='revenue'), 'fx_gain', 'FX Gain', 'أرباح فروق العملة', false, NULL, 'operating', 240),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'cogs', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة', false, NULL, 'operating', 250),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'operating_expense', 'Operating Expenses', 'مصروفات تشغيلية', false, NULL, 'operating', 260),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'payroll_expense', 'Payroll Expenses', 'مصروفات الرواتب', false, NULL, 'operating', 270),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'depreciation_expense', 'Depreciation Expense', 'مصروف الإهلاك', false, NULL, 'operating', 280),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'sales_discount', 'Sales Discounts', 'خصومات المبيعات', false, NULL, 'operating', 290),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'fx_loss', 'FX Loss', 'خسائر فروق العملة', false, NULL, 'operating', 300),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'bank_charges', 'Bank Charges', 'مصروفات بنكية', false, NULL, 'operating', 310),
  (gen_random_uuid(), NULL, (SELECT id FROM fin_account_classes WHERE tenant_id IS NULL AND code='expense'), 'write_off', 'Write-offs', 'إعدامات وشطب', false, NULL, 'operating', 320);

INSERT INTO "fin_journal_types" ("id","tenant_id","code","name","name_ar","document_type","default_prefix","sort_order") VALUES
  (gen_random_uuid(), NULL, 'general',            'General Journal',        'قيود عامة',            'journal_entry',   'JV',   10),
  (gen_random_uuid(), NULL, 'sales',              'Sales Journal',          'يومية المبيعات',       'journal_entry',   'SJV',  20),
  (gen_random_uuid(), NULL, 'purchases',          'Purchases Journal',      'يومية المشتريات',      'journal_entry',   'PJV',  30),
  (gen_random_uuid(), NULL, 'cash_receipts',      'Cash Receipts Journal',  'يومية المقبوضات',      'journal_entry',   'CRJ',  40),
  (gen_random_uuid(), NULL, 'cash_disbursements', 'Cash Disbursements',     'يومية المدفوعات',      'journal_entry',   'CDJ',  50),
  (gen_random_uuid(), NULL, 'bank',               'Bank Journal',           'يومية البنك',          'journal_entry',   'BJV',  60),
  (gen_random_uuid(), NULL, 'inventory',          'Inventory Journal',      'يومية المخزون',        'journal_entry',   'IJV',  70),
  (gen_random_uuid(), NULL, 'payroll',            'Payroll Journal',        'يومية الرواتب',        'journal_entry',   'PYJ',  80),
  (gen_random_uuid(), NULL, 'opening',            'Opening Balances',       'قيود افتتاحية',        'opening_balance', 'OB',   90),
  (gen_random_uuid(), NULL, 'closing',            'Closing Entries',        'قيود الإقفال',         'journal_entry',   'CLJ', 100),
  (gen_random_uuid(), NULL, 'adjustment',         'Adjustments',            'قيود تسوية',           'journal_entry',   'AJV', 110),
  (gen_random_uuid(), NULL, 'fx_reval',           'FX Revaluation',         'إعادة تقييم العملات',  'fx_revaluation',  'FXR', 120),
  (gen_random_uuid(), NULL, 'depreciation',       'Depreciation',           'قيود الإهلاك',         'depreciation_run','DEP', 130),
  (gen_random_uuid(), NULL, 'allocation',         'Allocations',            'قيود التحميل',         'allocation_run',  'ALC', 140),
  (gen_random_uuid(), NULL, 'tax',                'Tax Journal',            'يومية الضرائب',        'journal_entry',   'TXJ', 150);

INSERT INTO "fin_depreciation_methods" ("id","tenant_id","code","name","name_ar","calculation_strategy") VALUES
  (gen_random_uuid(), NULL, 'straight_line',       'Straight Line',          'القسط الثابت',          'straight_line'),
  (gen_random_uuid(), NULL, 'declining_balance',   'Declining Balance',      'القسط المتناقص',        'declining_balance'),
  (gen_random_uuid(), NULL, 'double_declining',    'Double Declining',       'القسط المتناقص المضاعف','double_declining'),
  (gen_random_uuid(), NULL, 'units_of_production', 'Units of Production',    'وحدات الإنتاج',         'units_of_production'),
  (gen_random_uuid(), NULL, 'none',                'No Depreciation',        'بدون إهلاك',            'none');

INSERT INTO "fin_cash_flow_categories" ("id","tenant_id","code","section","name","name_ar","sort_order") VALUES
  (gen_random_uuid(), NULL, 'operating_receipts',    'operating', 'Operating Receipts',        'متحصلات تشغيلية',      10),
  (gen_random_uuid(), NULL, 'operating_payments',    'operating', 'Operating Payments',        'مدفوعات تشغيلية',      20),
  (gen_random_uuid(), NULL, 'investing_acquisition', 'investing', 'Asset Acquisitions',        'شراء أصول',            30),
  (gen_random_uuid(), NULL, 'investing_disposal',    'investing', 'Asset Disposals',           'استبعاد أصول',         40),
  (gen_random_uuid(), NULL, 'financing_borrowing',   'financing', 'Borrowings',                'اقتراض',               50),
  (gen_random_uuid(), NULL, 'financing_repayment',   'financing', 'Loan Repayments',           'سداد قروض',            60),
  (gen_random_uuid(), NULL, 'financing_equity',      'financing', 'Equity Movements',          'حركات حقوق الملكية',   70),
  (gen_random_uuid(), NULL, 'fx_effect',             'operating', 'Effect of Exchange Rates',  'أثر فروق العملة',      80);

INSERT INTO "fin_tax_types" ("id","tenant_id","code","name","name_ar","direction") VALUES
  (gen_random_uuid(), NULL, 'vat',         'Value Added Tax', 'ضريبة القيمة المضافة', 'both'),
  (gen_random_uuid(), NULL, 'sales_tax',   'Sales Tax',       'ضريبة المبيعات',       'output'),
  (gen_random_uuid(), NULL, 'withholding', 'Withholding Tax', 'ضريبة الخصم من المنبع','both'),
  (gen_random_uuid(), NULL, 'excise',      'Excise Tax',      'الضريبة الانتقائية',   'both');

INSERT INTO "fin_payment_terms" ("id","tenant_id","code","name","name_ar","due_days","discount_days","discount_rate","is_end_of_month") VALUES
  (gen_random_uuid(), NULL, 'immediate', 'Due Immediately', 'استحقاق فوري',      0,  NULL, NULL,  false),
  (gen_random_uuid(), NULL, 'net_7',     'Net 7',           'صافي ٧ أيام',       7,  NULL, NULL,  false),
  (gen_random_uuid(), NULL, 'net_15',    'Net 15',          'صافي ١٥ يوماً',    15,  NULL, NULL,  false),
  (gen_random_uuid(), NULL, 'net_30',    'Net 30',          'صافي ٣٠ يوماً',    30,  NULL, NULL,  false),
  (gen_random_uuid(), NULL, '2_10_net_30','2/10 Net 30',    'خصم ٢٪ خلال ١٠ أيام', 30, 10, 2.0,  false),
  (gen_random_uuid(), NULL, 'eom',       'End of Month',    'نهاية الشهر',       0,  NULL, NULL,  true);

INSERT INTO "fin_dunning_levels" ("id","tenant_id","level_number","name","name_ar","days_overdue","block_sales") VALUES
  (gen_random_uuid(), NULL, 1, 'Friendly Reminder', 'تذكير ودي',        7,  false),
  (gen_random_uuid(), NULL, 2, 'Second Notice',     'إشعار ثانٍ',       30, false),
  (gen_random_uuid(), NULL, 3, 'Final Notice',      'إنذار نهائي',      60, true);

INSERT INTO "fin_close_task_templates" ("id","tenant_id","code","name","name_ar","module_code","sequence","is_required") VALUES
  (gen_random_uuid(), NULL, 'ap_reconciled',        'AP subledger reconciled to control',  'مطابقة ذمم الموردين',      'ap',        10, true),
  (gen_random_uuid(), NULL, 'ar_reconciled',        'AR subledger reconciled to control',  'مطابقة ذمم العملاء',       'ar',        20, true),
  (gen_random_uuid(), NULL, 'bank_reconciled',      'Bank accounts reconciled',            'مطابقة الحسابات البنكية',  'bank',      30, true),
  (gen_random_uuid(), NULL, 'inventory_valuated',   'Inventory valuation posted',          'ترحيل تقييم المخزون',      'inventory', 40, true),
  (gen_random_uuid(), NULL, 'depreciation_posted',  'Depreciation posted',                 'ترحيل الإهلاك',            'asset',     50, true),
  (gen_random_uuid(), NULL, 'fx_revalued',          'FX revaluation posted',               'إعادة تقييم العملات',      'gl',        60, false),
  (gen_random_uuid(), NULL, 'accruals_posted',      'Accruals and adjustments posted',     'ترحيل الاستحقاقات',        'gl',        70, true),
  (gen_random_uuid(), NULL, 'tax_finalized',        'Tax transactions finalized',          'اعتماد حركات الضرائب',     'tax',       80, true);

INSERT INTO "fin_currencies" ("id","tenant_id","code","name","name_ar","symbol","decimal_places") VALUES
  (gen_random_uuid(), NULL, 'USD', 'US Dollar',          'دولار أمريكي',   '$',    2),
  (gen_random_uuid(), NULL, 'EUR', 'Euro',               'يورو',           '€',    2),
  (gen_random_uuid(), NULL, 'GBP', 'Pound Sterling',     'جنيه إسترليني',  '£',    2),
  (gen_random_uuid(), NULL, 'EGP', 'Egyptian Pound',     'جنيه مصري',      'ج.م',  2),
  (gen_random_uuid(), NULL, 'SAR', 'Saudi Riyal',        'ريال سعودي',     'ر.س',  2),
  (gen_random_uuid(), NULL, 'AED', 'UAE Dirham',         'درهم إماراتي',   'د.إ',  2),
  (gen_random_uuid(), NULL, 'QAR', 'Qatari Riyal',       'ريال قطري',      'ر.ق',  2),
  (gen_random_uuid(), NULL, 'KWD', 'Kuwaiti Dinar',      'دينار كويتي',    'د.ك',  3),
  (gen_random_uuid(), NULL, 'BHD', 'Bahraini Dinar',     'دينار بحريني',   'د.ب',  3),
  (gen_random_uuid(), NULL, 'OMR', 'Omani Rial',         'ريال عماني',     'ر.ع',  3),
  (gen_random_uuid(), NULL, 'JOD', 'Jordanian Dinar',    'دينار أردني',    'د.أ',  3),
  (gen_random_uuid(), NULL, 'TRY', 'Turkish Lira',       'ليرة تركية',     '₺',    2),
  (gen_random_uuid(), NULL, 'JPY', 'Japanese Yen',       'ين ياباني',      '¥',    0),
  (gen_random_uuid(), NULL, 'CNY', 'Chinese Yuan',       'يوان صيني',      '¥',    2),
  (gen_random_uuid(), NULL, 'INR', 'Indian Rupee',       'روبية هندية',    '₹',    2);

-- Status registry rows for fin entity types (shared pod_ status engine).
INSERT INTO "pod_document_statuses" ("id","tenant_id","entity_type","code","name","sort_order","is_initial","is_terminal") VALUES
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'draft',    'Draft',    10, true,  false),
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'posted',   'Posted',   20, false, false),
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'reversed', 'Reversed', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'cancelled','Cancelled',40, false, true),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'open',    'Open',    10, true,  false),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'closing', 'Closing', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'closed',  'Closed',  30, false, true),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'future', 'Future', 10, true,  false),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'open',   'Open',   20, false, false),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'closed', 'Closed', 30, false, false),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'locked', 'Locked', 40, false, true),
  (gen_random_uuid(), NULL, 'fin_ar_receipt', 'draft',  'Draft',  10, true,  false),
  (gen_random_uuid(), NULL, 'fin_ar_receipt', 'posted', 'Posted', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_ar_receipt', 'voided', 'Voided', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'draft',    'Draft',    10, true,  false),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'proposed', 'Proposed', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'approved', 'Approved', 30, false, false),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'executed', 'Executed', 40, false, true),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'cancelled','Cancelled',50, false, true),
  (gen_random_uuid(), NULL, 'fin_cash_transaction', 'draft',  'Draft',  10, true,  false),
  (gen_random_uuid(), NULL, 'fin_cash_transaction', 'posted', 'Posted', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_cash_transaction', 'voided', 'Voided', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'draft',      'Draft',      10, true,  false),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'in_transit', 'In Transit', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'completed',  'Completed',  30, false, true),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'cancelled',  'Cancelled',  40, false, true),
  (gen_random_uuid(), NULL, 'fin_bank_reconciliation', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_bank_reconciliation', 'completed', 'Completed', 20, false, true),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'draft',   'Draft',   10, true,  false),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'filed',   'Filed',   20, false, false),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'paid',    'Paid',    30, false, true),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'amended', 'Amended', 40, false, true),
  (gen_random_uuid(), NULL, 'fin_asset', 'draft',             'Draft',             10, true,  false),
  (gen_random_uuid(), NULL, 'fin_asset', 'active',            'Active',            20, false, false),
  (gen_random_uuid(), NULL, 'fin_asset', 'fully_depreciated', 'Fully Depreciated', 30, false, false),
  (gen_random_uuid(), NULL, 'fin_asset', 'disposed',          'Disposed',          40, false, true),
  (gen_random_uuid(), NULL, 'fin_asset', 'written_off',       'Written Off',       50, false, true),
  (gen_random_uuid(), NULL, 'fin_budget', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_budget', 'submitted', 'Submitted', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_budget', 'approved',  'Approved',  30, false, false),
  (gen_random_uuid(), NULL, 'fin_budget', 'active',    'Active',    40, false, false),
  (gen_random_uuid(), NULL, 'fin_budget', 'closed',    'Closed',    50, false, true),
  (gen_random_uuid(), NULL, 'fin_depreciation_run', 'draft',    'Draft',    10, true,  false),
  (gen_random_uuid(), NULL, 'fin_depreciation_run', 'posted',   'Posted',   20, false, false),
  (gen_random_uuid(), NULL, 'fin_depreciation_run', 'reversed', 'Reversed', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_fx_revaluation_run', 'draft',    'Draft',    10, true,  false),
  (gen_random_uuid(), NULL, 'fin_fx_revaluation_run', 'posted',   'Posted',   20, false, false),
  (gen_random_uuid(), NULL, 'fin_fx_revaluation_run', 'reversed', 'Reversed', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'validated', 'Validated', 20, false, false),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'posted',    'Posted',    30, false, true),
  (gen_random_uuid(), NULL, 'fin_allocation_run', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_allocation_run', 'posted',    'Posted',    20, false, false),
  (gen_random_uuid(), NULL, 'fin_allocation_run', 'cancelled', 'Cancelled', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_dunning_run', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_dunning_run', 'executed',  'Executed',  20, false, true),
  (gen_random_uuid(), NULL, 'fin_dunning_run', 'cancelled', 'Cancelled', 30, false, true),
  (gen_random_uuid(), NULL, 'fin_cheque', 'draft',     'Draft',     10, true,  false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'issued',    'Issued',    20, false, false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'received',  'Received',  30, false, false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'deposited', 'Deposited', 40, false, false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'presented', 'Presented', 50, false, false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'cleared',   'Cleared',   60, false, true),
  (gen_random_uuid(), NULL, 'fin_cheque', 'bounced',   'Bounced',   70, false, false),
  (gen_random_uuid(), NULL, 'fin_cheque', 'replaced',  'Replaced',  80, false, true),
  (gen_random_uuid(), NULL, 'fin_cheque', 'cancelled', 'Cancelled', 90, false, true);

INSERT INTO "pod_status_transitions" ("id","tenant_id","entity_type","from_code","to_code") VALUES
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_journal_entry', 'posted', 'reversed'),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'open', 'closing'),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'closing', 'closed'),
  (gen_random_uuid(), NULL, 'fin_fiscal_year', 'closing', 'open'),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'future', 'open'),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'open', 'closed'),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'closed', 'open'),
  (gen_random_uuid(), NULL, 'fin_fiscal_period', 'closed', 'locked'),
  (gen_random_uuid(), NULL, 'fin_ar_receipt', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_ar_receipt', 'posted', 'voided'),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'draft', 'proposed'),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'proposed', 'approved'),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'approved', 'executed'),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_payment_run', 'proposed', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_cash_transaction', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_cash_transaction', 'posted', 'voided'),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'draft', 'in_transit'),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'draft', 'completed'),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'in_transit', 'completed'),
  (gen_random_uuid(), NULL, 'fin_funds_transfer', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_bank_reconciliation', 'draft', 'completed'),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'draft', 'filed'),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'filed', 'paid'),
  (gen_random_uuid(), NULL, 'fin_tax_return', 'filed', 'amended'),
  (gen_random_uuid(), NULL, 'fin_asset', 'draft', 'active'),
  (gen_random_uuid(), NULL, 'fin_asset', 'active', 'fully_depreciated'),
  (gen_random_uuid(), NULL, 'fin_asset', 'active', 'disposed'),
  (gen_random_uuid(), NULL, 'fin_asset', 'active', 'written_off'),
  (gen_random_uuid(), NULL, 'fin_asset', 'fully_depreciated', 'disposed'),
  (gen_random_uuid(), NULL, 'fin_asset', 'fully_depreciated', 'written_off'),
  (gen_random_uuid(), NULL, 'fin_budget', 'draft', 'submitted'),
  (gen_random_uuid(), NULL, 'fin_budget', 'submitted', 'approved'),
  (gen_random_uuid(), NULL, 'fin_budget', 'submitted', 'draft'),
  (gen_random_uuid(), NULL, 'fin_budget', 'approved', 'active'),
  (gen_random_uuid(), NULL, 'fin_budget', 'active', 'closed'),
  (gen_random_uuid(), NULL, 'fin_depreciation_run', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_depreciation_run', 'posted', 'reversed'),
  (gen_random_uuid(), NULL, 'fin_fx_revaluation_run', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_fx_revaluation_run', 'posted', 'reversed'),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'draft', 'validated'),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'validated', 'posted'),
  (gen_random_uuid(), NULL, 'fin_opening_balance_batch', 'validated', 'draft'),
  (gen_random_uuid(), NULL, 'fin_allocation_run', 'draft', 'posted'),
  (gen_random_uuid(), NULL, 'fin_allocation_run', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_dunning_run', 'draft', 'executed'),
  (gen_random_uuid(), NULL, 'fin_dunning_run', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'draft', 'issued'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'draft', 'received'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'received', 'deposited'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'issued', 'presented'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'deposited', 'presented'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'presented', 'cleared'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'presented', 'bounced'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'bounced', 'replaced'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'bounced', 'presented'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'draft', 'cancelled'),
  (gen_random_uuid(), NULL, 'fin_cheque', 'issued', 'cancelled');

-- Default posting rules (system rows, tenant_id NULL). Account resolution:
-- 'settings_default' reads the named column on the tenant's fin_settings row;
-- 'mapping' walks fin_account_mappings most-specific-first. Inventory movement
-- rules ship with the Phase 2 adapter.
WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'supplier_invoice.posted', 'pod_supplier_invoice', 'purchases', 'AP invoice: GRNI + input tax vs AP control', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'grni',       'debit',  'settings_default', NULL::text, NULL::text, 'grniAccountId',            'net_total'),
  (20, 'tax_input',  'debit',  'mapping',          'tax_code', 'tax_input', NULL::text,               'tax_total'),
  (30, 'ap_control', 'credit', 'settings_default', NULL,       NULL,       'defaultApControlAccountId','gross_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'supplier_payment.posted', 'pod_supplier_payment', 'cash_disbursements', 'AP payment: AP control vs bank clearing', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'ap_control',    'debit',  'settings_default', NULL::text, NULL::text, 'defaultApControlAccountId', 'gross_total'),
  (20, 'bank_clearing', 'credit', 'settings_default', NULL,       NULL,       'bankClearingAccountId',     'gross_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'sales_invoice.issued', 'sales_invoice', 'sales', 'Sales invoice: AR control vs revenue + output tax', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'ar_control',    'debit',  'settings_default', NULL::text, NULL::text, 'defaultArControlAccountId', 'gross_total'),
  (20, 'sales_revenue', 'credit', 'settings_default', NULL,       NULL,       'salesRevenueAccountId',     'net_total'),
  (30, 'tax_output',    'credit', 'mapping',          'tax_code', 'tax_output', NULL::text,                'tax_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'pos_sale.completed', 'pos_sale', 'sales', 'POS sale: settlement vs revenue + output tax + discounts', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'settlement',     'debit',  'mapping',          'payment_method', 'settlement', NULL::text,             'paid_total'),
  (20, 'sales_discount', 'debit',  'settings_default', NULL::text,       NULL::text,   'salesDiscountAccountId','discount_total'),
  (30, 'sales_revenue',  'credit', 'settings_default', NULL,             NULL,         'salesRevenueAccountId', 'net_total'),
  (40, 'tax_output',     'credit', 'mapping',          'tax_code',       'tax_output', NULL::text,             'tax_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'restaurant_order.completed', 'res_order', 'sales', 'Restaurant order: settlement vs revenue + charges + output tax', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'settlement',      'debit',  'mapping',          'payment_method', 'settlement',      NULL::text,              'paid_total'),
  (20, 'sales_discount',  'debit',  'settings_default', NULL::text,       NULL::text,        'salesDiscountAccountId', 'discount_total'),
  (30, 'sales_revenue',   'credit', 'settings_default', NULL,             NULL,              'salesRevenueAccountId',  'net_total'),
  (40, 'service_charge',  'credit', 'mapping',          'res_charge',     'service_charge',  NULL::text,              'service_charge_total'),
  (50, 'tips_payable',    'credit', 'mapping',          'res_charge',     'tips_payable',    NULL::text,              'tip_total'),
  (60, 'tax_output',      'credit', 'mapping',          'tax_code',       'tax_output',      NULL::text,              'tax_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

WITH r AS (
  INSERT INTO "fin_posting_rules" ("id","tenant_id","event_type","source_doc_type","journal_type_code","description","priority")
  VALUES (gen_random_uuid(), NULL, 'sales_return.credited', 'sales_return', 'sales', 'Sales return: revenue reversal vs AR control', 100)
  RETURNING id
)
INSERT INTO "fin_posting_rule_lines" ("id","tenant_id","rule_id","line_number","line_role","side","account_source","mapping_entity_type","mapping_role","settings_field","amount_selector","multiplier")
SELECT gen_random_uuid(), NULL, r.id, v.line_number, v.line_role, v.side, v.account_source, v.mapping_entity_type, v.mapping_role, v.settings_field, v.amount_selector, 1
FROM r, (VALUES
  (10, 'sales_returns', 'debit',  'settings_default', NULL::text, NULL::text, 'salesRevenueAccountId',     'net_total'),
  (20, 'tax_output',    'debit',  'mapping',          'tax_code', 'tax_output', NULL::text,                'tax_total'),
  (30, 'ar_control',    'credit', 'settings_default', NULL,       NULL,       'defaultArControlAccountId', 'gross_total')
) AS v(line_number, line_role, side, account_source, mapping_entity_type, mapping_role, settings_field, amount_selector);

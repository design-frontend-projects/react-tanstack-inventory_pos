-- Migration: HR / HCM module (Spec 007) — Phase 0
-- Adds 88 hr_* tables (organization, employee, recruitment, onboarding, time,
-- leave, payroll, performance, learning, career, workforce, budgeting, ESS,
-- assets, travel & expense) + 13 HR DocumentType enum values.
--
-- Tenant isolation is enforced in-application via the guard chain + tenantId
-- filters (see CLAUDE.md) — no RLS layer is added here, matching the existing
-- operational modules. pod_document_statuses / pod_status_transitions rows for
-- the HR workflow documents (leave, payroll, expense, ...) are seeded by the
-- later phases that implement those document services.
-- Generated with: prisma migrate diff (live DB -> schema); enum adds made idempotent.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_employee';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_job_opening';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_candidate';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_job_offer';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_leave_request';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_overtime_request';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_timesheet';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_payroll_run';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_loan';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_salary_advance';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_performance_review';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_travel_request';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'hr_expense_claim';

-- DropIndex
DROP INDEX "fin_journal_lines_created_brin";

-- AlterTable
ALTER TABLE "fin_account_classes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_account_mappings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_account_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_allocation_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_allocation_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_analysis_dimension_values" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_analysis_dimensions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_ar_receipts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_asset_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_asset_depreciation_schedules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_asset_disposals" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_asset_revaluations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_assets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_bank_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_bank_matching_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_bank_reconciliations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_bank_statement_lines" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_bank_statements" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_budget_control_policies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_budget_lines" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_budget_transfers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_budgets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cash_flow_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cash_transactions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cashboxes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cheque_books" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cheques" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_close_task_templates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_cost_centers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_currencies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_customer_financial_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_depreciation_methods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_depreciation_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_dunning_levels" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_dunning_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_event_cursors" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_fiscal_periods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_fiscal_years" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_funds_transfers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_fx_revaluation_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_gl_balances" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_journal_entries" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_journal_templates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_journal_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_opening_balance_batches" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_payment_run_lines" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_payment_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_payment_terms" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_period_close_run_tasks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_period_close_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_posting_queue" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_posting_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_projects" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_recurring_journal_schedules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_supplier_financial_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_tax_authorities" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_tax_codes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_tax_returns" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_tax_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_wht_certificates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fin_year_close_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_approval_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_approval_workflow_steps" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_approval_workflows" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_attachments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_custom_field_definitions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_custom_field_values" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_debit_note_reasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_document_statuses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_incoterms" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_landed_cost_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_landed_cost_vouchers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_payment_methods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_return_reasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_rfqs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_addresses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_bank_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_contacts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_payments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pod_supplier_quotations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_order_lines" ALTER COLUMN "remaining_qty" DROP DEFAULT;

-- CreateTable
CREATE TABLE "hr_companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "legal_name" TEXT,
    "registration_no" TEXT,
    "tax_id" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "base_country" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address_line" TEXT,
    "logo_url" TEXT,
    "parent_company_id" UUID,
    "is_legal_entity" BOOLEAN NOT NULL DEFAULT true,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "branch_type" TEXT NOT NULL DEFAULT 'office',
    "cost_center_id" UUID,
    "warehouse_id" UUID,
    "manager_id" UUID,
    "timezone" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address_line" TEXT,
    "city" TEXT,
    "country" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_business_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "head_id" UUID,
    "cost_center_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_divisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "business_unit_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "head_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "branch_id" UUID,
    "division_id" UUID,
    "parent_department_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "manager_id" UUID,
    "cost_center_id" UUID,
    "depth_level" INTEGER NOT NULL DEFAULT 0,
    "path_text" TEXT,
    "headcount_budget" INTEGER,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "supervisor_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_grades" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "grade_level" INTEGER NOT NULL DEFAULT 1,
    "min_salary" DECIMAL(19,4),
    "mid_salary" DECIMAL(19,4),
    "max_salary" DECIMAL(19,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "annual_leave_days" INTEGER,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_positions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT,
    "department_id" UUID,
    "job_grade_id" UUID,
    "reports_to_id" UUID,
    "employment_type" TEXT NOT NULL DEFAULT 'full_time',
    "headcount_limit" INTEGER,
    "job_description" TEXT,
    "is_managerial" BOOLEAN NOT NULL DEFAULT false,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_cost_centers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "company_id" UUID,
    "department_id" UUID,
    "parent_id" UUID,
    "fin_cost_center_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_reporting_structure" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "manager_id" UUID,
    "relation_type" TEXT NOT NULL DEFAULT 'solid_line',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_reporting_structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "profile_id" UUID,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "first_name_ar" TEXT,
    "last_name_ar" TEXT,
    "display_name" TEXT,
    "gender" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "marital_status" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "blood_group" TEXT,
    "personal_email" TEXT,
    "work_email" TEXT,
    "personal_phone" TEXT,
    "work_phone" TEXT,
    "national_id" TEXT,
    "passport_no" TEXT,
    "photo_url" TEXT,
    "company_id" UUID,
    "branch_id" UUID,
    "department_id" UUID,
    "section_id" UUID,
    "position_id" UUID,
    "job_grade_id" UUID,
    "cost_center_id" UUID,
    "manager_id" UUID,
    "employment_type" TEXT NOT NULL DEFAULT 'full_time',
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "hire_date" TIMESTAMP(3),
    "probation_end_date" TIMESTAMP(3),
    "confirmation_date" TIMESTAMP(3),
    "termination_date" TIMESTAMP(3),
    "termination_reason" TEXT,
    "is_rehire_eligible" BOOLEAN NOT NULL DEFAULT true,
    "work_location" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_contacts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contact_type" TEXT NOT NULL DEFAULT 'emergency',
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "address_type" TEXT NOT NULL DEFAULT 'home',
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_no" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_url" TEXT,
    "attachment_id" UUID,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_bank_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT NOT NULL,
    "iban" TEXT,
    "swift_code" TEXT,
    "branch_name" TEXT,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "allocation_pct" DECIMAL(5,2),
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_contracts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_number" TEXT NOT NULL,
    "contract_type" TEXT NOT NULL DEFAULT 'permanent',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "job_grade_id" UUID,
    "position_id" UUID,
    "base_salary" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "pay_frequency" TEXT NOT NULL DEFAULT 'monthly',
    "working_hours" DECIMAL(8,2),
    "probation_months" INTEGER,
    "notice_period_days" INTEGER,
    "salary_structure_id" UUID,
    "signed_date" TIMESTAMP(3),
    "file_url" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "change_type" TEXT NOT NULL,
    "field_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "changed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_employee_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_dependents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "national_id" TEXT,
    "is_beneficiary" BOOLEAN NOT NULL DEFAULT false,
    "is_insured" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_education" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field_of_study" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "grade" TEXT,
    "country" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_experience" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "responsibilities" TEXT,
    "reason_for_leaving" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_certifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "certificate_no" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_url" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_languages" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "proficiency" TEXT NOT NULL DEFAULT 'intermediate',
    "can_read" BOOLEAN NOT NULL DEFAULT true,
    "can_write" BOOLEAN NOT NULL DEFAULT true,
    "can_speak" BOOLEAN NOT NULL DEFAULT true,
    "is_native" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_openings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requisition_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID,
    "position_id" UUID,
    "job_grade_id" UUID,
    "branch_id" UUID,
    "hiring_manager_id" UUID,
    "employment_type" TEXT NOT NULL DEFAULT 'full_time',
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "requirements" TEXT,
    "salary_min" DECIMAL(19,4),
    "salary_max" DECIMAL(19,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "open_date" TIMESTAMP(3),
    "target_close_date" TIMESTAMP(3),
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_candidates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_opening_id" UUID,
    "candidate_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "resume_url" TEXT,
    "current_employer" TEXT,
    "expected_salary" DECIMAL(19,4),
    "notice_period_days" INTEGER,
    "rating" INTEGER,
    "stage_code" TEXT NOT NULL DEFAULT 'applied',
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_candidate_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "file_url" TEXT,
    "attachment_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_interviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "job_opening_id" UUID,
    "round_number" INTEGER NOT NULL DEFAULT 1,
    "interview_type" TEXT NOT NULL DEFAULT 'in_person',
    "scheduled_at" TIMESTAMP(3),
    "duration_mins" INTEGER,
    "location" TEXT,
    "meeting_link" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'scheduled',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_interview_feedback" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "interview_id" UUID NOT NULL,
    "interviewer_id" UUID NOT NULL,
    "overall_score" DECIMAL(5,2),
    "recommendation" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "comments" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_interview_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_offers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "job_opening_id" UUID,
    "offer_number" TEXT NOT NULL,
    "position_id" UUID,
    "job_grade_id" UUID,
    "offered_salary" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "start_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "offer_letter_url" TEXT,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_offer_acceptance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "responded_at" TIMESTAMP(3),
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "signature_url" TEXT,
    "comments" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_offer_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_onboarding_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "department_id" UUID,
    "description" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_onboarding_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "owner_role" TEXT,
    "due_offset_days" INTEGER NOT NULL DEFAULT 0,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_onboarding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "task_id" UUID,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "assigned_to_id" UUID,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shift_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "shift_type" TEXT NOT NULL DEFAULT 'fixed',
    "start_time" TEXT,
    "end_time" TEXT,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "work_hours" DECIMAL(8,2),
    "is_night_shift" BOOLEAN NOT NULL DEFAULT false,
    "grace_in_mins" INTEGER NOT NULL DEFAULT 0,
    "grace_out_mins" INTEGER NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_shift_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shift_patterns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rotation_days" INTEGER NOT NULL DEFAULT 7,
    "pattern_json" JSONB,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_shift_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_shift_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "shift_id" UUID,
    "pattern_id" UUID,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_attendance_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'in',
    "capture_method" TEXT NOT NULL DEFAULT 'manual',
    "device_id" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_attendance_daily" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "shift_id" UUID,
    "first_in" TIMESTAMP(3),
    "last_out" TIMESTAMP(3),
    "worked_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_out_mins" INTEGER NOT NULL DEFAULT 0,
    "attendance_code" TEXT NOT NULL DEFAULT 'present',
    "is_manual_edit" BOOLEAN NOT NULL DEFAULT false,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_attendance_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_timesheets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "total_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billable_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "project_id" UUID,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_overtime_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "overtime_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "rate_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "reason" TEXT,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_overtime_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_break_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "attendance_daily_id" UUID,
    "break_start" TIMESTAMP(3) NOT NULL,
    "break_end" TIMESTAMP(3),
    "break_type" TEXT NOT NULL DEFAULT 'meal',
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_break_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "affects_payroll" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "max_days_per_year" DECIMAL(6,2),
    "gender" TEXT,
    "color_hex" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "job_grade_id" UUID,
    "accrual_method" TEXT NOT NULL DEFAULT 'annual',
    "days_per_year" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrual_rate" DECIMAL(8,4),
    "max_carryover" DECIMAL(6,2),
    "min_service_months" INTEGER NOT NULL DEFAULT 0,
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_leave_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "accrued_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "used_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pending_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "carried_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "balance_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "contact_during_leave" TEXT,
    "document_url" TEXT,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_approvals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "leave_request_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL DEFAULT 1,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_leave_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_salary_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "component_type" TEXT NOT NULL DEFAULT 'earning',
    "calc_method" TEXT NOT NULL DEFAULT 'fixed',
    "formula" TEXT,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "affects_gross" BOOLEAN NOT NULL DEFAULT true,
    "gl_account_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_salary_structures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "job_grade_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "components_json" JSONB,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_salary_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "percentage" DECIMAL(8,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_salary_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_type" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "pay_date" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'open',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "run_number" TEXT NOT NULL,
    "run_type" TEXT NOT NULL DEFAULT 'regular',
    "company_id" UUID,
    "branch_id" UUID,
    "department_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "total_gross" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approval_request_id" UUID,
    "journal_entry_id" UUID,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "paid_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_details" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "worked_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "absent_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gross_pay" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_earnings" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "bank_account_id" UUID,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_payroll_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_payroll_component_details" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "payroll_detail_id" UUID NOT NULL,
    "component_id" UUID,
    "component_code" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "component_type" TEXT NOT NULL DEFAULT 'earning',
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_payroll_component_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_loans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "loan_number" TEXT NOT NULL,
    "loan_type" TEXT NOT NULL DEFAULT 'personal',
    "principal_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "interest_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "installment_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "approval_request_id" UUID,
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_loan_installments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "principal_part" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "interest_part" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "payroll_run_id" UUID,
    "paid_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_loan_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_salary_advances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "advance_number" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "reason" TEXT,
    "recovery_months" INTEGER NOT NULL DEFAULT 1,
    "recovered_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approval_request_id" UUID,
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_benefits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "benefit_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "amount" DECIMAL(19,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "policy_number" TEXT,
    "coverage_details" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_commissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'sales',
    "source_id" UUID,
    "period_id" UUID,
    "base_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "commission_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "payroll_run_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_kpis" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "measure_unit" TEXT,
    "target_value" DECIMAL(19,4),
    "weight" DECIMAL(5,2),
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_goals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kpi_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'performance',
    "weight" DECIMAL(5,2),
    "target_value" DECIMAL(19,4),
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_goal_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "actual_value" DECIMAL(19,4),
    "note" TEXT,
    "recorded_by_id" UUID,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_goal_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_review_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "review_type" TEXT NOT NULL DEFAULT 'annual',
    "sections_json" JSONB,
    "rating_scale_max" INTEGER NOT NULL DEFAULT 5,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_review_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_performance_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_id" UUID,
    "reviewer_id" UUID,
    "review_type" TEXT NOT NULL DEFAULT 'annual',
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "overall_score" DECIMAL(5,2),
    "rating_label" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "comments" TEXT,
    "employee_comments" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_review_scores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "kpi_id" UUID,
    "criterion" TEXT NOT NULL,
    "weight" DECIMAL(5,2),
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reviewer_type" TEXT NOT NULL DEFAULT 'manager',
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_review_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_training_courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "delivery_mode" TEXT NOT NULL DEFAULT 'classroom',
    "provider" TEXT,
    "duration_hours" DECIMAL(8,2),
    "cost" DECIMAL(19,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_training_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_training_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "trainer_id" UUID,
    "trainer_name" TEXT,
    "location" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "capacity" INTEGER,
    "status_code" TEXT NOT NULL DEFAULT 'scheduled',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_training_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "enrolled_at" TIMESTAMP(3),
    "attendance_pct" DECIMAL(5,2),
    "score" DECIMAL(5,2),
    "completed_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'enrolled',
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_training_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "certificate_no" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_training_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_career_paths" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "from_position_id" UUID,
    "to_position_id" UUID,
    "min_years" DECIMAL(5,2),
    "requirements" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_career_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_successors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "readiness_level" TEXT NOT NULL DEFAULT 'developing',
    "readiness_months" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_successors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_promotions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "promotion_number" TEXT NOT NULL,
    "from_position_id" UUID,
    "to_position_id" UUID,
    "from_job_grade_id" UUID,
    "to_job_grade_id" UUID,
    "old_salary" DECIMAL(19,4),
    "new_salary" DECIMAL(19,4),
    "effective_date" TIMESTAMP(3),
    "reason" TEXT,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_skills" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "category" TEXT NOT NULL DEFAULT 'technical',
    "status_code" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_skills" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 1,
    "years_experience" DECIMAL(5,2),
    "last_used_at" TIMESTAMP(3),
    "is_certified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_workforce_plans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "department_id" UUID,
    "current_headcount" INTEGER NOT NULL DEFAULT 0,
    "planned_headcount" INTEGER NOT NULL DEFAULT 0,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_workforce_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_workforce_requirements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "position_id" UUID,
    "department_id" UUID,
    "required_count" INTEGER NOT NULL DEFAULT 0,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "gap_count" INTEGER NOT NULL DEFAULT 0,
    "target_quarter" TEXT,
    "estimated_cost" DECIMAL(19,4),
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_workforce_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_skill_requirements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "min_proficiency" INTEGER NOT NULL DEFAULT 1,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_skill_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_budget_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "company_id" UUID,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "total_budget" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_budget_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_budget_departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "budget_year_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "budget_type" TEXT NOT NULL DEFAULT 'salary',
    "budget_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_budget_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_budget_positions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "budget_year_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "planned_count" INTEGER NOT NULL DEFAULT 0,
    "avg_salary" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_budget_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_budget_actuals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "budget_year_id" UUID NOT NULL,
    "department_id" UUID,
    "budget_type" TEXT NOT NULL DEFAULT 'salary',
    "period_month" INTEGER NOT NULL,
    "budget_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "actual_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "variance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_budget_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "approval_request_id" UUID,
    "assigned_to_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "status_code" TEXT NOT NULL DEFAULT 'open',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "entity_type" TEXT,
    "entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_employee_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "department_id" UUID,
    "publish_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_documents_shared" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID,
    "title" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT 'policy',
    "file_url" TEXT,
    "attachment_id" UUID,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "requires_ack" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_documents_shared_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee_assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "product_id" UUID,
    "fin_asset_id" UUID,
    "serial_number" TEXT,
    "asset_tag" TEXT,
    "name" TEXT NOT NULL,
    "assigned_date" TIMESTAMP(3),
    "returned_date" TIMESTAMP(3),
    "condition_out" TEXT,
    "condition_in" TEXT,
    "value" DECIMAL(19,4),
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'assigned',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_employee_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_travel_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "request_number" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" TEXT,
    "travel_type" TEXT NOT NULL DEFAULT 'domestic',
    "depart_date" TIMESTAMP(3),
    "return_date" TIMESTAMP(3),
    "estimated_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "advance_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "approval_request_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_travel_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_expense_claims" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "claim_number" TEXT NOT NULL,
    "travel_request_id" UUID,
    "title" TEXT NOT NULL,
    "claim_date" TIMESTAMP(3),
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approved_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "cost_center_id" UUID,
    "approval_request_id" UUID,
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hr_expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_expense_claim_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "expense_date" TIMESTAMP(3),
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "receipt_url" TEXT,
    "is_reimbursable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_expense_claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_expense_reimbursements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" TEXT NOT NULL DEFAULT 'USD',
    "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "bank_account_id" UUID,
    "payroll_run_id" UUID,
    "paid_at" TIMESTAMP(3),
    "journal_entry_id" UUID,
    "status_code" TEXT NOT NULL DEFAULT 'pending',
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_expense_reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_companies_tenant_status_idx" ON "hr_companies"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_companies_tenant_code_unique" ON "hr_companies"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_branches_tenant_company_idx" ON "hr_branches"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_branches_tenant_code_unique" ON "hr_branches"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_business_units_tenant_code_unique" ON "hr_business_units"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_divisions_tenant_code_unique" ON "hr_divisions"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_departments_tenant_company_idx" ON "hr_departments"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "hr_departments_tenant_parent_idx" ON "hr_departments"("tenant_id", "parent_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_departments_tenant_code_unique" ON "hr_departments"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_sections_tenant_department_idx" ON "hr_sections"("tenant_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_sections_tenant_code_unique" ON "hr_sections"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_grades_tenant_code_unique" ON "hr_job_grades"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_positions_tenant_department_idx" ON "hr_positions"("tenant_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_positions_tenant_code_unique" ON "hr_positions"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_cost_centers_tenant_code_unique" ON "hr_cost_centers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_reporting_structure_tenant_employee_idx" ON "hr_reporting_structure"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_reporting_structure_tenant_manager_idx" ON "hr_reporting_structure"("tenant_id", "manager_id");

-- CreateIndex
CREATE INDEX "hr_employees_tenant_status_idx" ON "hr_employees"("tenant_id", "employment_status");

-- CreateIndex
CREATE INDEX "hr_employees_tenant_department_idx" ON "hr_employees"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "hr_employees_tenant_manager_idx" ON "hr_employees"("tenant_id", "manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_tenant_code_unique" ON "hr_employees"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "hr_employee_contacts_tenant_employee_idx" ON "hr_employee_contacts"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_addresses_tenant_employee_idx" ON "hr_employee_addresses"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_documents_tenant_employee_idx" ON "hr_employee_documents"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_documents_tenant_expiry_idx" ON "hr_employee_documents"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "hr_employee_bank_accounts_tenant_employee_idx" ON "hr_employee_bank_accounts"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_contracts_tenant_employee_idx" ON "hr_employee_contracts"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_contracts_tenant_number_unique" ON "hr_employee_contracts"("tenant_id", "contract_number");

-- CreateIndex
CREATE INDEX "hr_employee_history_tenant_employee_idx" ON "hr_employee_history"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_history_tenant_type_idx" ON "hr_employee_history"("tenant_id", "change_type");

-- CreateIndex
CREATE INDEX "hr_employee_dependents_tenant_employee_idx" ON "hr_employee_dependents"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_education_tenant_employee_idx" ON "hr_employee_education"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_experience_tenant_employee_idx" ON "hr_employee_experience"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_certifications_tenant_employee_idx" ON "hr_employee_certifications"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_languages_tenant_employee_idx" ON "hr_employee_languages"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_job_openings_tenant_status_idx" ON "hr_job_openings"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_openings_tenant_number_unique" ON "hr_job_openings"("tenant_id", "requisition_no");

-- CreateIndex
CREATE INDEX "hr_candidates_tenant_opening_idx" ON "hr_candidates"("tenant_id", "job_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_candidates_tenant_code_unique" ON "hr_candidates"("tenant_id", "candidate_code");

-- CreateIndex
CREATE INDEX "hr_candidate_documents_tenant_candidate_idx" ON "hr_candidate_documents"("tenant_id", "candidate_id");

-- CreateIndex
CREATE INDEX "hr_interviews_tenant_candidate_idx" ON "hr_interviews"("tenant_id", "candidate_id");

-- CreateIndex
CREATE INDEX "hr_interviews_tenant_scheduled_idx" ON "hr_interviews"("tenant_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "hr_interview_feedback_tenant_interview_idx" ON "hr_interview_feedback"("tenant_id", "interview_id");

-- CreateIndex
CREATE INDEX "hr_job_offers_tenant_candidate_idx" ON "hr_job_offers"("tenant_id", "candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_offers_tenant_number_unique" ON "hr_job_offers"("tenant_id", "offer_number");

-- CreateIndex
CREATE INDEX "hr_offer_acceptance_tenant_offer_idx" ON "hr_offer_acceptance"("tenant_id", "offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_onboarding_templates_tenant_code_unique" ON "hr_onboarding_templates"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_onboarding_tasks_tenant_template_idx" ON "hr_onboarding_tasks"("tenant_id", "template_id");

-- CreateIndex
CREATE INDEX "hr_employee_onboarding_tenant_employee_idx" ON "hr_employee_onboarding"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_shift_definitions_tenant_code_unique" ON "hr_shift_definitions"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_shift_patterns_tenant_code_unique" ON "hr_shift_patterns"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_shift_assignments_tenant_employee_idx" ON "hr_shift_assignments"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_attendance_logs_tenant_employee_time_idx" ON "hr_attendance_logs"("tenant_id", "employee_id", "event_time");

-- CreateIndex
CREATE INDEX "hr_attendance_daily_tenant_date_idx" ON "hr_attendance_daily"("tenant_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "hr_attendance_daily_tenant_employee_date_unique" ON "hr_attendance_daily"("tenant_id", "employee_id", "work_date");

-- CreateIndex
CREATE INDEX "hr_timesheets_tenant_employee_idx" ON "hr_timesheets"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_overtime_requests_tenant_employee_idx" ON "hr_overtime_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_overtime_requests_tenant_number_unique" ON "hr_overtime_requests"("tenant_id", "request_number");

-- CreateIndex
CREATE INDEX "hr_break_logs_tenant_employee_idx" ON "hr_break_logs"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_types_tenant_code_unique" ON "hr_leave_types"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_leave_policies_tenant_type_idx" ON "hr_leave_policies"("tenant_id", "leave_type_id");

-- CreateIndex
CREATE INDEX "hr_leave_balances_tenant_employee_idx" ON "hr_leave_balances"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_balances_unique" ON "hr_leave_balances"("tenant_id", "employee_id", "leave_type_id", "year");

-- CreateIndex
CREATE INDEX "hr_leave_requests_tenant_employee_idx" ON "hr_leave_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_leave_requests_tenant_status_idx" ON "hr_leave_requests"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_requests_tenant_number_unique" ON "hr_leave_requests"("tenant_id", "request_number");

-- CreateIndex
CREATE INDEX "hr_leave_approvals_tenant_request_idx" ON "hr_leave_approvals"("tenant_id", "leave_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_salary_components_tenant_code_unique" ON "hr_salary_components"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_salary_structures_tenant_code_unique" ON "hr_salary_structures"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_employee_salary_components_tenant_employee_idx" ON "hr_employee_salary_components"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_payroll_periods_tenant_status_idx" ON "hr_payroll_periods"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_periods_tenant_code_unique" ON "hr_payroll_periods"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_payroll_runs_tenant_period_idx" ON "hr_payroll_runs"("tenant_id", "period_id");

-- CreateIndex
CREATE INDEX "hr_payroll_runs_tenant_status_idx" ON "hr_payroll_runs"("tenant_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_runs_tenant_number_unique" ON "hr_payroll_runs"("tenant_id", "run_number");

-- CreateIndex
CREATE INDEX "hr_payroll_details_tenant_employee_idx" ON "hr_payroll_details"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_payroll_details_run_employee_unique" ON "hr_payroll_details"("tenant_id", "payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_payroll_component_details_tenant_detail_idx" ON "hr_payroll_component_details"("tenant_id", "payroll_detail_id");

-- CreateIndex
CREATE INDEX "hr_loans_tenant_employee_idx" ON "hr_loans"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_loans_tenant_number_unique" ON "hr_loans"("tenant_id", "loan_number");

-- CreateIndex
CREATE INDEX "hr_loan_installments_tenant_loan_idx" ON "hr_loan_installments"("tenant_id", "loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_loan_installments_unique" ON "hr_loan_installments"("tenant_id", "loan_id", "installment_no");

-- CreateIndex
CREATE INDEX "hr_salary_advances_tenant_employee_idx" ON "hr_salary_advances"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_salary_advances_tenant_number_unique" ON "hr_salary_advances"("tenant_id", "advance_number");

-- CreateIndex
CREATE INDEX "hr_employee_benefits_tenant_employee_idx" ON "hr_employee_benefits"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_commissions_tenant_employee_idx" ON "hr_commissions"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_kpis_tenant_code_unique" ON "hr_kpis"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_goals_tenant_employee_idx" ON "hr_goals"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_goal_progress_tenant_goal_idx" ON "hr_goal_progress"("tenant_id", "goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_review_templates_tenant_code_unique" ON "hr_review_templates"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_performance_reviews_tenant_employee_idx" ON "hr_performance_reviews"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_review_scores_tenant_review_idx" ON "hr_review_scores"("tenant_id", "review_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_training_courses_tenant_code_unique" ON "hr_training_courses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_training_sessions_tenant_course_idx" ON "hr_training_sessions"("tenant_id", "course_id");

-- CreateIndex
CREATE INDEX "hr_training_records_tenant_employee_idx" ON "hr_training_records"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_training_records_tenant_session_idx" ON "hr_training_records"("tenant_id", "session_id");

-- CreateIndex
CREATE INDEX "hr_training_certificates_tenant_employee_idx" ON "hr_training_certificates"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_career_paths_tenant_code_unique" ON "hr_career_paths"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_successors_tenant_position_idx" ON "hr_successors"("tenant_id", "position_id");

-- CreateIndex
CREATE INDEX "hr_promotions_tenant_employee_idx" ON "hr_promotions"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_promotions_tenant_number_unique" ON "hr_promotions"("tenant_id", "promotion_number");

-- CreateIndex
CREATE UNIQUE INDEX "hr_skills_tenant_code_unique" ON "hr_skills"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_employee_skills_tenant_skill_idx" ON "hr_employee_skills"("tenant_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_skills_unique" ON "hr_employee_skills"("tenant_id", "employee_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_workforce_plans_tenant_code_unique" ON "hr_workforce_plans"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "hr_workforce_requirements_tenant_plan_idx" ON "hr_workforce_requirements"("tenant_id", "plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_skill_requirements_unique" ON "hr_skill_requirements"("tenant_id", "position_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_budget_years_tenant_year_unique" ON "hr_budget_years"("tenant_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "hr_budget_departments_tenant_year_idx" ON "hr_budget_departments"("tenant_id", "budget_year_id");

-- CreateIndex
CREATE INDEX "hr_budget_positions_tenant_year_idx" ON "hr_budget_positions"("tenant_id", "budget_year_id");

-- CreateIndex
CREATE INDEX "hr_budget_actuals_tenant_year_idx" ON "hr_budget_actuals"("tenant_id", "budget_year_id");

-- CreateIndex
CREATE INDEX "hr_employee_requests_tenant_employee_idx" ON "hr_employee_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_requests_tenant_number_unique" ON "hr_employee_requests"("tenant_id", "request_number");

-- CreateIndex
CREATE INDEX "hr_employee_notifications_tenant_employee_read_idx" ON "hr_employee_notifications"("tenant_id", "employee_id", "is_read");

-- CreateIndex
CREATE INDEX "hr_employee_announcements_tenant_publish_idx" ON "hr_employee_announcements"("tenant_id", "publish_at");

-- CreateIndex
CREATE INDEX "hr_employee_documents_shared_tenant_employee_idx" ON "hr_employee_documents_shared"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_assets_tenant_employee_idx" ON "hr_employee_assets"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "hr_travel_requests_tenant_employee_idx" ON "hr_travel_requests"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_travel_requests_tenant_number_unique" ON "hr_travel_requests"("tenant_id", "request_number");

-- CreateIndex
CREATE INDEX "hr_expense_claims_tenant_employee_idx" ON "hr_expense_claims"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_expense_claims_tenant_number_unique" ON "hr_expense_claims"("tenant_id", "claim_number");

-- CreateIndex
CREATE INDEX "hr_expense_claim_lines_tenant_claim_idx" ON "hr_expense_claim_lines"("tenant_id", "claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_expense_claim_lines_unique" ON "hr_expense_claim_lines"("tenant_id", "claim_id", "line_number");

-- CreateIndex
CREATE INDEX "hr_expense_reimbursements_tenant_claim_idx" ON "hr_expense_reimbursements"("tenant_id", "claim_id");

-- AddForeignKey
ALTER TABLE "hr_companies" ADD CONSTRAINT "hr_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_branches" ADD CONSTRAINT "hr_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_business_units" ADD CONSTRAINT "hr_business_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_divisions" ADD CONSTRAINT "hr_divisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_departments" ADD CONSTRAINT "hr_departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_sections" ADD CONSTRAINT "hr_sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_grades" ADD CONSTRAINT "hr_job_grades_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_positions" ADD CONSTRAINT "hr_positions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_cost_centers" ADD CONSTRAINT "hr_cost_centers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_reporting_structure" ADD CONSTRAINT "hr_reporting_structure_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_contacts" ADD CONSTRAINT "hr_employee_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_contacts" ADD CONSTRAINT "hr_employee_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_addresses" ADD CONSTRAINT "hr_employee_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_addresses" ADD CONSTRAINT "hr_employee_addresses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_documents" ADD CONSTRAINT "hr_employee_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_documents" ADD CONSTRAINT "hr_employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_bank_accounts" ADD CONSTRAINT "hr_employee_bank_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_bank_accounts" ADD CONSTRAINT "hr_employee_bank_accounts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_contracts" ADD CONSTRAINT "hr_employee_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_contracts" ADD CONSTRAINT "hr_employee_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_history" ADD CONSTRAINT "hr_employee_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_history" ADD CONSTRAINT "hr_employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_dependents" ADD CONSTRAINT "hr_employee_dependents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_dependents" ADD CONSTRAINT "hr_employee_dependents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_education" ADD CONSTRAINT "hr_employee_education_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_education" ADD CONSTRAINT "hr_employee_education_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_experience" ADD CONSTRAINT "hr_employee_experience_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_experience" ADD CONSTRAINT "hr_employee_experience_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_certifications" ADD CONSTRAINT "hr_employee_certifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_certifications" ADD CONSTRAINT "hr_employee_certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_languages" ADD CONSTRAINT "hr_employee_languages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_languages" ADD CONSTRAINT "hr_employee_languages_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_openings" ADD CONSTRAINT "hr_job_openings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_candidates" ADD CONSTRAINT "hr_candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_candidate_documents" ADD CONSTRAINT "hr_candidate_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_interviews" ADD CONSTRAINT "hr_interviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_interview_feedback" ADD CONSTRAINT "hr_interview_feedback_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_offers" ADD CONSTRAINT "hr_job_offers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_offer_acceptance" ADD CONSTRAINT "hr_offer_acceptance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_onboarding_templates" ADD CONSTRAINT "hr_onboarding_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_onboarding_tasks" ADD CONSTRAINT "hr_onboarding_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_onboarding" ADD CONSTRAINT "hr_employee_onboarding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_definitions" ADD CONSTRAINT "hr_shift_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_patterns" ADD CONSTRAINT "hr_shift_patterns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_shift_assignments" ADD CONSTRAINT "hr_shift_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_attendance_logs" ADD CONSTRAINT "hr_attendance_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_attendance_daily" ADD CONSTRAINT "hr_attendance_daily_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_timesheets" ADD CONSTRAINT "hr_timesheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_overtime_requests" ADD CONSTRAINT "hr_overtime_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_break_logs" ADD CONSTRAINT "hr_break_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_types" ADD CONSTRAINT "hr_leave_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_policies" ADD CONSTRAINT "hr_leave_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_balances" ADD CONSTRAINT "hr_leave_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_requests" ADD CONSTRAINT "hr_leave_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_approvals" ADD CONSTRAINT "hr_leave_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_salary_components" ADD CONSTRAINT "hr_salary_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_salary_structures" ADD CONSTRAINT "hr_salary_structures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_salary_components" ADD CONSTRAINT "hr_employee_salary_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_periods" ADD CONSTRAINT "hr_payroll_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_runs" ADD CONSTRAINT "hr_payroll_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_details" ADD CONSTRAINT "hr_payroll_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_payroll_component_details" ADD CONSTRAINT "hr_payroll_component_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_loans" ADD CONSTRAINT "hr_loans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_loan_installments" ADD CONSTRAINT "hr_loan_installments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_salary_advances" ADD CONSTRAINT "hr_salary_advances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_benefits" ADD CONSTRAINT "hr_employee_benefits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_commissions" ADD CONSTRAINT "hr_commissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_kpis" ADD CONSTRAINT "hr_kpis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_goals" ADD CONSTRAINT "hr_goals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_goal_progress" ADD CONSTRAINT "hr_goal_progress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_review_templates" ADD CONSTRAINT "hr_review_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_performance_reviews" ADD CONSTRAINT "hr_performance_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_review_scores" ADD CONSTRAINT "hr_review_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_training_courses" ADD CONSTRAINT "hr_training_courses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_training_sessions" ADD CONSTRAINT "hr_training_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_training_records" ADD CONSTRAINT "hr_training_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_training_certificates" ADD CONSTRAINT "hr_training_certificates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_career_paths" ADD CONSTRAINT "hr_career_paths_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_successors" ADD CONSTRAINT "hr_successors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_promotions" ADD CONSTRAINT "hr_promotions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_skills" ADD CONSTRAINT "hr_skills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_skills" ADD CONSTRAINT "hr_employee_skills_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_workforce_plans" ADD CONSTRAINT "hr_workforce_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_workforce_requirements" ADD CONSTRAINT "hr_workforce_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_skill_requirements" ADD CONSTRAINT "hr_skill_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_budget_years" ADD CONSTRAINT "hr_budget_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_budget_departments" ADD CONSTRAINT "hr_budget_departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_budget_positions" ADD CONSTRAINT "hr_budget_positions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_budget_actuals" ADD CONSTRAINT "hr_budget_actuals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_requests" ADD CONSTRAINT "hr_employee_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_notifications" ADD CONSTRAINT "hr_employee_notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_announcements" ADD CONSTRAINT "hr_employee_announcements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_documents_shared" ADD CONSTRAINT "hr_employee_documents_shared_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee_assets" ADD CONSTRAINT "hr_employee_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_travel_requests" ADD CONSTRAINT "hr_travel_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_expense_claims" ADD CONSTRAINT "hr_expense_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_expense_claim_lines" ADD CONSTRAINT "hr_expense_claim_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_expense_reimbursements" ADD CONSTRAINT "hr_expense_reimbursements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


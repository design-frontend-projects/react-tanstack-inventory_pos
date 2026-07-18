# ERD — Feature 006 (Enterprise Financial Management)

Mermaid ERDs grouped by domain cluster. As in the 005 ERDs, only **intra-module composition**
(header → line), **intra-finance master references** (account/type/period/tax code/…), and the
**tenant** relationship are real DB foreign keys — drawn as solid crow's-foot lines. Every
cross-module reference (`customers`, `suppliers`, `pod_supplier_invoices`, `pos_sales`,
`profiles`, source docs, …) is a **bare scalar UUID** with app-enforced integrity, drawn as a
dashed `||..o{` link. Entities that belong to another domain (or another module) appear without
attributes.

Every `fin_*` table carries `tenant_id → tenant_accounts` (real FK, cascade); it is shown once
below and omitted elsewhere for readability.

## Tenant scope (applies to every table)

```mermaid
erDiagram
  tenant_accounts ||--o{ fin_accounts : owns
  tenant_accounts ||--o{ fin_journal_entries : owns
  tenant_accounts ||--o{ fin_customer_ledger_entries : owns
  tenant_accounts ||--o{ fin_vendor_ledger_entries : owns
  tenant_accounts ||--o{ fin_bank_accounts : owns
  tenant_accounts ||--o{ fin_tax_codes : owns
  tenant_accounts ||--o{ fin_assets : owns
  tenant_accounts ||--o{ fin_settings : "owns (singleton)"
  tenant_accounts ||--o{ fin_currencies : "owns (nullable=system)"
  tenant_accounts ||--o{ fin_posting_rules : "owns (nullable=system)"
```

## Domain 1 — GL / Chart of Accounts

```mermaid
erDiagram
  fin_account_classes {
    uuid id PK
    uuid tenant_id FK
    text code
    text name
    text name_ar
    text normal_balance_side
  }
  fin_account_types {
    uuid id PK
    uuid account_class_id FK
    text code
    boolean is_control_type
    text control_domain
    text cash_flow_section
  }
  fin_accounts {
    uuid id PK
    uuid tenant_id FK
    text code
    uuid parent_account_id FK
    uuid account_type_id FK
    text path
    boolean is_leaf
    boolean is_control_account
    boolean allow_manual_journal
  }
  fin_account_mappings {
    uuid id PK
    text entity_type
    uuid entity_id
    text entity_code
    text mapping_role
    uuid account_id FK
  }
  fin_account_classes ||--o{ fin_account_types : classifies
  fin_account_types ||--o{ fin_accounts : types
  fin_accounts ||--o{ fin_accounts : "parent_account_id"
  fin_accounts ||--o{ fin_account_mappings : "maps to"
  products ||..o{ fin_account_mappings : "entity (polymorphic)"
  warehouses ||..o{ fin_account_mappings : "entity (polymorphic)"
  pod_payment_methods ||..o{ fin_account_mappings : "entity (polymorphic)"
  fin_cash_flow_categories ||..o{ fin_accounts : "FK cash_flow_category_id"
```

## Domain 2 — Fiscal calendar

```mermaid
erDiagram
  fin_fiscal_years {
    uuid id PK
    uuid tenant_id FK
    text code
    timestamp start_date
    timestamp end_date
    text status_code
  }
  fin_fiscal_periods {
    uuid id PK
    uuid fiscal_year_id FK
    int period_number
    timestamp start_date
    timestamp end_date
    text status_code
    boolean is_adjustment_period
  }
  fin_period_module_locks {
    uuid id PK
    uuid fiscal_period_id FK
    text module_code
    timestamp locked_at
  }
  fin_fiscal_years ||--o{ fin_fiscal_periods : partitions
  fin_fiscal_periods ||--o{ fin_period_module_locks : "soft-closes"
  fin_fiscal_periods ||--o{ fin_journal_entries : "gates posting"
  fin_fiscal_periods ||--o{ fin_gl_balances : buckets
```

## Domain 3 — Journals + GL balances

```mermaid
erDiagram
  fin_journal_types {
    uuid id PK
    text code
    text document_type
    text default_prefix
  }
  fin_journal_entries {
    uuid id PK
    uuid tenant_id FK
    text entry_number
    uuid journal_type_id FK
    uuid fiscal_period_id FK
    text status_code
    text source_doc_type
    uuid source_doc_id
    uuid reversal_of_entry_id FK
    decimal total_base_debit
    decimal total_base_credit
  }
  fin_journal_lines {
    uuid id PK
    uuid entry_id FK
    uuid account_id FK
    decimal debit_amount
    decimal credit_amount
    decimal base_debit_amount
    decimal base_credit_amount
    decimal exchange_rate
    uuid cost_center_id
    uuid party_id
  }
  fin_journal_templates {
    uuid id PK
    text code
    uuid journal_type_id
  }
  fin_journal_template_lines {
    uuid id PK
    uuid template_id FK
    text side
    text amount_formula
  }
  fin_recurring_journal_schedules {
    uuid id PK
    uuid template_id FK
    text frequency_code
    timestamp next_run_date
    boolean auto_post
  }
  fin_gl_balances {
    uuid id PK
    uuid account_id FK
    uuid fiscal_period_id FK
    text currency_code
    decimal period_debit
    decimal period_credit
    decimal base_period_debit
    decimal base_period_credit
  }
  fin_journal_types ||--o{ fin_journal_entries : books
  fin_journal_entries ||--o{ fin_journal_lines : contains
  fin_journal_entries ||--o{ fin_journal_entries : "reversal_of_entry_id"
  fin_accounts ||--o{ fin_journal_lines : posts
  fin_accounts ||--o{ fin_gl_balances : summarizes
  fin_fiscal_periods ||--o{ fin_journal_entries : dates
  fin_fiscal_periods ||--o{ fin_gl_balances : buckets
  fin_journal_templates ||--o{ fin_journal_template_lines : contains
  fin_journal_templates ||--o{ fin_recurring_journal_schedules : schedules
  pod_approval_requests ||..o{ fin_journal_entries : "FK approval_request_id"
```

## Domain 4 — Accounts Receivable

```mermaid
erDiagram
  fin_customer_ledger_entries {
    uuid id PK
    uuid customer_id
    uuid journal_entry_id
    text document_type
    decimal amount
    decimal base_amount
    decimal remaining_amount
    timestamp due_date
    boolean is_open
  }
  fin_customer_ledger_applications {
    uuid id PK
    uuid from_entry_id FK
    uuid to_entry_id FK
    decimal applied_amount
    decimal fx_gain_loss_base
    timestamp unapplied_at
  }
  fin_ar_receipts {
    uuid id PK
    text document_number
    uuid customer_id
    uuid bank_account_id
    uuid cashbox_id
    decimal amount
    decimal unallocated_amount
    boolean is_advance
    text status_code
  }
  fin_ar_receipt_allocations {
    uuid id PK
    uuid receipt_id FK
    uuid sales_invoice_id
    uuid pos_sale_id
    uuid customer_ledger_entry_id
    decimal allocated_amount
    decimal discount_taken
  }
  fin_customer_financial_profiles {
    uuid id PK
    uuid customer_id
    uuid ar_control_account_id
    uuid payment_term_id
    boolean credit_hold
  }
  fin_dunning_levels {
    uuid id PK
    int level_number
    int days_overdue
    boolean block_sales
  }
  fin_dunning_runs {
    uuid id PK
    text run_number
    text status_code
  }
  fin_dunning_run_entries {
    uuid id PK
    uuid run_id FK
    uuid customer_id
    decimal amount_due
    uuid notification_id
  }
  fin_customer_ledger_entries ||--o{ fin_customer_ledger_applications : "from_entry_id"
  fin_customer_ledger_entries ||--o{ fin_customer_ledger_applications : "to_entry_id"
  fin_ar_receipts ||--o{ fin_ar_receipt_allocations : allocates
  fin_dunning_runs ||--o{ fin_dunning_run_entries : contains
  customers ||..o{ fin_customer_ledger_entries : "FK customer_id"
  customers ||..o{ fin_ar_receipts : "FK customer_id"
  customers ||..o{ fin_customer_financial_profiles : "FK customer_id"
  fin_journal_entries ||..o{ fin_customer_ledger_entries : "FK journal_entry_id"
  fin_journal_entries ||..o{ fin_ar_receipts : "FK journal_entry_id"
  sales_invoices ||..o{ fin_ar_receipt_allocations : "FK sales_invoice_id"
  pos_sales ||..o{ fin_ar_receipt_allocations : "FK pos_sale_id"
  fin_customer_ledger_entries ||..o{ fin_ar_receipt_allocations : "FK customer_ledger_entry_id"
  fin_dunning_levels ||..o{ fin_dunning_run_entries : "FK dunning_level_id"
  fin_customer_ledger_entries ||..o{ fin_dunning_run_entries : "FK ledger_entry_id"
  pod_notifications ||..o{ fin_dunning_run_entries : "FK notification_id"
```

## Domain 5 — Accounts Payable

```mermaid
erDiagram
  fin_vendor_ledger_entries {
    uuid id PK
    uuid supplier_id
    uuid journal_entry_id
    text document_type
    text source_doc_type
    decimal amount
    decimal remaining_amount
    timestamp due_date
    boolean is_open
  }
  fin_vendor_ledger_applications {
    uuid id PK
    uuid from_entry_id FK
    uuid to_entry_id FK
    decimal applied_amount
    decimal fx_gain_loss_base
  }
  fin_supplier_financial_profiles {
    uuid id PK
    uuid supplier_id
    uuid ap_control_account_id
    uuid payment_term_id
    boolean wht_applicable
  }
  fin_payment_runs {
    uuid id PK
    text run_number
    uuid bank_account_id
    text status_code
    decimal total_proposed
    decimal total_executed
  }
  fin_payment_run_lines {
    uuid id PK
    uuid run_id FK
    uuid supplier_id
    uuid supplier_invoice_id
    decimal proposed_amount
    uuid resulting_supplier_payment_id
  }
  fin_vendor_ledger_entries ||--o{ fin_vendor_ledger_applications : "from_entry_id"
  fin_vendor_ledger_entries ||--o{ fin_vendor_ledger_applications : "to_entry_id"
  fin_payment_runs ||--o{ fin_payment_run_lines : proposes
  suppliers ||..o{ fin_vendor_ledger_entries : "FK supplier_id"
  suppliers ||..o{ fin_supplier_financial_profiles : "FK supplier_id"
  fin_journal_entries ||..o{ fin_vendor_ledger_entries : "FK journal_entry_id"
  pod_supplier_invoices ||..o{ fin_vendor_ledger_entries : "source doc (shadow)"
  pod_supplier_invoices ||..o{ fin_payment_run_lines : "FK supplier_invoice_id"
  financial_notes ||..o{ fin_payment_run_lines : "FK financial_note_id"
  pod_supplier_payments ||..o{ fin_payment_run_lines : "FK resulting_supplier_payment_id"
  fin_bank_accounts ||..o{ fin_payment_runs : "FK bank_account_id"
```

## Domain 6 — Cash management

```mermaid
erDiagram
  fin_cashboxes {
    uuid id PK
    text code
    uuid gl_account_id
    uuid custodian_profile_id
    decimal float_limit
    decimal current_balance
  }
  fin_cash_transactions {
    uuid id PK
    text document_number
    uuid cashbox_id FK
    text transaction_type
    uuid counter_account_id
    decimal amount
    uuid pos_session_id
    text status_code
    uuid journal_entry_id
  }
  fin_funds_transfers {
    uuid id PK
    text document_number
    uuid from_cashbox_id
    uuid to_bank_account_id
    decimal amount
    decimal received_amount
    uuid in_transit_account_id
    text status_code
  }
  fin_cash_flow_categories {
    uuid id PK
    text code
    text section
  }
  fin_cashboxes ||--o{ fin_cash_transactions : records
  fin_cashboxes ||..o{ fin_funds_transfers : "from/to cashbox"
  fin_bank_accounts ||..o{ fin_funds_transfers : "from/to bank account"
  fin_accounts ||..o{ fin_cashboxes : "FK gl_account_id"
  fin_accounts ||..o{ fin_cash_transactions : "FK counter_account_id"
  fin_journal_entries ||..o{ fin_cash_transactions : "FK journal_entry_id"
  fin_journal_entries ||..o{ fin_funds_transfers : "dispatch + completion JEs"
  pos_sessions ||..o{ fin_cash_transactions : "FK pos_session_id"
  fin_cash_flow_categories ||..o{ fin_accounts : classifies
```

## Domain 7 — Banking + reconciliation

```mermaid
erDiagram
  fin_bank_accounts {
    uuid id PK
    text code
    text bank_name
    text account_number
    text iban
    uuid gl_account_id
    decimal current_balance
  }
  fin_bank_statements {
    uuid id PK
    uuid bank_account_id FK
    timestamp statement_date
    decimal opening_balance
    decimal closing_balance
    text import_source
  }
  fin_bank_statement_lines {
    uuid id PK
    uuid statement_id FK
    timestamp line_date
    decimal amount
    text match_status_code
    text external_id
  }
  fin_bank_reconciliations {
    uuid id PK
    uuid bank_account_id FK
    timestamp as_of_date
    decimal statement_balance
    decimal gl_balance
    decimal unreconciled_difference
    text status_code
  }
  fin_bank_reconciliation_matches {
    uuid id PK
    uuid reconciliation_id FK
    uuid statement_line_id
    uuid journal_line_id
    decimal matched_amount
    text match_type
  }
  fin_bank_matching_rules {
    uuid id PK
    uuid bank_account_id
    text pattern
    text match_field
    int priority
  }
  fin_cheque_books {
    uuid id PK
    uuid bank_account_id FK
    text book_number
    int start_number
    int end_number
  }
  fin_cheques {
    uuid id PK
    text cheque_number
    text direction
    uuid cheque_book_id FK
    decimal amount
    timestamp maturity_date
    text status_code
  }
  fin_bank_accounts ||--o{ fin_bank_statements : receives
  fin_bank_statements ||--o{ fin_bank_statement_lines : contains
  fin_bank_accounts ||--o{ fin_bank_reconciliations : reconciles
  fin_bank_reconciliations ||--o{ fin_bank_reconciliation_matches : matches
  fin_bank_accounts ||--o{ fin_cheque_books : issues
  fin_cheque_books ||--o{ fin_cheques : numbers
  fin_bank_statement_lines ||..o{ fin_bank_reconciliation_matches : "FK statement_line_id"
  fin_journal_lines ||..o{ fin_bank_reconciliation_matches : "FK journal_line_id"
  fin_bank_accounts ||..o{ fin_bank_matching_rules : scopes
  fin_journal_entries ||..o{ fin_cheques : "FK clearing_journal_entry_id"
  fin_accounts ||..o{ fin_bank_accounts : "FK gl_account_id"
```

## Domain 8 — Tax accounting

```mermaid
erDiagram
  fin_tax_authorities {
    uuid id PK
    text code
    text registration_number
    uuid payable_account_id
    uuid receivable_account_id
  }
  fin_tax_types {
    uuid id PK
    text code
    text direction
  }
  fin_tax_codes {
    uuid id PK
    text code
    uuid tax_type_id
    uuid authority_id
    uuid input_account_id
    uuid output_account_id
    text reporting_box_code
    boolean is_inclusive
  }
  fin_tax_code_rates {
    uuid id PK
    uuid tax_code_id FK
    decimal rate
    timestamp effective_from
    timestamp effective_to
  }
  fin_tax_code_mappings {
    uuid id PK
    uuid tax_rate_id
    uuid res_tax_config_id
    uuid tax_code_id
  }
  fin_tax_transactions {
    uuid id PK
    uuid journal_entry_id
    uuid tax_code_id FK
    text direction
    decimal taxable_base_amount
    decimal tax_amount
    uuid tax_return_id
  }
  fin_tax_returns {
    uuid id PK
    text return_number
    uuid authority_id
    timestamp period_start
    timestamp period_end
    decimal net_payable
    text status_code
  }
  fin_tax_return_lines {
    uuid id PK
    uuid return_id FK
    text box_code
    decimal taxable_amount
    decimal tax_amount
  }
  fin_wht_certificates {
    uuid id PK
    text certificate_number
    uuid supplier_id
    uuid tax_code_id
    decimal base_amount
    decimal wht_amount
  }
  fin_tax_types ||..o{ fin_tax_codes : "FK tax_type_id"
  fin_tax_authorities ||..o{ fin_tax_codes : "FK authority_id"
  fin_tax_codes ||--o{ fin_tax_code_rates : "effective-dated rates"
  fin_tax_codes ||--o{ fin_tax_transactions : accumulates
  fin_tax_returns ||--o{ fin_tax_return_lines : boxes
  fin_tax_returns ||..o{ fin_tax_transactions : "FK tax_return_id (sweep)"
  tax_rates ||..o{ fin_tax_code_mappings : "FK tax_rate_id (zero-touch)"
  res_tax_configs ||..o{ fin_tax_code_mappings : "FK res_tax_config_id"
  fin_tax_codes ||..o{ fin_tax_code_mappings : "FK tax_code_id"
  fin_journal_entries ||..o{ fin_tax_transactions : "FK journal_entry_id"
  fin_tax_authorities ||..o{ fin_tax_returns : "FK authority_id"
  suppliers ||..o{ fin_wht_certificates : "FK supplier_id"
```

## Domain 9 — Multi-currency

```mermaid
erDiagram
  fin_currencies {
    uuid id PK
    text code
    text symbol
    int decimal_places
  }
  fin_exchange_rates {
    uuid id PK
    text from_currency_code
    text to_currency_code
    timestamp rate_date
    decimal rate
    text rate_type
  }
  fin_fx_revaluation_runs {
    uuid id PK
    text run_number
    timestamp as_of_date
    text rate_type
    uuid journal_entry_id
    uuid reversal_journal_entry_id
    decimal total_gain_base
    decimal total_loss_base
  }
  fin_fx_revaluation_lines {
    uuid id PK
    uuid run_id FK
    uuid account_id
    text currency_code
    decimal foreign_balance
    decimal old_rate
    decimal new_rate
    decimal gain_loss_base
  }
  fin_currencies ||..o{ fin_exchange_rates : "pairs (by code)"
  fin_fx_revaluation_runs ||--o{ fin_fx_revaluation_lines : details
  fin_exchange_rates ||..o{ fin_fx_revaluation_runs : "closing rates"
  fin_accounts ||..o{ fin_fx_revaluation_lines : "FK account_id"
  fin_journal_entries ||..o{ fin_fx_revaluation_runs : "reval + reversal JEs"
```

## Domain 10 — Cost dimensions

```mermaid
erDiagram
  fin_cost_centers {
    uuid id PK
    text code
    uuid parent_cost_center_id FK
    uuid manager_profile_id
  }
  fin_projects {
    uuid id PK
    text code
    uuid customer_id
    decimal budget_amount
    text status_code
  }
  fin_analysis_dimensions {
    uuid id PK
    text code
    boolean is_required_on_posting
  }
  fin_analysis_dimension_values {
    uuid id PK
    uuid dimension_id FK
    text code
  }
  fin_journal_line_dimensions {
    uuid id PK
    uuid journal_line_id FK
    uuid dimension_id FK
    uuid dimension_value_id FK
  }
  fin_cost_centers ||--o{ fin_cost_centers : "parent_cost_center_id"
  fin_analysis_dimensions ||--o{ fin_analysis_dimension_values : values
  fin_analysis_dimensions ||--o{ fin_journal_line_dimensions : stamps
  fin_analysis_dimension_values ||--o{ fin_journal_line_dimensions : "value"
  fin_journal_lines ||--o{ fin_journal_line_dimensions : "dimension stamps"
  fin_cost_centers ||..o{ fin_journal_lines : "FK cost_center_id"
  fin_projects ||..o{ fin_journal_lines : "FK project_id"
  customers ||..o{ fin_projects : "FK customer_id"
```

## Domain 11 — Budgets

```mermaid
erDiagram
  fin_budgets {
    uuid id PK
    text code
    uuid fiscal_year_id
    int revision_number
    text status_code
    uuid approval_request_id
  }
  fin_budget_lines {
    uuid id PK
    uuid budget_id FK
    uuid account_id
    uuid fiscal_period_id
    uuid cost_center_id
    decimal amount
  }
  fin_budget_revisions {
    uuid id PK
    uuid budget_id FK
    int revision_number
    jsonb snapshot
  }
  fin_budget_transfers {
    uuid id PK
    text transfer_number
    uuid from_budget_line_id
    uuid to_budget_line_id
    decimal amount
    text status_code
  }
  fin_budget_control_policies {
    uuid id PK
    uuid account_id
    uuid cost_center_id
    text control_action
    decimal tolerance_rate
  }
  fin_budgets ||--o{ fin_budget_lines : contains
  fin_budgets ||--o{ fin_budget_revisions : versions
  fin_budget_lines ||..o{ fin_budget_transfers : "from/to lines"
  fin_fiscal_years ||..o{ fin_budgets : "FK fiscal_year_id"
  fin_fiscal_periods ||..o{ fin_budget_lines : "FK fiscal_period_id"
  fin_accounts ||..o{ fin_budget_lines : "FK account_id"
  fin_cost_centers ||..o{ fin_budget_lines : "FK cost_center_id"
  fin_accounts ||..o{ fin_budget_control_policies : "FK account_id"
  pod_approval_requests ||..o{ fin_budgets : "FK approval_request_id"
```

## Domain 12 — Fixed assets

```mermaid
erDiagram
  fin_asset_categories {
    uuid id PK
    text code
    uuid asset_account_id
    uuid accum_depreciation_account_id
    uuid depreciation_expense_account_id
    text default_method_code
  }
  fin_depreciation_methods {
    uuid id PK
    text code
    text calculation_strategy
  }
  fin_assets {
    uuid id PK
    text asset_number
    uuid category_id FK
    decimal acquisition_cost
    decimal salvage_value
    int useful_life_months
    text depreciation_method_code
    decimal accumulated_depreciation
    text status_code
  }
  fin_asset_depreciation_schedules {
    uuid id PK
    uuid asset_id FK
    uuid fiscal_period_id
    decimal planned_amount
    decimal posted_amount
    text status_code
  }
  fin_depreciation_runs {
    uuid id PK
    text run_number
    uuid fiscal_period_id
    uuid journal_entry_id
    int asset_count
    decimal total_amount
  }
  fin_asset_depreciation_entries {
    uuid id PK
    uuid run_id FK
    uuid asset_id
    decimal amount
    decimal book_value_after
  }
  fin_asset_disposals {
    uuid id PK
    text disposal_number
    uuid asset_id
    decimal proceeds_amount
    decimal gain_loss_amount
  }
  fin_asset_revaluations {
    uuid id PK
    uuid asset_id
    decimal old_value
    decimal new_value
  }
  fin_asset_transfers {
    uuid id PK
    uuid asset_id
    uuid from_cost_center_id
    uuid to_cost_center_id
  }
  fin_asset_categories ||--o{ fin_assets : classifies
  fin_assets ||--o{ fin_asset_depreciation_schedules : plans
  fin_depreciation_runs ||--o{ fin_asset_depreciation_entries : details
  fin_assets ||..o{ fin_asset_depreciation_entries : "FK asset_id"
  fin_assets ||..o{ fin_asset_disposals : "FK asset_id"
  fin_assets ||..o{ fin_asset_revaluations : "FK asset_id"
  fin_assets ||..o{ fin_asset_transfers : "FK asset_id"
  fin_depreciation_methods ||..o{ fin_assets : "by code"
  fin_fiscal_periods ||..o{ fin_depreciation_runs : "FK fiscal_period_id"
  fin_journal_entries ||..o{ fin_depreciation_runs : "FK journal_entry_id"
  pod_supplier_invoices ||..o{ fin_assets : "capitalization source doc"
```

## Domain 13 — Closing, opening balances, allocations

```mermaid
erDiagram
  fin_close_task_templates {
    uuid id PK
    text code
    text module_code
    int sequence
    boolean is_required
  }
  fin_period_close_runs {
    uuid id PK
    uuid fiscal_period_id
    text status_code
    timestamp completed_at
  }
  fin_period_close_run_tasks {
    uuid id PK
    uuid close_run_id FK
    uuid template_id
    text status_code
  }
  fin_year_close_runs {
    uuid id PK
    uuid fiscal_year_id
    uuid closing_journal_entry_id
    uuid opening_journal_entry_id
    decimal total_pl_swept
  }
  fin_opening_balance_batches {
    uuid id PK
    text batch_number
    timestamp as_of_date
    decimal total_debit
    decimal total_credit
    text status_code
  }
  fin_opening_balance_lines {
    uuid id PK
    uuid batch_id FK
    uuid account_id
    uuid party_id
    decimal debit_amount
    decimal credit_amount
    timestamp due_date
  }
  fin_allocation_rules {
    uuid id PK
    text code
    uuid source_account_id
    text allocation_basis
  }
  fin_allocation_rule_targets {
    uuid id PK
    uuid rule_id FK
    uuid target_account_id
    decimal percentage
  }
  fin_allocation_runs {
    uuid id PK
    text run_number
    uuid rule_id
    decimal source_amount
    uuid journal_entry_id
  }
  fin_period_close_runs ||--o{ fin_period_close_run_tasks : checklist
  fin_close_task_templates ||..o{ fin_period_close_run_tasks : "FK template_id"
  fin_opening_balance_batches ||--o{ fin_opening_balance_lines : contains
  fin_allocation_rules ||--o{ fin_allocation_rule_targets : distributes
  fin_allocation_rules ||..o{ fin_allocation_runs : "FK rule_id"
  fin_fiscal_periods ||..o{ fin_period_close_runs : closes
  fin_fiscal_years ||..o{ fin_year_close_runs : closes
  fin_journal_entries ||..o{ fin_year_close_runs : "closing + opening JEs"
  fin_journal_entries ||..o{ fin_opening_balance_batches : "FK journal_entry_id"
  fin_journal_entries ||..o{ fin_allocation_runs : "FK journal_entry_id"
  fin_accounts ||..o{ fin_opening_balance_lines : "FK account_id"
  fin_accounts ||..o{ fin_allocation_rule_targets : "FK target_account_id"
```

## Domain 14 — Settings + posting engine

```mermaid
erDiagram
  fin_settings {
    uuid id PK
    uuid tenant_id FK
    text base_currency_code
    uuid retained_earnings_account_id
    uuid suspense_account_id
    uuid default_ar_control_account_id
    uuid default_ap_control_account_id
    boolean strict_account_resolution
    jsonb posting_modes
  }
  fin_posting_rules {
    uuid id PK
    text event_type
    text source_doc_type
    text journal_type_code
    int priority
    jsonb conditions
  }
  fin_posting_rule_lines {
    uuid id PK
    uuid rule_id FK
    text line_role
    text side
    text account_source
    text settings_field
    text amount_selector
    int multiplier
  }
  fin_posting_queue {
    uuid id PK
    uuid domain_event_id
    text event_type
    text source_doc_type
    uuid source_doc_id
    text status_code
    int attempt_count
    timestamp next_attempt_at
    uuid journal_entry_id
  }
  fin_event_cursors {
    uuid id PK
    text consumer_name
    uuid last_event_id
  }
  fin_payment_terms {
    uuid id PK
    text code
    int due_days
    int discount_days
    decimal discount_rate
  }
  fin_posting_rules ||--o{ fin_posting_rule_lines : recipe
  fin_settings ||..o{ fin_posting_rule_lines : "settings_field defaults"
  fin_account_mappings ||..o{ fin_posting_rule_lines : "mapping resolution"
  domain_events ||..o{ fin_posting_queue : "FK domain_event_id"
  domain_events ||..o{ fin_event_cursors : "FK last_event_id"
  fin_posting_queue ||..o{ fin_journal_entries : "produces (FK journal_entry_id)"
  fin_payment_terms ||..o{ fin_customer_financial_profiles : "FK payment_term_id"
  fin_payment_terms ||..o{ fin_supplier_financial_profiles : "FK payment_term_id"
```

## Cross-domain integration

`fin_journal_entries` is the hub every module posts into: operational documents flow in through
the outbox → cursor → queue pipeline (async) or post directly in-transaction (fin-native docs);
each posted entry fans out to lines, GL balances, subledgers, and tax transactions.

```mermaid
erDiagram
  pod_supplier_invoices ||..o{ fin_posting_queue : "supplier_invoice.posted"
  pod_supplier_payments ||..o{ fin_posting_queue : "supplier_payment.posted"
  pos_sales ||..o{ fin_posting_queue : "pos_sale.completed"
  sales_invoices ||..o{ fin_posting_queue : "sales_invoice.issued"
  res_orders ||..o{ fin_posting_queue : "restaurant_order.completed"
  inventory_movements ||..o{ fin_posting_queue : "inventory events (Phase 2)"
  domain_events ||..o{ fin_posting_queue : feeds
  fin_event_cursors ||..o{ domain_events : "consumer checkpoint"
  fin_posting_queue ||..o{ fin_journal_entries : "async posting"
  fin_posting_rules ||..o{ fin_journal_entries : "recipe resolution"
  fin_ar_receipts ||..o{ fin_journal_entries : "sync posting"
  fin_cash_transactions ||..o{ fin_journal_entries : "sync posting"
  fin_depreciation_runs ||..o{ fin_journal_entries : "sync posting"
  fin_journal_entries ||--o{ fin_journal_lines : contains
  fin_journal_lines ||..o{ fin_gl_balances : "upsert-increments"
  fin_journal_entries ||..o{ fin_customer_ledger_entries : "AR subledger"
  fin_journal_entries ||..o{ fin_vendor_ledger_entries : "AP subledger"
  fin_journal_entries ||..o{ fin_tax_transactions : "tax subledger"
  fin_accounts ||..o{ fin_journal_lines : posts
  fin_fiscal_periods ||..o{ fin_journal_entries : gates
```

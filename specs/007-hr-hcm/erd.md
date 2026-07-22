# ERD — Feature 007 (HR / HCM)

Mermaid ERDs grouped by domain cluster across the **88 `hr_` tables**. As in the
006 ERDs, only two kinds of link are real DB foreign keys, drawn as solid
crow's-foot lines:

1. The **tenant** relationship — every `hr_*` table carries
   `tenant_id → tenant_accounts` (real FK, `onDelete: Cascade`). It is shown once
   in the tenant-scope block below and omitted from the per-domain diagrams for
   readability.
2. The **`HrEmployee` composition** — only `hr_employees` declares Prisma
   `@relation`s to its eleven owned sub-tables (contacts, addresses, documents,
   bank accounts, contracts, history, dependents, education, experience,
   certifications, languages). Those are real cascading FKs.

**Every other reference is a bare scalar UUID with app-enforced integrity**,
drawn as a dashed `||..o{` link — this includes intra-HR references
(`employee_id` on time/leave/payroll rows, `department_id`, `position_id`,
`manager_id`, `leave_type_id`, `payroll_run_id`, …) and all cross-module
references. Statuses use free-string `status_code` / `stage_code` /
`employment_status` columns against the `pod_document_statuses` registry — no
new Prisma enums. Money is `Decimal(19,4)`.

Cross-module references are annotated scalar UUIDs pointing at foreign
aggregates (shown as attribute-less entities): `profiles` (`profile_id`,
`created_by`, approver ids), `fin_accounts` (`gl_account_id`),
`fin_cost_centers` (`fin_cost_center_id`), `fin_journal_entries`
(`journal_entry_id`), `pod_approval_requests` (`approval_request_id`),
`products` (`product_id`), `fin_assets` (`fin_asset_id`), `warehouses`
(`warehouse_id`).

## Tenant scope (applies to every table)

```mermaid
erDiagram
  tenant_accounts ||--o{ hr_companies : owns
  tenant_accounts ||--o{ hr_employees : owns
  tenant_accounts ||--o{ hr_job_openings : owns
  tenant_accounts ||--o{ hr_leave_requests : owns
  tenant_accounts ||--o{ hr_payroll_runs : owns
  tenant_accounts ||--o{ hr_performance_reviews : owns
  tenant_accounts ||--o{ hr_expense_claims : owns
  tenant_accounts ||--o{ hr_employee_assets : owns
  note "88 hr_ tables total; each carries tenant_id FK (cascade). Only hr_employees declares Prisma relations to its 11 sub-tables — all other links are app-enforced scalar UUIDs."
```

## Domain 1 — Organization Management

```mermaid
erDiagram
  hr_companies {
    uuid id PK
    uuid tenant_id FK
    text code
    text name
    text legal_name
    uuid parent_company_id
    boolean is_legal_entity
    text status_code
  }
  hr_branches {
    uuid id PK
    uuid tenant_id FK
    uuid company_id
    text code
    text branch_type
    uuid cost_center_id
    uuid warehouse_id
    uuid manager_id
    text status_code
  }
  hr_business_units {
    uuid id PK
    uuid company_id
    text code
    uuid head_id
    uuid cost_center_id
  }
  hr_divisions {
    uuid id PK
    uuid company_id
    uuid business_unit_id
    text code
    uuid head_id
  }
  hr_departments {
    uuid id PK
    uuid company_id
    uuid branch_id
    uuid division_id
    uuid parent_department_id
    text code
    uuid manager_id
    uuid cost_center_id
    int depth_level
    text path_text
    int headcount_budget
  }
  hr_sections {
    uuid id PK
    uuid department_id
    text code
    uuid supervisor_id
  }
  hr_job_grades {
    uuid id PK
    text code
    int grade_level
    decimal min_salary
    decimal mid_salary
    decimal max_salary
    int annual_leave_days
  }
  hr_positions {
    uuid id PK
    text code
    text title
    uuid department_id
    uuid job_grade_id
    uuid reports_to_id
    text employment_type
    int headcount_limit
    boolean is_managerial
  }
  hr_cost_centers {
    uuid id PK
    text code
    uuid company_id
    uuid department_id
    uuid parent_id
    uuid fin_cost_center_id
  }
  hr_reporting_structure {
    uuid id PK
    uuid employee_id
    uuid manager_id
    text relation_type
    timestamp effective_from
    timestamp effective_to
    boolean is_primary
  }
  hr_companies ||..o{ hr_branches : "FK company_id"
  hr_companies ||..o{ hr_business_units : "FK company_id"
  hr_companies ||..o{ hr_divisions : "FK company_id"
  hr_business_units ||..o{ hr_divisions : "FK business_unit_id"
  hr_companies ||..o{ hr_departments : "FK company_id"
  hr_branches ||..o{ hr_departments : "FK branch_id"
  hr_divisions ||..o{ hr_departments : "FK division_id"
  hr_departments ||..o{ hr_departments : "FK parent_department_id"
  hr_departments ||..o{ hr_sections : "FK department_id"
  hr_departments ||..o{ hr_positions : "FK department_id"
  hr_job_grades ||..o{ hr_positions : "FK job_grade_id"
  hr_positions ||..o{ hr_positions : "FK reports_to_id"
  hr_cost_centers ||..o{ hr_cost_centers : "FK parent_id"
  hr_companies ||..o{ hr_cost_centers : "FK company_id"
  hr_companies ||..o{ hr_companies : "FK parent_company_id"
  fin_cost_centers ||..o{ hr_cost_centers : "FK fin_cost_center_id (cross-module)"
  warehouses ||..o{ hr_branches : "FK warehouse_id (cross-module)"
  hr_employees ||..o{ hr_reporting_structure : "FK employee_id / manager_id"
```

## Domain 2 — Employee Master + sub-tables

The only cluster with real Prisma `@relation` FKs (solid lines): `hr_employees`
owns its eleven sub-tables with `onDelete: Cascade`.

```mermaid
erDiagram
  hr_employees {
    uuid id PK
    uuid tenant_id FK
    text employee_code
    uuid profile_id
    text first_name
    text last_name
    uuid company_id
    uuid branch_id
    uuid department_id
    uuid section_id
    uuid position_id
    uuid job_grade_id
    uuid cost_center_id
    uuid manager_id
    text employment_type
    text employment_status
    timestamp hire_date
    timestamp probation_end_date
    timestamp confirmation_date
    timestamp termination_date
    boolean is_rehire_eligible
  }
  hr_employee_contacts {
    uuid id PK
    uuid employee_id FK
    text contact_type
    text name
    boolean is_primary
  }
  hr_employee_addresses {
    uuid id PK
    uuid employee_id FK
    text address_type
    text address_line1
    boolean is_primary
  }
  hr_employee_documents {
    uuid id PK
    uuid employee_id FK
    text document_type
    text document_no
    timestamp expiry_date
    uuid attachment_id
    boolean is_verified
  }
  hr_employee_bank_accounts {
    uuid id PK
    uuid employee_id FK
    text bank_name
    text account_number
    decimal allocation_pct
    boolean is_primary
  }
  hr_employee_contracts {
    uuid id PK
    uuid employee_id FK
    text contract_number
    text contract_type
    timestamp start_date
    timestamp end_date
    uuid job_grade_id
    uuid position_id
    decimal base_salary
    text pay_frequency
    uuid salary_structure_id
    text status_code
  }
  hr_employee_history {
    uuid id PK
    uuid employee_id FK
    text change_type
    text field_name
    text old_value
    text new_value
    timestamp effective_date
    uuid changed_by
  }
  hr_employee_dependents {
    uuid id PK
    uuid employee_id FK
    text name
    text relationship
    boolean is_beneficiary
    boolean is_insured
  }
  hr_employee_education {
    uuid id PK
    uuid employee_id FK
    text institution
    text degree
  }
  hr_employee_experience {
    uuid id PK
    uuid employee_id FK
    text company_name
    text job_title
  }
  hr_employee_certifications {
    uuid id PK
    uuid employee_id FK
    text name
    timestamp expiry_date
  }
  hr_employee_languages {
    uuid id PK
    uuid employee_id FK
    text language
    text proficiency
  }
  hr_employees ||--o{ hr_employee_contacts : contains
  hr_employees ||--o{ hr_employee_addresses : contains
  hr_employees ||--o{ hr_employee_documents : contains
  hr_employees ||--o{ hr_employee_bank_accounts : contains
  hr_employees ||--o{ hr_employee_contracts : contains
  hr_employees ||--o{ hr_employee_history : "append-only audit"
  hr_employees ||--o{ hr_employee_dependents : contains
  hr_employees ||--o{ hr_employee_education : contains
  hr_employees ||--o{ hr_employee_experience : contains
  hr_employees ||--o{ hr_employee_certifications : contains
  hr_employees ||--o{ hr_employee_languages : contains
  profiles ||..o{ hr_employees : "FK profile_id (identity bridge)"
  hr_departments ||..o{ hr_employees : "FK department_id"
  hr_positions ||..o{ hr_employees : "FK position_id"
  hr_employees ||..o{ hr_employees : "FK manager_id"
  hr_salary_structures ||..o{ hr_employee_contracts : "FK salary_structure_id"
```

## Domain 3 — Recruitment (ATS)

```mermaid
erDiagram
  hr_job_openings {
    uuid id PK
    text requisition_no
    text title
    uuid department_id
    uuid position_id
    uuid job_grade_id
    uuid branch_id
    uuid hiring_manager_id
    int vacancies
    decimal salary_min
    decimal salary_max
    uuid approval_request_id
    text status_code
  }
  hr_candidates {
    uuid id PK
    uuid job_opening_id
    text candidate_code
    text first_name
    text last_name
    text source
    decimal expected_salary
    int rating
    text stage_code
    text status_code
  }
  hr_candidate_documents {
    uuid id PK
    uuid candidate_id
    text document_type
    uuid attachment_id
  }
  hr_interviews {
    uuid id PK
    uuid candidate_id
    uuid job_opening_id
    int round_number
    text interview_type
    timestamp scheduled_at
    text status_code
  }
  hr_interview_feedback {
    uuid id PK
    uuid interview_id
    uuid interviewer_id
    decimal overall_score
    text recommendation
  }
  hr_job_offers {
    uuid id PK
    uuid candidate_id
    uuid job_opening_id
    text offer_number
    uuid position_id
    uuid job_grade_id
    decimal offered_salary
    timestamp start_date
    uuid approval_request_id
    text status_code
  }
  hr_offer_acceptance {
    uuid id PK
    uuid offer_id
    timestamp responded_at
    text decision
    text signature_url
  }
  hr_job_openings ||..o{ hr_candidates : "FK job_opening_id"
  hr_candidates ||..o{ hr_candidate_documents : "FK candidate_id"
  hr_candidates ||..o{ hr_interviews : "FK candidate_id"
  hr_interviews ||..o{ hr_interview_feedback : "FK interview_id"
  hr_candidates ||..o{ hr_job_offers : "FK candidate_id"
  hr_job_offers ||..o{ hr_offer_acceptance : "FK offer_id"
  hr_positions ||..o{ hr_job_openings : "FK position_id"
  hr_departments ||..o{ hr_job_openings : "FK department_id"
  pod_approval_requests ||..o{ hr_job_openings : "FK approval_request_id (cross-module)"
  pod_approval_requests ||..o{ hr_job_offers : "FK approval_request_id (cross-module)"
  profiles ||..o{ hr_interview_feedback : "FK interviewer_id"
  hr_employees ||..o{ hr_candidates : "hire → HrEmployee (created on offer acceptance)"
```

## Domain 4 — Onboarding

```mermaid
erDiagram
  hr_onboarding_templates {
    uuid id PK
    text code
    text name
    uuid department_id
    text status_code
  }
  hr_onboarding_tasks {
    uuid id PK
    uuid template_id
    int sequence
    text title
    text category
    text owner_role
    int due_offset_days
    boolean is_mandatory
  }
  hr_employee_onboarding {
    uuid id PK
    uuid employee_id
    uuid template_id
    uuid task_id
    text title
    uuid assigned_to_id
    timestamp due_date
    timestamp completed_at
    text status_code
  }
  hr_onboarding_templates ||..o{ hr_onboarding_tasks : "FK template_id"
  hr_onboarding_templates ||..o{ hr_employee_onboarding : "FK template_id (instantiated)"
  hr_onboarding_tasks ||..o{ hr_employee_onboarding : "FK task_id (per-task instance)"
  hr_employees ||..o{ hr_employee_onboarding : "FK employee_id"
  hr_departments ||..o{ hr_onboarding_templates : "FK department_id"
```

## Domain 5 — Time Management

```mermaid
erDiagram
  hr_shift_definitions {
    uuid id PK
    text code
    text shift_type
    text start_time
    text end_time
    int break_minutes
    decimal work_hours
    boolean is_night_shift
    int grace_in_mins
    int grace_out_mins
  }
  hr_shift_patterns {
    uuid id PK
    text code
    int rotation_days
    json pattern_json
  }
  hr_shift_assignments {
    uuid id PK
    uuid employee_id
    uuid shift_id
    uuid pattern_id
    timestamp start_date
    timestamp end_date
  }
  hr_attendance_logs {
    uuid id PK
    uuid employee_id
    timestamp event_time
    text direction
    text capture_method
    text device_id
    boolean is_processed
    json raw_payload
  }
  hr_attendance_daily {
    uuid id PK
    uuid employee_id
    timestamp work_date
    uuid shift_id
    timestamp first_in
    timestamp last_out
    decimal worked_hours
    decimal overtime_hours
    int late_minutes
    text attendance_code
  }
  hr_timesheets {
    uuid id PK
    uuid employee_id
    timestamp period_start
    timestamp period_end
    decimal total_hours
    decimal billable_hours
    uuid project_id
    uuid approval_request_id
    text status_code
  }
  hr_overtime_requests {
    uuid id PK
    uuid employee_id
    text request_number
    timestamp overtime_date
    decimal hours
    decimal rate_multiplier
    uuid approval_request_id
    text status_code
  }
  hr_break_logs {
    uuid id PK
    uuid employee_id
    uuid attendance_daily_id
    timestamp break_start
    timestamp break_end
    int minutes
    boolean is_paid
  }
  hr_shift_definitions ||..o{ hr_shift_assignments : "FK shift_id"
  hr_shift_patterns ||..o{ hr_shift_assignments : "FK pattern_id"
  hr_shift_definitions ||..o{ hr_attendance_daily : "FK shift_id"
  hr_attendance_daily ||..o{ hr_break_logs : "FK attendance_daily_id"
  hr_employees ||..o{ hr_shift_assignments : "FK employee_id"
  hr_employees ||..o{ hr_attendance_logs : "FK employee_id"
  hr_employees ||..o{ hr_attendance_daily : "FK employee_id (raw logs rolled up)"
  hr_employees ||..o{ hr_timesheets : "FK employee_id"
  hr_employees ||..o{ hr_overtime_requests : "FK employee_id"
  fin_projects ||..o{ hr_timesheets : "FK project_id (cross-module)"
  pod_approval_requests ||..o{ hr_overtime_requests : "FK approval_request_id (cross-module)"
```

## Domain 6 — Leave Management

```mermaid
erDiagram
  hr_leave_types {
    uuid id PK
    text code
    text name
    boolean is_paid
    boolean affects_payroll
    boolean requires_document
    decimal max_days_per_year
  }
  hr_leave_policies {
    uuid id PK
    uuid leave_type_id
    uuid job_grade_id
    text accrual_method
    decimal days_per_year
    decimal accrual_rate
    decimal max_carryover
    int min_service_months
    boolean allow_negative
  }
  hr_leave_balances {
    uuid id PK
    uuid employee_id
    uuid leave_type_id
    int year
    decimal entitled_days
    decimal accrued_days
    decimal used_days
    decimal pending_days
    decimal carried_days
    decimal balance_days
  }
  hr_leave_requests {
    uuid id PK
    uuid employee_id
    uuid leave_type_id
    text request_number
    timestamp start_date
    timestamp end_date
    decimal total_days
    boolean is_half_day
    uuid approval_request_id
    text status_code
  }
  hr_leave_approvals {
    uuid id PK
    uuid leave_request_id
    uuid approver_id
    int step_order
    text decision
    timestamp decided_at
  }
  hr_leave_types ||..o{ hr_leave_policies : "FK leave_type_id"
  hr_leave_types ||..o{ hr_leave_balances : "FK leave_type_id"
  hr_leave_types ||..o{ hr_leave_requests : "FK leave_type_id"
  hr_leave_requests ||..o{ hr_leave_approvals : "FK leave_request_id (step ladder)"
  hr_job_grades ||..o{ hr_leave_policies : "FK job_grade_id"
  hr_employees ||..o{ hr_leave_balances : "FK employee_id"
  hr_employees ||..o{ hr_leave_requests : "FK employee_id (decrements balance on approve)"
  profiles ||..o{ hr_leave_approvals : "FK approver_id"
  pod_approval_requests ||..o{ hr_leave_requests : "FK approval_request_id (cross-module)"
```

## Domain 7 — Payroll & Benefits

```mermaid
erDiagram
  hr_salary_components {
    uuid id PK
    text code
    text component_type
    text calc_method
    text formula
    boolean is_taxable
    boolean affects_gross
    uuid gl_account_id
  }
  hr_salary_structures {
    uuid id PK
    text code
    uuid job_grade_id
    json components_json
  }
  hr_employee_salary_components {
    uuid id PK
    uuid employee_id
    uuid component_id
    decimal amount
    decimal percentage
    timestamp effective_from
    timestamp effective_to
  }
  hr_payroll_periods {
    uuid id PK
    text code
    text period_type
    timestamp start_date
    timestamp end_date
    timestamp pay_date
    text status_code
  }
  hr_payroll_runs {
    uuid id PK
    uuid period_id
    text run_number
    text run_type
    uuid company_id
    uuid department_id
    decimal total_gross
    decimal total_deductions
    decimal total_net
    uuid approval_request_id
    uuid journal_entry_id
    boolean is_posted
    text status_code
  }
  hr_payroll_details {
    uuid id PK
    uuid payroll_run_id
    uuid employee_id
    uuid contract_id
    decimal worked_days
    decimal gross_pay
    decimal total_deductions
    decimal net_pay
    uuid bank_account_id
    text payment_status
  }
  hr_payroll_component_details {
    uuid id PK
    uuid payroll_detail_id
    uuid component_id
    text component_code
    text component_type
    decimal amount
  }
  hr_loans {
    uuid id PK
    uuid employee_id
    text loan_number
    decimal principal_amount
    decimal installment_amount
    decimal outstanding_amount
    uuid approval_request_id
    uuid journal_entry_id
    text status_code
  }
  hr_loan_installments {
    uuid id PK
    uuid loan_id
    int installment_no
    timestamp due_date
    decimal amount
    uuid payroll_run_id
    text status_code
  }
  hr_salary_advances {
    uuid id PK
    uuid employee_id
    text advance_number
    decimal amount
    int recovery_months
    decimal recovered_amount
    uuid approval_request_id
    uuid journal_entry_id
    text status_code
  }
  hr_employee_benefits {
    uuid id PK
    uuid employee_id
    text benefit_type
    decimal amount
    text frequency
    text policy_number
  }
  hr_commissions {
    uuid id PK
    uuid employee_id
    text source_type
    uuid source_id
    uuid period_id
    decimal commission_amount
    uuid payroll_run_id
    text status_code
  }
  hr_salary_components ||..o{ hr_employee_salary_components : "FK component_id"
  hr_salary_components ||..o{ hr_payroll_component_details : "FK component_id"
  hr_job_grades ||..o{ hr_salary_structures : "FK job_grade_id"
  hr_payroll_periods ||..o{ hr_payroll_runs : "FK period_id"
  hr_payroll_runs ||..o{ hr_payroll_details : "FK payroll_run_id"
  hr_payroll_details ||..o{ hr_payroll_component_details : "FK payroll_detail_id"
  hr_loans ||..o{ hr_loan_installments : "FK loan_id"
  hr_payroll_runs ||..o{ hr_loan_installments : "FK payroll_run_id (recovery)"
  hr_payroll_runs ||..o{ hr_commissions : "FK payroll_run_id (payout)"
  hr_employees ||..o{ hr_employee_salary_components : "FK employee_id"
  hr_employees ||..o{ hr_payroll_details : "FK employee_id"
  hr_employees ||..o{ hr_loans : "FK employee_id"
  hr_employees ||..o{ hr_salary_advances : "FK employee_id"
  hr_employees ||..o{ hr_employee_benefits : "FK employee_id"
  hr_employees ||..o{ hr_commissions : "FK employee_id"
  hr_employee_contracts ||..o{ hr_payroll_details : "FK contract_id"
  fin_accounts ||..o{ hr_salary_components : "FK gl_account_id (cross-module)"
  fin_journal_entries ||..o{ hr_payroll_runs : "FK journal_entry_id (cross-module)"
  fin_journal_entries ||..o{ hr_loans : "FK journal_entry_id (cross-module)"
  pod_approval_requests ||..o{ hr_payroll_runs : "FK approval_request_id (cross-module)"
```

## Domain 8 — Performance Management

```mermaid
erDiagram
  hr_kpis {
    uuid id PK
    text code
    text category
    text measure_unit
    decimal target_value
    decimal weight
  }
  hr_goals {
    uuid id PK
    uuid employee_id
    uuid kpi_id
    text title
    decimal weight
    decimal target_value
    decimal progress_pct
    text status_code
  }
  hr_goal_progress {
    uuid id PK
    uuid goal_id
    decimal progress_pct
    decimal actual_value
    uuid recorded_by_id
    timestamp recorded_at
  }
  hr_review_templates {
    uuid id PK
    text code
    text review_type
    json sections_json
    int rating_scale_max
  }
  hr_performance_reviews {
    uuid id PK
    uuid employee_id
    uuid template_id
    uuid reviewer_id
    text review_type
    decimal overall_score
    text rating_label
    text status_code
  }
  hr_review_scores {
    uuid id PK
    uuid review_id
    uuid kpi_id
    text criterion
    decimal weight
    decimal score
    text reviewer_type
  }
  hr_kpis ||..o{ hr_goals : "FK kpi_id"
  hr_goals ||..o{ hr_goal_progress : "FK goal_id (progress log)"
  hr_review_templates ||..o{ hr_performance_reviews : "FK template_id"
  hr_performance_reviews ||..o{ hr_review_scores : "FK review_id"
  hr_kpis ||..o{ hr_review_scores : "FK kpi_id"
  hr_employees ||..o{ hr_goals : "FK employee_id"
  hr_employees ||..o{ hr_performance_reviews : "FK employee_id"
  profiles ||..o{ hr_performance_reviews : "FK reviewer_id"
```

## Domain 9 — Learning & Training

```mermaid
erDiagram
  hr_training_courses {
    uuid id PK
    text code
    text category
    text delivery_mode
    text provider
    decimal duration_hours
    decimal cost
  }
  hr_training_sessions {
    uuid id PK
    uuid course_id
    text code
    uuid trainer_id
    timestamp start_date
    timestamp end_date
    int capacity
    text status_code
  }
  hr_training_records {
    uuid id PK
    uuid session_id
    uuid employee_id
    timestamp enrolled_at
    decimal attendance_pct
    decimal score
    timestamp completed_at
    text status_code
  }
  hr_training_certificates {
    uuid id PK
    uuid record_id
    uuid employee_id
    text certificate_no
    timestamp issued_at
    timestamp expiry_date
  }
  hr_training_courses ||..o{ hr_training_sessions : "FK course_id"
  hr_training_sessions ||..o{ hr_training_records : "FK session_id"
  hr_training_records ||..o{ hr_training_certificates : "FK record_id"
  hr_employees ||..o{ hr_training_records : "FK employee_id"
  hr_employees ||..o{ hr_training_certificates : "FK employee_id"
```

## Domain 10 — Career, Succession & Workforce Planning

```mermaid
erDiagram
  hr_career_paths {
    uuid id PK
    text code
    uuid from_position_id
    uuid to_position_id
    decimal min_years
  }
  hr_successors {
    uuid id PK
    uuid position_id
    uuid employee_id
    text readiness_level
    int priority
    text status_code
  }
  hr_promotions {
    uuid id PK
    uuid employee_id
    text promotion_number
    uuid from_position_id
    uuid to_position_id
    uuid from_job_grade_id
    uuid to_job_grade_id
    decimal old_salary
    decimal new_salary
    uuid approval_request_id
    text status_code
  }
  hr_skills {
    uuid id PK
    text code
    text category
  }
  hr_employee_skills {
    uuid id PK
    uuid employee_id
    uuid skill_id
    int proficiency
    decimal years_experience
    boolean is_certified
  }
  hr_workforce_plans {
    uuid id PK
    text code
    int fiscal_year
    uuid department_id
    int current_headcount
    int planned_headcount
    uuid approval_request_id
    text status_code
  }
  hr_workforce_requirements {
    uuid id PK
    uuid plan_id
    uuid position_id
    uuid department_id
    int required_count
    int gap_count
    decimal estimated_cost
  }
  hr_skill_requirements {
    uuid id PK
    uuid position_id
    uuid skill_id
    int min_proficiency
    boolean is_mandatory
  }
  hr_positions ||..o{ hr_career_paths : "FK from/to_position_id"
  hr_positions ||..o{ hr_successors : "FK position_id"
  hr_positions ||..o{ hr_promotions : "FK from/to_position_id"
  hr_job_grades ||..o{ hr_promotions : "FK from/to_job_grade_id"
  hr_skills ||..o{ hr_employee_skills : "FK skill_id"
  hr_skills ||..o{ hr_skill_requirements : "FK skill_id"
  hr_positions ||..o{ hr_skill_requirements : "FK position_id"
  hr_workforce_plans ||..o{ hr_workforce_requirements : "FK plan_id"
  hr_positions ||..o{ hr_workforce_requirements : "FK position_id"
  hr_employees ||..o{ hr_successors : "FK employee_id"
  hr_employees ||..o{ hr_promotions : "FK employee_id"
  hr_employees ||..o{ hr_employee_skills : "FK employee_id"
  pod_approval_requests ||..o{ hr_promotions : "FK approval_request_id (cross-module)"
  pod_approval_requests ||..o{ hr_workforce_plans : "FK approval_request_id (cross-module)"
```

## Domain 11 — HR Budgeting

```mermaid
erDiagram
  hr_budget_years {
    uuid id PK
    int fiscal_year
    text name
    uuid company_id
    decimal total_budget
    uuid approval_request_id
    text status_code
  }
  hr_budget_departments {
    uuid id PK
    uuid budget_year_id
    uuid department_id
    text budget_type
    decimal budget_amount
  }
  hr_budget_positions {
    uuid id PK
    uuid budget_year_id
    uuid position_id
    int planned_count
    decimal avg_salary
    decimal total_cost
  }
  hr_budget_actuals {
    uuid id PK
    uuid budget_year_id
    uuid department_id
    text budget_type
    int period_month
    decimal budget_amount
    decimal actual_amount
    decimal variance_amount
  }
  hr_budget_years ||..o{ hr_budget_departments : "FK budget_year_id"
  hr_budget_years ||..o{ hr_budget_positions : "FK budget_year_id"
  hr_budget_years ||..o{ hr_budget_actuals : "FK budget_year_id"
  hr_departments ||..o{ hr_budget_departments : "FK department_id"
  hr_positions ||..o{ hr_budget_positions : "FK position_id"
  hr_departments ||..o{ hr_budget_actuals : "FK department_id"
  pod_approval_requests ||..o{ hr_budget_years : "FK approval_request_id (cross-module)"
```

## Domain 12 — Employee Self Service (ESS)

```mermaid
erDiagram
  hr_employee_requests {
    uuid id PK
    uuid employee_id
    text request_number
    text request_type
    text subject
    text priority
    uuid approval_request_id
    uuid assigned_to_id
    text status_code
  }
  hr_employee_notifications {
    uuid id PK
    uuid employee_id
    text title
    text category
    text entity_type
    uuid entity_id
    boolean is_read
  }
  hr_employee_announcements {
    uuid id PK
    text title
    text audience
    uuid department_id
    timestamp publish_at
    boolean is_pinned
    text status_code
  }
  hr_employee_documents_shared {
    uuid id PK
    uuid employee_id
    text title
    text document_type
    text audience
    boolean requires_ack
    uuid attachment_id
  }
  hr_employees ||..o{ hr_employee_requests : "FK employee_id"
  hr_employees ||..o{ hr_employee_notifications : "FK employee_id"
  hr_employees ||..o{ hr_employee_documents_shared : "FK employee_id (nullable = broadcast)"
  hr_departments ||..o{ hr_employee_announcements : "FK department_id"
  profiles ||..o{ hr_employee_requests : "FK assigned_to_id"
  pod_approval_requests ||..o{ hr_employee_requests : "FK approval_request_id (cross-module)"
```

## Domain 13 — Asset Assignment (Inventory / Fixed-asset integration)

```mermaid
erDiagram
  hr_employee_assets {
    uuid id PK
    uuid employee_id
    text asset_type
    uuid product_id
    uuid fin_asset_id
    text serial_number
    text asset_tag
    text name
    timestamp assigned_date
    timestamp returned_date
    text condition_out
    text condition_in
    decimal value
    text status_code
  }
  hr_employees ||..o{ hr_employee_assets : "FK employee_id"
  products ||..o{ hr_employee_assets : "FK product_id (cross-module — inventory item)"
  fin_assets ||..o{ hr_employee_assets : "FK fin_asset_id (cross-module — capitalized asset)"
```

## Domain 14 — Travel & Expense

```mermaid
erDiagram
  hr_travel_requests {
    uuid id PK
    uuid employee_id
    text request_number
    text purpose
    text travel_type
    timestamp depart_date
    timestamp return_date
    decimal estimated_cost
    decimal advance_amount
    uuid approval_request_id
    text status_code
  }
  hr_expense_claims {
    uuid id PK
    uuid employee_id
    text claim_number
    uuid travel_request_id
    text title
    decimal total_amount
    decimal approved_amount
    uuid cost_center_id
    uuid approval_request_id
    uuid journal_entry_id
    text status_code
  }
  hr_expense_claim_lines {
    uuid id PK
    uuid claim_id
    int line_number
    timestamp expense_date
    text category
    decimal amount
    decimal tax_amount
    boolean is_reimbursable
  }
  hr_expense_reimbursements {
    uuid id PK
    uuid claim_id
    uuid employee_id
    decimal amount
    text payment_method
    uuid bank_account_id
    uuid payroll_run_id
    uuid journal_entry_id
    text status_code
  }
  hr_travel_requests ||..o{ hr_expense_claims : "FK travel_request_id"
  hr_expense_claims ||--o{ hr_expense_claim_lines : "FK claim_id (composition)"
  hr_expense_claims ||..o{ hr_expense_reimbursements : "FK claim_id"
  hr_employees ||..o{ hr_travel_requests : "FK employee_id"
  hr_employees ||..o{ hr_expense_claims : "FK employee_id"
  hr_employees ||..o{ hr_expense_reimbursements : "FK employee_id"
  hr_payroll_runs ||..o{ hr_expense_reimbursements : "FK payroll_run_id (payroll route)"
  fin_journal_entries ||..o{ hr_expense_claims : "FK journal_entry_id (cross-module)"
  fin_journal_entries ||..o{ hr_expense_reimbursements : "FK journal_entry_id (cross-module)"
  fin_cost_centers ||..o{ hr_expense_claims : "FK cost_center_id (cross-module)"
  pod_approval_requests ||..o{ hr_travel_requests : "FK approval_request_id (cross-module)"
  pod_approval_requests ||..o{ hr_expense_claims : "FK approval_request_id (cross-module)"
```

## Cross-module integration summary

`hr_employees` is the hub the entire module hangs off (its `profile_id` bridges
to `profiles` / Supabase identity). HR posts money into Finance through
`journal_entry_id` back-references on payroll runs, loans, salary advances,
expense claims and reimbursements — the same async outbox → `fin_posting_queue`
pipeline the 006 module documents. Approvals for every routed HR document
(leave, overtime, timesheet, payroll run, loan, promotion, budget, travel,
expense) are delegated to the shared `pod_approval_*` engine via
`approval_request_id`. Asset assignments bridge to `products` (inventory) and
`fin_assets` (fixed-asset register).

```mermaid
erDiagram
  profiles ||..o{ hr_employees : "identity bridge (profile_id)"
  hr_payroll_runs ||..o{ fin_journal_entries : "payroll.posted → GL"
  hr_expense_claims ||..o{ fin_journal_entries : "expense.posted → GL"
  hr_expense_reimbursements ||..o{ fin_journal_entries : "reimbursement.paid → GL"
  hr_loans ||..o{ fin_journal_entries : "loan.disbursed → GL"
  hr_salary_advances ||..o{ fin_journal_entries : "advance.disbursed → GL"
  hr_leave_requests ||..o{ pod_approval_requests : "approval routing"
  hr_payroll_runs ||..o{ pod_approval_requests : "approval routing"
  hr_promotions ||..o{ pod_approval_requests : "approval routing"
  hr_travel_requests ||..o{ pod_approval_requests : "approval routing"
  hr_expense_claims ||..o{ pod_approval_requests : "approval routing"
  hr_employee_assets ||..o{ products : "inventory item link"
  hr_employee_assets ||..o{ fin_assets : "capitalized asset link"
  hr_salary_components ||..o{ fin_accounts : "GL mapping per component"
  hr_cost_centers ||..o{ fin_cost_centers : "cost dimension bridge"
```

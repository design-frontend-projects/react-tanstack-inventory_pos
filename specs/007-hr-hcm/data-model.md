# Data Model — Feature 007 (HR / HCM — Human Capital Management)

The authoritative schema is `prisma/schema.prisma` (search the banner `// HR / HCM (hr_)`, near the
end of the file) and the migration
`prisma/migrations/20260722120000_hr_hcm_v1/migration.sql`. This document tracks the full HR / HCM
domain model: all 88 `hr_*` tables grouped into 15 domain clusters, the conventions they share, and
the platform services the module reuses.

Feature 007 covers the **employee lifecycle end to end**: organization structure, employee master,
recruitment (ATS), onboarding, time & attendance, leave, payroll & benefits, performance, learning,
career & succession, workforce planning, HR budgeting, employee/manager self-service (ESS/MSS),
asset custody, and travel & expense. It does not replace any existing operational table: it links
into Finance (`fin_*`), Inventory (`product`/`fin_asset`), and the platform (`profiles`,
`tenant_accounts`, `pod_*`, `document_sequences`) through **bare scalar UUID** references, never
cross-module DB foreign keys. Every table below is documented bilingually: an English **Purpose**
paragraph and an Arabic **الشرح** paragraph, followed by the full column table.

---

## Conventions

### Numeric precision (fixed across the module)

| Concept | Type | Columns (examples) |
|---|---|---|
| Money / amounts | `DECIMAL(19,4)` | `base_salary`, `principal_amount`, `gross_pay`, `net_pay`, `total_amount`, `estimated_cost` |
| Rate — leave accrual / interest / commission | `DECIMAL(8,4)` | `accrual_rate`, `interest_rate`, `commission_rate`, `percentage` (employee comp) |
| Multiplier / percentage (small) | `DECIMAL(5,2)` | `rate_multiplier`, `allocation_pct`, `weight`, `progress_pct`, `overall_score`, `attendance_pct` |
| Days / hours | `DECIMAL(6,2)` (days) · `DECIMAL(8,2)` (hours) · `DECIMAL(10,2)` (timesheet totals) | `entitled_days`, `total_days`, `work_hours`, `worked_hours`, `overtime_hours`, `total_hours` |
| Geo coordinates | `DECIMAL(10,7)` | `latitude`, `longitude` (attendance logs) |

Money precision is the platform standard `DECIMAL(19,4)`. Rates use `DECIMAL(9,6)`/`DECIMAL(8,4)`
and percentages `DECIMAL(5,2)` per platform convention; the HR slice uses `DECIMAL(8,4)` for
accrual/interest/commission rates and `DECIMAL(5,2)` for weights, scores, and simple percentages.

### Identity and tenancy

- Every table has `id UUID` PK (`@default(uuid())`).
- Every table has `tenant_id UUID → tenant_accounts(id)` `ON DELETE CASCADE ON UPDATE CASCADE` —
  the only universal real FK. There are **no nullable-tenant system defaults** in the HR module:
  every `hr_*` row is tenant-owned (unlike some `fin_*` lookups).
- **Standard column set** on mutable masters/headers: `id`, `tenant_id`, `created_at`, `updated_at`,
  `created_by`, `updated_by`, `deleted_at`, `status_code`, `is_active`, `version_number`. Document
  headers add `deleted_by`; postable documents add `journal_entry_id`, `is_posted`, `posted_at`,
  `posted_by_profile_id` (payroll run) or a scalar `journal_entry_id` link (loans, advances, claims,
  reimbursements). Bilingual masters add `name_ar` / `title_ar`.

### Foreign-key strategy

Real DB foreign keys exist for **two** kinds of relationship only:

1. **Tenant scope** — `tenant_id` on every table (above).
2. **Header → line within the employee aggregate** — the child tables of `HrEmployee`
   (`hr_employee_contacts`, `_addresses`, `_documents`, `_bank_accounts`, `_contracts`, `_history`,
   `_dependents`, `_education`, `_experience`, `_certifications`, `_languages`) carry a real
   `employee_id → hr_employees(id)` cascade relation. These are the only `@relation` composition
   links in the module.

**Every other reference is a bare scalar `UUID` with app-enforced integrity** (no `@relation`, no
DB FK). This includes all intra-HR references (`company_id`, `department_id`, `position_id`,
`job_grade_id`, `manager_id`, `cost_center_id`, `leave_type_id`, `payroll_run_id`, `loan_id`,
`claim_id`, `template_id`, …) **and** all cross-module references: `profile_id` (→ `profiles`),
`warehouse_id`, `product_id`, `fin_asset_id`, `fin_cost_center_id`, `gl_account_id`,
`journal_entry_id`, `approval_request_id`, `attachment_id`. Guards + repos enforce these, matching
the `pod_`/`fin_`/inventory convention. Line rows outside the employee aggregate (payroll details,
loan installments, expense lines, budget children) also use scalar parent ids, not `@relation`.

### Status codes (`status_code` + pod registry)

`hr_*` documents store a denormalized free-string `status_code TEXT` (defaults such as `draft`,
`active`, `open`, `scheduled`, `pending`, `assigned`) validated at the service layer against the
existing `pod_document_statuses` / `pod_status_transitions` registry. **No new Prisma enums are
introduced.** Stage/decision fields that are not lifecycle states use plain `TEXT` with a code
default (`stage_code`, `attendance_code`, `decision`, `readiness_level`, `payment_status`).

### Audit-column standard

**Mutable masters and document headers** carry: `version_number INT DEFAULT 1` (optimistic lock),
`created_by` / `updated_by` (and `deleted_by` on headers) as scalar `UUID` actor profile ids,
`created_at DEFAULT now()`, `updated_at` (`@updatedAt`), and `deleted_at` (nullable soft delete).
`is_active BOOLEAN DEFAULT true` is a fast filter flag alongside `status_code`.

### Bilingual naming

Every master with a display name carries `name` (English, required) + `name_ar` (Arabic, nullable);
job/position/offer masters use `title` + `title_ar`. Seed data ships both languages; Arabic drives
RTL rendering in the UI.

### Append-only / immutable rows

These tables have **no soft delete and no update-audit** — they are append-only ledgers/logs and are
corrected by inserting new rows, never by editing:

- `hr_attendance_logs` — raw punch events (create + `created_at` only).
- `hr_break_logs` — break punches.
- `hr_employee_history` — employee change journal (`changed_by` + `created_at`).
- `hr_payroll_component_details` — frozen per-payslip component snapshot.
- `hr_goal_progress` — goal progress trail (`recorded_at`).

Other child tables that are effectively insert-mostly (`hr_review_scores`, `hr_workforce_requirements`,
`hr_skill_requirements`, `hr_budget_*`, `hr_expense_claim_lines`) keep `created_at`/`updated_at` but
omit soft delete.

---

## Reused platform services

No new infrastructure is created for HR; `hr_` plugs into the existing platform layer.

| Service | Table(s) | How Feature 007 uses it |
|---|---|---|
| Document numbering | `document_sequences` (`nextDocumentNumber`) | issues human-readable numbers via per-type prefixes: **EMP** (`employee_code`), **JOB** (`requisition_no`), **CND** (`candidate_code`), **OFR** (`offer_number`), **LVR** (`request_number`, leave), **OTR** (`request_number`, overtime), **TMS** (timesheet), **PAYR** (`run_number`), **LOAN** (`loan_number`), **ADV** (`advance_number`), **PRV** (`promotion_number`), **TRV** (`request_number`, travel), **EXP** (`claim_number`) |
| Approval engine | `pod_approval_workflows/steps/requests/actions` | polymorphic scalar `approval_request_id` on `hr_job_openings`, `hr_job_offers`, `hr_timesheets`, `hr_overtime_requests`, `hr_leave_requests`, `hr_payroll_runs`, `hr_loans`, `hr_salary_advances`, `hr_promotions`, `hr_workforce_plans`, `hr_budget_years`, `hr_employee_requests`, `hr_travel_requests`, `hr_expense_claims` (plus the in-module `hr_leave_approvals` step ledger) |
| Notifications | `pod_notifications` (`notify(tx, …)`) | ESS alerts, approval events, document-expiry reminders; also surfaced to employees via `hr_employee_notifications` |
| Attachments | `pod_attachments` (`PodAttachment`) | scalar `attachment_id` on `hr_employee_documents`, `hr_candidate_documents`, `hr_employee_documents_shared` (with `file_url` fallbacks elsewhere) |
| Finance posting | `fin_*` (`postJournalEntry`) | payroll, loans, salary advances, and expense claims/reimbursements produce GL entries linked by scalar `journal_entry_id`; `gl_account_id` on salary components and `fin_cost_center_id`/`fin_asset_id` map to the accounting engine |
| Actors | `profiles` | `profile_id` on `hr_employees` bridges identity; all `created_by`/`updated_by`/`deleted_by`/`*_by_id` scalar columns |
| Tenancy | `tenant_accounts` | real FK `tenant_id` on every `hr_*` table |

---

## Domain 1 — Organization Management

### `hr_companies`

**Purpose.** Legal entity / operating company master — the top of the HR org tree. Holds
registration and tax identity, base currency and country, branding, and an optional self-reference
to a parent company for group structures.

**الشرح.** سجل الكيان القانوني / الشركة المشغّلة، وهو قمة الهيكل التنظيمي للموارد البشرية. يخزّن
بيانات التسجيل والهوية الضريبية والعملة الأساسية والدولة والعلامة التجارية، مع مرجع اختياري للشركة
الأم لهياكل المجموعات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant (`hr_companies_tenant_code_unique`) |
| `name` | TEXT | English name |
| `name_ar` | TEXT | nullable |
| `legal_name` | TEXT | nullable |
| `registration_no` | TEXT | nullable |
| `tax_id` | TEXT | nullable |
| `currency_code` | TEXT | default `USD` |
| `base_country` | TEXT | nullable |
| `email` | TEXT | nullable |
| `phone` | TEXT | nullable |
| `address_line` | TEXT | nullable |
| `logo_url` | TEXT | nullable |
| `parent_company_id` | UUID | nullable, scalar self-ref |
| `is_legal_entity` | BOOLEAN | default `true` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable actors |
| `created_at` / `updated_at` | TIMESTAMPTZ | `now()` / `@updatedAt` |
| `deleted_at` | TIMESTAMPTZ | nullable (soft delete) |

### `hr_branches`

**Purpose.** Physical or organizational branch under a company — office, plant, store, etc. Links
optionally to a cost center, an inventory warehouse, and a branch manager, and carries locale/contact
metadata.

**الشرح.** الفرع المادي أو التنظيمي التابع للشركة (مكتب، مصنع، متجر…). يرتبط اختيارياً بمركز تكلفة
ومستودع مخزون ومدير للفرع، ويحمل بيانات المنطقة الزمنية والاتصال.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `company_id` | UUID | scalar → `hr_companies` |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `branch_type` | TEXT | default `office` |
| `cost_center_id` | UUID | nullable, scalar → `hr_cost_centers` |
| `warehouse_id` | UUID | nullable, scalar → inventory warehouse |
| `manager_id` | UUID | nullable, scalar → `hr_employees` |
| `timezone` | TEXT | nullable |
| `email` / `phone` | TEXT | nullable |
| `address_line` / `city` / `country` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | nullable |

### `hr_business_units`

**Purpose.** Business unit (P&L / strategic grouping) within a company, with an optional unit head
and cost center. Sits above divisions in the org hierarchy.

**الشرح.** وحدة الأعمال (تجميع استراتيجي / مركز ربحية) داخل الشركة، مع رئيس اختياري ومركز تكلفة.
تقع أعلى الأقسام الكبرى في التسلسل التنظيمي.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `company_id` | UUID | scalar → `hr_companies` |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `head_id` | UUID | nullable, scalar → `hr_employees` |
| `cost_center_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_divisions`

**Purpose.** Division under a company and (optionally) a business unit, with a division head.
Intermediate org layer between business unit and department.

**الشرح.** القطاع التابع للشركة و(اختيارياً) لوحدة الأعمال، مع رئيس للقطاع. طبقة تنظيمية وسيطة بين
وحدة الأعمال والإدارة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `company_id` | UUID | scalar → `hr_companies` |
| `business_unit_id` | UUID | nullable, scalar → `hr_business_units` |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `head_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_departments`

**Purpose.** Department master with self-referential hierarchy (`parent_department_id`, materialized
`depth_level` + `path_text`), optional branch/division links, a manager, a cost center, and a
headcount budget. The core unit most employees attach to.

**الشرح.** سجل الإدارات بتسلسل هرمي ذاتي المرجع (الإدارة الأم، مستوى العمق، ومسار نصي)، وروابط
اختيارية للفرع والقطاع، ومدير، ومركز تكلفة، وموازنة عدد الموظفين. الوحدة الأساسية التي يرتبط بها معظم
الموظفين.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `company_id` | UUID | scalar → `hr_companies` |
| `branch_id` | UUID | nullable, scalar |
| `division_id` | UUID | nullable, scalar |
| `parent_department_id` | UUID | nullable, scalar self-ref |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `manager_id` | UUID | nullable, scalar → `hr_employees` |
| `cost_center_id` | UUID | nullable, scalar |
| `depth_level` | INT | default 0 |
| `path_text` | TEXT | nullable (materialized path) |
| `headcount_budget` | INT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_sections`

**Purpose.** Section (sub-department) under a required department, with an optional supervisor. The
finest org grouping.

**الشرح.** القسم الفرعي التابع لإدارة إلزامية، مع مشرف اختياري. أدق تجميع تنظيمي.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `department_id` | UUID | scalar → `hr_departments` |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `supervisor_id` | UUID | nullable, scalar → `hr_employees` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_job_grades`

**Purpose.** Job grade / pay band defining salary min–mid–max, a grade level, base currency, and
default annual leave entitlement. Referenced by positions, contracts, offers, and leave policies.

**الشرح.** الدرجة الوظيفية / نطاق الأجر الذي يحدد الحد الأدنى والأوسط والأعلى للراتب ومستوى الدرجة
والعملة الأساسية ورصيد الإجازة السنوية الافتراضي. تُشير إليها الوظائف والعقود والعروض وسياسات الإجازات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `grade_level` | INT | default 1 |
| `min_salary` / `mid_salary` / `max_salary` | DECIMAL(19,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `annual_leave_days` | INT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_positions`

**Purpose.** Position / job master (a seat in the org, distinct from the person filling it). Links to
a department and job grade, a `reports_to` position, employment type, headcount limit, JD text, and a
managerial flag. Referenced across recruitment, contracts, succession, and budgeting.

**الشرح.** سجل الوظيفة / المنصب (مقعد في الهيكل يختلف عن شاغله). يرتبط بإدارة ودرجة وظيفية، ومنصب
يتبع له، ونوع التوظيف، وحد أقصى للعدد، ووصف وظيفي، وعلامة إدارية. يُشار إليه عبر التوظيف والعقود
والإحلال والموازنة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `title` / `title_ar` | TEXT | title_ar nullable |
| `department_id` | UUID | nullable, scalar |
| `job_grade_id` | UUID | nullable, scalar |
| `reports_to_id` | UUID | nullable, scalar self-ref (position) |
| `employment_type` | TEXT | default `full_time` |
| `headcount_limit` | INT | nullable |
| `job_description` | TEXT | nullable |
| `is_managerial` | BOOLEAN | default `false` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_cost_centers`

**Purpose.** HR-side cost center master, optionally tied to a company, department, a parent cost
center, and — critically — a scalar `fin_cost_center_id` mapping into the Finance module for payroll
posting and budget rollups.

**الشرح.** سجل مراكز التكلفة الخاص بالموارد البشرية، يرتبط اختيارياً بشركة وإدارة ومركز تكلفة أب،
والأهم بمعرّف مركز تكلفة مالي (fin) لربط ترحيل الرواتب وتجميع الموازنات مع الوحدة المالية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `company_id` | UUID | nullable, scalar |
| `department_id` | UUID | nullable, scalar |
| `parent_id` | UUID | nullable, scalar self-ref |
| `fin_cost_center_id` | UUID | nullable, scalar → Finance cost center |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_reporting_structure`

**Purpose.** Effective-dated reporting relationships (solid/dotted line) between an employee and a
manager, enabling matrix org charts and history. `is_primary` marks the main reporting line.

**الشرح.** علاقات إعداد التقارير المؤرَّخة (خط مباشر/منقّط) بين الموظف والمدير، لدعم الهياكل المصفوفية
وتتبع التاريخ. تحدد `is_primary` خط التبعية الرئيسي.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `manager_id` | UUID | nullable, scalar → `hr_employees` |
| `relation_type` | TEXT | default `solid_line` |
| `effective_from` | TIMESTAMPTZ | required |
| `effective_to` | TIMESTAMPTZ | nullable |
| `is_primary` | BOOLEAN | default `true` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 2 — Employee Management

The **only real header→line aggregate** in the module: `hr_employees` owns eleven child tables via
`employee_id` cascade `@relation`s.

### `hr_employees`

**Purpose.** The employee master — personal identity, contact channels, national/passport IDs, the
full org placement (company/branch/department/section/position/grade/cost-center/manager), employment
type & status, and the hire→probation→confirmation→termination lifecycle. Bridges to platform
identity via optional scalar `profile_id`.

**الشرح.** سجل الموظف الرئيسي — الهوية الشخصية وقنوات الاتصال وأرقام الهوية وجواز السفر، والتموضع
التنظيمي الكامل (الشركة/الفرع/الإدارة/القسم/الوظيفة/الدرجة/مركز التكلفة/المدير)، ونوع التوظيف وحالته،
ودورة الحياة من التعيين إلى فترة التجربة والتثبيت وانتهاء الخدمة. يرتبط بهوية المنصة عبر `profile_id`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_code` | TEXT | unique per tenant (`hr_employees_tenant_code_unique`) |
| `profile_id` | UUID | nullable, scalar → `profiles` (identity bridge) |
| `first_name` / `last_name` | TEXT | required |
| `middle_name` | TEXT | nullable |
| `first_name_ar` / `last_name_ar` | TEXT | nullable |
| `display_name` | TEXT | nullable |
| `gender` | TEXT | nullable |
| `date_of_birth` | TIMESTAMPTZ | nullable |
| `marital_status` | TEXT | nullable |
| `nationality` / `religion` / `blood_group` | TEXT | nullable |
| `personal_email` / `work_email` | TEXT | nullable |
| `personal_phone` / `work_phone` | TEXT | nullable |
| `national_id` / `passport_no` | TEXT | nullable |
| `photo_url` | TEXT | nullable |
| `company_id` / `branch_id` / `department_id` / `section_id` | UUID | nullable, scalar |
| `position_id` / `job_grade_id` / `cost_center_id` / `manager_id` | UUID | nullable, scalar |
| `employment_type` | TEXT | default `full_time` |
| `employment_status` | TEXT | default `active` |
| `hire_date` / `probation_end_date` / `confirmation_date` / `termination_date` | TIMESTAMPTZ | nullable |
| `termination_reason` | TEXT | nullable |
| `is_rehire_eligible` | BOOLEAN | default `true` |
| `work_location` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_contacts`

**Purpose.** Emergency and other contacts for an employee (name, relationship, phone/email), with a
primary flag. Child of `hr_employees`.

**الشرح.** جهات اتصال الطوارئ وغيرها للموظف (الاسم، صلة القرابة، الهاتف/البريد)، مع علامة للاتصال
الرئيسي. جدول تابع لـ `hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `contact_type` | TEXT | default `emergency` |
| `name` | TEXT | required |
| `relationship` | TEXT | nullable |
| `phone` / `email` | TEXT | nullable |
| `is_primary` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_addresses`

**Purpose.** Employee postal addresses (home / mailing / etc.), with a primary flag. Child of
`hr_employees`.

**الشرح.** عناوين الموظف البريدية (المنزل / المراسلة …)، مع علامة للعنوان الرئيسي. جدول تابع لـ
`hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `address_type` | TEXT | default `home` |
| `address_line1` | TEXT | required |
| `address_line2` | TEXT | nullable |
| `city` / `state` / `postal_code` / `country` | TEXT | nullable |
| `is_primary` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_documents`

**Purpose.** Employee document register (ID, visa, certificate scans) with issue/expiry dates,
a scalar `attachment_id` to the platform attachment store (or `file_url`), and a verification flag.
The expiry index drives renewal reminders.

**الشرح.** سجل وثائق الموظف (الهوية، التأشيرة، مسوح الشهادات) مع تواريخ الإصدار والانتهاء، ومعرّف
مرفق للمنصة (أو رابط ملف)، وعلامة توثيق. فهرس الانتهاء يشغّل تذكيرات التجديد.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `document_type` | TEXT | required |
| `document_name` | TEXT | required |
| `document_no` | TEXT | nullable |
| `issue_date` / `expiry_date` | TIMESTAMPTZ | nullable (expiry indexed) |
| `file_url` | TEXT | nullable |
| `attachment_id` | UUID | nullable, scalar → `pod_attachments` |
| `is_verified` | BOOLEAN | default `false` |
| `notes` | TEXT | nullable |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_bank_accounts`

**Purpose.** Employee salary bank accounts (bank, account no/IBAN/SWIFT, branch), with currency, a
primary flag and a split `allocation_pct` for multi-account payroll disbursement.

**الشرح.** الحسابات البنكية لرواتب الموظف (البنك، رقم الحساب/الآيبان/السويفت، الفرع)، مع العملة وعلامة
الحساب الرئيسي ونسبة توزيع لصرف الراتب على عدة حسابات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `bank_name` | TEXT | required |
| `account_name` | TEXT | nullable |
| `account_number` | TEXT | required |
| `iban` / `swift_code` / `branch_name` | TEXT | nullable |
| `currency_code` | TEXT | default `USD` |
| `is_primary` | BOOLEAN | default `true` |
| `allocation_pct` | DECIMAL(5,2) | nullable |
| `status_code` | TEXT | default `active` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_contracts`

**Purpose.** Employment contract record — type, start/end, grade/position, base salary + currency +
pay frequency, working hours, probation/notice terms, and a link to a salary structure. Signed date
and file URL captured.

**الشرح.** سجل عقد العمل — النوع، البداية/النهاية، الدرجة/الوظيفة، الراتب الأساسي والعملة ودورية
الصرف، ساعات العمل، شروط التجربة والإخطار، ورابط لهيكل الرواتب. مع تاريخ التوقيع ورابط الملف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `contract_number` | TEXT | unique per tenant |
| `contract_type` | TEXT | default `permanent` |
| `start_date` | TIMESTAMPTZ | required |
| `end_date` | TIMESTAMPTZ | nullable |
| `job_grade_id` / `position_id` | UUID | nullable, scalar |
| `base_salary` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `pay_frequency` | TEXT | default `monthly` |
| `working_hours` | DECIMAL(8,2) | nullable |
| `probation_months` / `notice_period_days` | INT | nullable |
| `salary_structure_id` | UUID | nullable, scalar → `hr_salary_structures` |
| `signed_date` | TIMESTAMPTZ | nullable |
| `file_url` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_history`

**Purpose.** Append-only employee change journal — one row per field change (transfer, promotion,
salary revision, status change) capturing old/new value, effective date, reason, and the actor. No
soft delete.

**الشرح.** سجل تغييرات الموظف (إضافة فقط) — سطر لكل تغيير حقل (نقل، ترقية، تعديل راتب، تغيير حالة)
يوثّق القيمة القديمة/الجديدة وتاريخ السريان والسبب والمنفّذ. بدون حذف ناعم.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `change_type` | TEXT | required (indexed) |
| `field_name` | TEXT | nullable |
| `old_value` / `new_value` | TEXT | nullable |
| `effective_date` | TIMESTAMPTZ | required |
| `reason` / `reference` | TEXT | nullable |
| `changed_by` | UUID | nullable, scalar actor |
| `created_at` | TIMESTAMPTZ | `now()` (append-only; no update/delete) |

### `hr_employee_dependents`

**Purpose.** Employee dependents (spouse, children, …) with relationship, DOB, national ID, and
beneficiary/insured flags for benefits and payroll.

**الشرح.** معالو الموظف (الزوج/ة، الأبناء…) مع صلة القرابة وتاريخ الميلاد والرقم القومي وعلامات
المستفيد والمؤمَّن عليه لأغراض المزايا والرواتب.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `name` | TEXT | required |
| `relationship` | TEXT | required |
| `date_of_birth` | TIMESTAMPTZ | nullable |
| `gender` / `national_id` | TEXT | nullable |
| `is_beneficiary` | BOOLEAN | default `false` |
| `is_insured` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_education`

**Purpose.** Education history — institution, degree, field, years, grade, country, and a verified
flag. Child of `hr_employees`.

**الشرح.** السجل التعليمي — المؤسسة، الدرجة العلمية، التخصص، السنوات، التقدير، الدولة، وعلامة التوثيق.
جدول تابع لـ `hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `institution` | TEXT | required |
| `degree` / `field_of_study` | TEXT | nullable |
| `start_year` / `end_year` | INT | nullable |
| `grade` / `country` | TEXT | nullable |
| `is_verified` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_experience`

**Purpose.** Prior work experience — employer, title, dates, responsibilities, reason for leaving,
and a verified flag. Child of `hr_employees`.

**الشرح.** الخبرات العملية السابقة — جهة العمل، المسمى، التواريخ، المسؤوليات، سبب ترك العمل، وعلامة
التوثيق. جدول تابع لـ `hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `company_name` | TEXT | required |
| `job_title` | TEXT | required |
| `start_date` / `end_date` | TIMESTAMPTZ | nullable |
| `responsibilities` / `reason_for_leaving` | TEXT | nullable |
| `is_verified` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_certifications`

**Purpose.** Professional certifications — name, issuer, certificate number, issue/expiry dates, and
file URL. Child of `hr_employees`.

**الشرح.** الشهادات المهنية — الاسم، الجهة المانحة، رقم الشهادة، تواريخ الإصدار والانتهاء، ورابط
الملف. جدول تابع لـ `hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `name` | TEXT | required |
| `issuer` / `certificate_no` | TEXT | nullable |
| `issue_date` / `expiry_date` | TIMESTAMPTZ | nullable |
| `file_url` | TEXT | nullable |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_languages`

**Purpose.** Language proficiencies — language, proficiency level, read/write/speak flags, and a
native flag. Child of `hr_employees`.

**الشرح.** إتقان اللغات — اللغة، مستوى الإتقان، علامات القراءة/الكتابة/التحدث، وعلامة اللغة الأم. جدول
تابع لـ `hr_employees`.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | **@relation** → `hr_employees` (Cascade) |
| `language` | TEXT | required |
| `proficiency` | TEXT | default `intermediate` |
| `can_read` / `can_write` / `can_speak` | BOOLEAN | default `true` |
| `is_native` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 3 — Recruitment (ATS)

### `hr_job_openings`

**Purpose.** Job requisition / opening — the vacancy to fill. Carries the target department/position/
grade/branch, hiring manager, employment type and vacancy count, JD & requirements, salary band, open
and target-close dates, and an approval-request link for requisition sign-off.

**الشرح.** طلب التوظيف / الشاغر المطلوب شغله. يحمل الإدارة/الوظيفة/الدرجة/الفرع المستهدفة، ومدير
التوظيف، ونوع التوظيف وعدد الشواغر، والوصف والمتطلبات، ونطاق الراتب، وتواريخ الفتح والإغلاق المستهدف،
ورابط طلب موافقة لاعتماد الطلب.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `requisition_no` | TEXT | unique per tenant |
| `title` | TEXT | required |
| `department_id` / `position_id` / `job_grade_id` / `branch_id` | UUID | nullable, scalar |
| `hiring_manager_id` | UUID | nullable, scalar → `hr_employees` |
| `employment_type` | TEXT | default `full_time` |
| `vacancies` | INT | default 1 |
| `description` / `requirements` | TEXT | nullable |
| `salary_min` / `salary_max` | DECIMAL(19,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `open_date` / `target_close_date` | TIMESTAMPTZ | nullable |
| `approval_request_id` | UUID | nullable, scalar → `pod_approval_requests` |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_candidates`

**Purpose.** Candidate / applicant record, optionally tied to a job opening. Holds contact details,
source, resume URL, current employer, expected salary, notice period, a rating, and the pipeline
`stage_code` (applied → screened → … ).

**الشرح.** سجل المرشح / المتقدم، مرتبط اختيارياً بشاغر. يحمل بيانات الاتصال والمصدر ورابط السيرة
الذاتية وجهة العمل الحالية والراتب المتوقع ومدة الإخطار والتقييم ومرحلة المسار الوظيفي (`stage_code`).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `job_opening_id` | UUID | nullable, scalar → `hr_job_openings` |
| `candidate_code` | TEXT | unique per tenant |
| `first_name` / `last_name` | TEXT | required |
| `email` / `phone` / `source` | TEXT | nullable |
| `resume_url` / `current_employer` | TEXT | nullable |
| `expected_salary` | DECIMAL(19,4) | nullable |
| `notice_period_days` | INT | nullable |
| `rating` | INT | nullable |
| `stage_code` | TEXT | default `applied` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_candidate_documents`

**Purpose.** Documents attached to a candidate (resume, portfolio, references) via `attachment_id` or
`file_url`. Lightweight child record (create audit only).

**الشرح.** المستندات المرفقة بالمرشح (السيرة الذاتية، الأعمال، التزكيات) عبر `attachment_id` أو رابط
ملف. سجل تابع خفيف (تدقيق إنشاء فقط).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `candidate_id` | UUID | scalar → `hr_candidates` |
| `document_type` | TEXT | required |
| `document_name` | TEXT | required |
| `file_url` | TEXT | nullable |
| `attachment_id` | UUID | nullable, scalar → `pod_attachments` |
| `created_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_interviews`

**Purpose.** Scheduled interview round for a candidate — round number, interview type, scheduled time,
duration, location or meeting link, and lifecycle status.

**الشرح.** جولة مقابلة مجدولة للمرشح — رقم الجولة، نوع المقابلة، الوقت المجدول، المدة، الموقع أو رابط
الاجتماع، وحالة دورة الحياة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `candidate_id` | UUID | scalar → `hr_candidates` |
| `job_opening_id` | UUID | nullable, scalar |
| `round_number` | INT | default 1 |
| `interview_type` | TEXT | default `in_person` |
| `scheduled_at` | TIMESTAMPTZ | nullable (indexed) |
| `duration_mins` | INT | nullable |
| `location` / `meeting_link` | TEXT | nullable |
| `status_code` | TEXT | default `scheduled` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_interview_feedback`

**Purpose.** Per-interviewer scorecard for an interview — overall score, recommendation, strengths,
weaknesses, and free-text comments.

**الشرح.** بطاقة تقييم كل مُقابِل للمقابلة — الدرجة الإجمالية والتوصية ونقاط القوة والضعف والملاحظات
النصية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `interview_id` | UUID | scalar → `hr_interviews` |
| `interviewer_id` | UUID | scalar → `hr_employees` |
| `overall_score` | DECIMAL(5,2) | nullable |
| `recommendation` | TEXT | nullable |
| `strengths` / `weaknesses` / `comments` | TEXT | nullable |
| `created_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_job_offers`

**Purpose.** Formal job offer to a candidate — offered position/grade, offered salary + currency,
start & expiry dates, offer-letter URL, and an approval-request link. Feeds employee creation on
acceptance.

**الشرح.** عرض العمل الرسمي للمرشح — الوظيفة/الدرجة المعروضة، الراتب المعروض والعملة، تاريخ البدء
والانتهاء، رابط خطاب العرض، ورابط طلب الموافقة. يُغذّي إنشاء الموظف عند القبول.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `candidate_id` | UUID | scalar → `hr_candidates` |
| `job_opening_id` | UUID | nullable, scalar |
| `offer_number` | TEXT | unique per tenant |
| `position_id` / `job_grade_id` | UUID | nullable, scalar |
| `offered_salary` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `start_date` / `expiry_date` | TIMESTAMPTZ | nullable |
| `offer_letter_url` | TEXT | nullable |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_offer_acceptance`

**Purpose.** Candidate's response to a job offer — decision (accept/decline/pending), responded
timestamp, signature URL, and comments.

**الشرح.** رد المرشح على عرض العمل — القرار (قبول/رفض/معلّق)، وقت الرد، رابط التوقيع، والملاحظات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `offer_id` | UUID | scalar → `hr_job_offers` |
| `responded_at` | TIMESTAMPTZ | nullable |
| `decision` | TEXT | default `pending` |
| `signature_url` / `comments` | TEXT | nullable |
| `created_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 4 — Onboarding

### `hr_onboarding_templates`

**Purpose.** Reusable onboarding checklist template, optionally scoped to a department. A named set
of tasks applied to new hires.

**الشرح.** قالب قائمة تدقيق تأهيل قابل لإعادة الاستخدام، محدد اختيارياً بإدارة. مجموعة مسمّاة من
المهام تُطبَّق على الموظفين الجدد.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `department_id` | UUID | nullable, scalar |
| `description` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_onboarding_tasks`

**Purpose.** A task line within an onboarding template — sequence, title, category, owning role, due
offset (days from start), and a mandatory flag.

**الشرح.** بند مهمة داخل قالب التأهيل — الترتيب، العنوان، الفئة، الدور المسؤول، إزاحة الاستحقاق
(أيام من البدء)، وعلامة الإلزام.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `template_id` | UUID | scalar → `hr_onboarding_templates` |
| `sequence` | INT | default 0 |
| `title` | TEXT | required |
| `category` | TEXT | default `general` |
| `owner_role` | TEXT | nullable |
| `due_offset_days` | INT | default 0 |
| `is_mandatory` | BOOLEAN | default `true` |
| `created_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_onboarding`

**Purpose.** Instantiated onboarding task assigned to a specific new hire — links back to template &
task, assignee, due/completed dates, and status. The per-employee execution record.

**الشرح.** مهمة تأهيل مُنشأة ومسندة لموظف جديد محدد — ترتبط بالقالب والمهمة، والمُسند إليه، وتواريخ
الاستحقاق والإنجاز، والحالة. سجل التنفيذ لكل موظف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `template_id` / `task_id` | UUID | nullable, scalar |
| `title` | TEXT | required |
| `category` | TEXT | default `general` |
| `assigned_to_id` | UUID | nullable, scalar → `hr_employees` |
| `due_date` / `completed_at` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `pending` |
| `notes` | TEXT | nullable |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 5 — Time Management

### `hr_shift_definitions`

**Purpose.** Shift master — start/end times (as HH:MM strings), break minutes, computed work hours,
grace windows for late-in/early-out, and a night-shift flag.

**الشرح.** سجل الورديات — أوقات البدء/الانتهاء (نصوص HH:MM)، دقائق الاستراحة، ساعات العمل المحتسبة،
فترات السماح للتأخير/الانصراف المبكر، وعلامة الوردية الليلية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `shift_type` | TEXT | default `fixed` |
| `start_time` / `end_time` | TEXT | nullable (HH:MM) |
| `break_minutes` | INT | default 0 |
| `work_hours` | DECIMAL(8,2) | nullable |
| `is_night_shift` | BOOLEAN | default `false` |
| `grace_in_mins` / `grace_out_mins` | INT | default 0 |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_shift_patterns`

**Purpose.** Rotating shift pattern — a rotation-day count plus a JSONB day-by-day pattern used to
generate shift assignments.

**الشرح.** نمط ورديات دوّار — عدد أيام الدورة مع نمط يومي بصيغة JSONB يُستخدم لتوليد إسنادات الورديات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` | TEXT | required |
| `rotation_days` | INT | default 7 |
| `pattern_json` | JSONB | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_shift_assignments`

**Purpose.** Assignment of a shift or pattern to an employee over an effective date range.

**الشرح.** إسناد وردية أو نمط لموظف خلال نطاق تاريخ سريان.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `shift_id` | UUID | nullable, scalar → `hr_shift_definitions` |
| `pattern_id` | UUID | nullable, scalar → `hr_shift_patterns` |
| `start_date` | TIMESTAMPTZ | required |
| `end_date` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_attendance_logs`

**Purpose.** Append-only raw punch events — event time, direction (in/out), capture method, device
id, optional geo coordinates, a processed flag, and the raw device payload. No soft delete; the
source-of-truth log that `hr_attendance_daily` is computed from.

**الشرح.** أحداث البصمة الخام (إضافة فقط) — وقت الحدث، الاتجاه (دخول/خروج)، طريقة الالتقاط، معرّف
الجهاز، الإحداثيات الجغرافية الاختيارية، علامة المعالجة، والحمولة الخام للجهاز. بدون حذف ناعم؛ هو
المصدر الذي يُحتسب منه الحضور اليومي.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `event_time` | TIMESTAMPTZ | required (indexed w/ employee) |
| `direction` | TEXT | default `in` |
| `capture_method` | TEXT | default `manual` |
| `device_id` | TEXT | nullable |
| `latitude` / `longitude` | DECIMAL(10,7) | nullable |
| `is_processed` | BOOLEAN | default `false` |
| `raw_payload` | JSONB | nullable |
| `created_at` | TIMESTAMPTZ | `now()` (append-only) |

### `hr_attendance_daily`

**Purpose.** Computed one-row-per-employee-per-day attendance summary — first-in/last-out, worked &
overtime hours, late & early-out minutes, an attendance code (present/absent/leave/…), and a manual-
edit flag. Unique on (tenant, employee, work_date).

**الشرح.** ملخص حضور محتسب بسطر واحد لكل موظف في اليوم — أول دخول/آخر خروج، ساعات العمل والإضافي،
دقائق التأخير والانصراف المبكر، رمز الحضور، وعلامة التعديل اليدوي. فريد على (المستأجر، الموظف، تاريخ
العمل).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `work_date` | TIMESTAMPTZ | required; unique w/ employee |
| `shift_id` | UUID | nullable, scalar |
| `first_in` / `last_out` | TIMESTAMPTZ | nullable |
| `worked_hours` / `overtime_hours` | DECIMAL(8,2) | default 0 |
| `late_minutes` / `early_out_mins` | INT | default 0 |
| `attendance_code` | TEXT | default `present` |
| `is_manual_edit` | BOOLEAN | default `false` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_timesheets`

**Purpose.** Period timesheet for an employee (e.g. project time) — total & billable hours, optional
project link, and an approval-request link.

**الشرح.** كشف دوام فترة للموظف (مثل وقت المشروع) — إجمالي الساعات والساعات القابلة للفوترة، رابط
مشروع اختياري، ورابط طلب موافقة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `period_start` / `period_end` | TIMESTAMPTZ | required |
| `total_hours` / `billable_hours` | DECIMAL(10,2) | default 0 |
| `project_id` | UUID | nullable, scalar |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_overtime_requests`

**Purpose.** Overtime request — date, start/end time, hours, a pay `rate_multiplier`, reason, and an
approval-request link. Feeds payroll on approval.

**الشرح.** طلب عمل إضافي — التاريخ، وقت البدء/الانتهاء، الساعات، مضاعف الأجر، السبب، ورابط طلب
الموافقة. يُغذّي الرواتب عند الاعتماد.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `request_number` | TEXT | unique per tenant |
| `overtime_date` | TIMESTAMPTZ | required |
| `start_time` / `end_time` | TEXT | nullable (HH:MM) |
| `hours` | DECIMAL(8,2) | default 0 |
| `rate_multiplier` | DECIMAL(5,2) | default 1.5 |
| `reason` | TEXT | nullable |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_break_logs`

**Purpose.** Append-only break punches within a day — optional link to the daily record, start/end,
break type, minutes, and a paid flag. No soft delete.

**الشرح.** بصمات الاستراحة خلال اليوم (إضافة فقط) — رابط اختياري للسجل اليومي، البداية/النهاية، نوع
الاستراحة، الدقائق، وعلامة الدفع. بدون حذف ناعم.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `attendance_daily_id` | UUID | nullable, scalar → `hr_attendance_daily` |
| `break_start` | TIMESTAMPTZ | required |
| `break_end` | TIMESTAMPTZ | nullable |
| `break_type` | TEXT | default `meal` |
| `minutes` | INT | default 0 |
| `is_paid` | BOOLEAN | default `false` |
| `created_at` | TIMESTAMPTZ | `now()` (append-only) |

---

## Domain 6 — Leave Management

### `hr_leave_types`

**Purpose.** Leave type master (annual, sick, maternity, …) — paid/affects-payroll/requires-document
flags, an annual cap, an optional gender restriction, and a UI color.

**الشرح.** سجل أنواع الإجازات (سنوية، مرضية، أمومة…) — علامات مدفوعة/تؤثر على الرواتب/تتطلب مستنداً،
حد سنوي، قيد جنس اختياري، ولون للواجهة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `is_paid` | BOOLEAN | default `true` |
| `affects_payroll` | BOOLEAN | default `false` |
| `requires_document` | BOOLEAN | default `false` |
| `max_days_per_year` | DECIMAL(6,2) | nullable |
| `gender` | TEXT | nullable (restriction) |
| `color_hex` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_leave_policies`

**Purpose.** Accrual policy for a leave type, optionally per job grade — accrual method, days per
year, accrual rate, max carryover, minimum service months, and an allow-negative flag.

**الشرح.** سياسة استحقاق لنوع إجازة، اختيارياً حسب الدرجة الوظيفية — طريقة الاستحقاق، الأيام سنوياً،
معدل الاستحقاق، الحد الأقصى للترحيل، الحد الأدنى لأشهر الخدمة، وعلامة السماح بالرصيد السالب.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `leave_type_id` | UUID | scalar → `hr_leave_types` |
| `name` | TEXT | required |
| `job_grade_id` | UUID | nullable, scalar |
| `accrual_method` | TEXT | default `annual` |
| `days_per_year` | DECIMAL(6,2) | default 0 |
| `accrual_rate` | DECIMAL(8,4) | nullable |
| `max_carryover` | DECIMAL(6,2) | nullable |
| `min_service_months` | INT | default 0 |
| `allow_negative` | BOOLEAN | default `false` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_leave_balances`

**Purpose.** Per-employee, per-leave-type, per-year balance ledger — entitled, accrued, used,
pending, carried, and net balance days. Unique on (tenant, employee, leave_type, year).

**الشرح.** رصيد لكل موظف ونوع إجازة وسنة — الأيام المستحقة والمتراكمة والمستخدمة والمعلّقة والمرحّلة
والرصيد الصافي. فريد على (المستأجر، الموظف، نوع الإجازة، السنة).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `leave_type_id` | UUID | scalar → `hr_leave_types` |
| `year` | INT | required (part of unique key) |
| `entitled_days` / `accrued_days` / `used_days` | DECIMAL(6,2) | default 0 |
| `pending_days` / `carried_days` / `balance_days` | DECIMAL(6,2) | default 0 |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_leave_requests`

**Purpose.** Leave request document — leave type, start/end, total days, half-day flag, reason,
contact-during-leave, supporting document URL, and an approval-request link.

**الشرح.** مستند طلب الإجازة — نوع الإجازة، البداية/النهاية، إجمالي الأيام، علامة نصف اليوم، السبب،
جهة الاتصال أثناء الإجازة، رابط المستند الداعم، ورابط طلب الموافقة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `leave_type_id` | UUID | scalar → `hr_leave_types` |
| `request_number` | TEXT | unique per tenant |
| `start_date` / `end_date` | TIMESTAMPTZ | required |
| `total_days` | DECIMAL(6,2) | default 0 |
| `is_half_day` | BOOLEAN | default `false` |
| `reason` / `contact_during_leave` | TEXT | nullable |
| `document_url` | TEXT | nullable |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` (indexed) |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_leave_approvals`

**Purpose.** In-module multi-step approval ledger for a leave request — approver, step order,
decision, comments, and decided timestamp. Complements the platform approval engine.

**الشرح.** سجل موافقات متعدد الخطوات داخل الوحدة لطلب إجازة — المعتمِد، ترتيب الخطوة، القرار،
الملاحظات، ووقت البتّ. مكمّل لمحرك الموافقات في المنصة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `leave_request_id` | UUID | scalar → `hr_leave_requests` |
| `approver_id` | UUID | scalar → `hr_employees` |
| `step_order` | INT | default 1 |
| `decision` | TEXT | default `pending` |
| `comments` | TEXT | nullable |
| `decided_at` | TIMESTAMPTZ | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

---

## Domain 7 — Payroll & Benefits

### `hr_salary_components`

**Purpose.** Pay component master (earning/deduction) — calc method (fixed/percentage/formula),
optional formula, taxable & affects-gross flags, a scalar `gl_account_id` for GL posting, and a
display order.

**الشرح.** سجل مكوّن الأجر (استحقاق/استقطاع) — طريقة الاحتساب (ثابت/نسبة/معادلة)، معادلة اختيارية،
علامات الخضوع للضريبة والتأثير على الإجمالي، معرّف حساب أستاذ للترحيل، وترتيب العرض.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `component_type` | TEXT | default `earning` |
| `calc_method` | TEXT | default `fixed` |
| `formula` | TEXT | nullable |
| `is_taxable` | BOOLEAN | default `true` |
| `affects_gross` | BOOLEAN | default `true` |
| `gl_account_id` | UUID | nullable, scalar → Finance GL account |
| `display_order` | INT | default 0 |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_salary_structures`

**Purpose.** Named salary structure (template of components), optionally per job grade, with the
component set stored as JSONB and a base currency.

**الشرح.** هيكل راتب مسمّى (قالب مكوّنات)، اختيارياً حسب الدرجة الوظيفية، مع مجموعة المكوّنات مخزّنة
بصيغة JSONB وعملة أساسية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `job_grade_id` | UUID | nullable, scalar |
| `currency_code` | TEXT | default `USD` |
| `components_json` | JSONB | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_salary_components`

**Purpose.** Effective-dated per-employee component assignment — a fixed amount or percentage, in a
currency, over an effective range. Drives payroll calculation.

**الشرح.** إسناد مكوّن لكل موظف مؤرَّخ بالسريان — مبلغ ثابت أو نسبة، بعملة، خلال نطاق سريان. يقود
احتساب الرواتب.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `component_id` | UUID | scalar → `hr_salary_components` |
| `amount` | DECIMAL(19,4) | default 0 |
| `percentage` | DECIMAL(8,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `effective_from` | TIMESTAMPTZ | required |
| `effective_to` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_payroll_periods`

**Purpose.** Payroll period master — period type, start/end, pay date, and an open/closed status.

**الشرح.** سجل فترة الرواتب — نوع الفترة، البداية/النهاية، تاريخ الصرف، وحالة مفتوح/مغلق.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` | TEXT | required |
| `period_type` | TEXT | default `monthly` |
| `start_date` / `end_date` | TIMESTAMPTZ | required |
| `pay_date` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `open` (indexed) |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_payroll_runs`

**Purpose.** Payroll run header — the postable document. Scoped by period and optionally company/
branch/department, with employee count and totals (gross/deductions/net), approval-request link, and
the full posting triple linking to a GL `journal_entry_id`.

**الشرح.** رأس تشغيل الرواتب — المستند القابل للترحيل. محدد بالفترة واختيارياً بالشركة/الفرع/الإدارة،
مع عدد الموظفين والإجماليات (الإجمالي/الاستقطاعات/الصافي)، ورابط الموافقة، وثلاثي الترحيل الكامل
المرتبط بقيد أستاذ.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `period_id` | UUID | scalar → `hr_payroll_periods` |
| `run_number` | TEXT | unique per tenant |
| `run_type` | TEXT | default `regular` |
| `company_id` / `branch_id` / `department_id` | UUID | nullable, scalar |
| `currency_code` | TEXT | default `USD` |
| `employee_count` | INT | default 0 |
| `total_gross` / `total_deductions` / `total_net` | DECIMAL(19,4) | default 0 |
| `approval_request_id` | UUID | nullable, scalar |
| `journal_entry_id` | UUID | nullable, scalar → Finance JE |
| `is_posted` | BOOLEAN | default `false` |
| `posted_at` | TIMESTAMPTZ | nullable |
| `posted_by_profile_id` | UUID | nullable, scalar |
| `paid_at` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `draft` (indexed) |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_payroll_details`

**Purpose.** Per-employee payslip within a run — worked/absent days, overtime hours, gross,
earnings, deductions and net pay, target bank account, and payment status. Unique on (tenant, run,
employee).

**الشرح.** كشف راتب لكل موظف ضمن التشغيل — أيام العمل/الغياب، ساعات الإضافي، الإجمالي، الاستحقاقات،
الاستقطاعات، والصافي، الحساب البنكي المستهدف، وحالة الدفع. فريد على (المستأجر، التشغيل، الموظف).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `payroll_run_id` | UUID | scalar → `hr_payroll_runs` |
| `employee_id` | UUID | scalar → `hr_employees` |
| `contract_id` | UUID | nullable, scalar |
| `currency_code` | TEXT | default `USD` |
| `worked_days` / `absent_days` | DECIMAL(6,2) | default 0 |
| `overtime_hours` | DECIMAL(8,2) | default 0 |
| `gross_pay` / `total_earnings` / `total_deductions` / `net_pay` | DECIMAL(19,4) | default 0 |
| `bank_account_id` | UUID | nullable, scalar |
| `payment_status` | TEXT | default `pending` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_payroll_component_details`

**Purpose.** Append-only frozen snapshot of the components that made up one payslip — denormalized
component code/name/type, amount, and taxable flag. No update/delete (immutable payslip line).

**الشرح.** لقطة مجمّدة (إضافة فقط) للمكوّنات التي كوّنت كشف راتب واحد — رمز/اسم/نوع المكوّن غير
المُطبَّع، المبلغ، وعلامة الخضوع للضريبة. بدون تعديل/حذف (بند كشف غير قابل للتغيير).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `payroll_detail_id` | UUID | scalar → `hr_payroll_details` |
| `component_id` | UUID | nullable, scalar |
| `component_code` / `component_name` | TEXT | required (denormalized) |
| `component_type` | TEXT | default `earning` |
| `amount` | DECIMAL(19,4) | default 0 |
| `is_taxable` | BOOLEAN | default `true` |
| `created_at` | TIMESTAMPTZ | `now()` (append-only) |

### `hr_loans`

**Purpose.** Employee loan header — type, principal, currency, interest rate, installment count &
amount, outstanding balance, start date, approval-request link, and a scalar `journal_entry_id` for
GL disbursement posting.

**الشرح.** رأس قرض الموظف — النوع، أصل المبلغ، العملة، معدل الفائدة، عدد وقيمة الأقساط، الرصيد
المتبقي، تاريخ البدء، رابط الموافقة، ومعرّف قيد أستاذ لترحيل الصرف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `loan_number` | TEXT | unique per tenant |
| `loan_type` | TEXT | default `personal` |
| `principal_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `interest_rate` | DECIMAL(8,4) | default 0 |
| `installments` | INT | default 1 |
| `installment_amount` / `outstanding_amount` | DECIMAL(19,4) | default 0 |
| `start_date` | TIMESTAMPTZ | nullable |
| `approval_request_id` | UUID | nullable, scalar |
| `journal_entry_id` | UUID | nullable, scalar → Finance JE |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_loan_installments`

**Purpose.** Amortization schedule row for a loan — installment number, due date, amount split into
principal/interest, the payroll run that recovered it, paid timestamp, and status. Unique on (tenant,
loan, installment_no).

**الشرح.** سطر جدول سداد للقرض — رقم القسط، تاريخ الاستحقاق، المبلغ مقسّم إلى أصل/فائدة، تشغيل
الرواتب الذي استرده، وقت الدفع، والحالة. فريد على (المستأجر، القرض، رقم القسط).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `loan_id` | UUID | scalar → `hr_loans` |
| `installment_no` | INT | required (part of unique key) |
| `due_date` | TIMESTAMPTZ | required |
| `amount` / `principal_part` / `interest_part` | DECIMAL(19,4) | default 0 |
| `payroll_run_id` | UUID | nullable, scalar |
| `paid_at` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `pending` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_salary_advances`

**Purpose.** Salary advance request — amount, currency, reason, recovery months, recovered amount to
date, approval-request link, and a scalar `journal_entry_id`.

**الشرح.** طلب سلفة على الراتب — المبلغ، العملة، السبب، أشهر الاسترداد، المبلغ المسترد حتى تاريخه،
رابط الموافقة، ومعرّف قيد أستاذ.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `advance_number` | TEXT | unique per tenant |
| `amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `reason` | TEXT | nullable |
| `recovery_months` | INT | default 1 |
| `recovered_amount` | DECIMAL(19,4) | default 0 |
| `approval_request_id` | UUID | nullable, scalar |
| `journal_entry_id` | UUID | nullable, scalar → Finance JE |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_benefits`

**Purpose.** Enrolled employee benefit (insurance, allowance, …) — type, provider, amount/frequency,
coverage period, policy number, and coverage details.

**الشرح.** مزية موظف مسجّلة (تأمين، بدل…) — النوع، المزوّد، المبلغ/الدورية، فترة التغطية، رقم
الوثيقة، وتفاصيل التغطية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `benefit_type` | TEXT | required |
| `name` | TEXT | required |
| `provider` | TEXT | nullable |
| `amount` | DECIMAL(19,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `frequency` | TEXT | default `monthly` |
| `start_date` / `end_date` | TIMESTAMPTZ | nullable |
| `policy_number` / `coverage_details` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_commissions`

**Purpose.** Commission accrual for an employee from a source document (sales, etc.) — base amount,
rate, computed commission amount, the payroll run that paid it, and status.

**الشرح.** استحقاق عمولة لموظف من مستند مصدر (مبيعات…) — المبلغ الأساس، المعدل، مبلغ العمولة المحتسب،
تشغيل الرواتب الذي صرفها، والحالة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `source_type` | TEXT | default `sales` |
| `source_id` | UUID | nullable, scalar (polymorphic) |
| `period_id` | UUID | nullable, scalar |
| `base_amount` | DECIMAL(19,4) | default 0 |
| `commission_rate` | DECIMAL(8,4) | default 0 |
| `commission_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `payroll_run_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `pending` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 8 — Performance Management

### `hr_kpis`

**Purpose.** KPI master — code/name, category, measure unit, target value, and a weight. Referenced by
goals and review scores.

**الشرح.** سجل مؤشرات الأداء — الرمز/الاسم، الفئة، وحدة القياس، القيمة المستهدفة، والوزن. تُشير إليها
الأهداف ودرجات التقييم.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `category` | TEXT | default `general` |
| `measure_unit` | TEXT | nullable |
| `target_value` | DECIMAL(19,4) | nullable |
| `weight` | DECIMAL(5,2) | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_goals`

**Purpose.** Employee goal / objective (optionally linked to a KPI) — title, category, weight, target
value, start/due dates, and a rolling `progress_pct`.

**الشرح.** هدف الموظف (مرتبط اختيارياً بمؤشر أداء) — العنوان، الفئة، الوزن، القيمة المستهدفة، تواريخ
البدء/الاستحقاق، ونسبة تقدم متجددة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `kpi_id` | UUID | nullable, scalar → `hr_kpis` |
| `title` | TEXT | required |
| `description` | TEXT | nullable |
| `category` | TEXT | default `performance` |
| `weight` | DECIMAL(5,2) | nullable |
| `target_value` | DECIMAL(19,4) | nullable |
| `start_date` / `due_date` | TIMESTAMPTZ | nullable |
| `progress_pct` | DECIMAL(5,2) | default 0 |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_goal_progress`

**Purpose.** Append-only progress trail for a goal — progress percent, actual value, note, and who
recorded it. No update/delete.

**الشرح.** أثر تقدم (إضافة فقط) للهدف — نسبة التقدم، القيمة الفعلية، ملاحظة، ومن سجّلها. بدون
تعديل/حذف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `goal_id` | UUID | scalar → `hr_goals` |
| `progress_pct` | DECIMAL(5,2) | default 0 |
| `actual_value` | DECIMAL(19,4) | nullable |
| `note` | TEXT | nullable |
| `recorded_by_id` | UUID | nullable, scalar |
| `recorded_at` | TIMESTAMPTZ | `now()` |
| `created_at` | TIMESTAMPTZ | `now()` (append-only) |

### `hr_review_templates`

**Purpose.** Performance review template — review type, JSONB section/question definition, and a
rating scale max.

**الشرح.** قالب تقييم الأداء — نوع التقييم، تعريف الأقسام/الأسئلة بصيغة JSONB، والحد الأقصى لمقياس
التقييم.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `review_type` | TEXT | default `annual` |
| `sections_json` | JSONB | nullable |
| `rating_scale_max` | INT | default 5 |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_performance_reviews`

**Purpose.** Performance review header — reviewed employee, template, reviewer, type, period, overall
score & rating label, strengths/improvements/comments, and employee comments.

**الشرح.** رأس تقييم الأداء — الموظف المُقيَّم، القالب، المُقيِّم، النوع، الفترة، الدرجة الإجمالية
وتسمية التقدير، نقاط القوة/التحسين/الملاحظات، وملاحظات الموظف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `template_id` | UUID | nullable, scalar |
| `reviewer_id` | UUID | nullable, scalar → `hr_employees` |
| `review_type` | TEXT | default `annual` |
| `period_start` / `period_end` | TIMESTAMPTZ | nullable |
| `overall_score` | DECIMAL(5,2) | nullable |
| `rating_label` | TEXT | nullable |
| `strengths` / `improvements` / `comments` / `employee_comments` | TEXT | nullable |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_review_scores`

**Purpose.** Per-criterion score line within a review — optional KPI, criterion text, weight, score,
reviewer type (manager/self/peer), and comments.

**الشرح.** سطر درجة لكل معيار داخل التقييم — مؤشر أداء اختياري، نص المعيار، الوزن، الدرجة، نوع
المُقيِّم (مدير/ذاتي/زميل)، والملاحظات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `review_id` | UUID | scalar → `hr_performance_reviews` |
| `kpi_id` | UUID | nullable, scalar |
| `criterion` | TEXT | required |
| `weight` | DECIMAL(5,2) | nullable |
| `score` | DECIMAL(5,2) | default 0 |
| `reviewer_type` | TEXT | default `manager` |
| `comments` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ | `now()` (no soft delete) |

---

## Domain 9 — Learning & Training

### `hr_training_courses`

**Purpose.** Training course master — category, delivery mode, provider, duration hours, cost +
currency, and description.

**الشرح.** سجل الدورة التدريبية — الفئة، أسلوب التقديم، المزوّد، ساعات المدة، التكلفة والعملة،
والوصف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `category` | TEXT | default `general` |
| `delivery_mode` | TEXT | default `classroom` |
| `provider` | TEXT | nullable |
| `duration_hours` | DECIMAL(8,2) | nullable |
| `cost` | DECIMAL(19,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `description` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_training_sessions`

**Purpose.** Scheduled delivery of a course — trainer (internal id or free-text name), location,
dates, and capacity.

**الشرح.** جلسة تقديم مجدولة للدورة — المدرّب (معرّف داخلي أو اسم نصي)، الموقع، التواريخ، والسعة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `course_id` | UUID | scalar → `hr_training_courses` |
| `code` | TEXT | required |
| `trainer_id` | UUID | nullable, scalar |
| `trainer_name` | TEXT | nullable |
| `location` | TEXT | nullable |
| `start_date` / `end_date` | TIMESTAMPTZ | nullable |
| `capacity` | INT | nullable |
| `status_code` | TEXT | default `scheduled` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_training_records`

**Purpose.** Employee enrollment in a training session — enrolled/completed timestamps, attendance
percent, score, status, and feedback.

**الشرح.** تسجيل الموظف في جلسة تدريب — أوقات التسجيل/الإنجاز، نسبة الحضور، الدرجة، الحالة،
والملاحظات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `session_id` | UUID | scalar → `hr_training_sessions` |
| `employee_id` | UUID | scalar → `hr_employees` |
| `enrolled_at` | TIMESTAMPTZ | nullable |
| `attendance_pct` | DECIMAL(5,2) | nullable |
| `score` | DECIMAL(5,2) | nullable |
| `completed_at` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `enrolled` |
| `feedback` | TEXT | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_training_certificates`

**Purpose.** Certificate issued for a completed training record — certificate number, issue/expiry
dates, and file URL.

**الشرح.** شهادة صادرة عن سجل تدريب مكتمل — رقم الشهادة، تواريخ الإصدار/الانتهاء، ورابط الملف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `record_id` | UUID | scalar → `hr_training_records` |
| `employee_id` | UUID | scalar → `hr_employees` |
| `certificate_no` | TEXT | required |
| `issued_at` / `expiry_date` | TIMESTAMPTZ | nullable |
| `file_url` | TEXT | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

---

## Domain 10 — Career & Succession Planning

### `hr_career_paths`

**Purpose.** Defined career progression from one position to another — minimum years and requirements
to move along the path.

**الشرح.** مسار وظيفي معرّف من وظيفة إلى أخرى — الحد الأدنى للسنوات والمتطلبات للانتقال عبر المسار.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` | TEXT | required |
| `from_position_id` / `to_position_id` | UUID | nullable, scalar |
| `min_years` | DECIMAL(5,2) | nullable |
| `requirements` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_successors`

**Purpose.** Succession candidate for a position — the employee, readiness level & months, priority
ranking, and notes.

**الشرح.** مرشح إحلال لوظيفة — الموظف، مستوى الجاهزية وأشهرها، ترتيب الأولوية، والملاحظات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `position_id` | UUID | scalar → `hr_positions` |
| `employee_id` | UUID | scalar → `hr_employees` |
| `readiness_level` | TEXT | default `developing` |
| `readiness_months` | INT | nullable |
| `priority` | INT | default 1 |
| `notes` | TEXT | nullable |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_promotions`

**Purpose.** Promotion document for an employee — from/to position & grade, old/new salary, effective
date, reason, and an approval-request link.

**الشرح.** مستند ترقية للموظف — من/إلى الوظيفة والدرجة، الراتب القديم/الجديد، تاريخ السريان، السبب،
ورابط طلب الموافقة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `promotion_number` | TEXT | unique per tenant |
| `from_position_id` / `to_position_id` | UUID | nullable, scalar |
| `from_job_grade_id` / `to_job_grade_id` | UUID | nullable, scalar |
| `old_salary` / `new_salary` | DECIMAL(19,4) | nullable |
| `effective_date` | TIMESTAMPTZ | nullable |
| `reason` | TEXT | nullable |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 11 — Workforce Planning

### `hr_skills`

**Purpose.** Skill / competency master — code/name and category (technical, behavioral, …).

**الشرح.** سجل المهارة / الكفاءة — الرمز/الاسم والفئة (تقنية، سلوكية…).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` / `name_ar` | TEXT | name_ar nullable |
| `category` | TEXT | default `technical` |
| `status_code` | TEXT | default `active` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_skills`

**Purpose.** Skill an employee holds — proficiency level, years of experience, last-used date, and a
certified flag. Unique on (tenant, employee, skill).

**الشرح.** مهارة يمتلكها الموظف — مستوى الإتقان، سنوات الخبرة، تاريخ آخر استخدام، وعلامة الاعتماد.
فريد على (المستأجر، الموظف، المهارة).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `skill_id` | UUID | scalar → `hr_skills` |
| `proficiency` | INT | default 1 |
| `years_experience` | DECIMAL(5,2) | nullable |
| `last_used_at` | TIMESTAMPTZ | nullable |
| `is_certified` | BOOLEAN | default `false` |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_workforce_plans`

**Purpose.** Workforce plan header for a fiscal year (optionally per department) — current vs planned
headcount and an approval-request link.

**الشرح.** رأس خطة القوى العاملة لسنة مالية (اختيارياً حسب الإدارة) — العدد الحالي مقابل المخطط ورابط
طلب الموافقة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `code` | TEXT | unique per tenant |
| `name` | TEXT | required |
| `fiscal_year` | INT | required |
| `department_id` | UUID | nullable, scalar |
| `current_headcount` / `planned_headcount` | INT | default 0 |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_workforce_requirements`

**Purpose.** Requirement line within a workforce plan — target position/department, required vs
current vs gap counts, target quarter, estimated cost, and priority.

**الشرح.** سطر متطلب ضمن خطة القوى العاملة — الوظيفة/الإدارة المستهدفة، الأعداد المطلوبة مقابل الحالية
مقابل الفجوة، الربع المستهدف، التكلفة التقديرية، والأولوية.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `plan_id` | UUID | scalar → `hr_workforce_plans` |
| `position_id` / `department_id` | UUID | nullable, scalar |
| `required_count` / `current_count` / `gap_count` | INT | default 0 |
| `target_quarter` | TEXT | nullable |
| `estimated_cost` | DECIMAL(19,4) | nullable |
| `priority` | TEXT | default `medium` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_skill_requirements`

**Purpose.** Skill required by a position — minimum proficiency and a mandatory flag. Unique on
(tenant, position, skill). Powers skill-gap analysis.

**الشرح.** مهارة تتطلبها الوظيفة — الحد الأدنى للإتقان وعلامة الإلزام. فريد على (المستأجر، الوظيفة،
المهارة). يشغّل تحليل فجوة المهارات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `position_id` | UUID | scalar → `hr_positions` |
| `skill_id` | UUID | scalar → `hr_skills` |
| `min_proficiency` | INT | default 1 |
| `is_mandatory` | BOOLEAN | default `true` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

---

## Domain 12 — HR Budgeting

### `hr_budget_years`

**Purpose.** HR budget header for a fiscal year (optionally per company) — total budget, currency,
and an approval-request link. Unique on (tenant, fiscal_year).

**الشرح.** رأس موازنة الموارد البشرية لسنة مالية (اختيارياً حسب الشركة) — إجمالي الموازنة، العملة،
ورابط طلب الموافقة. فريد على (المستأجر، السنة المالية).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `fiscal_year` | INT | required (part of unique key) |
| `name` | TEXT | required |
| `company_id` | UUID | nullable, scalar |
| `currency_code` | TEXT | default `USD` |
| `total_budget` | DECIMAL(19,4) | default 0 |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_budget_departments`

**Purpose.** Department-level budget allocation within a budget year — budget type (salary, training,
…), amount, and currency.

**الشرح.** تخصيص موازنة على مستوى الإدارة ضمن سنة الموازنة — نوع الموازنة (رواتب، تدريب…)، المبلغ،
والعملة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `budget_year_id` | UUID | scalar → `hr_budget_years` |
| `department_id` | UUID | scalar → `hr_departments` |
| `budget_type` | TEXT | default `salary` |
| `budget_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_budget_positions`

**Purpose.** Position-level budget line within a budget year — planned headcount, average salary,
total cost, and currency.

**الشرح.** سطر موازنة على مستوى الوظيفة ضمن سنة الموازنة — العدد المخطط، متوسط الراتب، التكلفة
الإجمالية، والعملة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `budget_year_id` | UUID | scalar → `hr_budget_years` |
| `position_id` | UUID | scalar → `hr_positions` |
| `planned_count` | INT | default 0 |
| `avg_salary` / `total_cost` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

### `hr_budget_actuals`

**Purpose.** Monthly budget-vs-actual tracking — budget type, period month, budget/actual/variance
amounts, and currency. Feeds variance reporting.

**الشرح.** تتبع الموازنة مقابل الفعلي شهرياً — نوع الموازنة، شهر الفترة، مبالغ الموازنة/الفعلي/الفرق،
والعملة. يغذّي تقارير الانحرافات.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `budget_year_id` | UUID | scalar → `hr_budget_years` |
| `department_id` | UUID | nullable, scalar |
| `budget_type` | TEXT | default `salary` |
| `period_month` | INT | required |
| `budget_amount` / `actual_amount` / `variance_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

---

## Domain 13 — Employee Self Service (ESS / MSS)

### `hr_employee_requests`

**Purpose.** Generic ESS request/ticket raised by an employee — request type, subject, details,
priority, an approval-request link, an assignee, and resolution timestamp.

**الشرح.** طلب/تذكرة خدمة ذاتية عامة يرفعها الموظف — نوع الطلب، الموضوع، التفاصيل، الأولوية، رابط طلب
الموافقة، المُسند إليه، ووقت الحل.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `request_number` | TEXT | unique per tenant |
| `request_type` | TEXT | required |
| `subject` | TEXT | required |
| `details` | TEXT | nullable |
| `priority` | TEXT | default `normal` |
| `approval_request_id` | UUID | nullable, scalar |
| `assigned_to_id` | UUID | nullable, scalar |
| `resolved_at` | TIMESTAMPTZ | nullable |
| `status_code` | TEXT | default `open` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_notifications`

**Purpose.** Per-employee in-app notification — title, body, category, a polymorphic entity
reference, and read state. Complements platform `pod_notifications` for the employee portal.

**الشرح.** إشعار داخل التطبيق لكل موظف — العنوان، النص، الفئة، مرجع كيان متعدد الأشكال، وحالة القراءة.
مكمّل لإشعارات المنصة لبوابة الموظف.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `title` | TEXT | required |
| `body` | TEXT | nullable |
| `category` | TEXT | default `general` |
| `entity_type` | TEXT | nullable |
| `entity_id` | UUID | nullable, scalar (polymorphic) |
| `is_read` | BOOLEAN | default `false` (indexed w/ employee) |
| `read_at` | TIMESTAMPTZ | nullable |
| `created_at` | TIMESTAMPTZ | `now()` (append-only) |

### `hr_employee_announcements`

**Purpose.** Company/department announcement — title, body, category, audience, optional department
scope, publish/expiry timestamps, and a pinned flag.

**الشرح.** إعلان للشركة/الإدارة — العنوان، النص، الفئة، الجمهور، نطاق إدارة اختياري، أوقات
النشر/الانتهاء، وعلامة التثبيت.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `title` | TEXT | required |
| `body` | TEXT | nullable |
| `category` | TEXT | default `general` |
| `audience` | TEXT | default `all` |
| `department_id` | UUID | nullable, scalar |
| `publish_at` / `expires_at` | TIMESTAMPTZ | nullable (publish_at indexed) |
| `is_pinned` | BOOLEAN | default `false` |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_employee_documents_shared`

**Purpose.** Company document shared to employees (policy, handbook, form) — optionally targeted to
one employee, with document type, file/attachment, audience, an acknowledgement requirement, and an
acknowledged timestamp.

**الشرح.** مستند شركة مشارَك مع الموظفين (سياسة، دليل، نموذج) — موجّه اختيارياً لموظف واحد، مع نوع
المستند، الملف/المرفق، الجمهور، اشتراط الإقرار، ووقت الإقرار.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | nullable, scalar → `hr_employees` |
| `title` | TEXT | required |
| `document_type` | TEXT | default `policy` |
| `file_url` | TEXT | nullable |
| `attachment_id` | UUID | nullable, scalar → `pod_attachments` |
| `audience` | TEXT | default `all` |
| `requires_ack` | BOOLEAN | default `false` |
| `acknowledged_at` | TIMESTAMPTZ | nullable |
| `created_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 14 — Asset Assignment (Inventory / Finance integration)

### `hr_employee_assets`

**Purpose.** Asset custody assigned to an employee — asset type with scalar links to an inventory
`product_id` and/or a Finance `fin_asset_id`, serial/tag, assigned/returned dates, out/in condition,
and value. Bridges HR to Inventory and the fixed-asset ledger.

**الشرح.** عهدة أصل مُسندة لموظف — نوع الأصل مع روابط لمعرّف منتج المخزون و/أو معرّف أصل مالي، الرقم
التسلسلي/الوسم، تواريخ التسليم/الإرجاع، الحالة عند الخروج/الدخول، والقيمة. يربط الموارد البشرية
بالمخزون ودفتر الأصول الثابتة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `asset_type` | TEXT | required |
| `product_id` | UUID | nullable, scalar → inventory product |
| `fin_asset_id` | UUID | nullable, scalar → Finance asset |
| `serial_number` / `asset_tag` | TEXT | nullable |
| `name` | TEXT | required |
| `assigned_date` / `returned_date` | TIMESTAMPTZ | nullable |
| `condition_out` / `condition_in` | TEXT | nullable |
| `value` | DECIMAL(19,4) | nullable |
| `currency_code` | TEXT | default `USD` |
| `notes` | TEXT | nullable |
| `status_code` | TEXT | default `assigned` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

---

## Domain 15 — Travel & Expense

### `hr_travel_requests`

**Purpose.** Business travel request — purpose, destination, travel type (domestic/international),
depart/return dates, estimated cost, requested advance, and an approval-request link.

**الشرح.** طلب سفر عمل — الغرض، الوجهة، نوع السفر (محلي/دولي)، تواريخ المغادرة/العودة، التكلفة
التقديرية، السلفة المطلوبة، ورابط طلب الموافقة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `request_number` | TEXT | unique per tenant |
| `purpose` | TEXT | required |
| `destination` | TEXT | nullable |
| `travel_type` | TEXT | default `domestic` |
| `depart_date` / `return_date` | TIMESTAMPTZ | nullable |
| `estimated_cost` / `advance_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `approval_request_id` | UUID | nullable, scalar |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_expense_claims`

**Purpose.** Expense claim header — optionally tied to a travel request, with claim date, total &
approved amounts, cost center, approval-request link, and a scalar `journal_entry_id` for GL posting.

**الشرح.** رأس مطالبة المصروفات — مرتبطة اختيارياً بطلب سفر، مع تاريخ المطالبة، المبالغ الإجمالية
والمعتمدة، مركز التكلفة، رابط الموافقة، ومعرّف قيد أستاذ للترحيل.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `employee_id` | UUID | scalar → `hr_employees` |
| `claim_number` | TEXT | unique per tenant |
| `travel_request_id` | UUID | nullable, scalar → `hr_travel_requests` |
| `title` | TEXT | required |
| `claim_date` | TIMESTAMPTZ | nullable |
| `total_amount` / `approved_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `cost_center_id` | UUID | nullable, scalar |
| `approval_request_id` | UUID | nullable, scalar |
| `journal_entry_id` | UUID | nullable, scalar → Finance JE |
| `status_code` | TEXT | default `draft` |
| `is_active` | BOOLEAN | default `true` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` / `deleted_by` | UUID | nullable |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMPTZ | deleted_at nullable |

### `hr_expense_claim_lines`

**Purpose.** Line item within an expense claim — expense date, category, description, amount + tax,
receipt URL, and a reimbursable flag. Unique on (tenant, claim, line_number).

**الشرح.** بند ضمن مطالبة المصروفات — تاريخ المصروف، الفئة، الوصف، المبلغ + الضريبة، رابط الإيصال،
وعلامة القابلية للاسترداد. فريد على (المستأجر، المطالبة، رقم البند).

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `claim_id` | UUID | scalar → `hr_expense_claims` |
| `line_number` | INT | required (part of unique key) |
| `expense_date` | TIMESTAMPTZ | nullable |
| `category` | TEXT | default `general` |
| `description` | TEXT | nullable |
| `amount` | DECIMAL(19,4) | default 0 |
| `tax_amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `receipt_url` | TEXT | nullable |
| `is_reimbursable` | BOOLEAN | default `true` |
| `created_at` | TIMESTAMPTZ | `now()` (no soft delete) |

### `hr_expense_reimbursements`

**Purpose.** Reimbursement payment against an expense claim — amount, payment method, target bank
account or payroll run, paid timestamp, a scalar `journal_entry_id`, and status.

**الشرح.** دفعة استرداد مقابل مطالبة مصروفات — المبلغ، طريقة الدفع، الحساب البنكي المستهدف أو تشغيل
الرواتب، وقت الدفع، معرّف قيد أستاذ، والحالة.

| Column | Type | Constraints/Notes |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → `tenant_accounts` (Cascade) |
| `claim_id` | UUID | scalar → `hr_expense_claims` |
| `employee_id` | UUID | scalar → `hr_employees` |
| `amount` | DECIMAL(19,4) | default 0 |
| `currency_code` | TEXT | default `USD` |
| `payment_method` | TEXT | default `bank_transfer` |
| `bank_account_id` | UUID | nullable, scalar |
| `payroll_run_id` | UUID | nullable, scalar |
| `paid_at` | TIMESTAMPTZ | nullable |
| `journal_entry_id` | UUID | nullable, scalar → Finance JE |
| `status_code` | TEXT | default `pending` |
| `version_number` | INT | default 1 |
| `created_by` / `updated_by` | UUID | nullable |
| `created_at` / `updated_at` | TIMESTAMPTZ | (no soft delete) |

---

## Table index (88 tables)

| # | Domain | Tables |
|---|---|---|
| 1 | Organization | `hr_companies`, `hr_branches`, `hr_business_units`, `hr_divisions`, `hr_departments`, `hr_sections`, `hr_positions`, `hr_job_grades`, `hr_cost_centers`, `hr_reporting_structure` (10) |
| 2 | Employee | `hr_employees`, `hr_employee_contacts`, `hr_employee_addresses`, `hr_employee_documents`, `hr_employee_bank_accounts`, `hr_employee_contracts`, `hr_employee_history`, `hr_employee_dependents`, `hr_employee_education`, `hr_employee_experience`, `hr_employee_certifications`, `hr_employee_languages` (12) |
| 3 | Recruitment | `hr_job_openings`, `hr_candidates`, `hr_candidate_documents`, `hr_interviews`, `hr_interview_feedback`, `hr_job_offers`, `hr_offer_acceptance` (7) |
| 4 | Onboarding | `hr_onboarding_templates`, `hr_onboarding_tasks`, `hr_employee_onboarding` (3) |
| 5 | Time | `hr_shift_definitions`, `hr_shift_patterns`, `hr_shift_assignments`, `hr_attendance_logs`, `hr_attendance_daily`, `hr_timesheets`, `hr_overtime_requests`, `hr_break_logs` (8) |
| 6 | Leave | `hr_leave_types`, `hr_leave_policies`, `hr_leave_balances`, `hr_leave_requests`, `hr_leave_approvals` (5) |
| 7 | Payroll & Benefits | `hr_salary_components`, `hr_salary_structures`, `hr_employee_salary_components`, `hr_payroll_periods`, `hr_payroll_runs`, `hr_payroll_details`, `hr_payroll_component_details`, `hr_loans`, `hr_loan_installments`, `hr_salary_advances`, `hr_employee_benefits`, `hr_commissions` (12) |
| 8 | Performance | `hr_kpis`, `hr_goals`, `hr_goal_progress`, `hr_review_templates`, `hr_performance_reviews`, `hr_review_scores` (6) |
| 9 | Learning | `hr_training_courses`, `hr_training_sessions`, `hr_training_records`, `hr_training_certificates` (4) |
| 10 | Career & Succession | `hr_career_paths`, `hr_successors`, `hr_promotions` (3) |
| 11 | Workforce Planning | `hr_skills`, `hr_employee_skills`, `hr_workforce_plans`, `hr_workforce_requirements`, `hr_skill_requirements` (5) |
| 12 | HR Budgeting | `hr_budget_years`, `hr_budget_departments`, `hr_budget_positions`, `hr_budget_actuals` (4) |
| 13 | ESS / MSS | `hr_employee_requests`, `hr_employee_notifications`, `hr_employee_announcements`, `hr_employee_documents_shared` (4) |
| 14 | Asset | `hr_employee_assets` (1) |
| 15 | Travel & Expense | `hr_travel_requests`, `hr_expense_claims`, `hr_expense_claim_lines`, `hr_expense_reimbursements` (4) |

Total: **88** `hr_*` tables.

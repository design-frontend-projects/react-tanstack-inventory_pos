# Data Model — Feature 006 (Enterprise Financial Management)

The authoritative schema is `prisma/schema.prisma` (search `FINANCE (fin_)`, at the end of the
file) and the migration
`prisma/migrations/20260718110000_financial_management_enterprise_v1/migration.sql`. This document
tracks the enterprise accounting domain model: all 86 `fin_*` tables grouped into 14 domain
clusters, the cross-cutting DB objects (check constraints, idempotency index, balance-assertion
trigger, rebuild function, RLS, seeds), and the platform services the module reuses.

Feature 006 adds the **single accounting engine** every operational module posts into. It does not
replace any operational table: existing masters (`tax_rates`, `pod_payment_methods`, per-document
`currency_code` strings) stay untouched and are linked via mapping tables (`fin_tax_code_mappings`,
`fin_account_mappings`). Every table below is documented bilingually: an English **Purpose**
paragraph and an Arabic **الشرح** paragraph, followed by the full column table.

---

## Conventions

### Numeric precision (fixed across the module)

| Concept | Type | Columns (examples) |
|---|---|---|
| Money / amounts | `DECIMAL(19,4)` | `debit_amount`, `base_amount`, `remaining_amount`, `total_base_debit`, `current_balance` |
| Unit cost / price | `DECIMAL(19,6)` | reserved (platform convention; no fin_ column uses it yet) |
| Rate / percentage | `DECIMAL(9,6)` | `fin_tax_code_rates.rate`, `discount_rate`, `tolerance_rate`, `percentage`, `percent_of_total` |
| Exchange / FX rate | `DECIMAL(19,8)` | `exchange_rate`, `fin_exchange_rates.rate`, `old_rate`, `new_rate` |

### Identity and tenancy

- Every table has `id UUID` PK (`@default(uuid())`).
- Every table has `tenant_id UUID → tenant_accounts(id)` `ON DELETE CASCADE ON UPDATE CASCADE` —
  the only universal real FK. On **system+tenant lookup tables** the column is **nullable**: a row
  with `tenant_id IS NULL` is a seeded system default visible to all tenants; a tenant may add its
  own rows to override. The nullable-tenant tables are: `fin_account_classes`,
  `fin_account_types`, `fin_journal_types`, `fin_dunning_levels`, `fin_cash_flow_categories`,
  `fin_tax_types`, `fin_currencies`, `fin_depreciation_methods`, `fin_close_task_templates`,
  `fin_posting_rules`, `fin_posting_rule_lines`, `fin_payment_terms`.

### Foreign-key strategy

Real DB foreign keys exist for three kinds of relationship only:

1. **Tenant scope** — `tenant_id` on every table (above).
2. **Header → line composition** — line/child tables cascade with their header
   (`fin_journal_lines → fin_journal_entries`, `fin_tax_return_lines → fin_tax_returns`, …).
3. **Intra-finance master references** — `account_type_id → fin_account_types`,
   `account_id → fin_accounts` (Restrict), `journal_type_id`, `fiscal_period_id`,
   `tax_code_id → fin_tax_codes`, `cashbox_id`, `bank_account_id`, `category_id`, and the
   reversal/hierarchy self-FKs. Masters referenced by ledger rows use `ON DELETE Restrict` so an
   account/type/period with postings can never disappear.

**Every cross-module reference is a bare scalar `UUID` with app-enforced integrity** (no
`@relation`, no DB FK): `customer_id`, `supplier_id`, `branch_id`, `warehouse_id`, `product`-side
mapping ids, `*_profile_id` actor/custodian ids, `pos_session_id`, `sales_invoice_id`,
`pos_sale_id`, `financial_note_id`, `supplier_invoice_id`, `approval_request_id`,
`domain_event_id`, `notification_id`, and every polymorphic `source_doc_type`/`source_doc_id`
pair. Guards + repos enforce these, matching the pod_/inventory convention.

### Status codes (`status_code` + pod registry)

`fin_*` documents store a denormalized `status_code TEXT` validated against the **existing**
`pod_document_statuses` / `pod_status_transitions` registry (no new Prisma enums). The migration
seeds global rows (`tenant_id IS NULL`) for these `entity_type` values:

`fin_journal_entry`, `fin_fiscal_year`, `fin_fiscal_period`, `fin_ar_receipt`, `fin_payment_run`,
`fin_cash_transaction`, `fin_funds_transfer`, `fin_bank_reconciliation`, `fin_tax_return`,
`fin_asset`, `fin_budget`, `fin_depreciation_run`, `fin_fx_revaluation_run`,
`fin_opening_balance_batch`, `fin_allocation_run`, `fin_dunning_run`, `fin_cheque`.

(Seeded codes and transition edges are listed under **Cross-cutting DB objects** at the end.)

### Audit-column standard

**Mutable document headers and masters** carry the full audit set:

| Column | Type | Notes |
|---|---|---|
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | optimistic lock |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor profile ids (scalar) |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | `DEFAULT now()` / touched on update |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Postable documents additionally carry the **posting triple** `is_posted BOOLEAN DEFAULT false`,
`posted_at TIMESTAMP(3)?`, `posted_by_profile_id UUID?`, plus `journal_entry_id UUID?` (scalar link
to the produced GL entry) and `correlation_id UUID?` for tracing.

**Immutable ledger tables have NO soft delete and no update audit** — `fin_journal_lines`,
`fin_customer_ledger_entries`, `fin_vendor_ledger_entries`, `fin_tax_transactions`,
`fin_gl_balances` (recomputed, never edited), and append-only child rows (`*_allocations`,
`*_applications`, run entries/lines). Corrections are **reversal-only** (see Business-rule
anchors).

### Bilingual naming

Every lookup/master with a display name carries `name` (English, required) + `name_ar` (Arabic,
nullable). Seed data ships both languages.

---

## Reused platform services

No new infrastructure is created for these; `fin_` plugs into the existing platform layer.

| Service | Table(s) | How Feature 006 uses it |
|---|---|---|
| Document numbering | `document_sequences` (+ `DocumentType` enum) | `entry_number`, `run_number`, `document_number`, … issued via `nextDocumentNumber`. Enum values added (additive, `ADD VALUE IF NOT EXISTS`): `journal_entry`, `ar_receipt`, `payment_run`, `cash_transaction`, `funds_transfer`, `depreciation_run`, `fx_revaluation`, `tax_return`, `opening_balance`, `allocation_run`, `asset`, `asset_disposal`, `dunning_run`, `budget_transfer` |
| Approval engine | `pod_approval_workflows/steps/requests/actions` | polymorphic `approval_request_id` on `fin_journal_entries`, `fin_ar_receipts`, `fin_payment_runs`, `fin_budgets`, `fin_budget_transfers` |
| Status registry | `pod_document_statuses` + `pod_status_transitions` | all `fin_*` `status_code` lifecycles (17 `fin_*` entity types seeded) |
| Notifications | `pod_notifications` (`notify(tx, …)`) | dunning letters (`fin_dunning_run_entries.notification_id`), posting-queue failures, approval events |
| Attachments / custom fields | `pod_attachments`, `pod_custom_field_definitions/values` | polymorphic `entity_type`/`entity_id` against fin documents |
| Domain events (outbox) | `domain_events` | finance consumer reads operational events → `fin_event_cursors` (cursor) → `fin_posting_queue` (work items); fin emits `fin_journal_entry.posted` / `.reversed` |
| Audit trail | `audit_logs` | service-layer writes on post/reverse/close actions |
| Actors | `profiles` | all `*_profile_id` and `created_by`/`updated_by`/`deleted_by` scalar columns |
| Tenancy | `tenant_accounts` | real FK `tenant_id` on every `fin_*` table |

---
## Domain 1 — General Ledger / Chart of Accounts

### `fin_account_classes`

**Purpose** — The five root accounting classes (asset, liability, equity, revenue, expense) that
anchor the entire chart of accounts. Each class fixes the `normal_balance_side` (debit or credit),
which drives balance presentation, trial-balance signs, and the year-end P&L sweep (revenue/expense
classes are swept to retained earnings). System rows (`tenant_id IS NULL`) are seeded; tenants may
add their own overriding rows.

**الشرح** — يمثل هذا الجدول التصنيفات الجذرية الخمسة للمحاسبة (الأصول، الالتزامات، حقوق الملكية،
الإيرادات، المصروفات) التي يُبنى عليها دليل الحسابات بالكامل. يحدد كل تصنيف الطرف الطبيعي للرصيد
(مدين أو دائن) وهو ما يتحكم في طريقة عرض الأرصدة في ميزان المراجعة والقوائم المالية، وفي قيود إقفال
السنة حيث تُرحَّل حسابات الإيرادات والمصروفات إلى الأرباح المحتجزة. الصفوف النظامية تُزرَع مع
الترحيل (`tenant_id` فارغ) ويمكن لكل مستأجر إضافة صفوفه الخاصة، ويرتبط به جدول أنواع الحسابات
`fin_account_types` كمستوى تصنيف أدق.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default; FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | `asset`, `liability`, `equity`, `revenue`, `expense` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `normal_balance_side` | `TEXT NOT NULL` | `debit` or `credit` |
| `display_order` | `INTEGER NOT NULL DEFAULT 0` | UI ordering |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_account_classes_tenant_code_unique (tenant_id, code)`.

### `fin_account_types`

**Purpose** — Sub-types within a class (bank, AR control, inventory, GRNI, tax payable, COGS, …)
that carry behavioral metadata: `is_control_type` + `control_domain` mark subledger control types
(ar/ap/inventory/tax/bank/cash), and `cash_flow_section` classifies the type for the cash-flow
statement (operating/investing/financing). Every posting account references exactly one type, which
in turn fixes its class.

**الشرح** — يفصّل هذا الجدول التصنيفات الجذرية إلى أنواع حسابات فرعية (بنوك، ذمم عملاء، مخزون،
بضاعة مستلمة لم تُفوتر، ضرائب مستحقة، تكلفة البضاعة المباعة وغيرها) مع بيانات سلوكية: علامة حساب
المراقبة `is_control_type` مع نطاق المراقبة `control_domain` لربط الحساب بدفتر أستاذ مساعد (عملاء،
موردون، مخزون، ضرائب)، وقسم قائمة التدفقات النقدية `cash_flow_section`. كل حساب في دليل الحسابات
يشير إلى نوع واحد، والنوع بدوره يحدد التصنيف الجذري، فيتكون تسلسل: تصنيف ← نوع ← حساب.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `account_class_id` | `UUID NOT NULL` | real FK → `fin_account_classes` (Restrict) |
| `code` | `TEXT NOT NULL` | e.g. `bank`, `ar_control`, `grni`, `cogs` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `is_control_type` | `BOOLEAN NOT NULL DEFAULT false` | subledger control marker |
| `control_domain` | `TEXT` (nullable) | `ar`, `ap`, `inventory`, `tax`, `bank`, `cash` |
| `cash_flow_section` | `TEXT` (nullable) | `operating` / `investing` / `financing` |
| `display_order` | `INTEGER NOT NULL DEFAULT 0` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_account_types_tenant_code_unique (tenant_id, code)` — Indexes:
`fin_account_types_tenant_class_idx (tenant_id, account_class_id)`.

### `fin_accounts` (chart of accounts)

**Purpose** — The tenant's chart of accounts with unlimited hierarchy: `parent_account_id`
self-FK, denormalized `level`, materialized `path` (code chain for subtree queries), and `is_leaf`
(only leaves accept postings). `is_control_account`/`control_domain` route subledger postings and
block manual journals to control accounts; `allow_manual_journal` gates user-entered lines;
`currency_code` optionally restricts the account to one currency; `cash_flow_category_id` overrides
the type-level cash-flow classification. Journal lines, GL balances, and account mappings all hang
off this table.

**الشرح** — هذا هو دليل الحسابات الخاص بكل مستأجر، ويدعم تدرجاً غير محدود عبر المرجع الذاتي
`parent_account_id` مع عمود المستوى `level` والمسار المُجسَّد `path` الذي يسهّل الاستعلام عن أي فرع
كامل من الشجرة. الترحيل مسموح على الحسابات الورقية فقط (`is_leaf`)، وتُميَّز حسابات المراقبة
(`is_control_account`) المرتبطة بدفاتر الأستاذ المساعدة بحيث يُمنع القيد اليدوي المباشر عليها،
ويتحكم `allow_manual_journal` في إتاحة القيود اليدوية، ويمكن تقييد الحساب بعملة واحدة. ترتبط به
سطور القيود `fin_journal_lines` وأرصدة الأستاذ `fin_gl_balances` وخريطة الحسابات
`fin_account_mappings`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | account number (unique per tenant) |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `description` | `TEXT` (nullable) | |
| `parent_account_id` | `UUID` (nullable) | self-FK (Restrict) — hierarchy |
| `account_type_id` | `UUID NOT NULL` | real FK → `fin_account_types` (Restrict) |
| `level` | `INTEGER NOT NULL DEFAULT 1` | depth in tree |
| `path` | `TEXT NOT NULL DEFAULT ''` | materialized code path |
| `is_leaf` | `BOOLEAN NOT NULL DEFAULT true` | only leaves are postable |
| `is_control_account` | `BOOLEAN NOT NULL DEFAULT false` | subledger control |
| `control_domain` | `TEXT` (nullable) | `ar` / `ap` / `inventory` / `tax` / … |
| `allow_manual_journal` | `BOOLEAN NOT NULL DEFAULT true` | gate for manual JEs |
| `currency_code` | `TEXT` (nullable) | optional single-currency restriction |
| `cash_flow_category_id` | `UUID` (nullable) | scalar → `fin_cash_flow_categories` |
| `branch_id` | `UUID` (nullable) | scalar; optional branch scoping |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | optimistic lock |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_accounts_tenant_code_unique (tenant_id, code)` — Indexes:
`fin_accounts_tenant_parent_idx (tenant_id, parent_account_id)`,
`fin_accounts_tenant_type_idx (tenant_id, account_type_id)`,
`fin_accounts_tenant_active_idx (tenant_id, is_active)`.

### `fin_account_mappings`

**Purpose** — The generic bridge between operational entities and GL accounts, keyed by polymorphic
`entity_type` + `entity_id`/`entity_code` + `mapping_role`. It maps products, categories,
warehouses, branches, payment methods, tax codes/rates, POS registers, restaurant charges, and
party groups to accounts (roles like `revenue`, `cogs`, `inventory`, `settlement`, `tax_input`,
`tax_output`, `tips_payable`). The posting engine walks these mappings most-specific-first before
falling back to `fin_settings` defaults.

**الشرح** — جدول الربط العام بين كيانات التشغيل وحسابات دليل الحسابات، عبر مفتاح متعدد الأشكال يجمع
نوع الكيان ومعرّفه (أو رمزه) مع دور الربط `mapping_role`. يُستخدم لربط المنتجات وفئاتها والمستودعات
والفروع وطرق الدفع وأكواد الضرائب ونقاط البيع ورسوم المطاعم بالحسابات المناسبة (إيراد، تكلفة، مخزون،
تحصيل، ضريبة مدخلات/مخرجات، إكراميات مستحقة). يمر محرك الترحيل على هذه الخريطة من الأكثر تحديداً إلى
الأعم قبل الرجوع إلى الحسابات الافتراضية في `fin_settings`، مما يجعل توجيه القيود قابلاً للتهيئة دون
تعديل الكود.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `entity_type` | `TEXT NOT NULL` | e.g. `product`, `category`, `warehouse`, `payment_method`, `tax_code`, `res_charge` |
| `entity_id` | `UUID` (nullable) | scalar polymorphic id |
| `entity_code` | `TEXT` (nullable) | alternative code key (e.g. payment method code) |
| `mapping_role` | `TEXT NOT NULL` | e.g. `revenue`, `cogs`, `settlement`, `tax_input` |
| `account_id` | `UUID NOT NULL` | real FK → `fin_accounts` (Restrict) |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_account_mappings_scope_unique (tenant_id, entity_type, entity_id, entity_code,
mapping_role)` — Indexes: `fin_account_mappings_tenant_role_idx (tenant_id, entity_type,
mapping_role)`.

---

## Domain 2 — Fiscal Calendar

### `fin_fiscal_years`

**Purpose** — The tenant's fiscal years (arbitrary start/end, e.g. calendar or Jul–Jun). Status
follows the registry lifecycle `open → closing → closed`; a closed year is finalized by
`fin_year_close_runs`. A CHECK enforces `start_date < end_date`. Owns the fiscal periods that
partition it.

**الشرح** — يمثل السنوات المالية للمستأجر بتواريخ بداية ونهاية حرة (سنة ميلادية أو سنة مالية
مخصصة). تمر السنة بدورة حياة «مفتوحة ← قيد الإقفال ← مقفلة» وفق سجل الحالات المشترك، ويُنفَّذ
إقفالها النهائي عبر جدول تشغيلات إقفال السنة `fin_year_close_runs` الذي يرحّل صافي نتيجة السنة إلى
الأرباح المحتجزة. يتفرع من كل سنة مجموعة فترات مالية في جدول `fin_fiscal_periods`، ويضمن قيد فحص
في قاعدة البيانات أن تاريخ البداية يسبق تاريخ النهاية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | e.g. `FY2026` |
| `start_date` / `end_date` | `TIMESTAMP(3) NOT NULL` | CHECK `start_date < end_date` |
| `status_code` | `TEXT NOT NULL DEFAULT 'open'` | registry `fin_fiscal_year` |
| `closed_at` | `TIMESTAMP(3)` (nullable) | |
| `closed_by_profile_id` | `UUID` (nullable) | scalar actor |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_fiscal_years_tenant_code_unique (tenant_id, code)` — Indexes:
`fin_fiscal_years_tenant_start_idx (tenant_id, start_date)`.

### `fin_fiscal_periods`

**Purpose** — The posting periods inside a fiscal year — typically 12 monthly periods plus an
optional 13th adjustment period (`is_adjustment_period`). Status lifecycle
`future → open → closed → locked` gates posting: the engine resolves each entry date to exactly one
open period and rejects closed/locked ones. Journal entries and GL balances reference the period
directly (Restrict/Cascade respectively).

**الشرح** — فترات الترحيل داخل السنة المالية، وعادةً اثنتا عشرة فترة شهرية تُضاف إليها فترة تسويات
ثالثة عشرة اختيارية (`is_adjustment_period`). تتحكم دورة حياة الفترة «مستقبلية ← مفتوحة ← مقفلة ←
مؤمَّنة» في قبول القيود: يحدد محرك الترحيل الفترة المطابقة لتاريخ القيد ويرفض الترحيل إلى فترة غير
مفتوحة. ترتبط بها قيود اليومية `fin_journal_entries` وأرصدة الأستاذ `fin_gl_balances` وأقفال
الوحدات `fin_period_module_locks`، ويضمن قيد فحص سلامة نطاق التواريخ.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `fiscal_year_id` | `UUID NOT NULL` | real FK → `fin_fiscal_years` (Cascade) |
| `period_number` | `INTEGER NOT NULL` | 1–12 (+13 adjustment) |
| `name` | `TEXT NOT NULL` | e.g. `2026-01` |
| `start_date` / `end_date` | `TIMESTAMP(3) NOT NULL` | CHECK `start_date <= end_date` |
| `status_code` | `TEXT NOT NULL DEFAULT 'future'` | registry `fin_fiscal_period` |
| `is_adjustment_period` | `BOOLEAN NOT NULL DEFAULT false` | period 13 |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_fiscal_periods_year_number_unique (tenant_id, fiscal_year_id, period_number)` —
Indexes: `fin_fiscal_periods_tenant_range_idx (tenant_id, start_date, end_date)`,
`fin_fiscal_periods_tenant_status_idx (tenant_id, status_code)`.

### `fin_period_module_locks`

**Purpose** — Per-module soft close of a period: AP can be locked while GL stays open for
adjustments. One row per (period, module code); the posting engine consults these before accepting
module-sourced entries into an otherwise open period.

**الشرح** — يتيح إقفالاً جزئياً للفترة على مستوى الوحدة الواحدة: يمكن مثلاً إقفال وحدة الموردين
(AP) عن الترحيل في فترة معينة مع بقاء دفتر الأستاذ العام مفتوحاً لقيود التسوية. يُسجَّل صف واحد لكل
زوج (فترة، رمز وحدة) مع توقيت الإقفال ومنفّذه، ويرجع إليه محرك الترحيل قبل قبول قيود قادمة من تلك
الوحدة حتى لو كانت الفترة نفسها مفتوحة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `fiscal_period_id` | `UUID NOT NULL` | real FK → `fin_fiscal_periods` (Cascade) |
| `module_code` | `TEXT NOT NULL` | e.g. `ap`, `ar`, `inventory`, `bank` |
| `locked_at` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `locked_by_profile_id` | `UUID` (nullable) | scalar actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_period_module_locks_scope_unique (tenant_id, fiscal_period_id, module_code)`.

---
## Domain 3 — Journals + GL Balances

### `fin_journal_types`

**Purpose** — The catalog of journal books (general, sales, purchases, cash receipts/disbursements,
bank, inventory, payroll, opening, closing, adjustment, FX revaluation, depreciation, allocation,
tax). Each type binds to a `DocumentType` for numbering and an optional `default_prefix` (JV, SJV,
PJV, …). System rows are seeded; every journal entry references exactly one type.

**الشرح** — دليل أنواع اليوميات المحاسبية (يومية عامة، مبيعات، مشتريات، مقبوضات، مدفوعات، بنك،
مخزون، رواتب، قيود افتتاحية، قيود إقفال، تسويات، إعادة تقييم عملات، إهلاك، تحميل، ضرائب). يرتبط كل
نوع بقيمة من تعداد أنواع المستندات لأغراض الترقيم التسلسلي مع بادئة افتراضية (مثل JV للقيود
العامة)، وتُزرَع الأنواع النظامية مع الترحيل. كل قيد يومية في `fin_journal_entries` يشير إلى نوع
واحد يحدد دفتره وبادئة ترقيمه.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | e.g. `general`, `sales`, `fx_reval` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `document_type` | `TEXT NOT NULL` | `DocumentType` value for numbering |
| `default_prefix` | `TEXT` (nullable) | e.g. `JV`, `CRJ`, `DEP` |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_journal_types_tenant_code_unique (tenant_id, code)`.

### `fin_journal_entries`

**Purpose** — The double-entry journal header and the heart of the module. Carries the source-doc
triple (`source_doc_type`/`source_doc_id`/`source_event_type`) that powers posting idempotency (one
posted, non-reversal entry per source event — partial unique index), header totals in base currency
that must equal the line sums, and the reversal self-FK pair (`reversal_of_entry_id` ↔ reversal
entries). Lifecycle is `draft → posted → reversed` (or `draft → cancelled`); posted entries are
immutable — corrections happen only through mirror-image reversal entries.

**الشرح** — رأس قيد اليومية المزدوج، وهو قلب الوحدة المالية كلها. يحمل ثلاثية المستند المصدر (نوع
المستند، معرّفه، نوع الحدث) التي يقوم عليها ضمان عدم تكرار الترحيل عبر فهرس فريد جزئي، كما يحمل
إجماليي المدين والدائن بالعملة الأساسية اللذين يجب أن يطابقا مجموع السطور، والمرجع الذاتي لقيد العكس
`reversal_of_entry_id`. دورة الحياة: مسودة ← مرحَّل ← معكوس (أو مسودة ← ملغى)، والقيد المرحَّل غير
قابل للتعديل نهائياً؛ التصحيح الوحيد المسموح هو إنشاء قيد عكسي مطابق بالمقلوب ثم قيد جديد صحيح.
ترتبط به السطور `fin_journal_lines` وكل الدفاتر المساعدة عبر `journal_entry_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `entry_number` | `TEXT NOT NULL` | via `document_sequences` (`journal_entry`) |
| `journal_type_id` | `UUID NOT NULL` | real FK → `fin_journal_types` (Restrict) |
| `entry_date` | `TIMESTAMP(3) NOT NULL` | accounting date |
| `fiscal_period_id` | `UUID NOT NULL` | real FK → `fin_fiscal_periods` (Restrict) |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_journal_entry` |
| `source_doc_type` | `TEXT` (nullable) | e.g. `pod_supplier_invoice`, `pos_sale` |
| `source_doc_id` | `UUID` (nullable) | scalar polymorphic source |
| `source_event_type` | `TEXT` (nullable) | e.g. `supplier_invoice.posted` |
| `reference_number` | `TEXT` (nullable) | external reference |
| `memo` | `TEXT` (nullable) | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | header txn currency |
| `total_base_debit` / `total_base_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | must equal line sums (trigger-checked); CHECK `>= 0` |
| `reversal_of_entry_id` | `UUID` (nullable) | self-FK (Restrict) — this entry reverses that one |
| `is_posted` | `BOOLEAN NOT NULL DEFAULT false` | |
| `posted_at` / `posted_by_profile_id` | `TIMESTAMP(3)` / `UUID` (nullable) | posting audit |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |
| `correlation_id` | `UUID` (nullable) | tracing |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | drafts only; posted entries never soft-delete |

Unique: `fin_journal_entries_tenant_number_unique (tenant_id, entry_number)`; partial
`fin_journal_entries_source_unique (tenant_id, source_doc_type, source_doc_id, source_event_type)
WHERE status_code = 'posted' AND reversal_of_entry_id IS NULL AND source_doc_id IS NOT NULL` —
Indexes: `fin_journal_entries_tenant_date_idx (tenant_id, entry_date)`,
`fin_journal_entries_period_status_idx (tenant_id, fiscal_period_id, status_code)`,
`fin_journal_entries_source_idx (tenant_id, source_doc_type, source_doc_id)`.

### `fin_journal_lines`

**Purpose** — Immutable debit/credit lines. Each line stores transaction-currency amounts plus
base-currency amounts and the `exchange_rate` used — base amounts are the balancing authority.
Row CHECKs enforce non-negative amounts and one-side-only per line; the deferred constraint trigger
enforces entry balance at commit. Lines carry the analytical dimensions (party, cost center,
project, branch, warehouse, tax code) plus a `source_line_id` back-pointer. No soft delete ever.

**الشرح** — سطور القيد المدينة والدائنة، وهي سجلات ثابتة لا تُعدَّل ولا تُحذف حذفاً ناعماً. يخزّن كل
سطر المبلغ بعملة العملية وما يقابله بالعملة الأساسية مع سعر الصرف المستخدم، والعملة الأساسية هي
مرجع التوازن المعتمد. تفرض قيود الفحص على مستوى الصف عدم سلبية المبالغ وعدم الجمع بين مدين ودائن في
سطر واحد، بينما يتحقق مشغّل مؤجَّل عند لحظة الالتزام من توازن القيد كاملاً. يحمل السطر أيضاً الأبعاد
التحليلية: الطرف (عميل/مورد)، مركز التكلفة، المشروع، الفرع، المستودع، وكود الضريبة، إضافة إلى مرجع
سطر المستند المصدر.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `entry_id` | `UUID NOT NULL` | real FK → `fin_journal_entries` (Cascade) |
| `line_number` | `INTEGER NOT NULL` | ordering within entry |
| `account_id` | `UUID NOT NULL` | real FK → `fin_accounts` (Restrict) — leaf only (app rule) |
| `description` | `TEXT` (nullable) | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | transaction currency |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | txn → base |
| `debit_amount` / `credit_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | txn currency; CHECK `>= 0`, not both `> 0` |
| `base_debit_amount` / `base_credit_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | base currency (balancing authority); same CHECKs |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | `customer` / `supplier` + scalar id |
| `cost_center_id` | `UUID` (nullable) | scalar → `fin_cost_centers` |
| `project_id` | `UUID` (nullable) | scalar → `fin_projects` |
| `branch_id` / `warehouse_id` | `UUID` (nullable) | scalar operational dims |
| `tax_code_id` | `UUID` (nullable) | scalar → `fin_tax_codes` |
| `source_line_id` | `UUID` (nullable) | scalar back-pointer to source doc line |
| `created_at` | `TIMESTAMP(3) NOT NULL` | append-only (BRIN-indexed) |

Unique: `fin_journal_lines_entry_line_unique (entry_id, line_number)` — Indexes:
`fin_journal_lines_tenant_account_idx (tenant_id, account_id)`,
`fin_journal_lines_tenant_party_idx (tenant_id, party_type, party_id)`,
`fin_journal_lines_tenant_cost_center_idx (tenant_id, cost_center_id)`,
BRIN `fin_journal_lines_created_brin (created_at)`.

### `fin_journal_templates`

**Purpose** — Reusable journal skeletons (e.g. monthly rent accrual, payroll split). A template
optionally pins a journal type, owns ordered template lines, and feeds recurring schedules.
Instantiating a template produces a normal draft `fin_journal_entries` row.

**الشرح** — قوالب قيود جاهزة لإعادة الاستخدام (مثل استحقاق الإيجار الشهري أو توزيع الرواتب). يمكن
للقالب تثبيت نوع يومية معين، ويملك سطوراً مرتَّبة في جدول `fin_journal_template_lines`، كما تُبنى
عليه جداول التكرار `fin_recurring_journal_schedules`. عند استدعاء القالب يُنشأ قيد يومية عادي بحالة
مسودة يمكن مراجعته وترحيله كأي قيد آخر.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `journal_type_id` | `UUID` (nullable) | scalar → `fin_journal_types` |
| `description` | `TEXT` (nullable) | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_journal_templates_tenant_code_unique (tenant_id, code)`.

### `fin_journal_template_lines`

**Purpose** — Ordered lines of a template: account, side (debit/credit), and an amount formula —
`fixed` (uses `fixed_amount`) or percent-of-total (uses `percent_of_total`). Optional default cost
center/project dimensions are stamped onto generated entry lines.

**الشرح** — سطور القالب المرتَّبة: الحساب، والجهة (مدين أو دائن)، وطريقة حساب المبلغ إما مبلغاً
ثابتاً أو نسبة من إجمالي القيد. يمكن تحديد مركز تكلفة ومشروع افتراضيين يُختمان على سطور القيد الناتج
عند توليده من القالب، وتُحذف السطور تلقائياً مع حذف قالبها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `template_id` | `UUID NOT NULL` | real FK → `fin_journal_templates` (Cascade) |
| `line_number` | `INTEGER NOT NULL` | |
| `account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `side` | `TEXT NOT NULL` | `debit` / `credit` |
| `amount_formula` | `TEXT NOT NULL DEFAULT 'fixed'` | `fixed` / `percent_of_total` |
| `fixed_amount` | `DECIMAL(19,4)` (nullable) | |
| `percent_of_total` | `DECIMAL(9,6)` (nullable) | |
| `description` | `TEXT` (nullable) | |
| `cost_center_id` / `project_id` | `UUID` (nullable) | scalar default dims |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_journal_template_lines_template_line_unique (template_id, line_number)`.

### `fin_recurring_journal_schedules`

**Purpose** — Drives periodic generation of entries from a template: frequency + interval,
`next_run_date`/`last_run_date` cursor, optional `end_date`, and `auto_post` to post without manual
review. A scheduler job picks due active schedules via the dedicated index.

**الشرح** — جدولة توليد القيود الدورية من القوالب: تكرار (شهري، أسبوعي…) مع مضاعف الفترة، ومؤشر
تاريخ التشغيل القادم والأخير، وتاريخ انتهاء اختياري، وخيار الترحيل التلقائي `auto_post` الذي يرحّل
القيد الناتج فوراً دون مراجعة يدوية. تلتقط مهمة مجدولة الجداول النشطة المستحقة عبر فهرس مخصص
للاستحقاق، وتُحدَّث المؤشرات بعد كل تشغيل.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `template_id` | `UUID NOT NULL` | real FK → `fin_journal_templates` (Cascade) |
| `name` | `TEXT NOT NULL` | |
| `frequency_code` | `TEXT NOT NULL` | `daily` / `weekly` / `monthly` / … |
| `interval_count` | `INTEGER NOT NULL DEFAULT 1` | every N periods |
| `next_run_date` | `TIMESTAMP(3) NOT NULL` | scheduler cursor |
| `last_run_date` | `TIMESTAMP(3)` (nullable) | |
| `end_date` | `TIMESTAMP(3)` (nullable) | |
| `auto_post` | `BOOLEAN NOT NULL DEFAULT false` | post generated entry immediately |
| `status_code` | `TEXT NOT NULL DEFAULT 'active'` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_recurring_schedules_due_idx (tenant_id, status_code, next_run_date)`.

### `fin_gl_balances`

**Purpose** — Materialized account balances per (account, fiscal period, currency): opening and
period movement columns in both transaction and base currency. Maintained atomically by the posting
engine (`INSERT … ON CONFLICT DO UPDATE` in the same transaction as the journal entry); opening
columns are rolled forward by period close. Never edited by hand — the repair function
`fin_rebuild_gl_balances()` recomputes period movements from posted lines.

**الشرح** — أرصدة الأستاذ العام المُجسَّدة لكل ثلاثية (حساب، فترة مالية، عملة)، بأعمدة رصيد افتتاحي
وحركة الفترة مديناً وائتماناً بعملة العملية وبالعملة الأساسية معاً. يحدّث محرك الترحيل هذه الصفوف
ذرّياً داخل نفس معاملة ترحيل القيد عبر إدراج مع تحديث عند التعارض، بينما تُرحَّل الأرصدة الافتتاحية
عند إقفال الفترات. لا يُعدَّل الجدول يدوياً أبداً؛ وعند الشك تعيد الدالة `fin_rebuild_gl_balances()`
احتساب حركات الفترة من السطور المرحَّلة، وهو الأساس السريع لميزان المراجعة والتقارير.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `account_id` | `UUID NOT NULL` | real FK → `fin_accounts` (Cascade) |
| `fiscal_period_id` | `UUID NOT NULL` | real FK → `fin_fiscal_periods` (Cascade) |
| `currency_code` | `TEXT NOT NULL` | transaction currency bucket |
| `opening_debit` / `opening_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | txn currency opening |
| `period_debit` / `period_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | txn currency movement |
| `base_opening_debit` / `base_opening_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | base currency opening |
| `base_period_debit` / `base_period_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | base currency movement |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_gl_balances_scope_unique (tenant_id, account_id, fiscal_period_id, currency_code)` —
Indexes: `fin_gl_balances_tenant_period_idx (tenant_id, fiscal_period_id)`.

---
## Domain 4 — Accounts Receivable (customer accounting)

### `fin_customer_ledger_entries`

**Purpose** — The materialized AR subledger: one open-item row per customer document (invoice,
receipt, credit note, opening item), written by the posting engine in the same transaction as the
journal entry. `amount`/`base_amount` are signed (debit positive), `remaining_amount` + `is_open`
carry open-item state for aging and statements, and `due_date` drives dunning. Immutable —
applications reduce `remaining_amount`, reversals append counter-rows.

**الشرح** — دفتر أستاذ العملاء المساعد بصيغة مجسَّدة: صف واحد لكل مستند خاص بالعميل (فاتورة، سند
قبض، إشعار دائن، رصيد افتتاحي) يكتبه محرك الترحيل داخل نفس معاملة قيد اليومية. يُخزَّن المبلغ
بالعملتين مع إشارة موجبة للمدين، ويحمل الصف حالة البند المفتوح عبر `remaining_amount` و`is_open`
اللذين تقوم عليهما تقارير أعمار الديون وكشوف الحساب، بينما يحدد `due_date` استحقاق المطالبات. الجدول
ثابت لا يُعدَّل: التسديدات تُخصم عبر جدول التطبيقات، والتصحيح يكون بصفوف عكسية جديدة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `customer_id` | `UUID NOT NULL` | scalar → `customers` |
| `journal_entry_id` / `journal_line_id` | `UUID` (nullable) | scalar link to the GL posting |
| `entry_date` | `TIMESTAMP(3) NOT NULL` | |
| `document_type` | `TEXT NOT NULL` | `invoice` / `receipt` / `credit_note` / `opening` / … |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | polymorphic operational source |
| `document_number` | `TEXT` (nullable) | display reference |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `amount` / `base_amount` | `DECIMAL(19,4) NOT NULL` | signed (debit +) |
| `remaining_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | open-item balance |
| `due_date` | `TIMESTAMP(3)` (nullable) | aging / dunning |
| `is_open` | `BOOLEAN NOT NULL DEFAULT true` | |
| `memo` | `TEXT` (nullable) | |
| `created_at` | `TIMESTAMP(3) NOT NULL` | append-only |

Indexes: `fin_customer_ledger_open_idx (tenant_id, customer_id, is_open)`,
`fin_customer_ledger_due_idx (tenant_id, due_date)`,
`fin_customer_ledger_entry_idx (tenant_id, journal_entry_id)`,
`fin_customer_ledger_source_idx (tenant_id, source_doc_type, source_doc_id)`.

### `fin_customer_ledger_applications`

**Purpose** — Open-item matching for AR: applies a payment/credit entry (`from_entry_id`) against
an invoice entry (`to_entry_id`) for `applied_amount`, capturing the realized FX difference in
`fx_gain_loss_base` and the FX-adjustment journal in `journal_entry_id`. `unapplied_at` records
un-matching without deleting history.

**الشرح** — جدول مطابقة البنود المفتوحة في ذمم العملاء: يطبّق سند قبض أو إشعاراً دائناً (الطرف
`from_entry_id`) على فاتورة (الطرف `to_entry_id`) بمبلغ محدد، مع احتساب فرق العملة المحقق في
`fx_gain_loss_base` وربط قيد التسوية الناتج عنه. عند فك المطابقة لا يُحذف الصف بل يُختم بتاريخ
`unapplied_at` حفاظاً على الأثر التاريخي الكامل، وتُعاد زيادة المبلغ المتبقي في بنود الدفتر.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `from_entry_id` | `UUID NOT NULL` | real FK → `fin_customer_ledger_entries` (Cascade) — payment/credit side |
| `to_entry_id` | `UUID NOT NULL` | real FK → `fin_customer_ledger_entries` (Cascade) — invoice side |
| `applied_amount` / `applied_base_amount` | `DECIMAL(19,4) NOT NULL` | txn / base |
| `fx_gain_loss_base` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | realized FX difference |
| `application_date` | `TIMESTAMP(3) NOT NULL` | |
| `journal_entry_id` | `UUID` (nullable) | scalar — FX/settlement JE |
| `unapplied_at` | `TIMESTAMP(3)` (nullable) | un-matching timestamp |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_customer_ledger_apps_from_idx (tenant_id, from_entry_id)`,
`fin_customer_ledger_apps_to_idx (tenant_id, to_entry_id)`.

### `fin_ar_receipts`

**Purpose** — The AR receipt (customer payment) document: method, deposit target (bank account or
cashbox), currency + rate, and the allocation running totals (`allocated_amount` /
`unallocated_amount`). `is_advance` marks prepayments held on account. Posting (sync, fin-native)
produces the journal entry and a credit row in the customer ledger; allocations then match it to
invoices.

**الشرح** — مستند سند قبض من العميل: طريقة الدفع، ووجهة الإيداع (حساب بنكي أو صندوق نقدية)، والعملة
وسعر الصرف، مع إجماليي المبلغ الموزَّع وغير الموزَّع على الفواتير. تشير علامة `is_advance` إلى
الدفعات المقدمة المحتجزة على الحساب. عند الترحيل — وهو ترحيل متزامن لأن المستند مالي أصيل — يُنشأ
قيد اليومية وصف دائن في دفتر أستاذ العملاء، ثم توزَّع قيمته على الفواتير عبر جدول التخصيصات
`fin_ar_receipt_allocations`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `document_number` | `TEXT NOT NULL` | via `document_sequences` (`ar_receipt`) |
| `customer_id` | `UUID NOT NULL` | scalar → `customers` |
| `receipt_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `payment_method_code` | `TEXT` (nullable) | pod payment method code |
| `bank_account_id` / `cashbox_id` | `UUID` (nullable) | scalar deposit target |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `amount` | `DECIMAL(19,4) NOT NULL` | receipt total |
| `allocated_amount` / `unallocated_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | allocation running totals |
| `reference_number` | `TEXT` (nullable) | |
| `is_advance` | `BOOLEAN NOT NULL DEFAULT false` | prepayment on account |
| `notes` | `TEXT` (nullable) | |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_ar_receipt` |
| `is_posted` / `posted_at` / `posted_by_profile_id` | posting triple | |
| `journal_entry_id` | `UUID` (nullable) | scalar — produced JE |
| `approval_request_id` / `correlation_id` | `UUID` (nullable) | scalar |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_ar_receipts_tenant_number_unique (tenant_id, document_number)` — Indexes:
`fin_ar_receipts_tenant_customer_idx (tenant_id, customer_id)`,
`fin_ar_receipts_tenant_status_idx (tenant_id, status_code)`.

### `fin_ar_receipt_allocations`

**Purpose** — Splits a receipt across targets. Exactly one of `sales_invoice_id`, `pos_sale_id`,
`financial_note_id`, `customer_ledger_entry_id` must be set (DB CHECK), covering both operational
documents and pure subledger items. `discount_taken` records early-settlement discount granted at
allocation time.

**الشرح** — يوزّع سند القبض على مستهدفاته: فاتورة مبيعات، أو عملية بيع نقاط بيع، أو إشعار مالي، أو
بند مباشر في دفتر أستاذ العملاء — ويُلزم قيد فحص في قاعدة البيانات بتحديد هدف واحد فقط لكل صف.
يُسجَّل خصم السداد المعجّل الممنوح لحظة التخصيص في `discount_taken`، وتُحدَّث بموجب هذه الصفوف
المبالغ الموزّعة على رأس السند والمبالغ المتبقية في بنود الدفتر.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `receipt_id` | `UUID NOT NULL` | real FK → `fin_ar_receipts` (Cascade) |
| `sales_invoice_id` | `UUID` (nullable) | scalar target — exactly one of the four (CHECK) |
| `pos_sale_id` | `UUID` (nullable) | scalar target |
| `financial_note_id` | `UUID` (nullable) | scalar target |
| `customer_ledger_entry_id` | `UUID` (nullable) | scalar target |
| `allocated_amount` | `DECIMAL(19,4) NOT NULL` | |
| `discount_taken` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | settlement discount |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_ar_receipt_allocations_receipt_idx (tenant_id, receipt_id)`. CHECK:
`fin_ar_receipt_allocations_target_check` (exactly one target set).

### `fin_customer_financial_profiles`

**Purpose** — Per-customer accounting overrides: AR control account (else settings default),
payment term, credit hold flag, current dunning level, and statement delivery preference. One row
per customer, created lazily when finance needs it.

**الشرح** — الملف المالي للعميل بإعدادات تتجاوز الافتراضيات: حساب مراقبة ذمم مخصص بدلاً من الحساب
الافتراضي في الإعدادات، وشرط سداد خاص، وعلامة إيقاف ائتماني تمنع البيع الآجل، ومستوى المطالبة الحالي
في سلّم التحصيل، وطريقة تسليم كشف الحساب المفضلة. يُنشأ صف واحد لكل عميل عند أول حاجة مالية إليه، ولا
يمس هذا الجدول بيانات العميل التشغيلية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `customer_id` | `UUID NOT NULL` | scalar → `customers` |
| `ar_control_account_id` | `UUID` (nullable) | scalar override of settings default |
| `payment_term_id` | `UUID` (nullable) | scalar → `fin_payment_terms` |
| `credit_hold` | `BOOLEAN NOT NULL DEFAULT false` | blocks credit sales |
| `dunning_level_id` | `UUID` (nullable) | scalar → `fin_dunning_levels` |
| `statement_delivery` | `TEXT` (nullable) | `email` / `print` / … |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_customer_financial_profiles_unique (tenant_id, customer_id)`.

### `fin_dunning_levels`

**Purpose** — The escalation ladder for overdue receivables (seeded: friendly reminder at 7 days,
second notice at 30, final notice at 60 with sales block). Each level sets the trigger
`days_overdue`, an optional late `fee_amount`, and whether further sales are blocked.

**الشرح** — سلّم تصعيد المطالبات للمديونيات المتأخرة، وتُزرَع ثلاث درجات افتراضية: تذكير ودي بعد
سبعة أيام، وإشعار ثانٍ بعد ثلاثين يوماً، وإنذار نهائي بعد ستين يوماً مع حظر البيع الآجل. تحدد كل درجة
عدد أيام التأخير المُفعِّلة لها، ورسم تأخير اختيارياً، وعلامة حظر المبيعات `block_sales` التي تُطبَّق
على العميل عند بلوغه هذه الدرجة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `level_number` | `INTEGER NOT NULL` | 1, 2, 3, … |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `days_overdue` | `INTEGER NOT NULL` | trigger threshold |
| `fee_amount` | `DECIMAL(19,4)` (nullable) | optional late fee |
| `block_sales` | `BOOLEAN NOT NULL DEFAULT false` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_dunning_levels_tenant_level_unique (tenant_id, level_number)`.

### `fin_dunning_runs`

**Purpose** — A dunning execution batch: scans open overdue customer ledger items, assigns levels,
and generates notifications. Lifecycle `draft → executed` (or cancelled); the run header records
who executed it and owns the per-customer entries.

**الشرح** — تشغيلة مطالبات: تمسح البنود المفتوحة المتأخرة في دفتر أستاذ العملاء، وتحدد درجة
المطالبة المستحقة لكل عميل، وتولّد الإشعارات المناسبة عبر خدمة الإشعارات المشتركة. دورة الحياة
«مسودة ← منفَّذة» أو تُلغى، ويسجل الرأس منفّذ التشغيلة وتاريخها ويملك صفوف التفاصيل في
`fin_dunning_run_entries`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_number` | `TEXT NOT NULL` | via `document_sequences` (`dunning_run`) |
| `run_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_dunning_run` |
| `executed_by_profile_id` | `UUID` (nullable) | scalar actor |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_dunning_runs_tenant_number_unique (tenant_id, run_number)`.

### `fin_dunning_run_entries`

**Purpose** — One row per dunned item/customer in a run: the ledger item, the level applied, the
amount due at run time, and the id of the notification that was sent. Append-only detail of the
run.

**الشرح** — تفاصيل تشغيلة المطالبات: صف لكل بند أو عميل شملته التشغيلة، يحدد بند الدفتر المتأخر،
ودرجة المطالبة المطبَّقة عليه، والمبلغ المستحق لحظة التنفيذ، ومعرّف الإشعار الذي أُرسل عبر منظومة
الإشعارات. الجدول إلحاقي فقط ويشكّل السجل التاريخي الكامل لما أُرسل لكل عميل.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_id` | `UUID NOT NULL` | real FK → `fin_dunning_runs` (Cascade) |
| `customer_id` | `UUID NOT NULL` | scalar → `customers` |
| `ledger_entry_id` | `UUID` (nullable) | scalar → `fin_customer_ledger_entries` |
| `dunning_level_id` | `UUID` (nullable) | scalar → `fin_dunning_levels` |
| `amount_due` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | at run time |
| `notification_id` | `UUID` (nullable) | scalar → `pod_notifications` |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_dunning_run_entries_run_idx (tenant_id, run_id)`.

---
## Domain 5 — Accounts Payable (vendor accounting shadow)

### `fin_vendor_ledger_entries`

**Purpose** — The materialized AP subledger, mirror image of the customer ledger: one open-item row
per supplier document. Sources are the existing operational AP documents
(`pod_supplier_invoices`/`pod_supplier_payments`, `financial_notes`, landed cost) — fin **shadows**
them here via the async posting pipeline; the operational tables stay authoritative for workflow.
`remaining_amount`/`is_open` power AP aging and payment proposals.

**الشرح** — دفتر أستاذ الموردين المساعد، وهو الصورة المرآتية لدفتر العملاء: صف بند مفتوح لكل مستند
خاص بالمورد. المصادر هي مستندات الموردين التشغيلية القائمة (فواتير الموردين ومدفوعاتهم والإشعارات
المالية وقسائم تكاليف الشحن)، والوحدة المالية «تظلّلها» هنا عبر خط الترحيل غير المتزامن دون أي تغيير
على الجداول التشغيلية التي تبقى مرجع سير العمل. يقوم على `remaining_amount` و`is_open` تقريرا أعمار
ذمم الموردين ومقترحات الدفع في تشغيلات السداد.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `supplier_id` | `UUID NOT NULL` | scalar → `suppliers` |
| `journal_entry_id` / `journal_line_id` | `UUID` (nullable) | scalar link to GL posting |
| `entry_date` | `TIMESTAMP(3) NOT NULL` | |
| `document_type` | `TEXT NOT NULL` | `invoice` / `payment` / `debit_note` / `opening` / … |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | e.g. `pod_supplier_invoice` + id |
| `document_number` | `TEXT` (nullable) | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `amount` / `base_amount` | `DECIMAL(19,4) NOT NULL` | signed (credit + for invoices) |
| `remaining_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | open-item balance |
| `due_date` | `TIMESTAMP(3)` (nullable) | |
| `is_open` | `BOOLEAN NOT NULL DEFAULT true` | |
| `memo` | `TEXT` (nullable) | |
| `created_at` | `TIMESTAMP(3) NOT NULL` | append-only |

Indexes: `fin_vendor_ledger_open_idx (tenant_id, supplier_id, is_open)`,
`fin_vendor_ledger_due_idx (tenant_id, due_date)`,
`fin_vendor_ledger_entry_idx (tenant_id, journal_entry_id)`,
`fin_vendor_ledger_source_idx (tenant_id, source_doc_type, source_doc_id)`.

### `fin_vendor_ledger_applications`

**Purpose** — Open-item matching for AP: applies a payment/debit-note entry against an invoice
entry, capturing realized FX gain/loss and the FX-adjustment journal. `unapplied_at` preserves
history on un-matching. Identical mechanics to the AR applications table.

**الشرح** — مطابقة البنود المفتوحة في ذمم الموردين: تطبيق دفعة أو إشعار مدين (الطرف الدافع) على
فاتورة مورد (الطرف المستحق) بمبلغ محدد، مع احتساب فرق العملة المحقق وربط قيد التسوية الخاص به. عند
فك المطابقة يُختم الصف بـ `unapplied_at` دون حذف، بنفس آلية جدول تطبيقات العملاء تماماً، فيبقى
السجل التاريخي للمطابقات كاملاً.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `from_entry_id` | `UUID NOT NULL` | real FK → `fin_vendor_ledger_entries` (Cascade) — payment side |
| `to_entry_id` | `UUID NOT NULL` | real FK → `fin_vendor_ledger_entries` (Cascade) — invoice side |
| `applied_amount` / `applied_base_amount` | `DECIMAL(19,4) NOT NULL` | txn / base |
| `fx_gain_loss_base` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | realized FX difference |
| `application_date` | `TIMESTAMP(3) NOT NULL` | |
| `journal_entry_id` | `UUID` (nullable) | scalar — FX/settlement JE |
| `unapplied_at` | `TIMESTAMP(3)` (nullable) | |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_vendor_ledger_apps_from_idx (tenant_id, from_entry_id)`,
`fin_vendor_ledger_apps_to_idx (tenant_id, to_entry_id)`.

### `fin_supplier_financial_profiles`

**Purpose** — Per-supplier accounting overrides: AP control account, default expense account for
non-stock invoices, payment term, and withholding-tax configuration (`wht_applicable` +
`wht_tax_code_id`). One row per supplier; leaves the operational `suppliers` table untouched.

**الشرح** — الملف المالي للمورد بإعدادات تتجاوز الافتراضيات: حساب مراقبة دائنين مخصص، وحساب مصروف
افتراضي للفواتير غير المخزنية، وشرط سداد خاص، وإعداد ضريبة الخصم من المنبع (علامة الانطباق وكود
الضريبة). صف واحد لكل مورد يُنشأ عند الحاجة، ولا يعدّل هذا الجدول شيئاً في جدول الموردين التشغيلي
القائم.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `supplier_id` | `UUID NOT NULL` | scalar → `suppliers` |
| `ap_control_account_id` | `UUID` (nullable) | scalar override |
| `default_expense_account_id` | `UUID` (nullable) | scalar |
| `payment_term_id` | `UUID` (nullable) | scalar → `fin_payment_terms` |
| `wht_applicable` | `BOOLEAN NOT NULL DEFAULT false` | |
| `wht_tax_code_id` | `UUID` (nullable) | scalar → `fin_tax_codes` |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_supplier_financial_profiles_unique (tenant_id, supplier_id)`.

### `fin_payment_runs`

**Purpose** — Batch payment proposal and execution: select open vendor items by criteria
(`selection_criteria` JSON), review proposed lines, approve (polymorphic approval), then execute —
generating operational `PodSupplierPayment` documents per line. Lifecycle
`draft → proposed → approved → executed`, totals track proposed vs executed amounts.

**الشرح** — تشغيلة سداد جماعية للموردين: تُنتقى البنود المفتوحة وفق معايير اختيار مخزنة بصيغة
JSON (تاريخ الاستحقاق، المورد، الحد الأدنى…)، ثم تُراجع السطور المقترحة وتُعتمد عبر محرك الموافقات
المشترك، وعند التنفيذ تُنشأ مستندات دفع الموردين التشغيلية `pod_supplier_payments` سطراً بسطر. دورة
الحياة «مسودة ← مقترحة ← معتمدة ← منفَّذة»، ويتابع الرأس إجمالي المقترح مقابل إجمالي المنفَّذ فعلاً.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_number` | `TEXT NOT NULL` | via `document_sequences` (`payment_run`) |
| `run_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `bank_account_id` | `UUID` (nullable) | scalar → `fin_bank_accounts` (paying account) |
| `payment_method_code` | `TEXT` (nullable) | |
| `selection_criteria` | `JSONB` (nullable) | filter used to propose lines |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_payment_run` |
| `total_proposed` / `total_executed` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |
| `executed_at` | `TIMESTAMP(3)` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_payment_runs_tenant_number_unique (tenant_id, run_number)` — Indexes:
`fin_payment_runs_tenant_status_idx (tenant_id, status_code)`.

### `fin_payment_run_lines`

**Purpose** — Proposed/executed lines of a payment run: the supplier, the payable being settled
(supplier invoice, financial note, or vendor ledger entry), outstanding vs proposed amount, early
settlement discount, and — after execution — the id of the generated supplier payment document.

**الشرح** — سطور تشغيلة السداد: المورد، والمستحق الجاري سداده (فاتورة مورد أو إشعار مالي أو بند في
دفتر أستاذ الموردين)، والمبلغ القائم مقابل المبلغ المقترح دفعه، وخصم السداد المعجّل إن وُجد. بعد
التنفيذ يُسجَّل في السطر معرّف مستند دفع المورد التشغيلي الذي أُنشئ عنه
(`resulting_supplier_payment_id`)، ولكل سطر حالة مستقلة تسمح باستبعاد سطور بعينها من التشغيلة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_id` | `UUID NOT NULL` | real FK → `fin_payment_runs` (Cascade) |
| `supplier_id` | `UUID NOT NULL` | scalar → `suppliers` |
| `supplier_invoice_id` | `UUID` (nullable) | scalar → `pod_supplier_invoices` |
| `financial_note_id` | `UUID` (nullable) | scalar → `financial_notes` |
| `vendor_ledger_entry_id` | `UUID` (nullable) | scalar → `fin_vendor_ledger_entries` |
| `due_date` | `TIMESTAMP(3)` (nullable) | |
| `outstanding_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | at proposal time |
| `proposed_amount` | `DECIMAL(19,4) NOT NULL` | |
| `discount_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | settlement discount |
| `status_code` | `TEXT NOT NULL DEFAULT 'proposed'` | line-level state |
| `resulting_supplier_payment_id` | `UUID` (nullable) | scalar → `pod_supplier_payments` |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_payment_run_lines_run_idx (tenant_id, run_id)`,
`fin_payment_run_lines_supplier_idx (tenant_id, supplier_id)`.

---

## Domain 6 — Cash Management

### `fin_cashboxes`

**Purpose** — Physical/logical cash drawers and petty-cash boxes, each bound to one GL account
(required real-FK-like scalar, Restrict via account usage) and one currency, with an optional
custodian and float limit. `current_balance` is a denormalized running balance maintained by posted
cash transactions.

**الشرح** — الصناديق النقدية وعُهد المصروفات النثرية، ماديةً كانت أو منطقية، وكل صندوق مرتبط بحساب
واحد في دليل الحسابات وعملة واحدة، مع أمين عهدة اختياري وحد أقصى للعهدة `float_limit`. يُحدَّث
الرصيد الجاري `current_balance` تلقائياً مع ترحيل حركات الصندوق في `fin_cash_transactions`، ويُستخدم
للمطابقة اليومية ومراقبة تجاوز حد العهدة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `gl_account_id` | `UUID NOT NULL` | scalar → `fin_accounts` (cash account) |
| `branch_id` | `UUID` (nullable) | scalar |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `custodian_profile_id` | `UUID` (nullable) | scalar → `profiles` |
| `float_limit` | `DECIMAL(19,4)` (nullable) | max float |
| `current_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | denormalized running balance |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_cashboxes_tenant_code_unique (tenant_id, code)`.

### `fin_cash_transactions`

**Purpose** — Cash receipt/disbursement/expense/float documents against a cashbox, with a counter
account, optional party, and an optional `pos_session_id` link so POS cash settlements tie back to
their register session. Posting produces the journal entry (cash account vs counter account) and
updates the cashbox running balance.

**الشرح** — مستندات حركة الصندوق: قبض نقدي، صرف نقدي، مصروف، أو تغذية/سحب عهدة، على صندوق محدد مع
حساب مقابل وطرف اختياري (عميل أو مورد أو موظف)، ورابط اختياري بجلسة نقطة البيع `pos_session_id`
ليُقفَل نقد الوردية على جلستها. عند الترحيل يُنشأ قيد اليومية (حساب الصندوق مقابل الحساب المقابل)
ويُحدَّث رصيد الصندوق الجاري، ويمكن إبطال المستند بعد الترحيل وفق سجل الحالات.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `document_number` | `TEXT NOT NULL` | via `document_sequences` (`cash_transaction`) |
| `cashbox_id` | `UUID NOT NULL` | real FK → `fin_cashboxes` (Restrict) |
| `transaction_type` | `TEXT NOT NULL` | `receipt` / `disbursement` / `expense` / `float_in` / `float_out` |
| `counter_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | optional counterparty |
| `transaction_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `amount` | `DECIMAL(19,4) NOT NULL` | |
| `reference_number` | `TEXT` (nullable) | |
| `notes` | `TEXT` (nullable) | |
| `pos_session_id` | `UUID` (nullable) | scalar → POS session |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_cash_transaction` |
| `is_posted` / `posted_at` / `posted_by_profile_id` | posting triple | |
| `journal_entry_id` | `UUID` (nullable) | scalar — produced JE |
| `correlation_id` | `UUID` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_cash_transactions_tenant_number_unique (tenant_id, document_number)` — Indexes:
`fin_cash_transactions_cashbox_date_idx (tenant_id, cashbox_id, transaction_date)`,
`fin_cash_transactions_tenant_status_idx (tenant_id, status_code)`.

### `fin_funds_transfers`

**Purpose** — Moves money between cashboxes and/or bank accounts, including cross-currency
transfers (`received_amount` + rate). A DB CHECK requires at least one `from_*` and one `to_*`
endpoint. Two-step accounting via an in-transit account: the initial JE debits in-transit, the
completion JE (`completion_journal_entry_id`) lands the funds; lifecycle
`draft → in_transit → completed`.

**الشرح** — تحويل الأموال بين الصناديق والحسابات البنكية بكل الاتجاهات، بما في ذلك التحويل بين
عملتين مختلفتين حيث يُسجَّل المبلغ المستلم وسعر الصرف. يُلزم قيد فحص بوجود طرف مصدر وطرف مستقبل على
الأقل، وتُنفَّذ المحاسبة على خطوتين عبر حساب «نقد بالطريق»: قيد أول عند الإرسال يُقيّد على حساب
الطريق، وقيد إتمام عند الاستلام الفعلي، ودورة الحياة «مسودة ← بالطريق ← مكتمل»، مع إمكانية الإتمام
المباشر للتحويلات الفورية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `document_number` | `TEXT NOT NULL` | via `document_sequences` (`funds_transfer`) |
| `transfer_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `from_bank_account_id` / `from_cashbox_id` | `UUID` (nullable) | scalar source (CHECK: at least one) |
| `to_bank_account_id` / `to_cashbox_id` | `UUID` (nullable) | scalar destination (CHECK: at least one) |
| `amount` | `DECIMAL(19,4) NOT NULL` | sent amount |
| `from_currency_code` / `to_currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `received_amount` | `DECIMAL(19,4)` (nullable) | destination-currency amount |
| `in_transit_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_funds_transfer` |
| `journal_entry_id` | `UUID` (nullable) | scalar — dispatch JE |
| `completion_journal_entry_id` | `UUID` (nullable) | scalar — arrival JE |
| `notes` | `TEXT` (nullable) | |
| `is_posted` / `posted_at` / `posted_by_profile_id` | posting triple | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_funds_transfers_tenant_number_unique (tenant_id, document_number)` — Indexes:
`fin_funds_transfers_tenant_status_idx (tenant_id, status_code)`. CHECK:
`fin_funds_transfers_endpoints_check`.

### `fin_cash_flow_categories`

**Purpose** — Classification rows for the cash-flow statement, each assigned to a `section`
(operating / investing / financing). Seeded system rows cover receipts, payments, asset
acquisition/disposal, borrowings, repayments, equity movements, and FX effect; accounts opt in via
`fin_accounts.cash_flow_category_id`.

**الشرح** — فئات تصنيف قائمة التدفقات النقدية، وكل فئة تنتمي إلى قسم من الأقسام الثلاثة: التشغيلي
أو الاستثماري أو التمويلي. تُزرَع فئات نظامية جاهزة (متحصلات ومدفوعات تشغيلية، شراء واستبعاد أصول،
اقتراض وسداد قروض، حركات حقوق الملكية، وأثر فروق العملة)، وترتبط الحسابات بها اختيارياً عبر عمود
`cash_flow_category_id` في دليل الحسابات لتُبنى القائمة آلياً من الأرصدة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | e.g. `operating_receipts` |
| `section` | `TEXT NOT NULL` | `operating` / `investing` / `financing` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_cash_flow_categories_tenant_code_unique (tenant_id, code)`.

---
## Domain 7 — Banking + Reconciliation

### `fin_bank_accounts`

**Purpose** — The tenant's bank accounts (bank, number, IBAN, SWIFT, currency) each bound to one GL
account. `current_balance` is a denormalized book balance. Owns statements, reconciliations, and
cheque books; referenced (scalar) by receipts, payment runs, transfers, and cheques.

**الشرح** — الحسابات البنكية للمستأجر ببياناتها المصرفية (اسم البنك، رقم الحساب، الآيبان، رمز
السويفت، العملة)، وكل حساب مرتبط بحساب واحد في دليل الحسابات. يُحتفظ برصيد دفتري مشتق في
`current_balance`، ويملك الحساب كشوفه البنكية وتسوياته ودفاتر شيكاته، وتشير إليه سندات القبض
وتشغيلات السداد والتحويلات والشيكات.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `bank_name` | `TEXT NOT NULL` | |
| `account_name` | `TEXT` (nullable) | |
| `account_number` | `TEXT NOT NULL` | |
| `iban` / `swift_code` | `TEXT` (nullable) | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `gl_account_id` | `UUID NOT NULL` | scalar → `fin_accounts` (bank GL account) |
| `branch_id` | `UUID` (nullable) | scalar |
| `current_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | denormalized book balance |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_bank_accounts_tenant_code_unique (tenant_id, code)`.

### `fin_bank_statements`

**Purpose** — An imported or manually captured bank statement header: statement date, opening and
closing balances, and `import_source` (manual/csv/api). Owns statement lines; feeds the
reconciliation workspace. Status `open` until fully matched/closed.

**الشرح** — رأس كشف الحساب البنكي المستورد أو المُدخل يدوياً: تاريخ الكشف، والرصيد الافتتاحي
والختامي، ومصدر الاستيراد (يدوي، ملف CSV، أو ربط برمجي). يملك الكشف سطوره في
`fin_bank_statement_lines`، وهو مدخل شاشة التسوية البنكية، ويبقى بحالة مفتوحة حتى تتم مطابقة سطوره
وإقفاله.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `bank_account_id` | `UUID NOT NULL` | real FK → `fin_bank_accounts` (Cascade) |
| `statement_date` | `TIMESTAMP(3) NOT NULL` | |
| `reference_number` | `TEXT` (nullable) | |
| `opening_balance` / `closing_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `import_source` | `TEXT NOT NULL DEFAULT 'manual'` | `manual` / `csv` / `api` |
| `status_code` | `TEXT NOT NULL DEFAULT 'open'` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_bank_statements_account_date_idx (tenant_id, bank_account_id, statement_date)`.

### `fin_bank_statement_lines`

**Purpose** — Individual statement movements (signed `amount`, optional running `balance_after`).
`external_id` deduplicates re-imports via a unique key per statement; `match_status_code` tracks
reconciliation progress (`unmatched` → `matched`/`suggested`).

**الشرح** — حركات كشف الحساب سطراً بسطر: التاريخ والوصف والمرجع والمبلغ بإشارته، مع الرصيد بعد
الحركة اختيارياً. يمنع المعرّف الخارجي `external_id` تكرار السطور عند إعادة الاستيراد بفضل قيد فريد
على مستوى الكشف، وتتابع حالة المطابقة `match_status_code` تقدم التسوية من «غير مطابق» إلى «مقترح» ثم
«مطابق».

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `statement_id` | `UUID NOT NULL` | real FK → `fin_bank_statements` (Cascade) |
| `line_date` | `TIMESTAMP(3) NOT NULL` | |
| `description` / `reference` | `TEXT` (nullable) | |
| `amount` | `DECIMAL(19,4) NOT NULL` | signed |
| `balance_after` | `DECIMAL(19,4)` (nullable) | |
| `match_status_code` | `TEXT NOT NULL DEFAULT 'unmatched'` | |
| `external_id` | `TEXT` (nullable) | import dedupe key |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_bank_statement_lines_external_unique (tenant_id, statement_id, external_id)` —
Indexes: `fin_bank_statement_lines_match_idx (tenant_id, match_status_code)`.

### `fin_bank_reconciliations`

**Purpose** — A reconciliation session for a bank account as of a date: statement balance vs GL
balance and the outstanding `unreconciled_difference`. Owns the match rows; completed sessions
record who signed off. Lifecycle `draft → completed`.

**الشرح** — جلسة تسوية بنكية لحساب معين حتى تاريخ محدد: رصيد الكشف مقابل رصيد دفتر الأستاذ والفرق
غير المُسوّى بينهما. تملك الجلسة صفوف المطابقة في `fin_bank_reconciliation_matches`، وعند الاكتمال
يُسجَّل مَن اعتمدها وتاريخ الاعتماد، ودورة الحياة «مسودة ← مكتملة»، ولا تكتمل إلا عند وصول الفرق
غير المُسوّى إلى الصفر أو تبريره بقيود تسوية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `bank_account_id` | `UUID NOT NULL` | real FK → `fin_bank_accounts` (Cascade) |
| `as_of_date` | `TIMESTAMP(3) NOT NULL` | |
| `statement_balance` / `gl_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `unreconciled_difference` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_bank_reconciliation` |
| `completed_at` / `completed_by_profile_id` | `TIMESTAMP(3)` / `UUID` (nullable) | sign-off |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_bank_reconciliations_account_date_idx (tenant_id, bank_account_id, as_of_date)`.

### `fin_bank_reconciliation_matches`

**Purpose** — A single match inside a reconciliation: pairs a statement line with a GL journal
line (or an adjustment journal entry created during reconciliation, e.g. bank charges).
`match_type` records how it was made (manual/rule/auto).

**الشرح** — صف مطابقة واحد داخل جلسة التسوية: يقرن سطراً من كشف البنك بسطر قيد في دفتر الأستاذ، أو
بقيد تسوية أُنشئ أثناء الجلسة نفسها (مثل مصروفات بنكية لم تُسجَّل من قبل). يوثّق `match_type` طريقة
المطابقة: يدوية أو عبر قاعدة مطابقة أو آلية بالكامل، مع مبلغ المطابقة ومنشئها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `reconciliation_id` | `UUID NOT NULL` | real FK → `fin_bank_reconciliations` (Cascade) |
| `statement_line_id` | `UUID` (nullable) | scalar → `fin_bank_statement_lines` |
| `journal_line_id` | `UUID` (nullable) | scalar → `fin_journal_lines` |
| `adjustment_journal_entry_id` | `UUID` (nullable) | scalar — adjustment JE created in-session |
| `matched_amount` | `DECIMAL(19,4) NOT NULL` | |
| `match_type` | `TEXT NOT NULL DEFAULT 'manual'` | `manual` / `rule` / `auto` |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_bank_reconciliation_matches_recon_idx (tenant_id, reconciliation_id)`.

### `fin_bank_matching_rules`

**Purpose** — Pattern rules for auto-matching statement lines: a regex/text `pattern` applied to a
`match_field` (description/reference), optionally scoped to one bank account, with a
`counter_account_id` to auto-book recurring items (fees, interest) and a `priority` order.

**الشرح** — قواعد مطابقة آلية لسطور كشف البنك: نمط نصي يُطبَّق على حقل الوصف أو المرجع، ويمكن حصر
القاعدة بحساب بنكي واحد أو تركها عامة. عند التطابق يُقترح الحساب المقابل `counter_account_id`
لترحيل البنود المتكررة تلقائياً (رسوم بنكية، فوائد، اشتراكات)، وتُطبَّق القواعد حسب أولويتها
تصاعدياً.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `bank_account_id` | `UUID` (nullable) | scalar; NULL = all accounts |
| `name` | `TEXT NOT NULL` | |
| `pattern` | `TEXT NOT NULL` | text/regex pattern |
| `match_field` | `TEXT NOT NULL DEFAULT 'description'` | `description` / `reference` |
| `counter_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `priority` | `INTEGER NOT NULL DEFAULT 100` | lower first |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_bank_matching_rules_account_idx (tenant_id, bank_account_id, priority)`.

### `fin_cheque_books`

**Purpose** — Physical cheque books per bank account: number range (`start_number`–`end_number`)
and the `next_number` counter used when issuing cheques. Status marks active/exhausted/cancelled
books.

**الشرح** — دفاتر الشيكات المادية لكل حساب بنكي: نطاق الأرقام من البداية إلى النهاية، وعدّاد الرقم
التالي `next_number` الذي يُستهلك عند إصدار كل شيك جديد من الدفتر. تحدد الحالة إن كان الدفتر نشطاً
أو مستنفداً أو ملغى، وتُحذف الدفاتر تبعاً لحذف حسابها البنكي.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `bank_account_id` | `UUID NOT NULL` | real FK → `fin_bank_accounts` (Cascade) |
| `book_number` | `TEXT NOT NULL` | |
| `start_number` / `end_number` | `INTEGER NOT NULL` | cheque number range |
| `next_number` | `INTEGER` (nullable) | issue counter |
| `status_code` | `TEXT NOT NULL DEFAULT 'active'` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_cheque_books_scope_unique (tenant_id, bank_account_id, book_number)`.

### `fin_cheques`

**Purpose** — Issued and received cheques including post-dated cheques (PDC): `direction`
(issued/received), party, amount, `cheque_date` vs `maturity_date`, and the full lifecycle
`draft → issued/received → deposited → presented → cleared/bounced (→ replaced)`. Clearing books
the settlement JE (`clearing_journal_entry_id`); `source_doc_type/_id` links the payment/receipt
that spawned the cheque.

**الشرح** — الشيكات الصادرة والواردة بما فيها الشيكات الآجلة: الاتجاه (صادر أو وارد)، والطرف،
والمبلغ، وتاريخ الشيك مقابل تاريخ الاستحقاق للشيكات المؤجلة. تمر بدورة حياة كاملة: مسودة ← إصدار أو
استلام ← إيداع ← تقديم ← تحصيل أو ارتجاع (مع إمكانية الاستبدال بعد الارتجاع)، وعند التحصيل يُسجَّل
قيد التسوية في `clearing_journal_entry_id`، ويحفظ مرجع المستند المصدر رابط سند الدفع أو القبض الذي
نشأ عنه الشيك.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `cheque_number` | `TEXT NOT NULL` | |
| `direction` | `TEXT NOT NULL` | `issued` / `received` |
| `bank_account_id` | `UUID` (nullable) | scalar → `fin_bank_accounts` |
| `cheque_book_id` | `UUID` (nullable) | real FK → `fin_cheque_books` (SetNull) |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | counterparty |
| `payee_name` | `TEXT` (nullable) | |
| `amount` | `DECIMAL(19,4) NOT NULL` | |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `cheque_date` | `TIMESTAMP(3) NOT NULL` | |
| `maturity_date` | `TIMESTAMP(3)` (nullable) | PDC due date |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_cheque` |
| `memo` | `TEXT` (nullable) | |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | originating payment/receipt |
| `clearing_journal_entry_id` | `UUID` (nullable) | scalar — clearing JE |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_cheques_status_maturity_idx (tenant_id, status_code, maturity_date)`,
`fin_cheques_account_number_idx (tenant_id, bank_account_id, cheque_number)`.

---
## Domain 8 — Tax Accounting

### `fin_tax_authorities`

**Purpose** — The tax jurisdictions the tenant files with (e.g. national VAT authority), holding
the tenant's registration number and the default payable/receivable GL accounts for settlements
with that authority. Tax codes and returns reference an authority.

**الشرح** — الجهات الضريبية التي يتعامل معها المستأجر (مثل مصلحة الضرائب أو هيئة الزكاة والدخل)،
مع رقم التسجيل الضريبي لدى الجهة وحسابي الاستحقاق (دائن) والاسترداد (مدين) الافتراضيين لتسويات تلك
الجهة. تشير إليها أكواد الضرائب في `fin_tax_codes` والإقرارات في `fin_tax_returns`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `registration_number` | `TEXT` (nullable) | tenant's tax registration |
| `payable_account_id` / `receivable_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_tax_authorities_tenant_code_unique (tenant_id, code)`.

### `fin_tax_types`

**Purpose** — The kinds of tax the engine understands — seeded: VAT (both directions), sales tax
(output), withholding (both), excise (both). `direction` declares whether a type applies to inputs,
outputs, or both; tax codes belong to a type.

**الشرح** — أنواع الضرائب التي يفهمها المحرك الضريبي، وتُزرَع أنواع نظامية: ضريبة القيمة المضافة
(مدخلات ومخرجات)، ضريبة المبيعات (مخرجات)، ضريبة الخصم من المنبع، والضريبة الانتقائية. يحدد عمود
`direction` انطباق النوع على المشتريات أو المبيعات أو كليهما، وتنتمي أكواد الضرائب إلى هذه الأنواع.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | `vat`, `sales_tax`, `withholding`, `excise` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `direction` | `TEXT NOT NULL DEFAULT 'both'` | `input` / `output` / `both` |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_tax_types_tenant_code_unique (tenant_id, code)`.

### `fin_tax_codes`

**Purpose** — The accounting tax codes: type + authority, the **input** (recoverable) and
**output** (payable) GL accounts, the tax-return `reporting_box_code`, and `is_inclusive` for
tax-in-price handling. Rates live in the effective-dated child table; tax transactions accumulate
against the code.

**الشرح** — أكواد الضرائب المحاسبية المعتمدة: يرتبط الكود بنوع ضريبة وجهة ضريبية، ويحدد حساب ضريبة
المدخلات القابلة للخصم وحساب ضريبة المخرجات المستحقة في دليل الحسابات، وخانة الإقرار الضريبي التي
يصب فيها `reporting_box_code`، وعلامة شمول الضريبة في السعر `is_inclusive`. النسب تُحفظ في جدول
تاريخي ابن بحيث تتغير النسبة بمرور الزمن دون تعديل الكود، وتتراكم الحركات الضريبية على الكود في
`fin_tax_transactions`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `tax_type_id` | `UUID` (nullable) | scalar → `fin_tax_types` |
| `authority_id` | `UUID` (nullable) | scalar → `fin_tax_authorities` |
| `input_account_id` / `output_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `reporting_box_code` | `TEXT` (nullable) | tax-return box |
| `is_inclusive` | `BOOLEAN NOT NULL DEFAULT false` | tax included in price |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_tax_codes_tenant_code_unique (tenant_id, code)`.

### `fin_tax_code_rates`

**Purpose** — Effective-dated rates for a tax code (`rate DECIMAL(9,6)` percent). Overlap is
prevented by uniqueness on `effective_from` per code; the engine picks the rate valid at
transaction date, so historical postings stay correct after a rate change.

**الشرح** — نسب كود الضريبة بتواريخ سريان: نسبة مئوية بدقة عالية مع تاريخ بداية سريان وتاريخ نهاية
اختياري. يمنع القيد الفريد تكرار تاريخ البداية لنفس الكود، ويختار المحرك النسبة السارية في تاريخ
العملية نفسها، وبذلك تبقى القيود التاريخية صحيحة حتى بعد أي تعديل حكومي على النسبة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `tax_code_id` | `UUID NOT NULL` | real FK → `fin_tax_codes` (Cascade) |
| `rate` | `DECIMAL(9,6) NOT NULL` | percent |
| `effective_from` | `TIMESTAMP(3) NOT NULL` | |
| `effective_to` | `TIMESTAMP(3)` (nullable) | open-ended if NULL |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_tax_code_rates_effective_unique (tenant_id, tax_code_id, effective_from)`.

### `fin_tax_code_mappings`

**Purpose** — The zero-touch bridge from existing operational tax masters to accounting codes: maps
an inventory/purchasing `tax_rates` row and/or a restaurant `res_tax_configs` row to a
`fin_tax_codes` row. Operational modules keep their own tax tables; the finance consumer resolves
them through this mapping when posting.

**الشرح** — جسر الربط «دون أي تعديل» بين جداول الضرائب التشغيلية القائمة والأكواد المحاسبية: يربط
صف `tax_rates` المستخدم في المخزون والمشتريات أو صف `res_tax_configs` الخاص بالمطاعم بكود ضريبي
مالي واحد. تحتفظ الوحدات التشغيلية بجداولها كما هي بلا مساس، ويحلّ مستهلك التمويل الضريبة عبر هذه
الخريطة لحظة الترحيل ليجد الحساب والنسبة والخانة الصحيحة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `tax_rate_id` | `UUID` (nullable) | scalar → `tax_rates` (operational) |
| `res_tax_config_id` | `UUID` (nullable) | scalar → `res_tax_configs` (restaurant) |
| `tax_code_id` | `UUID NOT NULL` | scalar → `fin_tax_codes` |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_tax_code_mappings_tax_rate_idx (tenant_id, tax_rate_id)`,
`fin_tax_code_mappings_tax_code_idx (tenant_id, tax_code_id)`.

### `fin_tax_transactions`

**Purpose** — The immutable tax subledger: one row per taxed journal line/document with taxable
base, tax amount (txn + base currency), direction (input/output), party, and source doc. Rows are
swept into a return via `tax_return_id` when the return is prepared; never updated otherwise.

**الشرح** — دفتر الأستاذ الضريبي المساعد الثابت: صف لكل سطر أو مستند خاضع للضريبة يسجّل الوعاء
الخاضع ومبلغ الضريبة بعملة العملية وبالعملة الأساسية، والاتجاه (مدخلات أو مخرجات)، والطرف، والمستند
المصدر. عند إعداد الإقرار الضريبي تُلتقط الصفوف غير المُقرَّرة وتُختم بمعرّف الإقرار
`tax_return_id`، وفيما عدا ذلك لا يجري أي تعديل على الصفوف إطلاقاً حفاظاً على سلامة السجل الضريبي.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `journal_entry_id` | `UUID NOT NULL` | scalar — producing JE |
| `journal_line_id` | `UUID` (nullable) | scalar |
| `tax_code_id` | `UUID NOT NULL` | real FK → `fin_tax_codes` (Restrict) |
| `direction` | `TEXT NOT NULL` | `input` / `output` |
| `taxable_base_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `tax_amount` / `base_tax_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | txn / base currency |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `transaction_date` | `TIMESTAMP(3) NOT NULL` | |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | polymorphic source |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | counterparty |
| `tax_return_id` | `UUID` (nullable) | scalar — stamped when swept into a return |
| `created_at` | `TIMESTAMP(3) NOT NULL` | append-only |

Indexes: `fin_tax_transactions_code_date_idx (tenant_id, tax_code_id, transaction_date)`,
`fin_tax_transactions_return_idx (tenant_id, tax_return_id)`.

### `fin_tax_returns`

**Purpose** — A tax filing for a period: aggregates unswept tax transactions into box lines,
computes `net_payable`, and tracks `draft → filed → paid/amended`. `payment_journal_entry_id`
links the settlement entry to the authority.

**الشرح** — الإقرار الضريبي عن فترة محددة: يجمّع الحركات الضريبية غير المُقرَّرة في سطور خانات
الإقرار، ويحسب صافي المستحق `net_payable` (دائناً للسداد أو مديناً للاسترداد)، ويمر بدورة «مسودة ←
مُقدَّم ← مسدَّد أو مُعدَّل». عند سداد الإقرار يُربط قيد التسوية مع الجهة الضريبية عبر
`payment_journal_entry_id`، ويملك الإقرار سطوره في `fin_tax_return_lines`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `return_number` | `TEXT NOT NULL` | via `document_sequences` (`tax_return`) |
| `authority_id` | `UUID` (nullable) | scalar → `fin_tax_authorities` |
| `period_start` / `period_end` | `TIMESTAMP(3) NOT NULL` | filing window |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_tax_return` |
| `filed_at` / `filed_by_profile_id` | `TIMESTAMP(3)` / `UUID` (nullable) | filing audit |
| `net_payable` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `payment_journal_entry_id` | `UUID` (nullable) | scalar — settlement JE |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_tax_returns_tenant_number_unique (tenant_id, return_number)`.

### `fin_tax_return_lines`

**Purpose** — The box breakdown of a return (`box_code` per authority form): taxable amount and
tax amount per box, sorted for form rendering. Regenerated while the return is draft; frozen once
filed.

**الشرح** — تفصيل الإقرار على مستوى خانات النموذج الرسمي: لكل خانة رمزها ووصفها والمبلغ الخاضع
ومبلغ الضريبة وترتيب العرض. تُعاد توليد السطور ما دام الإقرار مسودة كلما أُعيد التجميع، وتتجمد
نهائياً بمجرد تقديم الإقرار للجهة الضريبية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `return_id` | `UUID NOT NULL` | real FK → `fin_tax_returns` (Cascade) |
| `box_code` | `TEXT NOT NULL` | authority form box |
| `description` | `TEXT` (nullable) | |
| `taxable_amount` / `tax_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` | |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_tax_return_lines_return_idx (tenant_id, return_id)`.

### `fin_wht_certificates`

**Purpose** — Withholding-tax certificates issued to suppliers (or received from customers):
certificate number, party, tax code, base amount and withheld amount, and the source document. The
paper trail for WHT remittance and supplier reconciliation.

**الشرح** — شهادات ضريبة الخصم من المنبع الصادرة للموردين عند الخصم من مستحقاتهم (أو المستلمة من
العملاء عند خصمهم من مستحقاتنا): رقم الشهادة، والطرف، وكود الضريبة، والمبلغ الأساسي والمبلغ
المخصوم، والمستند المصدر الذي جرى الخصم عنده. تشكّل هذه الشهادات المستند الرسمي لتوريد ضريبة الخصم
وللمطابقة مع الموردين والجهة الضريبية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `certificate_number` | `TEXT NOT NULL` | |
| `supplier_id` / `customer_id` | `UUID` (nullable) | scalar counterparty (one side) |
| `tax_code_id` | `UUID` (nullable) | scalar → `fin_tax_codes` |
| `base_amount` / `wht_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | base and withheld |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | originating document |
| `issue_date` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `status_code` | `TEXT NOT NULL DEFAULT 'issued'` | |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_wht_certificates_tenant_number_unique (tenant_id, certificate_number)`.

---
## Domain 9 — Multi-currency

### `fin_currencies`

**Purpose** — The accounting currency master, ISO-seeded (USD, EUR, GBP, EGP, SAR, AED, QAR, KWD,
BHD, OMR, JOD, TRY, JPY, CNY, INR) with symbol and `decimal_places` (0 for JPY, 3 for KWD/BHD/OMR).
Authoritative for finance; operational `currency_code` strings elsewhere remain untouched.

**الشرح** — الجدول الرئيسي لعملات المحاسبة، مزروع بعملات ISO الشائعة مع الرمز وعدد الخانات العشرية
(صفر للين الياباني وثلاث للدينار الكويتي والبحريني والريال العماني). هذا الجدول هو المرجع المعتمد
في الوحدة المالية، بينما تبقى أعمدة رموز العملات النصية في الوحدات التشغيلية كما هي دون تغيير،
ويستخدمه التقريب وعرض المبالغ وضبط أسعار الصرف.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default (ISO seeds) |
| `code` | `TEXT NOT NULL` | ISO 4217 |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `symbol` | `TEXT` (nullable) | |
| `decimal_places` | `INTEGER NOT NULL DEFAULT 2` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_currencies_tenant_code_unique (tenant_id, code)`.

### `fin_exchange_rates`

**Purpose** — Effective-dated exchange rates per currency pair and `rate_type`
(spot/average/closing/budget), with a positive-rate CHECK. The engine resolves the most recent
rate on or before the transaction date for the requested type; `source` records manual vs imported
rates.

**الشرح** — أسعار الصرف بتواريخ سريان لكل زوج عملات ولكل نوع سعر: فوري للعمليات اليومية، ومتوسط
للتقارير، وإقفالي لإعادة تقييم نهاية الفترة، وتقديري للموازنات. يختار المحرك أحدث سعر في تاريخ
العملية أو قبله للنوع المطلوب، ويسجّل عمود `source` مصدر السعر (يدوي أو مستورد)، ويمنع قيد فحص أي
سعر غير موجب.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `from_currency_code` / `to_currency_code` | `TEXT NOT NULL` | pair |
| `rate_date` | `TIMESTAMP(3) NOT NULL` | effective date |
| `rate` | `DECIMAL(19,8) NOT NULL` | CHECK `> 0` |
| `rate_type` | `TEXT NOT NULL DEFAULT 'spot'` | `spot` / `average` / `closing` / `budget` |
| `source` | `TEXT NOT NULL DEFAULT 'manual'` | |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_exchange_rates_scope_unique (tenant_id, from_currency_code, to_currency_code,
rate_date, rate_type)` — Indexes: `fin_exchange_rates_tenant_date_idx (tenant_id, rate_date)`.

### `fin_fx_revaluation_runs`

**Purpose** — Period-end unrealized FX revaluation: revalues open foreign-currency balances
(monetary accounts, open AR/AP items) at the closing rate, posts the unrealized gain/loss JE, and
auto-books the reversing entry (`reversal_journal_entry_id`) for the next period. Lifecycle
`draft → posted → reversed`.

**الشرح** — إعادة تقييم فروق العملة غير المحققة في نهاية الفترة: تُقيَّم الأرصدة المفتوحة بالعملات
الأجنبية (الحسابات النقدية وبنود العملاء والموردين المفتوحة) بسعر الإقفال، ويُرحَّل قيد الأرباح أو
الخسائر غير المحققة، ثم يُسجَّل تلقائياً قيد عكسي في بداية الفترة التالية لأن الفروق غير محققة
بطبيعتها. دورة الحياة «مسودة ← مرحَّلة ← معكوسة»، ويجمع الرأس إجمالي الأرباح والخسائر بالعملة
الأساسية.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_number` | `TEXT NOT NULL` | via `document_sequences` (`fx_revaluation`) |
| `as_of_date` | `TIMESTAMP(3) NOT NULL` | valuation date |
| `rate_type` | `TEXT NOT NULL DEFAULT 'closing'` | rate set used |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_fx_revaluation_run` |
| `journal_entry_id` | `UUID` (nullable) | scalar — revaluation JE |
| `reversal_journal_entry_id` | `UUID` (nullable) | scalar — auto-reversal JE |
| `total_gain_base` / `total_loss_base` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_fx_revaluation_runs_tenant_number_unique (tenant_id, run_number)`.

### `fin_fx_revaluation_lines`

**Purpose** — Per-account (optionally per-party) revaluation detail: foreign balance, old vs new
rate, old vs new base balance, and the resulting `gain_loss_base`. Append-only audit of how the
run's totals were computed.

**الشرح** — تفاصيل إعادة التقييم على مستوى كل حساب (وكل طرف عند الحاجة): الرصيد بالعملة الأجنبية،
والسعر القديم مقابل الجديد، والرصيد الأساسي قبل وبعد، وفرق الربح أو الخسارة الناتج بالعملة
الأساسية. الجدول إلحاقي فقط ويوثّق كيفية احتساب إجماليات التشغيلة رقماً رقماً لأغراض المراجعة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_id` | `UUID NOT NULL` | real FK → `fin_fx_revaluation_runs` (Cascade) |
| `account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | optional open-item party |
| `currency_code` | `TEXT NOT NULL` | foreign currency |
| `foreign_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `old_rate` / `new_rate` | `DECIMAL(19,8)` (nullable) | |
| `old_base_balance` / `new_base_balance` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `gain_loss_base` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | signed |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_fx_revaluation_lines_run_idx (tenant_id, run_id)`.

---

## Domain 10 — Cost Dimensions

### `fin_cost_centers`

**Purpose** — Hierarchical cost centers (self-FK parent) with optional manager and branch. Stamped
on journal lines, budget lines, and allocation targets to slice P&L by responsibility center.

**الشرح** — مراكز التكلفة بهيكل شجري عبر المرجع الذاتي للأب، مع مدير مسؤول وفرع اختياريين. تُختم
مراكز التكلفة على سطور القيود وسطور الموازنات وأهداف قواعد التحميل، وبها تُشرَّح قائمة الدخل حسب
مراكز المسؤولية وتُقارن الموازنة بالفعلي لكل مركز.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `parent_cost_center_id` | `UUID` (nullable) | self-FK (Restrict) — hierarchy |
| `manager_profile_id` | `UUID` (nullable) | scalar → `profiles` |
| `branch_id` | `UUID` (nullable) | scalar |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_cost_centers_tenant_code_unique (tenant_id, code)`.

### `fin_projects`

**Purpose** — Financial projects/jobs for project-based tracking: optional customer, date range,
lifecycle status, budget amount, and manager. Journal lines and budget lines reference a project
for project P&L.

**الشرح** — المشاريع المالية أو أوامر العمل لتتبع الإيرادات والتكاليف على مستوى المشروع: عميل
اختياري، ونطاق زمني، وحالة دورة حياة، ومبلغ موازنة تقديري، ومدير مشروع. تشير سطور القيود وسطور
الموازنات إلى المشروع فتُبنى قائمة دخل خاصة بكل مشروع وتُقارن تكاليفه الفعلية بموازنته.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `customer_id` | `UUID` (nullable) | scalar → `customers` |
| `start_date` / `end_date` | `TIMESTAMP(3)` (nullable) | |
| `status_code` | `TEXT NOT NULL DEFAULT 'active'` | |
| `budget_amount` | `DECIMAL(19,4)` (nullable) | |
| `manager_profile_id` | `UUID` (nullable) | scalar → `profiles` |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_projects_tenant_code_unique (tenant_id, code)`.

### `fin_analysis_dimensions`

**Purpose** — User-definable analysis dimensions beyond cost center/project (e.g. product line,
region, campaign). `is_required_on_posting` forces a value on every journal line at post time.
Owns its values and the line-dimension junction rows.

**الشرح** — أبعاد تحليلية إضافية يعرّفها المستخدم فيما يتجاوز مراكز التكلفة والمشاريع (خط منتجات،
منطقة جغرافية، حملة تسويقية…). يمكن جعل البعد إلزامياً عند الترحيل عبر `is_required_on_posting`
فيرفض المحرك أي قيد لا يحمل قيمة له، ويملك البعد قيمه في جدول ابن وصفوف ربطه بسطور القيود.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `is_required_on_posting` | `BOOLEAN NOT NULL DEFAULT false` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_analysis_dimensions_tenant_code_unique (tenant_id, code)`.

### `fin_analysis_dimension_values`

**Purpose** — The allowed values of a dimension (e.g. regions: north/south/…), bilingual and
individually activatable. Journal-line junction rows must point at a value of the same dimension.

**الشرح** — القيم المسموح بها لكل بعد تحليلي (مثلاً للمنطقة: شمال، جنوب…) بأسماء ثنائية اللغة مع
إمكانية تعطيل قيمة بعينها دون حذفها. تشترط صفوف الربط على سطور القيود أن تكون القيمة تابعة للبعد
نفسه، وتُحذف القيم تبعاً لحذف بعدها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `dimension_id` | `UUID NOT NULL` | real FK → `fin_analysis_dimensions` (Cascade) |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_analysis_dimension_values_scope_unique (tenant_id, dimension_id, code)`.

### `fin_journal_line_dimensions`

**Purpose** — Junction stamping a dimension value onto a journal line, at most one value per
dimension per line (unique). Cost center and project remain first-class columns on the line
itself; this junction covers only the user-defined dimensions.

**الشرح** — جدول الربط الذي يختم قيمة بعد تحليلي على سطر قيد، بقيمة واحدة كحد أقصى لكل بعد على
السطر الواحد بموجب القيد الفريد. يظل مركز التكلفة والمشروع عمودين صريحين على سطر القيد نفسه لأنهما
الأكثر استخداماً، ويغطي هذا الجدول الأبعاد المعرَّفة من المستخدم فقط، وتُحذف صفوفه تبعاً لحذف
السطر.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `journal_line_id` | `UUID NOT NULL` | real FK → `fin_journal_lines` (Cascade) |
| `dimension_id` | `UUID NOT NULL` | real FK → `fin_analysis_dimensions` (Cascade) |
| `dimension_value_id` | `UUID NOT NULL` | real FK → `fin_analysis_dimension_values` (Restrict) |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_journal_line_dimensions_unique (journal_line_id, dimension_id)`.

---
## Domain 11 — Budgets

### `fin_budgets`

**Purpose** — Budget header per fiscal year, versioned by `revision_number` (uniqueness spans
year + code + revision) and approvable via the shared approval engine. Lifecycle
`draft → submitted → approved → active → closed`; the active revision is the one budget control
compares actuals against.

**الشرح** — رأس الموازنة التقديرية لسنة مالية محددة، بإصدارات متتابعة عبر `revision_number` بحيث
تبقى كل مراجعة سجلاً مستقلاً، وتُعتمد الموازنة عبر محرك الموافقات المشترك. دورة الحياة «مسودة ←
مقدَّمة ← معتمدة ← نشطة ← مقفلة»، والمراجعة النشطة هي التي تُقارن بها الأرقام الفعلية في سياسات
الرقابة على الموازنة، ويملك الرأس سطوره ومراجعاته.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `fiscal_year_id` | `UUID NOT NULL` | scalar → `fin_fiscal_years` |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_budget` |
| `revision_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_budgets_scope_unique (tenant_id, fiscal_year_id, code, revision_number)`.

### `fin_budget_lines`

**Purpose** — Budget amounts at the finest grain: account × fiscal period × optional cost center ×
optional project. The composite unique prevents duplicate cells; the account/period index serves
budget-vs-actual queries.

**الشرح** — مبالغ الموازنة على أدق مستوى: حساب × فترة مالية × مركز تكلفة اختياري × مشروع اختياري.
يمنع القيد الفريد المركّب تكرار الخلية الواحدة، ويخدم فهرس الحساب والفترة استعلامات مقارنة الموازنة
بالفعلي التي تجمع حركة `fin_gl_balances` مقابل هذه السطور.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `budget_id` | `UUID NOT NULL` | real FK → `fin_budgets` (Cascade) |
| `account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `fiscal_period_id` | `UUID NOT NULL` | scalar → `fin_fiscal_periods` |
| `cost_center_id` / `project_id` | `UUID` (nullable) | scalar dims |
| `amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `notes` | `TEXT` (nullable) | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_budget_lines_scope_unique (budget_id, account_id, fiscal_period_id, cost_center_id,
project_id)` — Indexes: `fin_budget_lines_account_period_idx (tenant_id, account_id,
fiscal_period_id)`.

### `fin_budget_revisions`

**Purpose** — Audit trail of budget revisions: who revised, why, and a JSON `snapshot` of the
previous line set so any revision can be diffed or restored. Appended whenever a new
`revision_number` is cut.

**الشرح** — سجل مراجعات الموازنة: من عدّل، وسبب التعديل، ولقطة JSON كاملة لسطور الموازنة قبل
المراجعة بحيث يمكن مقارنة أي إصدارين أو استرجاع إصدار سابق. يُلحق صف جديد هنا كلما قُطعت مراجعة
جديدة برقم إصدار أعلى، ولا تُعدَّل الصفوف بعد إنشائها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `budget_id` | `UUID NOT NULL` | real FK → `fin_budgets` (Cascade) |
| `revision_number` | `INTEGER NOT NULL` | |
| `reason` | `TEXT` (nullable) | |
| `revised_by_profile_id` | `UUID` (nullable) | scalar actor |
| `snapshot` | `JSONB` (nullable) | prior line set |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_budget_revisions_budget_idx (tenant_id, budget_id)`.

### `fin_budget_transfers`

**Purpose** — Moves budgeted amount from one budget line to another (virement) with reason and
optional approval. Keeps total budget constant while reallocating between accounts/cost centers.

**الشرح** — مناقلة اعتمادات بين سطرين من سطور الموازنة (من سطر مانح إلى سطر مستفيد) بمبلغ محدد
وسبب موثَّق واعتماد اختياري عبر محرك الموافقات. تحافظ المناقلة على إجمالي الموازنة ثابتاً مع إعادة
توزيع الاعتمادات بين الحسابات أو مراكز التكلفة، ولها رقم مستند متسلسل ودورة حالة خاصة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `transfer_number` | `TEXT NOT NULL` | via `document_sequences` (`budget_transfer`) |
| `from_budget_line_id` / `to_budget_line_id` | `UUID NOT NULL` | scalar → `fin_budget_lines` |
| `amount` | `DECIMAL(19,4) NOT NULL` | |
| `reason` | `TEXT` (nullable) | |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | |
| `approval_request_id` | `UUID` (nullable) | scalar → `pod_approval_requests` |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_budget_transfers_tenant_number_unique (tenant_id, transfer_number)`.

### `fin_budget_control_policies`

**Purpose** — Enforcement policies for budget overruns, scoped by account, account type, or cost
center: `control_action` none/warn/block plus an optional `tolerance_rate` percentage headroom.
Checked by the posting/commitment path before accepting expense postings.

**الشرح** — سياسات الرقابة على تجاوز الموازنة، وتُحدَّد على مستوى حساب بعينه أو نوع حسابات أو مركز
تكلفة: إجراء الرقابة إما لا شيء أو تحذير أو منع `block`، مع نسبة سماح اختيارية `tolerance_rate`
فوق الاعتماد. يفحص مسار الترحيل هذه السياسات قبل قبول قيود المصروفات فيحذّر المستخدم أو يرفض القيد
عند تجاوز الاعتماد المتاح بأكثر من نسبة السماح.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `account_id` | `UUID` (nullable) | scalar scope |
| `account_type_id` | `UUID` (nullable) | scalar scope |
| `cost_center_id` | `UUID` (nullable) | scalar scope |
| `control_action` | `TEXT NOT NULL DEFAULT 'warn'` | `none` / `warn` / `block` |
| `tolerance_rate` | `DECIMAL(9,6)` (nullable) | percent headroom |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_budget_control_policies_account_idx (tenant_id, account_id)`.

---

## Domain 12 — Fixed Assets

### `fin_asset_categories`

**Purpose** — Asset classes (vehicles, machinery, IT, …) carrying the four default GL accounts
(asset, accumulated depreciation, depreciation expense, disposal gain/loss) plus the default
depreciation method and useful life. New assets inherit these defaults.

**الشرح** — فئات الأصول الثابتة (سيارات، آلات، أجهزة حاسب…) وتحمل كل فئة الحسابات الأربعة
الافتراضية: حساب الأصل، ومجمع الإهلاك، ومصروف الإهلاك، وحساب أرباح/خسائر الاستبعاد، إضافة إلى طريقة
الإهلاك الافتراضية والعمر الإنتاجي الافتراضي بالأشهر. يرث الأصل الجديد هذه الإعدادات من فئته ويمكن
تجاوزها على مستواه.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `asset_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `accum_depreciation_account_id` | `UUID` (nullable) | scalar |
| `depreciation_expense_account_id` | `UUID` (nullable) | scalar |
| `disposal_gain_loss_account_id` | `UUID` (nullable) | scalar |
| `default_method_code` | `TEXT` (nullable) | → `fin_depreciation_methods.code` |
| `default_useful_life_months` | `INTEGER` (nullable) | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_asset_categories_tenant_code_unique (tenant_id, code)`.

### `fin_depreciation_methods`

**Purpose** — Depreciation method lookup mapping a code to a `calculation_strategy` implemented in
code (seeded: straight line, declining balance, double declining, units of production, none).
System rows; tenants may add custom labels over the same strategies.

**الشرح** — دليل طرق الإهلاك، يربط كل رمز باستراتيجية حساب منفَّذة برمجياً، وتُزرَع الطرق القياسية:
القسط الثابت، والقسط المتناقص، والمتناقص المضاعف، ووحدات الإنتاج، وبدون إهلاك (للأراضي مثلاً).
الصفوف النظامية مشتركة، ويمكن للمستأجر إضافة صفوفه بأسماء مخصصة فوق الاستراتيجيات نفسها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `calculation_strategy` | `TEXT NOT NULL DEFAULT 'straight_line'` | code-implemented strategy |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_depreciation_methods_tenant_code_unique (tenant_id, code)`.

### `fin_assets`

**Purpose** — The fixed-asset register: acquisition data, salvage value, useful life, method,
location dims (branch/warehouse/cost center), custodian, and running `accumulated_depreciation`.
`source_doc_type/_id` supports capitalization from supplier invoices;
`capitalization_journal_entry_id` links the capitalization JE. Lifecycle
`draft → active → fully_depreciated/disposed/written_off`.

**الشرح** — سجل الأصول الثابتة: بيانات الاقتناء وتاريخ بدء التشغيل وقيمة الخردة والعمر الإنتاجي
وطريقة الإهلاك، مع أبعاد الموقع (فرع، مستودع، مركز تكلفة) وأمين العهدة والرقم التسلسلي، ومجمع
الإهلاك الجاري المتراكم. يدعم الأصل الرسملة من فاتورة مورد عبر مرجع المستند المصدر، ويُربط قيد
الرسملة في `capitalization_journal_entry_id`، ودورة الحياة: مسودة ← نشط ← مُهلَك بالكامل أو مستبعد
أو مشطوب.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `asset_number` | `TEXT NOT NULL` | via `document_sequences` (`asset`) |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `category_id` | `UUID NOT NULL` | real FK → `fin_asset_categories` (Restrict) |
| `acquisition_date` | `TIMESTAMP(3) NOT NULL` | |
| `in_service_date` | `TIMESTAMP(3)` (nullable) | depreciation start |
| `acquisition_cost` | `DECIMAL(19,4) NOT NULL` | |
| `salvage_value` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `useful_life_months` | `INTEGER NOT NULL` | |
| `depreciation_method_code` | `TEXT NOT NULL` | → `fin_depreciation_methods.code` |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_asset` |
| `branch_id` / `warehouse_id` / `cost_center_id` | `UUID` (nullable) | scalar location dims |
| `custodian_profile_id` | `UUID` (nullable) | scalar → `profiles` |
| `serial_number` | `TEXT` (nullable) | |
| `source_doc_type` / `source_doc_id` | `TEXT` / `UUID` (nullable) | e.g. capitalized supplier invoice |
| `accumulated_depreciation` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | running total |
| `capitalization_journal_entry_id` | `UUID` (nullable) | scalar — capitalization JE |
| `disposed_at` | `TIMESTAMP(3)` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_assets_tenant_number_unique (tenant_id, asset_number)` — Indexes:
`fin_assets_tenant_category_idx (tenant_id, category_id)`,
`fin_assets_tenant_status_idx (tenant_id, status_code)`.

### `fin_asset_depreciation_schedules`

**Purpose** — The planned depreciation plan: one row per asset per fiscal period with
`planned_amount`, updated to `posted_amount` + `posted_run_id` when a depreciation run posts it.
Unique per (asset, period); regenerated when asset parameters change before posting.

**الشرح** — خطة الإهلاك المستقبلية: صف لكل أصل في كل فترة مالية بالمبلغ المخطط، وعند ترحيل تشغيلة
الإهلاك يُسجَّل المبلغ المرحَّل فعلاً ومعرّف التشغيلة وتتحول الحالة إلى «مرحَّل». القيد الفريد على
(الأصل، الفترة) يمنع التكرار، ويُعاد توليد الصفوف غير المرحَّلة عند تغيير معطيات الأصل كالعمر أو
القيمة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `asset_id` | `UUID NOT NULL` | real FK → `fin_assets` (Cascade) |
| `fiscal_period_id` | `UUID NOT NULL` | scalar → `fin_fiscal_periods` |
| `planned_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `posted_amount` | `DECIMAL(19,4)` (nullable) | actual posted |
| `status_code` | `TEXT NOT NULL DEFAULT 'planned'` | `planned` / `posted` / `skipped` |
| `posted_run_id` | `UUID` (nullable) | scalar → `fin_depreciation_runs` |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_asset_depreciation_schedules_unique (asset_id, fiscal_period_id)`.

### `fin_depreciation_runs`

**Purpose** — Posts one period's depreciation for all eligible assets in a single batch: one
journal entry (depreciation expense vs accumulated depreciation), `asset_count` and `total_amount`
summary, lifecycle `draft → posted → reversed`. Owns per-asset entries.

**الشرح** — تشغيلة الإهلاك الدوري: ترحّل إهلاك فترة كاملة لجميع الأصول المؤهلة دفعة واحدة بقيد
يومية واحد (مصروف الإهلاك مقابل مجمع الإهلاك)، مع ملخص عدد الأصول والمبلغ الإجمالي في الرأس. دورة
الحياة «مسودة ← مرحَّلة ← معكوسة»، وتملك التشغيلة صفوف التفاصيل لكل أصل في
`fin_asset_depreciation_entries`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_number` | `TEXT NOT NULL` | via `document_sequences` (`depreciation_run`) |
| `fiscal_period_id` | `UUID NOT NULL` | scalar → `fin_fiscal_periods` |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_depreciation_run` |
| `journal_entry_id` | `UUID` (nullable) | scalar — batch JE |
| `asset_count` | `INTEGER NOT NULL DEFAULT 0` | |
| `total_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_depreciation_runs_tenant_number_unique (tenant_id, run_number)`.

### `fin_asset_depreciation_entries`

**Purpose** — Per-asset detail of a depreciation run: amount charged, accumulated depreciation
after, and book value after. Append-only history that reconstructs each asset's depreciation
career.

**الشرح** — تفاصيل تشغيلة الإهلاك على مستوى كل أصل: مبلغ الإهلاك المحمَّل في هذه التشغيلة، ومجمع
الإهلاك بعدها، والقيمة الدفترية المتبقية بعدها. سجل إلحاقي فقط يعيد بناء تاريخ إهلاك أي أصل كاملاً
من أول تشغيلة إلى آخرها لأغراض المراجعة والتقارير.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_id` | `UUID NOT NULL` | real FK → `fin_depreciation_runs` (Cascade) |
| `asset_id` | `UUID NOT NULL` | scalar → `fin_assets` |
| `schedule_id` | `UUID` (nullable) | scalar → `fin_asset_depreciation_schedules` |
| `amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `accumulated_after` / `book_value_after` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_asset_depreciation_entries_run_idx (tenant_id, run_id)`,
`fin_asset_depreciation_entries_asset_idx (tenant_id, asset_id)`.

### `fin_asset_disposals`

**Purpose** — Disposal/sale/scrap of an asset: proceeds, net book value at disposal, computed
gain/loss, and the disposal JE (derecognize cost + accumulated depreciation, book gain/loss).
Posting flips the asset to `disposed`.

**الشرح** — استبعاد الأصل بالبيع أو الكسر أو التبرع: قيمة المتحصلات، والقيمة الدفترية الصافية لحظة
الاستبعاد، والربح أو الخسارة المحسوبة بينهما، مع قيد الاستبعاد الذي يلغي تكلفة الأصل ومجمع إهلاكه
ويثبت الفرق في حساب أرباح/خسائر الاستبعاد. عند الترحيل تتحول حالة الأصل إلى «مستبعد» ويتوقف إدراجه
في تشغيلات الإهلاك اللاحقة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `disposal_number` | `TEXT NOT NULL` | via `document_sequences` (`asset_disposal`) |
| `asset_id` | `UUID NOT NULL` | scalar → `fin_assets` |
| `disposal_date` | `TIMESTAMP(3) NOT NULL` | |
| `disposal_type` | `TEXT NOT NULL` | `sale` / `scrap` / `donation` / … |
| `proceeds_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `net_book_value` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | at disposal |
| `gain_loss_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | signed |
| `journal_entry_id` | `UUID` (nullable) | scalar — disposal JE |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_asset_disposals_tenant_number_unique (tenant_id, disposal_number)` — Indexes:
`fin_asset_disposals_asset_idx (tenant_id, asset_id)`.

### `fin_asset_revaluations`

**Purpose** — Revalues an asset's carrying amount (impairment or upward revaluation): old vs new
value, reason, and the adjustment JE. Draft until posted; feeds revised depreciation schedules.

**الشرح** — إعادة تقييم القيمة الدفترية للأصل هبوطاً (اضمحلال) أو صعوداً: القيمة القديمة مقابل
الجديدة مع سبب موثَّق وقيد التسوية المرتبط. تبقى مسودة حتى الترحيل، وبعده يُعاد توليد جداول
الإهلاك المستقبلية على أساس القيمة الجديدة والعمر المتبقي.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `asset_id` | `UUID NOT NULL` | scalar → `fin_assets` |
| `revaluation_date` | `TIMESTAMP(3) NOT NULL` | |
| `old_value` / `new_value` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `journal_entry_id` | `UUID` (nullable) | scalar — adjustment JE |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | |
| `reason` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Indexes: `fin_asset_revaluations_asset_idx (tenant_id, asset_id)`.

### `fin_asset_transfers`

**Purpose** — Moves an asset between branches, cost centers, and/or custodians, recording
from/to on each axis and an optional JE when the transfer has accounting impact (e.g. cost-center
depreciation reallocation). Append-only movement log.

**الشرح** — نقل الأصل بين الفروع أو مراكز التكلفة أو أمناء العهدة، مع تسجيل «من» و«إلى» على كل
محور من المحاور الثلاثة وقيد يومية اختياري حين يكون للنقل أثر محاسبي (كإعادة توجيه مصروف الإهلاك
لمركز تكلفة آخر). الجدول سجل حركة إلحاقي فقط يوثّق مسار الأصل مكانياً وإدارياً طوال عمره.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `asset_id` | `UUID NOT NULL` | scalar → `fin_assets` |
| `transfer_date` | `TIMESTAMP(3) NOT NULL` | |
| `from_branch_id` / `to_branch_id` | `UUID` (nullable) | scalar |
| `from_cost_center_id` / `to_cost_center_id` | `UUID` (nullable) | scalar |
| `from_custodian_profile_id` / `to_custodian_profile_id` | `UUID` (nullable) | scalar |
| `journal_entry_id` | `UUID` (nullable) | scalar — optional JE |
| `notes` | `TEXT` (nullable) | |
| `created_by` | `UUID` (nullable) | actor |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_asset_transfers_asset_idx (tenant_id, asset_id)`.

---
## Domain 13 — Closing, Opening Balances, Allocations

### `fin_close_task_templates`

**Purpose** — The reusable period-close checklist definition (seeded: AP/AR/bank reconciled,
inventory valuated, depreciation posted, FX revalued, accruals posted, tax finalized). Each task
has a module, a sequence, and a required flag; period close runs copy these into concrete tasks.

**الشرح** — قوالب قائمة مهام إقفال الفترة القابلة لإعادة الاستخدام، وتُزرَع مهام قياسية: مطابقة
ذمم الموردين والعملاء والبنوك، وترحيل تقييم المخزون، وترحيل الإهلاك، وإعادة تقييم العملات، وترحيل
الاستحقاقات، واعتماد حركات الضرائب. لكل مهمة وحدة مسؤولة وترتيب تنفيذ وعلامة إلزامية، وتُنسخ هذه
القوالب مهامَّ فعلية عند بدء كل تشغيلة إقفال فترة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | e.g. `bank_reconciled` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `module_code` | `TEXT` (nullable) | `ap` / `ar` / `bank` / `inventory` / `asset` / `gl` / `tax` |
| `sequence` | `INTEGER NOT NULL DEFAULT 0` | checklist order |
| `is_required` | `BOOLEAN NOT NULL DEFAULT true` | must complete before close |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_close_task_templates_tenant_code_unique (tenant_id, code)`.

### `fin_period_close_runs`

**Purpose** — A guided close of one fiscal period: instantiates the checklist, tracks progress
(`in_progress → completed`), and records who closed. Completing all required tasks is the
precondition for flipping the period's status to closed.

**الشرح** — تشغيلة إقفال موجَّهة لفترة مالية واحدة: تُنسخ فيها قائمة المهام من القوالب، ويُتابع
التقدم من «قيد التنفيذ» إلى «مكتملة» مع توثيق من أقفل ومتى. إتمام جميع المهام الإلزامية شرط مسبق
لتحويل حالة الفترة نفسها إلى «مقفلة»، وتملك التشغيلة مهامها في `fin_period_close_run_tasks`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `fiscal_period_id` | `UUID NOT NULL` | scalar → `fin_fiscal_periods` |
| `status_code` | `TEXT NOT NULL DEFAULT 'in_progress'` | |
| `started_at` | `TIMESTAMP(3) NOT NULL DEFAULT now()` | |
| `completed_at` | `TIMESTAMP(3)` (nullable) | |
| `closed_by_profile_id` | `UUID` (nullable) | scalar actor |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_period_close_runs_period_idx (tenant_id, fiscal_period_id)`.

### `fin_period_close_run_tasks`

**Purpose** — The concrete checklist items of a close run, copied from templates (or added ad
hoc — `template_id` nullable, code/name denormalized). Each task tracks pending/completed state
with completion audit.

**الشرح** — بنود قائمة الإقفال الفعلية داخل التشغيلة، المنسوخة من القوالب أو المضافة يدوياً لهذه
التشغيلة فقط (لذلك مرجع القالب اختياري والرمز والاسم منسوخان). تتابع كل مهمة حالتها من «معلَّقة»
إلى «مكتملة» مع توثيق من أتمّها ومتى وملاحظاته، ولا تكتمل التشغيلة إلا بإتمام الإلزامي منها.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `close_run_id` | `UUID NOT NULL` | real FK → `fin_period_close_runs` (Cascade) |
| `template_id` | `UUID` (nullable) | scalar → `fin_close_task_templates` |
| `code` / `name` | `TEXT` (nullable) | denormalized from template or ad hoc |
| `status_code` | `TEXT NOT NULL DEFAULT 'pending'` | `pending` / `completed` / `skipped` |
| `completed_at` / `completed_by_profile_id` | `TIMESTAMP(3)` / `UUID` (nullable) | completion audit |
| `notes` | `TEXT` (nullable) | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_period_close_run_tasks_run_idx (tenant_id, close_run_id)`.

### `fin_year_close_runs`

**Purpose** — Year-end close: posts one closing JE sweeping all P&L balances (`total_pl_swept`)
into retained earnings and one opening JE for the next year. One run per fiscal year (unique). No
physical balance rollover — reports compute current-year earnings dynamically until close.

**الشرح** — إقفال السنة المالية: يُرحَّل قيد إقفال واحد يكنس أرصدة حسابات الإيرادات والمصروفات
كلها (بإجمالي `total_pl_swept`) إلى حساب الأرباح المحتجزة، وقيد افتتاحي واحد للسنة الجديدة بأرصدة
المركز المالي. تشغيلة واحدة فقط لكل سنة بموجب القيد الفريد، ولا يوجد ترحيل مادي دوري للأرصدة —
تحتسب التقارير أرباح السنة الجارية ديناميكياً حتى لحظة الإقفال.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `fiscal_year_id` | `UUID NOT NULL` | scalar → `fin_fiscal_years` |
| `retained_earnings_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `closing_journal_entry_id` | `UUID` (nullable) | scalar — P&L sweep JE |
| `opening_journal_entry_id` | `UUID` (nullable) | scalar — next-year opening JE |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | |
| `total_pl_swept` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | |
| `executed_at` / `executed_by_profile_id` | `TIMESTAMP(3)` / `UUID` (nullable) | execution audit |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_year_close_runs_tenant_year_unique (tenant_id, fiscal_year_id)`.

### `fin_opening_balance_batches`

**Purpose** — Staged migration of opening balances when a tenant goes live: a batch of lines
validated (`draft → validated → posted`) before posting one opening JE. Header totals must balance
before validation passes.

**الشرح** — ترحيل الأرصدة الافتتاحية عند بدء استخدام النظام: دفعة سطور تُدخل وتُدقَّق على مراحل
«مسودة ← مُتحقَّق منها ← مرحَّلة» قبل إنشاء قيد افتتاحي واحد بها. يجب أن يتساوى إجمالي المدين مع
إجمالي الدائن في الرأس قبل اجتياز التحقق، وتشمل السطور البنود المفتوحة للعملاء والموردين حتى تُبنى
دفاتر الأستاذ المساعدة من اليوم الأول.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `batch_number` | `TEXT NOT NULL` | via `document_sequences` (`opening_balance`) |
| `as_of_date` | `TIMESTAMP(3) NOT NULL` | cut-over date |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_opening_balance_batch` |
| `journal_entry_id` | `UUID` (nullable) | scalar — opening JE |
| `total_debit` / `total_credit` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | must balance |
| `notes` | `TEXT` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_opening_balance_batches_tenant_number_unique (tenant_id, batch_number)`.

### `fin_opening_balance_lines`

**Purpose** — Batch lines: account, optional open-item party (to seed AR/AP subledgers with open
invoices — `source_doc_ref` + `due_date` carry the legacy reference), and amounts in txn + base
currency. Posted lines also spawn customer/vendor ledger entries.

**الشرح** — سطور دفعة الأرصدة الافتتاحية: الحساب، وطرف اختياري للبنود المفتوحة (لزرع دفاتر العملاء
والموردين بالفواتير المفتوحة، مع مرجع المستند القديم وتاريخ استحقاقه)، والمبالغ بعملة العملية
وبالعملة الأساسية مع سعر الصرف. عند ترحيل الدفعة تولّد السطور ذات الأطراف بنوداً مقابلة في دفتري
أستاذ العملاء والموردين إلى جانب قيد الافتتاح.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `batch_id` | `UUID NOT NULL` | real FK → `fin_opening_balance_batches` (Cascade) |
| `account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `party_type` / `party_id` | `TEXT` / `UUID` (nullable) | open-item party |
| `source_doc_ref` | `TEXT` (nullable) | legacy document reference |
| `currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `exchange_rate` | `DECIMAL(19,8) NOT NULL DEFAULT 1` | |
| `debit_amount` / `credit_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | txn currency |
| `base_debit_amount` / `base_credit_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | base currency |
| `due_date` | `TIMESTAMP(3)` (nullable) | open-item due date |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_opening_balance_lines_batch_idx (tenant_id, batch_id)`.

### `fin_allocation_rules`

**Purpose** — Periodic cost-allocation definitions: sweep a source account's balance to target
accounts/cost centers by `allocation_basis` (fixed percent today; headcount/square-meter bases
later). Owns percentage targets; runs execute the rule per period.

**الشرح** — قواعد التحميل الدوري للتكاليف: تكنس رصيد حساب مصدر (كمصروفات الإدارة العامة) وتوزعه
على حسابات أو مراكز تكلفة مستهدفة وفق أساس التوزيع `allocation_basis` — نسب ثابتة حالياً مع قابلية
التوسع لأسس أخرى كعدد الموظفين أو المساحة. تملك القاعدة أهدافها بنسبها في جدول ابن، وتُنفَّذ عبر
تشغيلات التحميل في نهاية كل فترة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `code` | `TEXT NOT NULL` | |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `source_account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `allocation_basis` | `TEXT NOT NULL DEFAULT 'fixed_percent'` | |
| `journal_type_id` | `UUID` (nullable) | scalar → `fin_journal_types` |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_allocation_rules_tenant_code_unique (tenant_id, code)`.

### `fin_allocation_rule_targets`

**Purpose** — The distribution targets of a rule: target account plus optional cost
center/project, each with a `percentage` (CHECK 0–100; the service validates the set sums to
100).

**الشرح** — أهداف التوزيع داخل قاعدة التحميل: حساب مستهدف مع مركز تكلفة أو مشروع اختياريين، ولكل
هدف نسبته المئوية التي يضمن قيد فحص وقوعها بين الصفر والمئة، بينما تتحقق طبقة الخدمات من أن مجموع
نسب أهداف القاعدة يساوي مئة بالمئة قبل التفعيل.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `rule_id` | `UUID NOT NULL` | real FK → `fin_allocation_rules` (Cascade) |
| `target_account_id` | `UUID NOT NULL` | scalar → `fin_accounts` |
| `cost_center_id` / `project_id` | `UUID` (nullable) | scalar dims |
| `percentage` | `DECIMAL(9,6) NOT NULL` | CHECK `> 0 AND <= 100` |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_allocation_rule_targets_rule_idx (tenant_id, rule_id)`. CHECK:
`fin_allocation_rule_targets_pct_check`.

### `fin_allocation_runs`

**Purpose** — One execution of an allocation rule for a period: captures the swept
`source_amount`, produces the allocation JE, lifecycle `draft → posted` (or cancelled).

**الشرح** — تنفيذ واحد لقاعدة تحميل في فترة محددة: يلتقط رصيد الحساب المصدر المكنوس
`source_amount`، ويولّد قيد التحميل الموزَّع على الأهداف بنسبها، ودورة الحياة «مسودة ← مرحَّلة» أو
تُلغى قبل الترحيل. يوثَّق وقت التنفيذ ورقم التشغيلة المتسلسل لكل فترة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `run_number` | `TEXT NOT NULL` | via `document_sequences` (`allocation_run`) |
| `rule_id` | `UUID` (nullable) | scalar → `fin_allocation_rules` |
| `fiscal_period_id` | `UUID` (nullable) | scalar → `fin_fiscal_periods` |
| `source_amount` | `DECIMAL(19,4) NOT NULL DEFAULT 0` | swept balance |
| `status_code` | `TEXT NOT NULL DEFAULT 'draft'` | registry `fin_allocation_run` |
| `journal_entry_id` | `UUID` (nullable) | scalar — allocation JE |
| `executed_at` | `TIMESTAMP(3)` (nullable) | |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` / `deleted_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete (drafts) |

Unique: `fin_allocation_runs_tenant_number_unique (tenant_id, run_number)`.

---

## Domain 14 — Settings, Posting Engine, Queue, Lookups

### `fin_settings`

**Purpose** — The tenant finance singleton (unique per tenant): base currency, every named default
account the posting engine can fall back to (retained earnings, FX gain/loss ×4, rounding,
suspense, AR/AP control, GRNI, inventory, COGS, sales revenue/discount, bank clearing, write-off),
the `strict_account_resolution` switch (throw vs post-to-suspense), per-source `posting_modes`
JSON (sync/async), and initialization state.

**الشرح** — صف إعدادات الوحدة المالية الوحيد لكل مستأجر: العملة الأساسية، وكل الحسابات الافتراضية
المسماة التي يرجع إليها محرك الترحيل عند غياب ربط أدق (الأرباح المحتجزة، أرباح وخسائر فروق العملة
المحققة وغير المحققة، التقريب، الحساب المعلق، مراقبة العملاء والموردين، البضاعة المستلمة غير
المفوترة، المخزون، تكلفة المبيعات، إيراد المبيعات وخصمه، المقاصة البنكية، الإعدام)، ومفتاح الدقة
الصارمة في حل الحسابات `strict_account_resolution` الذي يحدد الرفض أو الترحيل للحساب المعلق، وأنماط
الترحيل لكل نوع مستند مصدر بصيغة JSON، وحالة تهيئة الوحدة وتاريخ بدء المحاسبة.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts`; unique (singleton) |
| `base_currency_code` | `TEXT NOT NULL DEFAULT 'USD'` | |
| `retained_earnings_account_id` | `UUID` (nullable) | scalar → `fin_accounts` |
| `fx_realized_gain_account_id` / `fx_realized_loss_account_id` | `UUID` (nullable) | scalar |
| `fx_unrealized_gain_account_id` / `fx_unrealized_loss_account_id` | `UUID` (nullable) | scalar |
| `rounding_account_id` | `UUID` (nullable) | scalar — FX rounding residue |
| `suspense_account_id` | `UUID` (nullable) | scalar — unresolved postings |
| `default_ar_control_account_id` / `default_ap_control_account_id` | `UUID` (nullable) | scalar |
| `grni_account_id` | `UUID` (nullable) | scalar |
| `inventory_account_id` / `cogs_account_id` | `UUID` (nullable) | scalar |
| `sales_revenue_account_id` / `sales_discount_account_id` | `UUID` (nullable) | scalar |
| `bank_clearing_account_id` | `UUID` (nullable) | scalar |
| `write_off_account_id` | `UUID` (nullable) | scalar |
| `strict_account_resolution` | `BOOLEAN NOT NULL DEFAULT false` | throw vs suspense |
| `posting_modes` | `JSONB` (nullable) | per `source_doc_type`: `sync` / `async` |
| `finance_start_date` | `TIMESTAMP(3)` (nullable) | accounting go-live |
| `is_initialized` | `BOOLEAN NOT NULL DEFAULT false` | set by `initializeTenantFinance()` |
| `version_number` | `INTEGER NOT NULL DEFAULT 1` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_settings_tenant_unique (tenant_id)`.

### `fin_posting_rules`

**Purpose** — Declarative posting recipes per `event_type` (e.g. `supplier_invoice.posted`,
`pos_sale.completed`): journal type, optional JSON `conditions`, and `priority` for overrides.
System rows (nullable tenant) ship defaults for AP invoice/payment, sales invoice, POS sale,
restaurant order, and sales return; tenant rows override without code changes.

**الشرح** — وصفات الترحيل التصريحية لكل نوع حدث (مثل ترحيل فاتورة مورد أو إتمام عملية بيع نقاط
بيع): نوع اليومية المستخدم، وشروط اختيارية بصيغة JSON، وأولوية تسمح لقاعدة المستأجر بأن تتقدم على
القاعدة النظامية. تُزرَع قواعد افتراضية لفواتير الموردين ومدفوعاتهم وفواتير المبيعات ومبيعات نقاط
البيع وطلبات المطاعم ومردودات المبيعات، ويستطيع المستأجر تجاوزها بقواعد خاصة دون أي تعديل برمجي.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default rule |
| `event_type` | `TEXT NOT NULL` | e.g. `supplier_invoice.posted` |
| `source_doc_type` | `TEXT` (nullable) | e.g. `pod_supplier_invoice` |
| `journal_type_code` | `TEXT` (nullable) | → `fin_journal_types.code` |
| `description` | `TEXT` (nullable) | |
| `priority` | `INTEGER NOT NULL DEFAULT 100` | lower wins |
| `conditions` | `JSONB` (nullable) | optional predicate |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_by` / `updated_by` | `UUID` (nullable) | actor ids |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |
| `deleted_at` | `TIMESTAMP(3)` (nullable) | soft delete |

Unique: `fin_posting_rules_scope_unique (tenant_id, event_type, priority)` — Indexes:
`fin_posting_rules_event_idx (tenant_id, event_type, is_active)`.

### `fin_posting_rule_lines`

**Purpose** — The debit/credit recipe lines of a rule: `line_role` (grni, tax_input, ap_control,
settlement, …), `side` (CHECK debit/credit), and `account_source` (CHECK
fixed/mapping/settings_default) resolved via `account_id`, `mapping_entity_type`+`mapping_role`,
or `settings_field` respectively. `amount_selector` picks the source-document amount
(net_total/tax_total/gross_total/…), scaled by `multiplier`.

**الشرح** — سطور وصفة الترحيل داخل القاعدة: دور السطر (بضاعة غير مفوترة، ضريبة مدخلات، مراقبة
موردين، تحصيل…)، والجهة مديناً أو دائناً بقيد فحص، ومصدر الحساب بثلاث طرق يضبطها قيد فحص أيضاً:
حساب ثابت محدد، أو المرور على خريطة الحسابات بنوع كيان ودور، أو حقل مسمّى من إعدادات المستأجر.
يختار `amount_selector` المبلغ المطلوب من المستند المصدر (صافي، ضريبة، إجمالي…) مضروباً في المعامل
`multiplier`، فيتكوّن القيد كاملاً من هذه السطور دون سطر برمجي واحد.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL on system rule lines |
| `rule_id` | `UUID NOT NULL` | real FK → `fin_posting_rules` (Cascade) |
| `line_number` | `INTEGER NOT NULL DEFAULT 0` | |
| `line_role` | `TEXT NOT NULL` | e.g. `grni`, `tax_output`, `settlement` |
| `side` | `TEXT NOT NULL` | CHECK `debit` / `credit` |
| `account_source` | `TEXT NOT NULL DEFAULT 'mapping'` | CHECK `fixed` / `mapping` / `settings_default` |
| `account_id` | `UUID` (nullable) | scalar — when `fixed` |
| `mapping_entity_type` / `mapping_role` | `TEXT` (nullable) | when `mapping` |
| `settings_field` | `TEXT` (nullable) | when `settings_default`, e.g. `grniAccountId` |
| `amount_selector` | `TEXT NOT NULL` | e.g. `net_total`, `tax_total`, `gross_total`, `paid_total` |
| `multiplier` | `INTEGER NOT NULL DEFAULT 1` | sign/scale |
| `description` | `TEXT` (nullable) | |
| `created_at` | `TIMESTAMP(3) NOT NULL` | |

Indexes: `fin_posting_rule_lines_rule_idx (rule_id)`. CHECKs:
`fin_posting_rule_lines_side_check`, `fin_posting_rule_lines_source_check`.

### `fin_posting_queue`

**Purpose** — The async posting work queue fed by the domain-event consumer: one deduplicated item
per (event type, source doc) with payload snapshot, retry state (`attempt_count`, `last_error`,
`next_attempt_at` backoff, ≤5 attempts), and the resulting `journal_entry_id` on success. Failed
rows surface in the exceptions screen and notify accountants; operational flows never block on
this queue.

**الشرح** — طابور الترحيل غير المتزامن الذي يغذّيه مستهلك أحداث النطاق: عنصر واحد غير مكرر لكل زوج
(نوع حدث، مستند مصدر) بموجب القيد الفريد، مع لقطة الحمولة وبيانات إعادة المحاولة (عدد المحاولات،
وآخر خطأ، وتوقيت المحاولة التالية بتراجع تصاعدي وبحد أقصى خمس محاولات)، ومعرّف قيد اليومية الناتج
عند النجاح. تظهر العناصر الفاشلة في شاشة الاستثناءات مع إشعار للمحاسبين، ولا تتوقف العمليات
التشغيلية إطلاقاً بانتظار هذا الطابور.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `domain_event_id` | `UUID` (nullable) | scalar → `domain_events` |
| `event_type` | `TEXT NOT NULL` | |
| `source_doc_type` / `source_doc_id` | `TEXT NOT NULL` / `UUID NOT NULL` | dedupe scope |
| `payload` | `JSONB` (nullable) | event snapshot |
| `status_code` | `TEXT NOT NULL DEFAULT 'pending'` | `pending` / `processing` / `posted` / `failed` / `skipped` |
| `attempt_count` | `INTEGER NOT NULL DEFAULT 0` | max 5 |
| `last_error` | `TEXT` (nullable) | |
| `journal_entry_id` | `UUID` (nullable) | scalar — result |
| `next_attempt_at` | `TIMESTAMP(3)` (nullable) | backoff cursor |
| `processed_at` | `TIMESTAMP(3)` (nullable) | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_posting_queue_source_unique (tenant_id, event_type, source_doc_type, source_doc_id)`
— Indexes: `fin_posting_queue_pending_idx (tenant_id, status_code, next_attempt_at)`.

### `fin_event_cursors`

**Purpose** — Consumer checkpoints over the `domain_events` outbox (mirrors
`crm_projection_cursors`): one row per consumer name storing `last_event_id`, so the finance
consumer resumes exactly where it stopped and never double-enqueues.

**الشرح** — مؤشرات مستهلكي أحداث النطاق على غرار مؤشرات إسقاطات وحدة العملاء: صف واحد لكل اسم
مستهلك يخزّن معرّف آخر حدث تمت معالجته، فيستأنف مستهلك التمويل القراءة من حيث توقف تماماً بعد أي
إعادة تشغيل ولا يُدرج الحدث الواحد في الطابور مرتين.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID NOT NULL` | FK → `tenant_accounts` |
| `consumer_name` | `TEXT NOT NULL` | e.g. `finance_posting` |
| `last_event_id` | `UUID` (nullable) | scalar → `domain_events` |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_event_cursors_consumer_unique (tenant_id, consumer_name)`.

### `fin_payment_terms`

**Purpose** — Payment terms lookup (seeded: immediate, net 7/15/30, 2/10 net 30, end of month):
`due_days`, optional early-settlement `discount_days` + `discount_rate`, and `is_end_of_month`.
Referenced by customer and supplier financial profiles to derive due dates and settlement
discounts.

**الشرح** — دليل شروط السداد، وتُزرَع شروط قياسية: استحقاق فوري، وصافي ٧ و١٥ و٣٠ يوماً، وخصم ٢٪
خلال ١٠ أيام مع صافي ٣٠، ونهاية الشهر. يحدد الشرط أيام الاستحقاق، وأيام خصم السداد المعجّل ونسبته
اختيارياً، وعلامة الاحتساب من نهاية الشهر، وتشير إليه الملفات المالية للعملاء والموردين لاشتقاق
تواريخ الاستحقاق وخصومات السداد آلياً.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` PK | |
| `tenant_id` | `UUID` (nullable) | NULL = system default |
| `code` | `TEXT NOT NULL` | e.g. `net_30`, `2_10_net_30` |
| `name` / `name_ar` | `TEXT NOT NULL` / `TEXT` (nullable) | bilingual label |
| `due_days` | `INTEGER NOT NULL DEFAULT 0` | |
| `discount_days` | `INTEGER` (nullable) | early-settlement window |
| `discount_rate` | `DECIMAL(9,6)` (nullable) | percent |
| `is_end_of_month` | `BOOLEAN NOT NULL DEFAULT false` | |
| `is_active` | `BOOLEAN NOT NULL DEFAULT true` | |
| `created_at` / `updated_at` | `TIMESTAMP(3) NOT NULL` | |

Unique: `fin_payment_terms_tenant_code_unique (tenant_id, code)`.

---
## Cross-cutting DB objects

All defined in sections (5)–(9) of
`prisma/migrations/20260718110000_financial_management_enterprise_v1/migration.sql`.

### Check constraints (section 5)

| Constraint | Table | Rule |
|---|---|---|
| `fin_journal_lines_debit_nonneg_check` | `fin_journal_lines` | `debit_amount >= 0 AND base_debit_amount >= 0` |
| `fin_journal_lines_credit_nonneg_check` | `fin_journal_lines` | `credit_amount >= 0 AND base_credit_amount >= 0` |
| `fin_journal_lines_single_side_check` | `fin_journal_lines` | not both `debit_amount > 0` and `credit_amount > 0` |
| `fin_journal_lines_base_single_side_check` | `fin_journal_lines` | same, in base currency |
| `fin_journal_entries_totals_nonneg_check` | `fin_journal_entries` | header totals `>= 0` |
| `fin_fiscal_years_range_check` | `fin_fiscal_years` | `start_date < end_date` |
| `fin_fiscal_periods_range_check` | `fin_fiscal_periods` | `start_date <= end_date` |
| `fin_ar_receipt_allocations_target_check` | `fin_ar_receipt_allocations` | exactly one of the four target ids is set |
| `fin_funds_transfers_endpoints_check` | `fin_funds_transfers` | at least one `from_*` and one `to_*` endpoint |
| `fin_exchange_rates_positive_check` | `fin_exchange_rates` | `rate > 0` |
| `fin_allocation_rule_targets_pct_check` | `fin_allocation_rule_targets` | `percentage > 0 AND <= 100` |
| `fin_posting_rule_lines_side_check` | `fin_posting_rule_lines` | `side IN ('debit','credit')` |
| `fin_posting_rule_lines_source_check` | `fin_posting_rule_lines` | `account_source IN ('fixed','mapping','settings_default')` |

### Idempotency + BRIN indexes (section 6)

- **`fin_journal_entries_source_unique`** — partial unique index on
  `(tenant_id, source_doc_type, source_doc_id, source_event_type)` `WHERE status_code = 'posted'
  AND reversal_of_entry_id IS NULL AND source_doc_id IS NOT NULL`. Guarantees **one posted,
  non-reversal journal entry per source-document event**. Reversal entries and reversed originals
  are exempt, so a corrected re-post can claim the slot again.
- **`fin_journal_lines_created_brin`** — `BRIN (created_at)` on the append-heavy ledger keeps
  time-range scans cheap at scale (B-tree partitioning deferred, see `performance.md`).

### Functions + deferred constraint triggers (section 7)

- **`fin_check_entry_balanced(p_entry_id UUID)`** — validates a *posted* entry only: line base
  debits must equal line base credits, and header `total_base_debit`/`total_base_credit` must
  match the line sums. Raises an exception otherwise; drafts are ignored so they can be edited
  freely.
- **`fin_journal_lines_balance_trigger()` / `fin_journal_entries_balance_trigger()`** — trigger
  bodies that call the shared check for the affected entry.
- **`fin_journal_lines_balance_ct`** — `CONSTRAINT TRIGGER AFTER INSERT OR UPDATE OR DELETE ON
  fin_journal_lines DEFERRABLE INITIALLY DEFERRED` — the DB backstop for double-entry, evaluated
  at commit so multi-statement posting transactions (header → lines → status flip) never trip
  mid-flight.
- **`fin_journal_entries_balance_ct`** — same, `AFTER INSERT OR UPDATE ON fin_journal_entries`.
- **`fin_rebuild_gl_balances(p_tenant_id UUID, p_fiscal_year_id UUID)`** — repair function:
  deletes and re-aggregates the **period movement** columns of `fin_gl_balances` for one tenant +
  fiscal year from posted journal lines (grouped by account, period, currency). Opening columns
  are rolled forward by the period-close job, not by this function.

### Row Level Security (section 8)

All 86 `fin_*` tables get `ENABLE ROW LEVEL SECURITY` (not FORCE — the migration/pooled owner role
bypasses policies; app-level guard chains stay the primary boundary) plus one policy per table
(`<table>_tenant_isolation`):

- `USING (tenant_id IS NULL OR tenant_id::text = current_setting('app.current_tenant_id', true))`
  — global seed rows stay readable to every tenant.
- `WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true))` — non-owner
  roles can only write rows for the GUC-scoped tenant.

Same posture as the pod_ layer (`20260717090000_purchase_management_enterprise_v1`).

### Seed data (section 9) — all global (`tenant_id IS NULL`)

| Seed set | Rows |
|---|---|
| `fin_account_classes` | 5 classes: asset/liability/equity/revenue/expense with normal balance sides (EN + AR names) |
| `fin_account_types` | 32 types across the classes, incl. control types (`ar_control`, `ap_control`, `grni`, `inventory`, `tax_payable`, `wht_payable`) and platform-specific liabilities (`gift_card_liability`, `loyalty_liability`), each with cash-flow section |
| `fin_journal_types` | 15 journals: general/sales/purchases/cash receipts/cash disbursements/bank/inventory/payroll/opening/closing/adjustment/fx_reval/depreciation/allocation/tax with prefixes (JV, SJV, PJV, CRJ, CDJ, BJV, IJV, PYJ, OB, CLJ, AJV, FXR, DEP, ALC, TXJ) |
| `fin_depreciation_methods` | straight_line, declining_balance, double_declining, units_of_production, none |
| `fin_cash_flow_categories` | 8 categories across operating/investing/financing + FX effect |
| `fin_tax_types` | vat (both), sales_tax (output), withholding (both), excise (both) |
| `fin_payment_terms` | immediate, net_7, net_15, net_30, 2_10_net_30 (2% / 10 days), eom |
| `fin_dunning_levels` | 3 levels: 7d friendly reminder, 30d second notice, 60d final notice (+ sales block) |
| `fin_close_task_templates` | 8 tasks: ap/ar/bank reconciled, inventory valuated, depreciation posted, fx revalued (optional), accruals posted, tax finalized |
| `fin_currencies` | 15 ISO currencies (USD…INR) with symbols and decimal places |
| `pod_document_statuses` | status rows for the 17 `fin_*` entity types (journal entry, fiscal year/period, AR receipt, payment run, cash transaction, funds transfer, bank reconciliation, tax return, asset, budget, depreciation run, FX revaluation run, opening balance batch, allocation run, dunning run, cheque) |
| `pod_status_transitions` | the legal edges for each entity type above (e.g. `fin_journal_entry`: draft→posted, draft→cancelled, posted→reversed; full cheque/PDC lifecycle incl. bounced→replaced) |
| `fin_posting_rules` + `fin_posting_rule_lines` | 6 default rules with recipe lines: `supplier_invoice.posted` (GRNI + input tax vs AP control), `supplier_payment.posted` (AP control vs bank clearing), `sales_invoice.issued` (AR control vs revenue + output tax), `pos_sale.completed` (settlement + discounts vs revenue + output tax), `restaurant_order.completed` (settlement vs revenue + service charge + tips + tax), `sales_return.credited` (revenue reversal vs AR control). Inventory movement rules ship with the Phase 2 adapter |

---

## Business-rule anchors

How the key accounting invariants map to concrete DB objects (belt-and-braces with the service
layer — the app checks first, the DB backstops):

| Rule | App enforcement | DB enforcement |
|---|---|---|
| **Balanced entries** — posted entries must have base debits = base credits = header totals | pure `assertBalanced()` in `journal-balancing.ts` before every post | row CHECKs (`*_nonneg_check`, `*_single_side_check`) + deferred constraint triggers `fin_journal_lines_balance_ct` / `fin_journal_entries_balance_ct` running `fin_check_entry_balanced()` at commit |
| **Posting idempotency** — one posted entry per source-document event | posting engine looks up existing entry by source triple before inserting | partial unique index `fin_journal_entries_source_unique`; queue-level dedupe via `fin_posting_queue_source_unique` |
| **Reversal-only corrections** — posted entries are immutable | journal service refuses updates once `is_posted`; `buildReversalEntry` creates the mirror entry linked via `reversal_of_entry_id` | registry transitions permit only `posted → reversed`; idempotency index exempts reversal chains so a corrected re-post can claim the slot |
| **Period gating** — no posting into closed/locked periods or locked modules | `period-resolution.ts` resolves entry date → open period, checks `fin_period_module_locks` | period `status_code` + `fin_fiscal_periods_range_check`; year/period transitions constrained by `pod_status_transitions` |
| **Base-currency authority** — base amounts balance, FX residue posts to rounding account | `convertToBase` + rounding synthesis in the engine | base-amount CHECKs + balance trigger operate exclusively on `base_*` columns |
| **Account resolution** — rule line → mapping walk → settings default → strict?throw:suspense | `account-resolution.ts` walk order | `fin_posting_rule_lines_source_check` restricts sources to the three legal strategies; `fin_settings.suspense_account_id` holds the fallback |
| **Balance integrity** — `fin_gl_balances` always reflects posted lines | atomic `INSERT … ON CONFLICT DO UPDATE` inside the posting tx | `fin_gl_balances_scope_unique` upsert target + repair function `fin_rebuild_gl_balances()` |
| **Open-item integrity** — AR/AP `remaining_amount` reduced only via applications | ledger services adjust `remaining_amount`/`is_open` with each application row | append-only application tables with `unapplied_at` (no deletes); `fin_ar_receipt_allocations_target_check` forces exactly one target |
| **Tenant isolation** — no cross-tenant reads/writes | `requireAuth → requireTenantAccess → requirePermission` guard chain on every server function | RLS policies `<table>_tenant_isolation` on all 86 tables (GUC `app.current_tenant_id`), global rows readable |

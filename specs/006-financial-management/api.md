# Financial Management — API Design (Spec 006)

All endpoints are TanStack `createServerFn({ method: 'POST' })` handlers living in
`src/features/finance/**`. Every handler follows the established pattern
(mirrors `src/features/purchasing/server-functions.ts`):

```ts
async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({ accessToken: data.accessToken, tenantId: data.tenantId }),
      data.tenantId,
    ),
    permission,
  )
}

const base = z.object({ accessToken: accessTokenSchema, tenantId: tenantIdSchema })
const withId = base.extend({ id: idSchema })
```

Conventions:
- `accessToken` + `tenantId` are validated in every input; mutating payloads are
  nested under `input` (`base.extend({ input: … })`), validated by
  `finance-validation.ts` (Zod, `decimalInput` union pattern — string or number,
  parsed to `Prisma.Decimal` server-side).
- Permission codes use `finance.<action_underscored>` (added to
  `rbac-catalog.ts` + `module-catalog.ts` in Phase 0).
- All `Decimal` values are serialized to strings at the DTO boundary
  (`finance-dto.ts`); never returned as `Prisma.Decimal`.
- Guard errors are `DomainError` subclasses (`UnauthorizedError` 401,
  `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409,
  `ValidationError` 422). The posting engine adds typed `PostingError` variants
  (mapped to 409/422 — see Error mapping below).
- Writes run inside `prisma.$transaction`; posting uses `RepeatableRead` + 30s
  timeout, matching the inventory engine.

> Phase 1 (this pass) ships the four groups below. Later-phase groups are listed
> at the end as contracts only.

## Accounts / COA (`account-server-functions.ts`)

| Server function | Method | Permission | Input (Zod) | Returns |
|---|---|---|---|---|
| `listFinAccountsServerFn` | POST | `finance.account_view` | `base.extend({ classCode?, typeCode?, search?, includeInactive?, parentAccountId? })` | `{ items: FinAccountDto[] }` (tree-ordered via `path`) |
| `getFinAccountServerFn` | POST | `finance.account_view` | `withId` | `FinAccountDetailDto` (incl. type/class, children count, current balance) |
| `createFinAccountServerFn` | POST | `finance.account_manage` | `base.extend({ input: accountCreateSchema })` | `FinAccountDto` |
| `updateFinAccountServerFn` | POST | `finance.account_manage` | `base.extend({ id, input: accountUpdateSchema })` | `FinAccountDto` (path/level maintained on reparent) |
| `deactivateFinAccountServerFn` | POST | `finance.account_manage` | `withId` | `{ id }` — rejects if balance ≠ 0, has active children, or referenced by mappings/settings |
| `listFinAccountClassesServerFn` | POST | `finance.account_view` | `base` | `FinAccountClassDto[]` (system + tenant rows) |
| `listFinAccountTypesServerFn` | POST | `finance.account_view` | `base.extend({ classCode? })` | `FinAccountTypeDto[]` |
| `listFinAccountMappingsServerFn` | POST | `finance.account_view` | `base.extend({ entityType?, mappingRole? })` | `FinAccountMappingDto[]` |
| `upsertFinAccountMappingServerFn` | POST | `finance.posting_manage` | `base.extend({ input: accountMappingSchema })` | `FinAccountMappingDto` |
| `deleteFinAccountMappingServerFn` | POST | `finance.posting_manage` | `withId` | `{ id }` |

`accountCreateSchema`: `{ accountCode, nameEn, nameAr?, accountTypeId, parentAccountId?, isControlAccount?, allowManualJournal?, currencyCode?, description? }`.
`accountMappingSchema`: `{ entityType, entityId? | entityCode?, mappingRole, accountId }` (exactly one of id/code).

## Fiscal (`fiscal-server-functions.ts`)

| Server function | Method | Permission | Input (Zod) | Returns |
|---|---|---|---|---|
| `createFinFiscalYearServerFn` | POST | `finance.fiscal_manage` | `base.extend({ input: { yearCode, startDate, endDate, periodCount? } })` | `FinFiscalYearDto` — periods 1–12 + adjustment period 13 generated (`generatePeriods`, pure) |
| `listFinFiscalYearsServerFn` | POST | `finance.account_view` | `base` | `FinFiscalYearDto[]` |
| `listFinFiscalPeriodsServerFn` | POST | `finance.account_view` | `base.extend({ fiscalYearId })` | `FinFiscalPeriodDto[]` (statusCode per period) |
| `openFinPeriodServerFn` | POST | `finance.fiscal_manage` | `withId` | `FinFiscalPeriodDto` — `future→open` (or `closed→open` reopen, audit-logged) |
| `closeFinPeriodServerFn` | POST | `finance.fiscal_manage` | `withId` | `FinFiscalPeriodDto` — `open→closed`; rejects while posting queue holds rows dated inside the period |
| `lockFinPeriodServerFn` | POST | `finance.fiscal_manage` | `withId` | `FinFiscalPeriodDto` — `closed→locked` (no reopen) |
| `setFinModuleLockServerFn` | POST | `finance.fiscal_manage` | `base.extend({ periodId, module, isLocked })` | `FinPeriodModuleLockDto` — soft close per module (`inventory`, `purchasing`, `sales`, `pos`, `restaurant`, `finance`) |

## Journals (`journal-server-functions.ts`)

| Server function | Method | Permission | Input (Zod) | Returns |
|---|---|---|---|---|
| `createFinJournalEntryServerFn` | POST | `finance.journal_create` | `base.extend({ input: journalEntryCreateSchema })` | `FinJournalEntryDto` (draft; unbalanced allowed while draft) |
| `updateFinJournalEntryServerFn` | POST | `finance.journal_create` | `base.extend({ id, input: journalEntryUpdateSchema, versionNumber })` | `FinJournalEntryDto` — drafts only; optimistic-lock on `versionNumber` |
| `postFinJournalEntryServerFn` | POST | `finance.journal_post` | `withId` | `FinJournalEntryDto` (posted) — sync engine path; see PostingError variants |
| `reverseFinJournalEntryServerFn` | POST | `finance.journal_reverse` | `base.extend({ id, reversalDate?, reason })` | `{ original: FinJournalEntryDto, reversal: FinJournalEntryDto }` |
| `listFinJournalEntriesServerFn` | POST | `finance.journal_view` | `base.extend({ statusCode?, journalTypeId?, sourceDocType?, dateFrom?, dateTo?, accountId?, page?, pageSize? })` | `{ items: FinJournalEntryDto[], total }` |
| `getFinJournalEntryServerFn` | POST | `finance.journal_view` | `withId` | `FinJournalEntryDetailDto` (lines with account/dimension detail, reversal links, source doc ref) |
| `getFinTrialBalanceServerFn` | POST | `finance.journal_view` | `base.extend({ fiscalPeriodId | asOfDate, currencyCode?, includeZero? })` | `{ rows: TrialBalanceRowDto[], totals }` — read from `fin_gl_balances`, O(accounts) |

`journalEntryCreateSchema`: `{ journalTypeId?, entryDate, currencyCode?, exchangeRate?, referenceNumber?, memo?, lines: [{ accountId, debitAmount, creditAmount, description?, partyType?, partyId?, costCenterId?, projectId?, branchId?, warehouseId?, taxCodeId? }] }` — per-line CHECK mirrored in Zod: amounts ≥ 0, not both > 0.

## Settings / engine (`settings-server-functions.ts`)

| Server function | Method | Permission | Input (Zod) | Returns |
|---|---|---|---|---|
| `getFinSettingsServerFn` | POST | `finance.account_view` | `base` | `FinSettingsDto` (base currency, all default accounts, `strictAccountResolution`, `postingModes`) |
| `updateFinSettingsServerFn` | POST | `finance.settings_manage` | `base.extend({ input: settingsUpdateSchema })` | `FinSettingsDto` — validates each default account exists + is a leaf |
| `initializeTenantFinanceServerFn` | POST | `finance.settings_manage` | `base.extend({ input: { baseCurrencyCode, fiscalYearStart, coaTemplate? } })` | `{ settings, accountCount, fiscalYearId }` — bootstrap: settings + default COA (`coa-template.ts`, EN+AR) + fiscal year/periods + journal types; idempotent (409 if already initialized) |
| `listFinPostingRulesServerFn` | POST | `finance.posting_manage` | `base.extend({ sourceDocType? })` | `FinPostingRuleDto[]` (system defaults + tenant overrides, with lines) |
| `upsertFinPostingRuleServerFn` | POST | `finance.posting_manage` | `base.extend({ input: postingRuleSchema })` | `FinPostingRuleDto` — tenant-scoped override; system rows (null tenant) are read-only |
| `listFinCurrenciesServerFn` | POST | `finance.account_view` | `base` | `FinCurrencyDto[]` (ISO-seeded system + tenant) |
| `upsertFinExchangeRateServerFn` | POST | `finance.settings_manage` | `base.extend({ input: { currencyCode, rateType, effectiveDate, rate } })` | `FinExchangeRateDto` (effective-dated; `rateType` ∈ spot/average/closing/budget) |

## Error mapping

| Situation | Error | HTTP |
|---|---|---|
| Missing/invalid token | `UnauthorizedError` | 401 |
| Wrong tenant / missing permission | `ForbiddenError` | 403 |
| Record not found | `NotFoundError` | 404 |
| Illegal transition, already posted/reversed, version conflict, already initialized | `ConflictError` | 409 |
| Input fails Zod / invariant | `ValidationError` | 422 |
| Supabase unavailable | `ServiceUnavailableError` | 503 |

**`PostingError` variants** (typed `code` on a 409/422 body; also stored on
failed `fin_posting_queue` rows):

| Code | Meaning | Thrown by |
|---|---|---|
| `UNBALANCED` | Σ base debits ≠ Σ base credits beyond rounding tolerance | `assertBalanced` (and the deferred DB trigger as backstop) |
| `PERIOD_CLOSED` | entry date resolves to a non-open period, or module lock active | `period-resolution.ts` |
| `ACCOUNT_UNRESOLVED` | resolution walk exhausted with `strictAccountResolution = true` | `account-resolution.ts` |
| `DUPLICATE_SOURCE` | idempotency index hit for (sourceDocType, sourceDocId, eventType) | posting engine insert |
| `CONTROL_ACCOUNT_MANUAL` | manual JE line targets a control account (`isControlAccount` and `allowManualJournal = false`) | journal-service validation |

## Later phases (contracts only)

| Group | Phase | Scope (one line) |
|---|---|---|
| `queue-server-functions` | 2 (planned) | posting-queue exceptions list, retry, skip; cursor status |
| `ap-server-functions` | 3 (planned) | vendor ledger/open items, payment runs (propose/submit/execute), vendor statements |
| `ar-server-functions` | 4 (planned) | AR receipts CRUD/post/void, allocations, customer ledger, credit check, statements |
| `cash-server-functions` | 6 (planned) | cashboxes, cash transactions, funds transfers, POS-session cash tie-out |
| `bank-server-functions` | 7 (planned) | bank accounts, statement import, reconciliation, cheque/PDC lifecycle |
| `tax-server-functions` | 8 (planned) | tax codes/rates/mappings, tax transactions read, returns file/pay/amend, WHT certificates |
| `fx-server-functions` | 9 (planned) | FX revaluation run propose/post (auto-reversing) |
| `dimension-budget-server-functions` | 10 (planned) | cost centers, projects, analysis dimensions, budgets + control policies |
| `asset-server-functions` | 11 (planned) | asset register, depreciation runs, disposals, revaluations, transfers |
| `closing-server-functions` | 12 (planned) | close checklists, allocations, opening balances, year close |
| `report-server-functions` | 13 (planned) | trial balance (shipped Phase 1), P&L, balance sheet, cash flow, aging, GL detail |

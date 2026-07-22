# HR / HCM — API Design (Spec 007)

All endpoints are TanStack `createServerFn({ method: 'POST' })` handlers living in
`src/features/hr/**`. There is **no REST or GraphQL layer** in this repo — every
call is a POST server function invoked from a client hook (`use-*.ts`) with a
Supabase access token. GraphQL is a **documented future enhancement** (a read-only
`/graphql` gateway over the same services), not implemented; do not assume it
exists.

Every handler follows the established pattern (see the already-shipped
`src/features/hr/server-functions.ts`, which mirrors
`src/features/purchasing/server-functions.ts` and `src/features/finance/**`):

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
- `accessToken` (`z.string().min(1)`) + `tenantId` (`z.string().uuid()`) are
  validated on **every** input. Mutating payloads are nested under `input`
  (`base.extend({ input: … })`); single-record reads/deletes use
  `withId` (`base.extend({ id: idSchema })`); list reads take an optional
  `filters` object. Update handlers use `withId.extend({ input: <schema>.partial() })`.
- Schemas live in `src/features/hr/validation.ts` (Zod). Money fields use the
  `decimalInput` union (`z.number()` **or** numeric-string regex), parsed to
  `Prisma.Decimal` server-side; date fields use `z.coerce.date()`.
- Permission codes use the `hr.<action>` convention, defined in
  `features/auth/rbac-catalog.ts` and surfaced through `module-catalog.ts`.
- All `Decimal` (and `Date`) values are serialized at the DTO boundary via
  `serializeRecord` / `serializeRecords` (`src/server/hr/hr-dto.ts`) — Decimal → string;
  the client never receives a raw `Prisma.Decimal`.
- Every write records an audit-log row in the same call (`createAuditLog`,
  `actionKey = 'hr.<action>'`); employee mutations additionally append
  `HrEmployeeHistory` rows **inside the same `prisma.$transaction`** (BR-EMP-1:
  history is append-only, never overwritten).
- Deletes are **soft** (`deletedAt` / `isActive = false`) and return
  `{ id, deleted: true }`.

> **Status legend.** ✅ = implemented in `server-functions.ts` today.
> 🔷 = planned contract for a deferred domain (same pattern, service +
> validation not yet written). Sections 1–2 are shipped; sections 3+ are contracts.

---

## 1. Organization masters (`server-functions.ts` → `organization-service.ts`) ✅

Guard: `hr.org_view` (reads) / `hr.org_manage` (writes). All list reads return a
serialized array; creates/updates return the serialized record; deletes return
`{ id, deleted: true }`.

| Server function | Permission | Input (Zod) | Returns |
|---|---|---|---|
| `listCompaniesServerFn` | `hr.org_view` | `base` | `HrCompanyDto[]` |
| `createCompanyServerFn` | `hr.org_manage` | `base.extend({ input: companyWriteSchema })` | `HrCompanyDto` |
| `updateCompanyServerFn` | `hr.org_manage` | `withId.extend({ input: companyWriteSchema.partial() })` | `HrCompanyDto` (rejects self-ancestor cycle → 422) |
| `deleteCompanyServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |
| `listBranchesServerFn` | `hr.org_view` | `base` | `HrBranchDto[]` |
| `createBranchServerFn` | `hr.org_manage` | `base.extend({ input: branchWriteSchema })` | `HrBranchDto` |
| `updateBranchServerFn` | `hr.org_manage` | `withId.extend({ input: branchWriteSchema.partial() })` | `HrBranchDto` |
| `deleteBranchServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |
| `listDepartmentsServerFn` | `hr.org_view` | `base` | `HrDepartmentDto[]` (flat, with `depthLevel` / `pathText`) |
| `departmentTreeServerFn` | `hr.org_view` | `base` | `HrDepartmentNode[]` (nested forest via `buildForest`) |
| `createDepartmentServerFn` | `hr.org_manage` | `base.extend({ input: departmentWriteSchema })` | `HrDepartmentDto` (derives `depthLevel`/`pathText`) |
| `updateDepartmentServerFn` | `hr.org_manage` | `withId.extend({ input: departmentWriteSchema.partial() })` | `HrDepartmentDto` (rejects cycle / missing parent → 422) |
| `deleteDepartmentServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |
| `listPositionsServerFn` | `hr.org_view` | `base` | `HrPositionDto[]` |
| `createPositionServerFn` | `hr.org_manage` | `base.extend({ input: positionWriteSchema })` | `HrPositionDto` |
| `updatePositionServerFn` | `hr.org_manage` | `withId.extend({ input: positionWriteSchema.partial() })` | `HrPositionDto` |
| `deletePositionServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |
| `listJobGradesServerFn` | `hr.org_view` | `base` | `HrJobGradeDto[]` (Decimal salary bands → string) |
| `createJobGradeServerFn` | `hr.org_manage` | `base.extend({ input: jobGradeWriteSchema })` | `HrJobGradeDto` |
| `updateJobGradeServerFn` | `hr.org_manage` | `withId.extend({ input: jobGradeWriteSchema.partial() })` | `HrJobGradeDto` |
| `deleteJobGradeServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |
| `listCostCentersServerFn` | `hr.org_view` | `base` | `HrCostCenterDto[]` (incl. `finCostCenterId`) |
| `createCostCenterServerFn` | `hr.org_manage` | `base.extend({ input: costCenterWriteSchema })` | `HrCostCenterDto` |
| `updateCostCenterServerFn` | `hr.org_manage` | `withId.extend({ input: costCenterWriteSchema.partial() })` | `HrCostCenterDto` (rejects self-ancestor cycle → 422) |
| `deleteCostCenterServerFn` | `hr.org_manage` | `withId` | `{ id, deleted: true }` |

**Input schema field sets** (from `validation.ts`):

- `companyWriteSchema`: `{ code, name, nameAr?, legalName?, registrationNo?, taxId?, currencyCode?, baseCountry?, email?, phone?, addressLine?, parentCompanyId?, isLegalEntity?, isActive? }`
- `branchWriteSchema`: `{ companyId, code, name, nameAr?, branchType?, costCenterId?, warehouseId?, managerId?, timezone?, email?, phone?, addressLine?, city?, country?, isActive? }`
- `departmentWriteSchema`: `{ companyId, branchId?, divisionId?, parentDepartmentId?, code, name, nameAr?, managerId?, costCenterId?, headcountBudget?, isActive? }`
- `positionWriteSchema`: `{ code, title, titleAr?, departmentId?, jobGradeId?, reportsToId?, employmentType?, headcountLimit?, jobDescription?, isManagerial?, isActive? }`
- `jobGradeWriteSchema`: `{ code, name, nameAr?, gradeLevel?, minSalary?, midSalary?, maxSalary?, currencyCode?, annualLeaveDays?, isActive? }` (salaries = `decimalInput`)
- `costCenterWriteSchema`: `{ code, name, nameAr?, companyId?, departmentId?, parentId?, finCostCenterId?, isActive? }`

## 2. Employee master (`server-functions.ts` → `employee-service.ts`) ✅

Guard: `hr.employee_view` (reads) / `hr.employee_manage` (writes).

| Server function | Permission | Input (Zod) | Returns |
|---|---|---|---|
| `listEmployeesServerFn` | `hr.employee_view` | `base.extend({ filters: employeeFiltersSchema.optional() })` | `{ items: HrEmployeeDto[], total }` |
| `getEmployeeServerFn` | `hr.employee_view` | `withId` | `HrEmployeeDetailDto` — root + `contacts, addresses, documents, bankAccounts, contracts, history, dependents, education, experience, certifications, languages` (each serialized) |
| `createEmployeeServerFn` | `hr.employee_manage` | `base.extend({ input: employeeCreateSchema })` | `HrEmployeeDto` — tx also appends a `hired` history row |
| `updateEmployeeServerFn` | `hr.employee_manage` | `withId.extend({ input: employeeUpdateSchema })` | `HrEmployeeDto` — tx appends one history row per changed tracked field (`computeHistoryEntries`) |
| `deleteEmployeeServerFn` | `hr.employee_manage` | `withId.extend({ reason?: string(≤400) })` | `{ id, deleted: true }` — soft delete + `terminated` history row |
| `employeeHistoryServerFn` | `hr.employee_view` | `withId` | `HrEmployeeHistoryDto[]` (append-only timeline) |

- `employeeCreateSchema`: identity (`employeeCode`, `profileId?`, EN/AR names,
  `gender?`, `dateOfBirth?`, `maritalStatus?`, `nationality?`, `religion?`,
  `bloodGroup?`), contact (`personalEmail?`, `workEmail?`, phones), IDs
  (`nationalId?`, `passportNo?`), org assignment (`companyId?`, `branchId?`,
  `departmentId?`, `sectionId?`, `positionId?`, `jobGradeId?`, `costCenterId?`,
  `managerId?`), employment (`employmentType` ∈ full_time/part_time/contract/temporary/intern,
  `employmentStatus` ∈ active/probation/on_leave/suspended/terminated, hire /
  probation-end / confirmation / termination dates, `terminationReason?`,
  `workLocation?`, `isActive?`).
- `employeeUpdateSchema` = `employeeCreateSchema.partial()`.
- `employeeFiltersSchema`: `{ search?, departmentId?, employmentStatus?, managerId?, take?(1–500), skip?(≥0) }`.

---

## 3. Recruitment / ATS (`recruitment-server-functions.ts`) 🔷

Guard: `hr.recruitment_view` / `hr.recruitment_manage`.

| Server function | Permission | Input (Zod) | Returns |
|---|---|---|---|
| `listJobRequisitionsServerFn` | `hr.recruitment_view` | `base.extend({ filters: { status?, departmentId?, positionId? } })` | `{ items: HrJobRequisitionDto[], total }` |
| `createJobRequisitionServerFn` | `hr.recruitment_manage` | `base.extend({ input: requisitionWriteSchema })` | `HrJobRequisitionDto` (headcount, grade band, budget) |
| `submitJobRequisitionServerFn` | `hr.recruitment_manage` | `withId` | `HrJobRequisitionDto` — opens approval (§ integration: approval engine, `entityType='hr_job_requisition'`) |
| `postJobOpeningServerFn` | `hr.recruitment_manage` | `base.extend({ input: jobPostingWriteSchema })` | `HrJobPostingDto` (channel, publish window) |
| `listCandidatesServerFn` | `hr.recruitment_view` | `base.extend({ filters })` | `{ items: HrCandidateDto[], total }` |
| `createCandidateServerFn` | `hr.recruitment_manage` | `base.extend({ input: candidateWriteSchema })` | `HrCandidateDto` (CV via attachment service) |
| `listApplicationsServerFn` | `hr.recruitment_view` | `base.extend({ filters: { requisitionId?, stage? } })` | `HrApplicationDto[]` (pipeline board) |
| `moveApplicationStageServerFn` | `hr.recruitment_manage` | `base.extend({ id, stage, note? })` | `HrApplicationDto` (state transition + audit) |
| `scheduleInterviewServerFn` | `hr.recruitment_manage` | `base.extend({ input: interviewWriteSchema })` | `HrInterviewDto` — panel, slot; `notify(...)` panelists |
| `recordInterviewFeedbackServerFn` | `hr.recruitment_manage` | `base.extend({ id, input: scorecardSchema })` | `HrInterviewDto` |
| `makeOfferServerFn` | `hr.recruitment_manage` | `base.extend({ input: offerWriteSchema })` | `HrOfferDto` — opens approval (`entityType='hr_job_offer'`) |
| `acceptOfferServerFn` | `hr.recruitment_manage` | `withId` | `{ offer: HrOfferDto, employeeId }` — hand-off to onboarding (creates provisional employee) |

## 4. Onboarding / Offboarding (`onboarding-server-functions.ts`) 🔷

Guard: `hr.employee_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listOnboardingChecklistsServerFn` | `hr.employee_view` | `base.extend({ filters })` | `HrOnboardingCaseDto[]` |
| `startOnboardingServerFn` | `hr.employee_manage` | `base.extend({ input: { employeeId, templateId, startDate } })` | `HrOnboardingCaseDto` (tasks fanned out) |
| `completeOnboardingTaskServerFn` | `hr.employee_manage` | `base.extend({ id, taskId, note? })` | `HrOnboardingTaskDto` |
| `startOffboardingServerFn` | `hr.employee_manage` | `base.extend({ input: { employeeId, lastWorkingDate, reason } })` | `HrOffboardingCaseDto` (asset return §integration inventory, final-settlement flag §payroll) |
| `runFinalSettlementServerFn` | `hr.payroll_run` | `withId` | `HrFinalSettlementDto` (EOSB/gratuity computed; posts JE §finance) |

## 5. Time & Attendance (`attendance-server-functions.ts`) 🔷

Guard: `hr.attendance_view` / `hr.attendance_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listShiftsServerFn` / `upsertShiftServerFn` / `deleteShiftServerFn` | view / manage / manage | shift master CRUD | `HrShiftDto` |
| `listRostersServerFn` / `assignRosterServerFn` | view / manage | `base.extend({ filters }` / `{ input: rosterAssignmentSchema } })` | `HrRosterDto` |
| `recordAttendanceServerFn` | `hr.attendance_manage` | `base.extend({ input: { employeeId, date, checkIn?, checkOut?, source } })` | `HrAttendanceDto` (in/out, geofence, device source) |
| `importAttendanceServerFn` | `hr.attendance_manage` | `base.extend({ input: { rows: [...] } })` | `{ inserted, skipped, errors }` (biometric/CSV feed) |
| `listTimesheetsServerFn` | `hr.attendance_view` | `base.extend({ filters })` | `{ items: HrTimesheetDto[], total }` |
| `requestOvertimeServerFn` | `hr.attendance_manage` | `base.extend({ input: overtimeRequestSchema })` | `HrOvertimeDto` — opens approval (`entityType='hr_overtime'`) |
| `approveTimesheetServerFn` | `hr.attendance_manage` | `withId` | `HrTimesheetDto` (locks period → payroll input) |

## 6. Leave / Absence (`leave-server-functions.ts`) 🔷

Guard: `hr.leave_view` / `hr.leave_request` / `hr.leave_approve`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listLeaveTypesServerFn` / `upsertLeaveTypeServerFn` | view / `hr.settings_manage` | leave-type + accrual policy master | `HrLeaveTypeDto` |
| `getLeaveBalancesServerFn` | `hr.leave_view` | `base.extend({ employeeId, asOf? })` | `HrLeaveBalanceDto[]` (entitlement / taken / accrued / carry-over) |
| `requestLeaveServerFn` | `hr.leave_request` | `base.extend({ input: leaveRequestSchema })` | `HrLeaveRequestDto` — opens approval (`entityType='hr_leave_request'`) + `notify('hr.leave_requested')` |
| `actOnLeaveRequestServerFn` | `hr.leave_approve` | `base.extend({ id, action: approve\|reject, note? })` | `HrLeaveRequestDto` — on approve, deduct balance; if paid/EOSB-impacting, may post JE §finance |
| `cancelLeaveRequestServerFn` | `hr.leave_request` | `withId` | `HrLeaveRequestDto` (re-credits balance) |
| `runLeaveAccrualServerFn` | `hr.settings_manage` | `base.extend({ input: { periodId } })` | `{ processed, accrued }` (scheduled accrual batch) |

## 7. Payroll (`payroll-server-functions.ts`) 🔷

Guard: `hr.payroll_view` / `hr.payroll_run` / `hr.payroll_post`; loans/advances `hr.loan_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listPayComponentsServerFn` / `upsertPayComponentServerFn` | view / `hr.settings_manage` | earning/deduction/contribution component master (formula, taxability, GL mapping) | `HrPayComponentDto` |
| `getSalaryStructureServerFn` / `assignSalaryStructureServerFn` | view / `hr.payroll_run` | per-employee CTC breakdown | `HrSalaryStructureDto` |
| `createPayrollRunServerFn` | `hr.payroll_run` | `base.extend({ input: { periodId, branchId?, componentSet? } })` | `HrPayrollRunDto` (draft; payslips computed) |
| `getPayrollRunServerFn` | `hr.payroll_view` | `withId` | `HrPayrollRunDetailDto` (payslips, totals, exceptions) |
| `submitPayrollRunServerFn` | `hr.payroll_run` | `withId` | `HrPayrollRunDto` — opens approval (`entityType='hr_payroll_run'`, amount = net total) |
| `postPayrollRunServerFn` | `hr.payroll_post` | `withId` | `HrPayrollRunDto` (posted) — **posts JE directly via `postJournalEntry`** (§ integration finance; `sourceDocType='hr_payroll_run'`); idempotent |
| `listPayslipsServerFn` / `getPayslipServerFn` | `hr.payroll_view` | `base.extend({ filters }` / `withId })` | `HrPayslipDto` (ESS-visible to owner) |
| `createLoanServerFn` | `hr.loan_manage` | `base.extend({ input: loanWriteSchema })` | `HrLoanDto` — opens approval (`entityType='hr_loan'`); disbursement posts JE (`sourceDocType='hr_loan'`), repayments net in payroll |
| `createSalaryAdvanceServerFn` | `hr.loan_manage` | `base.extend({ input: advanceSchema })` | `HrSalaryAdvanceDto` — approval (`entityType='hr_salary_advance'`) + JE (`sourceDocType='hr_salary_advance'`) |

## 8. Performance (`performance-server-functions.ts`) 🔷

Guard: `hr.performance_view` / `hr.performance_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listReviewCyclesServerFn` / `createReviewCycleServerFn` | view / manage | appraisal cycle master | `HrReviewCycleDto` |
| `setGoalsServerFn` / `listGoalsServerFn` | manage / view | `base.extend({ employeeId, input: goalsSchema })` | `HrGoalDto[]` (OKR/KPI) |
| `submitSelfAssessmentServerFn` | `hr.performance_manage` | `base.extend({ id, input: assessmentSchema })` | `HrAppraisalDto` |
| `submitManagerReviewServerFn` | `hr.performance_manage` | `base.extend({ id, input: ratingSchema })` | `HrAppraisalDto` |
| `calibrateServerFn` | `hr.performance_manage` | `base.extend({ input: { cycleId, ratings } })` | `{ updated }` (9-box / bell-curve) |
| `finalizeAppraisalServerFn` | `hr.performance_manage` | `withId` | `HrAppraisalDto` — may open promotion approval (`entityType='hr_promotion'`) and feed merit-increase into payroll |

## 9. Learning & Development (`learning-server-functions.ts`) 🔷

Guard: `hr.training_manage` (writes) / `hr.employee_view` (catalogue reads).

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listCoursesServerFn` / `upsertCourseServerFn` | view / `hr.training_manage` | course/curriculum master | `HrCourseDto` |
| `enrollServerFn` / `listEnrollmentsServerFn` | `hr.training_manage` / view | `base.extend({ input: enrollmentSchema })` | `HrEnrollmentDto` |
| `recordCompletionServerFn` | `hr.training_manage` | `base.extend({ id, input: { score?, certificateFileId? } })` | `HrEnrollmentDto` (writes competency + certification) |
| `listTrainingBudgetServerFn` | `hr.training_manage` | `base.extend({ filters })` | `HrTrainingBudgetDto` (links §finance budget) |

## 10. Career & Succession (`career-server-functions.ts`) 🔷

Guard: `hr.performance_view` / `hr.performance_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `getCareerPathServerFn` | `hr.performance_view` | `base.extend({ employeeId })` | `HrCareerPathDto` |
| `listSuccessionPlansServerFn` / `upsertSuccessionPlanServerFn` | view / manage | key-position bench, readiness | `HrSuccessionPlanDto` |
| `nominateTalentServerFn` | `hr.performance_manage` | `base.extend({ input: talentSchema })` | `HrTalentPoolDto` |

## 11. Workforce & Position Management (`workforce-server-functions.ts`) 🔷

Guard: `hr.org_view` / `hr.org_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `getHeadcountPlanServerFn` | `hr.org_view` | `base.extend({ filters: { companyId?, year } })` | `HrHeadcountPlanDto` (budget vs actual per department) |
| `requestPositionChangeServerFn` | `hr.org_manage` | `base.extend({ input: positionChangeSchema })` | `HrPositionRequestDto` — opens approval (`entityType='hr_workforce'`) |
| `getOrgChartServerFn` | `hr.org_view` | `base.extend({ rootId? })` | `HrOrgNode[]` (reuses `departmentTree` + reporting lines) |

## 12. HR Budgeting (`hr-budget-server-functions.ts`) 🔷

Guard: `hr.settings_manage` / `hr.analytics_view`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listHrBudgetsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | `HrBudgetDto[]` (personnel-cost budget, links `fin_budgets` §finance) |
| `upsertHrBudgetServerFn` | `hr.settings_manage` | `base.extend({ input: budgetSchema })` | `HrBudgetDto` — opens approval (`entityType='hr_budget'`) |
| `getBudgetVarianceServerFn` | `hr.analytics_view` | `base.extend({ filters: { periodId } })` | `HrBudgetVarianceDto[]` (planned vs posted payroll cost) |

## 13. ESS / MSS (`ess-server-functions.ts`) 🔷

Self-service. Guards are the same catalog codes but **row-scoped to the caller's
own employee record** (ESS) or the caller's **direct reports** (MSS); scoping is
enforced in the service, not by a distinct permission.

| Server function | Permission | Scope | Returns |
|---|---|---|---|
| `mySelfServerFn` | `hr.employee_view` | own | `HrEmployeeSelfDto` |
| `myPayslipsServerFn` | `hr.payroll_view` | own | `HrPayslipDto[]` |
| `myLeaveBalancesServerFn` | `hr.leave_view` | own | `HrLeaveBalanceDto[]` |
| `myTeamServerFn` | `hr.employee_view` | direct reports (MSS) | `HrEmployeeDto[]` |
| `myTeamApprovalsServerFn` | `hr.leave_approve` \| `hr.attendance_manage` | direct reports | `HrApprovalTaskDto[]` (leave/overtime/expense inbox) |

## 14. Employee Assets (`hr-asset-server-functions.ts`) 🔷

Guard: `hr.employee_view` / `hr.employee_manage`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `listEmployeeAssetsServerFn` | `hr.employee_view` | `base.extend({ filters: { employeeId? } })` | `HrEmployeeAssetDto[]` (links `products` / `fin_assets` §integration) |
| `assignAssetServerFn` | `hr.employee_manage` | `base.extend({ input: { employeeId, productId?, finAssetId?, serialNo?, issuedDate } })` | `HrEmployeeAssetDto` |
| `returnAssetServerFn` | `hr.employee_manage` | `base.extend({ id, input: { returnedDate, condition } })` | `HrEmployeeAssetDto` |

## 15. Travel & Expense (`travel-expense-server-functions.ts`) 🔷

Guard: `hr.expense_view` / `hr.expense_manage` / `hr.expense_approve`.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `createTravelRequestServerFn` | `hr.expense_manage` | `base.extend({ input: travelRequestSchema })` | `HrTravelRequestDto` — opens approval (`entityType='hr_travel'`) |
| `createExpenseClaimServerFn` | `hr.expense_manage` | `base.extend({ input: expenseClaimSchema })` | `HrExpenseClaimDto` (line items + receipt attachments) |
| `submitExpenseClaimServerFn` | `hr.expense_manage` | `withId` | `HrExpenseClaimDto` — opens approval (`entityType='hr_expense_claim'`, amount = claim total) |
| `actOnExpenseClaimServerFn` | `hr.expense_approve` | `base.extend({ id, action, note? })` | `HrExpenseClaimDto` |
| `reimburseExpenseClaimServerFn` | `hr.expense_approve` | `withId` | `HrExpenseClaimDto` (posted) — **posts JE** (`sourceDocType='hr_expense_claim'`) §finance |

## 16. Analytics (`hr-analytics-server-functions.ts`) 🔷

Guard: `hr.analytics_view`. All read-only, aggregate over the domains above.

| Server function | Permission | Input | Returns |
|---|---|---|---|
| `getHeadcountAnalyticsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | headcount by dept/grade/type, growth trend |
| `getTurnoverAnalyticsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | attrition rate, tenure buckets |
| `getPayrollAnalyticsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | cost-to-company trend, cost by cost-center (§finance dimensions) |
| `getAttendanceAnalyticsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | absence %, overtime, punctuality |
| `getDiversityAnalyticsServerFn` | `hr.analytics_view` | `base.extend({ filters })` | gender/nationality/age distribution |

---

## Guard chain (mandatory on every handler)

Every server function resolves and authorizes the caller **before** touching a
service, via the shared `resolveContext` helper:

```
getCurrentUserContext({ accessToken, tenantId })   // validates Supabase token, builds CurrentUserContext
  → requireTenantAccess(context, tenantId)         // caller is a member of the tenant
  → requirePermission(context, 'hr.<action>')      // caller holds the required hr.* permission
```

This chain is the **only** tenant-isolation boundary — a handler that skips it
leaks cross-tenant data. The guards throw typed `DomainError`s
(`src/server/auth/tenant-guard.ts`, `src/server/auth/errors.ts`); the service
layer receives an already-guarded `CurrentUserContext` and never re-checks auth.
Planned row-level scoping (branch / department / cost-center — §13 ESS/MSS and
`integration.md` §Security) is enforced **inside the service** on top of this
chain, not by additional permission codes.

## Error types → HTTP status

Thrown by services, surfaced by the server function, mapped to HTTP by the
TanStack Start boundary:

| Situation | Error (`server/auth/errors.ts`) | HTTP |
|---|---|---|
| Missing / invalid Supabase token | `UnauthorizedError` | 401 |
| Wrong tenant / missing `hr.*` permission | `ForbiddenError` | 403 |
| Record not found (e.g. `NotFoundError('Employee not found.')`) | `NotFoundError` | 404 |
| Illegal state transition, duplicate code, already-posted payroll, version conflict | `ConflictError` | 409 |
| Zod failure or invariant breach (cycle in org tree, unbalanced payroll JE, missing parent) | `ValidationError` | 422 |
| Supabase / dependency unreachable | `ServiceUnavailableError` | 503 |

All extend `DomainError` (`code`, `statusCode`); `isDomainError(err)` narrows them.
The org/employee services already throw `NotFoundError` and `ValidationError`
exactly this way (see `organization-service.ts` cycle checks and
`employee-service.ts` not-found guards).

## DTO serialization convention

Services never return raw Prisma rows. `serializeRecord` / `serializeRecords`
(`src/server/hr/hr-dto.ts`) walk each row and convert **`Prisma.Decimal` → string**
(and normalize dates), so money fields (salary bands, payroll amounts, loan
balances, expense totals) cross the wire as strings and are re-parsed client-side.
This mirrors the finance `finance-dto.ts` boundary — no `Prisma.Decimal` ever
reaches the client.

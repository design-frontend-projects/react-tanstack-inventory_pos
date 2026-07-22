import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { computePayslip } from '#/server/hr/payroll-calc'
import type { PayComponentLine } from '#/server/hr/payroll-calc'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import type { JournalLineInput } from '#/server/finance/journal-balancing'
import {
  createDraftEntry,
  postDraftEntry,
} from '#/server/finance/journal-service'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as employeeRepo from '#/server/repos/hr-employee-repo'
import * as payrollRepo from '#/server/repos/hr-payroll-repo'
import type { CurrentUserContext } from '#/types/auth'

// Payroll service. A run is calculated from the contract base + assigned salary
// components + benefits + approved overtime + due loan installments (BR-PAY: no
// duplicated salary source). Lifecycle: draft -> calculated -> approved ->
// posted (GL) -> paid. Posting is idempotent per run via the finance engine.

const HOURS_PER_MONTH = 240 // 30 days x 8h, for hourly-rate derivation

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  )
}

// --- Salary components (config) ---------------------------------------------

export async function listComponents(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await payrollRepo.listComponents(tenantId))
}

export async function createComponent(
  context: CurrentUserContext,
  tenantId: string,
  input: payrollRepo.ComponentWriteInput,
) {
  const c = await payrollRepo.createComponent(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_salary_component',
    c.id,
    { code: c.code },
  )
  return serializeRecord(c)
}

export async function updateComponent(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<payrollRepo.ComponentWriteInput>,
) {
  const c = await payrollRepo.updateComponent(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!c) throw new NotFoundError('Salary component not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_salary_component',
    id,
    null,
  )
  return serializeRecord(c)
}

export async function deleteComponent(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await payrollRepo.softDeleteComponent(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Salary component not found.')
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_salary_component',
    id,
    null,
  )
  return { id, deleted: true }
}

export async function assignComponent(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    employeeId: string
    componentId: string
    amount: string | number
    currencyCode?: string
    effectiveFrom: Date
  },
) {
  const a = await payrollRepo.assignEmployeeComponent(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.settings_manage',
    'hr_employee_salary_component',
    a.id,
    null,
  )
  return serializeRecord(a)
}

// --- Periods ----------------------------------------------------------------

export async function listPeriods(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await payrollRepo.listPeriods(tenantId))
}

export async function createPeriod(
  context: CurrentUserContext,
  tenantId: string,
  input: payrollRepo.PeriodWriteInput,
) {
  const p = await payrollRepo.createPeriod(tenantId, input, context.profileId)
  await audit(context, tenantId, 'hr.payroll_run', 'hr_payroll_period', p.id, {
    code: p.code,
  })
  return serializeRecord(p)
}

// --- Runs -------------------------------------------------------------------

export async function listRuns(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await payrollRepo.listRuns(tenantId))
}

export async function getRun(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const run = await payrollRepo.findRunById(tenantId, id)
  if (!run) throw new NotFoundError('Payroll run not found.')
  const componentDetails = await payrollRepo.listComponentDetailsForRun(
    tenantId,
    id,
  )
  return {
    ...serializeRecord(run),
    details: serializeRecords(run.details),
    componentDetails: serializeRecords(componentDetails),
  }
}

export async function createRun(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    periodId: string
    runType?: string
    companyId?: string | null
    branchId?: string | null
    departmentId?: string | null
    currencyCode?: string
  },
) {
  const period = await payrollRepo.findPeriodById(tenantId, input.periodId)
  if (!period) throw new ValidationError('Payroll period not found.')

  const run = await prisma.$transaction(async (tx) => {
    const runNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_PAYROLL_RUN',
    })
    return payrollRepo.createRun(
      tenantId,
      { ...input, runNumber },
      context.profileId,
      tx,
    )
  })

  await audit(context, tenantId, 'hr.payroll_run', 'hr_payroll_run', run.id, {
    runNumber: run.runNumber,
  })
  return serializeRecord(run)
}

// Calculates the run: builds every employee's payslip from their component
// sources and persists details + a breakdown. Recalculation clears prior detail.
export async function calculateRun(
  context: CurrentUserContext,
  tenantId: string,
  runId: string,
) {
  const run = await payrollRepo.findRunById(tenantId, runId)
  if (!run) throw new NotFoundError('Payroll run not found.')
  if (['posted', 'paid'].includes(run.statusCode)) {
    throw new ConflictError('A posted or paid run cannot be recalculated.')
  }
  const period = await payrollRepo.findPeriodById(tenantId, run.periodId)
  if (!period) throw new ValidationError('Payroll period not found.')

  const periodDays = daysBetween(
    new Date(period.startDate),
    new Date(period.endDate),
  )
  const components = await payrollRepo.listComponentDefinitionsMap(tenantId)
  const componentById = new Map(components.map((c) => [c.id, c]))

  // Scope: active employees, optionally filtered by company/branch/department.
  const employees = (
    await employeeRepo.listEmployees(tenantId, {
      departmentId: run.departmentId ?? undefined,
      employmentStatus: 'active',
      take: 500,
    })
  ).filter(
    (e) =>
      (!run.companyId || e.companyId === run.companyId) &&
      (!run.branchId || e.branchId === run.branchId),
  )

  const totals = await prisma.$transaction(async (tx) => {
    await payrollRepo.clearRunDetails(tenantId, runId, tx)

    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0
    let count = 0

    for (const employee of employees) {
      const contract = await payrollRepo.activeContractForEmployee(
        tenantId,
        employee.id,
        tx,
      )
      const baseSalary = contract ? Number(contract.baseSalary) : 0
      const currency = contract?.currencyCode ?? run.currencyCode

      const lines: Array<PayComponentLine> = [
        {
          componentCode: 'BASIC',
          componentName: 'Basic Salary',
          componentType: 'earning',
          amount: baseSalary,
          isTaxable: true,
        },
      ]

      // Assigned salary components.
      const assigned = await payrollRepo.listEmployeeComponents(
        tenantId,
        employee.id,
        tx,
      )
      for (const a of assigned) {
        const def = componentById.get(a.componentId)
        if (!def) continue
        lines.push({
          componentCode: def.code,
          componentName: def.name,
          componentType: def.componentType,
          amount: Number(a.amount),
          isTaxable: def.isTaxable,
        })
      }

      // Recurring benefits (earnings).
      const benefits = await payrollRepo.listActiveBenefits(
        tenantId,
        employee.id,
        tx,
      )
      for (const b of benefits) {
        lines.push({
          componentCode: 'BENEFIT',
          componentName: b.name,
          componentType: 'earning',
          amount: Number(b.amount ?? 0),
          isTaxable: true,
        })
      }

      // Approved overtime in the period → earning at derived hourly rate.
      const overtime = await payrollRepo.listApprovedOvertimeInPeriod(
        tenantId,
        employee.id,
        new Date(period.startDate),
        new Date(period.endDate),
        tx,
      )
      const otWeightedHours = overtime.reduce(
        (sum, o) => sum + Number(o.hours) * Number(o.rateMultiplier),
        0,
      )
      if (otWeightedHours > 0 && baseSalary > 0) {
        const hourly = baseSalary / HOURS_PER_MONTH
        lines.push({
          componentCode: 'OT',
          componentName: 'Overtime',
          componentType: 'earning',
          amount: round2(otWeightedHours * hourly),
          isTaxable: true,
        })
      }

      // Due loan installments → deduction.
      const dueInstallments = await payrollRepo.listDueInstallmentsForEmployee(
        tenantId,
        employee.id,
        new Date(period.endDate),
        tx,
      )
      const loanDeduction = dueInstallments.reduce(
        (sum, i) => sum + Number(i.amount),
        0,
      )
      if (loanDeduction > 0) {
        lines.push({
          componentCode: 'LOAN',
          componentName: 'Loan repayment',
          componentType: 'deduction',
          amount: round2(loanDeduction),
        })
      }

      const payslip = computePayslip(lines)

      const detail = await payrollRepo.createDetail(
        tenantId,
        {
          payrollRunId: runId,
          employeeId: employee.id,
          contractId: contract?.id ?? null,
          currencyCode: currency,
          workedDays: periodDays,
          grossPay: payslip.grossPay,
          totalEarnings: payslip.totalEarnings,
          totalDeductions: payslip.totalDeductions,
          netPay: payslip.netPay,
        },
        tx,
      )

      await payrollRepo.createComponentDetails(
        tenantId,
        detail.id,
        lines.map((l) => ({
          componentCode: l.componentCode,
          componentName: l.componentName,
          componentType: l.componentType,
          amount: l.amount,
          isTaxable: l.isTaxable,
        })),
        tx,
      )

      totalGross += payslip.grossPay
      totalDeductions += payslip.totalDeductions
      totalNet += payslip.netPay
      count += 1
    }

    await payrollRepo.updateRun(
      tenantId,
      runId,
      {
        employeeCount: count,
        totalGross: round2(totalGross),
        totalDeductions: round2(totalDeductions),
        totalNet: round2(totalNet),
        statusCode: 'calculated',
        updatedBy: context.profileId,
      },
      tx,
    )

    return { count, totalGross, totalNet }
  })

  await audit(context, tenantId, 'hr.payroll_run', 'hr_payroll_run', runId, {
    action: 'calculate',
    ...totals,
  })

  return getRun(context, tenantId, runId)
}

export async function approveRun(
  context: CurrentUserContext,
  tenantId: string,
  runId: string,
) {
  const run = await payrollRepo.findRunById(tenantId, runId)
  if (!run) throw new NotFoundError('Payroll run not found.')
  if (run.statusCode !== 'calculated') {
    throw new ConflictError('Only a calculated run can be approved.')
  }
  await payrollRepo.updateRun(tenantId, runId, {
    statusCode: 'approved',
    updatedBy: context.profileId,
  })
  await audit(context, tenantId, 'hr.payroll_post', 'hr_payroll_run', runId, {
    action: 'approve',
  })
  return { id: runId, statusCode: 'approved' }
}

export interface PostPayrollInput {
  expenseAccountId: string
  payableAccountId: string
  deductionsAccountId?: string | null
}

// Posts the run to the GL: Dr salary expense (gross), Cr net-pay payable (net),
// Cr deductions payable (deductions). Uses the finance journal service, which
// enforces balance + fiscal period + idempotency. Requires finance to be
// bootstrapped and the chosen accounts to allow manual journals.
export async function postRunToFinance(
  context: CurrentUserContext,
  tenantId: string,
  runId: string,
  input: PostPayrollInput,
) {
  const run = await payrollRepo.findRunById(tenantId, runId)
  if (!run) throw new NotFoundError('Payroll run not found.')
  if (run.statusCode !== 'approved') {
    throw new ConflictError('Only an approved run can be posted.')
  }
  if (run.isPosted) {
    throw new ConflictError('This run is already posted to the general ledger.')
  }

  const period = await payrollRepo.findPeriodById(tenantId, run.periodId)
  const entryDate = period?.payDate ?? period?.endDate ?? new Date()
  const gross = Number(run.totalGross)
  const net = Number(run.totalNet)
  const deductions = Number(run.totalDeductions)

  if (gross <= 0) {
    throw new ValidationError(
      'Run has no calculated amounts to post. Calculate first.',
    )
  }

  const currency = run.currencyCode
  const lines: Array<JournalLineInput> = [
    {
      accountId: input.expenseAccountId,
      currencyCode: currency,
      debitAmount: gross,
      description: `Payroll ${run.runNumber} — salary expense`,
    },
    {
      accountId: input.payableAccountId,
      currencyCode: currency,
      creditAmount: net,
      description: `Payroll ${run.runNumber} — net pay payable`,
    },
  ]
  if (deductions > 0) {
    lines.push({
      accountId: input.deductionsAccountId ?? input.payableAccountId,
      currencyCode: currency,
      creditAmount: deductions,
      description: `Payroll ${run.runNumber} — deductions payable`,
    })
  }

  // Draft -> post through the finance engine (balance + period gates applied).
  const draft = await createDraftEntry(context, tenantId, {
    journalTypeCode: 'general',
    entryDate: new Date(entryDate),
    referenceNumber: run.runNumber,
    memo: `Payroll run ${run.runNumber}`,
    lines,
  })
  await postDraftEntry(context, tenantId, draft.id)

  await prisma.$transaction(async (tx) => {
    await payrollRepo.updateRun(
      tenantId,
      runId,
      {
        statusCode: 'posted',
        isPosted: true,
        postedAt: new Date(),
        postedByProfileId: context.profileId,
        journalEntryId: draft.id,
        updatedBy: context.profileId,
      },
      tx,
    )
    // Settle the loan installments that were deducted this run.
    for (const detail of run.details) {
      const due = await payrollRepo.listDueInstallmentsForEmployee(
        tenantId,
        detail.employeeId,
        new Date(period?.endDate ?? entryDate),
        tx,
      )
      await payrollRepo.markInstallmentsPaid(
        tenantId,
        due.map((i) => i.id),
        runId,
        tx,
      )
    }
  })

  await audit(context, tenantId, 'hr.payroll_post', 'hr_payroll_run', runId, {
    action: 'post',
    journalEntryId: draft.id,
  })

  return { id: runId, statusCode: 'posted', journalEntryId: draft.id }
}

export async function markRunPaid(
  context: CurrentUserContext,
  tenantId: string,
  runId: string,
) {
  const run = await payrollRepo.findRunById(tenantId, runId)
  if (!run) throw new NotFoundError('Payroll run not found.')
  if (run.statusCode !== 'posted') {
    throw new ConflictError('Only a posted run can be marked paid.')
  }
  await payrollRepo.updateRun(tenantId, runId, {
    statusCode: 'paid',
    paidAt: new Date(),
    updatedBy: context.profileId,
  })
  await audit(context, tenantId, 'hr.payroll_post', 'hr_payroll_run', runId, {
    action: 'pay',
  })
  return { id: runId, statusCode: 'paid' }
}

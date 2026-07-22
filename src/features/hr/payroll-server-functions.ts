import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as payrollService from '#/server/hr/payroll-service'
import * as accountRepo from '#/server/repos/fin-account-repo'
import type { CurrentUserContext } from '#/types/auth'
import {
  assignComponentSchema,
  payrollPeriodWriteSchema,
  payrollPostSchema,
  payrollRunCreateSchema,
  salaryComponentWriteSchema,
} from '#/features/hr/payroll-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})
const withId = base.extend({ id: z.string().uuid() })

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

// --- Salary components ------------------------------------------------------

export const listSalaryComponentsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_view')
    return payrollService.listComponents(context, data.tenantId)
  })

export const createSalaryComponentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: salaryComponentWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return payrollService.createComponent(context, data.tenantId, data.input)
  })

export const updateSalaryComponentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    withId.extend({ input: salaryComponentWriteSchema.partial() }),
  )
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return payrollService.updateComponent(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deleteSalaryComponentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return payrollService.deleteComponent(context, data.tenantId, data.id)
  })

export const assignSalaryComponentServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: assignComponentSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.settings_manage')
    return payrollService.assignComponent(context, data.tenantId, data.input)
  })

// --- Periods ----------------------------------------------------------------

export const listPayrollPeriodsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_view')
    return payrollService.listPeriods(context, data.tenantId)
  })

export const createPayrollPeriodServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: payrollPeriodWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_run')
    return payrollService.createPeriod(context, data.tenantId, data.input)
  })

// --- Runs -------------------------------------------------------------------

export const listPayrollRunsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_view')
    return payrollService.listRuns(context, data.tenantId)
  })

export const getPayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_view')
    return payrollService.getRun(context, data.tenantId, data.id)
  })

export const createPayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: payrollRunCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_run')
    return payrollService.createRun(context, data.tenantId, data.input)
  })

export const calculatePayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_run')
    return payrollService.calculateRun(context, data.tenantId, data.id)
  })

export const approvePayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_post')
    return payrollService.approveRun(context, data.tenantId, data.id)
  })

export const postPayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: payrollPostSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_post')
    return payrollService.postRunToFinance(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const payPayrollRunServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.payroll_post')
    return payrollService.markRunPaid(context, data.tenantId, data.id)
  })

// Postable GL accounts (leaf + manual-journal enabled) for the posting dialog.
export const listPostableAccountsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'hr.payroll_post')
    const accounts = await accountRepo.listAccounts(data.tenantId, {
      isActive: true,
      take: 1000,
    })
    return accounts
      .filter((a) => a.isLeaf && a.allowManualJournal)
      .map((a) => ({ id: a.id, code: a.code, name: a.name }))
  })

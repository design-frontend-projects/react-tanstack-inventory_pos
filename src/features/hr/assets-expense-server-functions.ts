import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import * as service from '#/server/hr/assets-expense-service'
import * as accountRepo from '#/server/repos/fin-account-repo'
import type { CurrentUserContext } from '#/types/auth'
import {
  assetWriteSchema,
  decisionSchema,
  expenseClaimSchema,
  reimburseSchema,
  travelWriteSchema,
} from '#/features/hr/assets-expense-validation'

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

// --- Assets -----------------------------------------------------------------

export const listAssetsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ statusCode: z.string().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_view')
    return service.listAssets(context, data.tenantId, {
      statusCode: data.statusCode,
    })
  })

export const assignAssetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: assetWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return service.assignAsset(context, data.tenantId, data.input)
  })

export const returnAssetServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ conditionIn: z.string().max(200).nullish() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.employee_manage')
    return service.returnAsset(
      context,
      data.tenantId,
      data.id,
      data.conditionIn,
    )
  })

// --- Travel -----------------------------------------------------------------

export const listTravelServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ statusCode: z.string().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_view')
    return service.listTravel(context, data.tenantId, {
      statusCode: data.statusCode,
    })
  })

export const submitTravelServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: travelWriteSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_manage')
    return service.submitTravel(context, data.tenantId, data.input)
  })

export const decideTravelServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: decisionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_approve')
    return service.decideTravel(
      context,
      data.tenantId,
      data.id,
      data.input.decision,
    )
  })

// --- Expense claims ---------------------------------------------------------

export const listClaimsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ statusCode: z.string().optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_view')
    return service.listClaims(context, data.tenantId, {
      statusCode: data.statusCode,
    })
  })

export const getClaimServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_view')
    return service.getClaim(context, data.tenantId, data.id)
  })

export const submitClaimServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: expenseClaimSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_manage')
    return service.submitClaim(context, data.tenantId, data.input)
  })

export const decideClaimServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: decisionSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_approve')
    return service.decideClaim(
      context,
      data.tenantId,
      data.id,
      data.input.decision,
    )
  })

export const reimburseClaimServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: reimburseSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'hr.expense_approve')
    return service.reimburseClaim(context, data.tenantId, data.id, data.input)
  })

// Postable GL accounts for the reimbursement dialog.
export const listExpenseAccountsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'hr.expense_approve')
    const accounts = await accountRepo.listAccounts(data.tenantId, {
      isActive: true,
      take: 1000,
    })
    return accounts
      .filter((a) => a.isLeaf && a.allowManualJournal)
      .map((a) => ({ id: a.id, code: a.code, name: a.name }))
  })

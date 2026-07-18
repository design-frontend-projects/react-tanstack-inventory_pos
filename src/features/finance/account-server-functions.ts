import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as accountService from '#/server/finance/account-service'
import { serializeAccount } from '#/server/finance/finance-dto'
import * as accountRepo from '#/server/repos/fin-account-repo'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  accountCreateSchema,
  accountListSchema,
  accountMappingListSchema,
  accountMappingUpsertSchema,
  accountUpdateSchema,
} from '#/features/finance/finance-validation'

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

export const listFinAccountsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: accountListSchema.optional() }))
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.account_view')
    return accountService.listAccounts(data.tenantId, data.input ?? {})
  })

export const getFinAccountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.account_view')
    const account = await accountRepo.findAccountById(data.tenantId, data.id)
    return account ? serializeAccount(account) : null
  })

export const listFinAccountTypesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.account_view')
    return accountRepo.listAccountTypes(data.tenantId)
  })

export const listFinAccountClassesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.account_view')
    return accountRepo.listAccountClasses(data.tenantId)
  })

export const createFinAccountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: accountCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.account_manage')
    return accountService.createAccount(context, data.tenantId, data.input)
  })

export const updateFinAccountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: accountUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.account_manage')
    return accountService.updateAccount(
      context,
      data.tenantId,
      data.id,
      data.input,
    )
  })

export const deactivateFinAccountServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.account_manage')
    await accountService.deactivateAccount(context, data.tenantId, data.id)
    return { success: true }
  })

export const listFinAccountMappingsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: accountMappingListSchema.optional() }))
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.account_view')
    return accountRepo.listMappings(data.tenantId, data.input ?? {})
  })

export const upsertFinAccountMappingServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(base.extend({ input: accountMappingUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.posting_manage')
    return accountService.upsertAccountMapping(
      context,
      data.tenantId,
      data.input,
    )
  })

export const deleteFinAccountMappingServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.posting_manage')
    const removed = await accountRepo.deleteMapping(data.tenantId, data.id)
    return { success: removed }
  })

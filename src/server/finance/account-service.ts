import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as accountRepo from '#/server/repos/fin-account-repo'
import { serializeAccount } from '#/server/finance/finance-dto'
import type { FinAccountDto } from '#/server/finance/finance-dto'
import type { CurrentUserContext } from '#/types/auth'

// Chart-of-accounts management: hierarchy-safe create/update/deactivate and
// operational-entity → account mappings.

export interface CreateAccountInput {
  code: string
  name: string
  nameAr?: string | null
  description?: string | null
  parentAccountId?: string | null
  accountTypeCode: string
  isControlAccount?: boolean
  controlDomain?: string | null
  allowManualJournal?: boolean
  currencyCode?: string | null
  cashFlowCategoryId?: string | null
  branchId?: string | null
}

export async function createAccount(
  context: CurrentUserContext,
  tenantId: string,
  input: CreateAccountInput,
): Promise<FinAccountDto> {
  const accountType = await accountRepo.findAccountTypeByCode(
    tenantId,
    input.accountTypeCode,
  )

  if (!accountType) {
    throw new NotFoundError(`Account type ${input.accountTypeCode} not found.`)
  }

  const duplicate = await accountRepo.findAccountByCode(tenantId, input.code)

  if (duplicate) {
    throw new ConflictError(`Account code ${input.code} already exists.`)
  }

  let level = 1
  let path = input.code

  if (input.parentAccountId) {
    const parent = await accountRepo.findAccountById(
      tenantId,
      input.parentAccountId,
    )

    if (!parent) {
      throw new NotFoundError('Parent account not found.')
    }

    level = parent.level + 1
    path = `${parent.path}/${input.code}`
  }

  const account = await prisma.$transaction(async (tx) => {
    if (input.parentAccountId) {
      await accountRepo.markParentNotLeaf(tenantId, input.parentAccountId, tx)
    }

    const created = await accountRepo.createAccount(
      tenantId,
      {
        code: input.code,
        name: input.name,
        nameAr: input.nameAr ?? null,
        description: input.description ?? null,
        parentAccountId: input.parentAccountId ?? null,
        accountTypeId: accountType.id,
        level,
        path,
        isControlAccount: input.isControlAccount ?? accountType.isControlType,
        controlDomain: input.controlDomain ?? accountType.controlDomain,
        allowManualJournal: input.allowManualJournal ?? true,
        currencyCode: input.currencyCode ?? null,
        cashFlowCategoryId: input.cashFlowCategoryId ?? null,
        branchId: input.branchId ?? null,
        createdBy: context.profileId,
      },
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.account_created',
        entityType: 'fin_account',
        entityId: created.id,
        newValues: { code: input.code, name: input.name },
      },
      tx,
    )

    return created
  })

  return serializeAccount(account)
}

export interface UpdateAccountInput {
  name?: string
  nameAr?: string | null
  description?: string | null
  allowManualJournal?: boolean
  currencyCode?: string | null
  cashFlowCategoryId?: string | null
  branchId?: string | null
}

export async function updateAccount(
  context: CurrentUserContext,
  tenantId: string,
  accountId: string,
  input: UpdateAccountInput,
): Promise<FinAccountDto> {
  const existing = await accountRepo.findAccountById(tenantId, accountId)

  if (!existing) {
    throw new NotFoundError('Account not found.')
  }

  await prisma.$transaction(async (tx) => {
    await accountRepo.updateAccount(
      tenantId,
      accountId,
      input,
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.account_updated',
        entityType: 'fin_account',
        entityId: accountId,
        newValues: input as Record<string, unknown>,
      },
      tx,
    )
  })

  const updated = await accountRepo.findAccountById(tenantId, accountId)

  if (!updated) {
    throw new NotFoundError('Account not found after update.')
  }

  return serializeAccount(updated)
}

// Deactivation guards: no active children, no non-zero balance rows.
export async function deactivateAccount(
  context: CurrentUserContext,
  tenantId: string,
  accountId: string,
): Promise<void> {
  const account = await accountRepo.findAccountById(tenantId, accountId)

  if (!account) {
    throw new NotFoundError('Account not found.')
  }

  const childCount = await accountRepo.countChildAccounts(tenantId, accountId)

  if (childCount > 0) {
    throw new ConflictError(
      'Deactivate or move child accounts before deactivating a parent.',
    )
  }

  const balances = await prisma.finGlBalance.findMany({
    where: { tenantId, accountId },
  })

  const hasBalance = balances.some(
    (balance) =>
      !balance.basePeriodDebit.equals(balance.basePeriodCredit) ||
      !balance.baseOpeningDebit.equals(balance.baseOpeningCredit),
  )

  if (hasBalance) {
    throw new ConflictError(
      'Account carries a balance — close it out before deactivating.',
    )
  }

  await prisma.$transaction(async (tx) => {
    await accountRepo.updateAccount(
      tenantId,
      accountId,
      { isActive: false },
      context.profileId,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.account_deactivated',
        entityType: 'fin_account',
        entityId: accountId,
        oldValues: { isActive: true },
        newValues: { isActive: false },
      },
      tx,
    )
  })
}

export async function listAccounts(
  tenantId: string,
  options: Parameters<typeof accountRepo.listAccounts>[1],
): Promise<Array<FinAccountDto>> {
  const accounts = await accountRepo.listAccounts(tenantId, options)

  return accounts.map(serializeAccount)
}

export async function upsertAccountMapping(
  context: CurrentUserContext,
  tenantId: string,
  input: Omit<accountRepo.FinAccountMappingUpsertInput, 'actorProfileId'>,
) {
  const account = await accountRepo.findAccountById(tenantId, input.accountId)

  if (!account || !account.isActive) {
    throw new NotFoundError('Mapped account not found or inactive.')
  }

  const mapping = await accountRepo.upsertMapping(tenantId, {
    ...input,
    actorProfileId: context.profileId,
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actionKey: 'finance.account_mapping_upserted',
    entityType: 'fin_account_mapping',
    entityId: mapping.id,
    newValues: {
      entityType: input.entityType,
      mappingRole: input.mappingRole,
      accountId: input.accountId,
    },
  })

  return mapping
}

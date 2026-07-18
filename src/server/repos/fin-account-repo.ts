import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Chart of accounts + classes/types + operational-entity → account mappings.

export interface FinAccountCreateInput {
  code: string
  name: string
  nameAr?: string | null
  description?: string | null
  parentAccountId?: string | null
  accountTypeId: string
  level?: number
  path?: string
  isLeaf?: boolean
  isControlAccount?: boolean
  controlDomain?: string | null
  allowManualJournal?: boolean
  currencyCode?: string | null
  cashFlowCategoryId?: string | null
  branchId?: string | null
  createdBy?: string | null
}

const accountInclude = {
  accountType: { include: { accountClass: true } },
} satisfies Prisma.FinAccountInclude

export type FinAccountWithType = Prisma.FinAccountGetPayload<{
  include: typeof accountInclude
}>

export function findAccountById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<FinAccountWithType | null> {
  return client.finAccount.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: accountInclude,
  })
}

export function findAccountByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
): Promise<FinAccountWithType | null> {
  return client.finAccount.findFirst({
    where: { tenantId, code, deletedAt: null },
    include: accountInclude,
  })
}

export function listAccounts(
  tenantId: string,
  options: {
    isActive?: boolean
    accountTypeId?: string
    parentAccountId?: string | null
    search?: string
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.finAccount.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      ...(options.accountTypeId ? { accountTypeId: options.accountTypeId } : {}),
      ...(options.parentAccountId !== undefined
        ? { parentAccountId: options.parentAccountId }
        : {}),
      ...(options.search
        ? {
            OR: [
              { code: { contains: options.search, mode: 'insensitive' } },
              { name: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: accountInclude,
    orderBy: { code: 'asc' },
    take: options.take ?? 500,
  })
}

export function countChildAccounts(
  tenantId: string,
  parentAccountId: string,
  client: PrismaClientLike = prisma,
): Promise<number> {
  return client.finAccount.count({
    where: { tenantId, parentAccountId, deletedAt: null },
  })
}

export function createAccount(
  tenantId: string,
  input: FinAccountCreateInput,
  client: PrismaClientLike = prisma,
): Promise<FinAccountWithType> {
  return client.finAccount.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      description: input.description ?? null,
      parentAccountId: input.parentAccountId ?? null,
      accountTypeId: input.accountTypeId,
      level: input.level ?? 1,
      path: input.path ?? input.code,
      isLeaf: input.isLeaf ?? true,
      isControlAccount: input.isControlAccount ?? false,
      controlDomain: input.controlDomain ?? null,
      allowManualJournal: input.allowManualJournal ?? true,
      currencyCode: input.currencyCode ?? null,
      cashFlowCategoryId: input.cashFlowCategoryId ?? null,
      branchId: input.branchId ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
    include: accountInclude,
  })
}

export async function updateAccount(
  tenantId: string,
  id: string,
  data: Partial<
    Pick<
      FinAccountCreateInput,
      | 'name'
      | 'nameAr'
      | 'description'
      | 'allowManualJournal'
      | 'currencyCode'
      | 'cashFlowCategoryId'
      | 'branchId'
    >
  > & { isActive?: boolean },
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finAccount.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { ...data, updatedBy, versionNumber: { increment: 1 } },
  })

  return result.count > 0
}

export async function markParentNotLeaf(
  tenantId: string,
  parentAccountId: string,
  client: PrismaClientLike = prisma,
) {
  await client.finAccount.updateMany({
    where: { id: parentAccountId, tenantId, deletedAt: null, isLeaf: true },
    data: { isLeaf: false },
  })
}

export function listAccountClasses(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finAccountClass.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
    orderBy: { displayOrder: 'asc' },
  })
}

export function listAccountTypes(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finAccountType.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
    include: { accountClass: true },
    orderBy: { displayOrder: 'asc' },
  })
}

export function findAccountTypeByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
) {
  return client.finAccountType.findFirst({
    where: { code, OR: [{ tenantId }, { tenantId: null }], isActive: true },
    include: { accountClass: true },
    orderBy: { tenantId: { sort: 'desc', nulls: 'last' } },
  })
}

// --- Account mappings -------------------------------------------------------

export interface FinAccountMappingUpsertInput {
  entityType: string
  entityId?: string | null
  entityCode?: string | null
  mappingRole: string
  accountId: string
  actorProfileId?: string | null
}

export function listMappings(
  tenantId: string,
  options: { entityType?: string; mappingRole?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.finAccountMapping.findMany({
    where: {
      tenantId,
      isActive: true,
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.mappingRole ? { mappingRole: options.mappingRole } : {}),
    },
    orderBy: [{ entityType: 'asc' }, { mappingRole: 'asc' }],
  })
}

export async function upsertMapping(
  tenantId: string,
  input: FinAccountMappingUpsertInput,
  client: PrismaClientLike = prisma,
) {
  const existing = await client.finAccountMapping.findFirst({
    where: {
      tenantId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityCode: input.entityCode ?? null,
      mappingRole: input.mappingRole,
    },
  })

  if (existing) {
    return client.finAccountMapping.update({
      where: { id: existing.id },
      data: {
        accountId: input.accountId,
        isActive: true,
        updatedBy: input.actorProfileId ?? null,
      },
    })
  }

  return client.finAccountMapping.create({
    data: {
      tenantId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityCode: input.entityCode ?? null,
      mappingRole: input.mappingRole,
      accountId: input.accountId,
      createdBy: input.actorProfileId ?? null,
      updatedBy: input.actorProfileId ?? null,
    },
  })
}

export async function deleteMapping(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finAccountMapping.deleteMany({
    where: { id, tenantId },
  })

  return result.count > 0
}

export function findMappedAccountIds(
  tenantId: string,
  keys: Array<{
    entityType: string
    entityId?: string | null
    entityCode?: string | null
    mappingRole: string
  }>,
  client: PrismaClientLike = prisma,
) {
  return client.finAccountMapping.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: keys.map((key) => ({
        entityType: key.entityType,
        entityId: key.entityId ?? null,
        entityCode: key.entityCode ?? null,
        mappingRole: key.mappingRole,
      })),
    },
  })
}

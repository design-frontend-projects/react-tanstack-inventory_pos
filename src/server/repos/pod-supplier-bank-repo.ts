import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierBankAccountWriteInput {
  supplierId: string
  bankName: string
  accountName?: string | null
  accountNumber?: string | null
  iban?: string | null
  swift?: string | null
  currencyCode?: string
  isPrimary?: boolean
  isActive?: boolean
}

export function listSupplierBankAccounts(
  tenantId: string,
  supplierId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierBankAccount.findMany({
    where: { tenantId, supplierId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { bankName: 'asc' }],
  })
}

export function findSupplierBankAccountById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierBankAccount.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSupplierBankAccount(
  tenantId: string,
  input: SupplierBankAccountWriteInput,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierBankAccount.create({
    data: {
      tenantId,
      supplierId: input.supplierId,
      bankName: input.bankName.trim(),
      accountName: input.accountName ?? null,
      accountNumber: input.accountNumber ?? null,
      iban: input.iban ?? null,
      swift: input.swift ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      isPrimary: input.isPrimary ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSupplierBankAccount(
  tenantId: string,
  id: string,
  data: Partial<Omit<SupplierBankAccountWriteInput, 'supplierId'>>,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierBankAccount.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.bankName !== undefined
        ? { bankName: data.bankName.trim() }
        : {}),
      ...(data.accountName !== undefined
        ? { accountName: data.accountName ?? null }
        : {}),
      ...(data.accountNumber !== undefined
        ? { accountNumber: data.accountNumber ?? null }
        : {}),
      ...(data.iban !== undefined ? { iban: data.iban ?? null } : {}),
      ...(data.swift !== undefined ? { swift: data.swift ?? null } : {}),
      ...(data.currencyCode !== undefined
        ? { currencyCode: data.currencyCode }
        : {}),
      ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findSupplierBankAccountById(tenantId, id, client)
}

export async function softDeleteSupplierBankAccount(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierBankAccount.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

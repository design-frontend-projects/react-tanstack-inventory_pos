import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierWriteInput {
  code: string
  name: string
  taxId?: string | null
  email?: string | null
  phone?: string | null
  addressJson?: Prisma.InputJsonValue | null
  paymentTerms?: string | null
  currencyCode?: string
  creditLimit?: Prisma.Decimal | string | number | null
  // Spec 005 procurement fields
  categoryId?: string | null
  statusCode?: string
  rating?: Prisma.Decimal | string | number | null
  leadTimeDays?: number | null
  isPreferred?: boolean
  tags?: Prisma.InputJsonValue | null
  isActive?: boolean
}

export interface SupplierActor {
  createdBy?: string | null
  updatedBy?: string | null
}

export function findSupplierById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.supplier.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

// Full profile with CRM satellites (contacts, addresses, bank accounts). Satellites
// are separate pod_ aggregates referenced by scalar supplierId, so they are fetched
// explicitly rather than via a Prisma relation include.
export async function findSupplierDetail(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const supplier = await client.supplier.findFirst({
    where: { id, tenantId, deletedAt: null },
  })

  if (!supplier) {
    return null
  }

  const [contacts, addresses, bankAccounts] = await Promise.all([
    client.podSupplierContact.findMany({
      where: { tenantId, supplierId: id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    }),
    client.podSupplierAddress.findMany({
      where: { tenantId, supplierId: id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { addressType: 'asc' }],
    }),
    client.podSupplierBankAccount.findMany({
      where: { tenantId, supplierId: id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { bankName: 'asc' }],
    }),
  ])

  return { ...supplier, contacts, addresses, bankAccounts }
}

export interface ListSupplierOptions {
  search?: string
  categoryId?: string
  statusCode?: string
  includeInactive?: boolean
  skip?: number
  take?: number
}

function buildSupplierWhere(
  tenantId: string,
  options: ListSupplierOptions,
): Prisma.SupplierWhereInput {
  return {
    tenantId,
    deletedAt: null,
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.statusCode ? { statusCode: options.statusCode } : {}),
    ...(options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
            { email: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

export function listSuppliers(
  tenantId: string,
  options: ListSupplierOptions = {},
  client: PrismaClientLike = prisma,
) {
  return client.supplier.findMany({
    where: buildSupplierWhere(tenantId, options),
    orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
    ...(options.skip !== undefined ? { skip: options.skip } : {}),
    ...(options.take !== undefined ? { take: options.take } : {}),
  })
}

export function countSuppliers(
  tenantId: string,
  options: ListSupplierOptions = {},
  client: PrismaClientLike = prisma,
) {
  return client.supplier.count({ where: buildSupplierWhere(tenantId, options) })
}

export function createSupplier(
  tenantId: string,
  input: SupplierWriteInput & SupplierActor,
  client: PrismaClientLike = prisma,
) {
  return client.supplier.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      taxId: input.taxId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      addressJson: input.addressJson ?? undefined,
      paymentTerms: input.paymentTerms ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      creditLimit: input.creditLimit ?? null,
      categoryId: input.categoryId ?? null,
      statusCode: input.statusCode ?? 'active',
      rating: input.rating ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
      isPreferred: input.isPreferred ?? false,
      tags: input.tags ?? undefined,
      isActive: input.isActive ?? true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
  })
}

export async function updateSupplier(
  tenantId: string,
  id: string,
  data: Partial<SupplierWriteInput> & SupplierActor,
  client: PrismaClientLike = prisma,
) {
  const result = await client.supplier.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.taxId !== undefined ? { taxId: data.taxId ?? null } : {}),
      ...(data.email !== undefined ? { email: data.email ?? null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
      ...(data.addressJson !== undefined
        ? { addressJson: data.addressJson ?? Prisma.DbNull }
        : {}),
      ...(data.paymentTerms !== undefined
        ? { paymentTerms: data.paymentTerms ?? null }
        : {}),
      ...(data.currencyCode !== undefined
        ? { currencyCode: data.currencyCode }
        : {}),
      ...(data.creditLimit !== undefined
        ? { creditLimit: data.creditLimit ?? null }
        : {}),
      ...(data.categoryId !== undefined
        ? { categoryId: data.categoryId ?? null }
        : {}),
      ...(data.statusCode !== undefined ? { statusCode: data.statusCode } : {}),
      ...(data.rating !== undefined ? { rating: data.rating ?? null } : {}),
      ...(data.leadTimeDays !== undefined
        ? { leadTimeDays: data.leadTimeDays ?? null }
        : {}),
      ...(data.isPreferred !== undefined
        ? { isPreferred: data.isPreferred }
        : {}),
      ...(data.tags !== undefined ? { tags: data.tags ?? Prisma.DbNull } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.updatedBy !== undefined
        ? { updatedBy: data.updatedBy ?? null }
        : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findSupplierById(tenantId, id, client)
}

export async function softDeleteSupplier(
  tenantId: string,
  id: string,
  actor: { deletedBy?: string | null } = {},
  client: PrismaClientLike = prisma,
) {
  const result = await client.supplier.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      deletedAt: new Date(),
      isActive: false,
      deletedBy: actor.deletedBy ?? null,
    },
  })

  return result.count > 0
}

// Detail payload type shared with the DTO/service layer.
export type SupplierDetail = NonNullable<
  Awaited<ReturnType<typeof findSupplierDetail>>
>

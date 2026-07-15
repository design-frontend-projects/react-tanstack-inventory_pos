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
  isActive?: boolean
}

export function findSupplierById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.supplier.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listSuppliers(
  tenantId: string,
  options: { search?: string; includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.supplier.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { code: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createSupplier(
  tenantId: string,
  input: SupplierWriteInput,
  client: PrismaClientLike = prisma
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
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSupplier(
  tenantId: string,
  id: string,
  data: Partial<SupplierWriteInput>,
  client: PrismaClientLike = prisma
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
      ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms ?? null } : {}),
      ...(data.currencyCode !== undefined ? { currencyCode: data.currencyCode } : {}),
      ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
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
  client: PrismaClientLike = prisma
) {
  const result = await client.supplier.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

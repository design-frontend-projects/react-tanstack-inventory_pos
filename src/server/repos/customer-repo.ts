import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { CustomerType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface CustomerWriteInput {
  code: string
  name: string
  customerType?: CustomerType
  taxId?: string | null
  email?: string | null
  phone?: string | null
  billingAddressJson?: Prisma.InputJsonValue | null
  shippingAddressJson?: Prisma.InputJsonValue | null
  priceListId?: string | null
  creditLimit?: Prisma.Decimal | string | number | null
  isActive?: boolean
}

export function findCustomerById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.customer.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function listCustomers(
  tenantId: string,
  options: { search?: string; includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma
) {
  return client.customer.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { code: { contains: options.search, mode: 'insensitive' } },
              { phone: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
}

export function createCustomer(
  tenantId: string,
  input: CustomerWriteInput,
  client: PrismaClientLike = prisma
) {
  return client.customer.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      customerType: input.customerType ?? 'RETAIL',
      taxId: input.taxId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      billingAddressJson: input.billingAddressJson ?? undefined,
      shippingAddressJson: input.shippingAddressJson ?? undefined,
      priceListId: input.priceListId ?? null,
      creditLimit: input.creditLimit ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateCustomer(
  tenantId: string,
  id: string,
  data: Partial<CustomerWriteInput>,
  client: PrismaClientLike = prisma
) {
  const result = await client.customer.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.customerType !== undefined ? { customerType: data.customerType } : {}),
      ...(data.taxId !== undefined ? { taxId: data.taxId ?? null } : {}),
      ...(data.email !== undefined ? { email: data.email ?? null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
      ...(data.billingAddressJson !== undefined
        ? { billingAddressJson: data.billingAddressJson ?? Prisma.DbNull }
        : {}),
      ...(data.shippingAddressJson !== undefined
        ? { shippingAddressJson: data.shippingAddressJson ?? Prisma.DbNull }
        : {}),
      ...(data.priceListId !== undefined ? { priceListId: data.priceListId ?? null } : {}),
      ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findCustomerById(tenantId, id, client)
}

export async function softDeleteCustomer(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.customer.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

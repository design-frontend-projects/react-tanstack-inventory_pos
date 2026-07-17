import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierContactWriteInput {
  supplierId: string
  name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  isPrimary?: boolean
  notes?: string | null
  isActive?: boolean
}

export function listSupplierContacts(
  tenantId: string,
  supplierId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierContact.findMany({
    where: { tenantId, supplierId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  })
}

export function findSupplierContactById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierContact.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSupplierContact(
  tenantId: string,
  input: SupplierContactWriteInput,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierContact.create({
    data: {
      tenantId,
      supplierId: input.supplierId,
      name: input.name.trim(),
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSupplierContact(
  tenantId: string,
  id: string,
  data: Partial<Omit<SupplierContactWriteInput, 'supplierId'>>,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierContact.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.title !== undefined ? { title: data.title ?? null } : {}),
      ...(data.email !== undefined ? { email: data.email ?? null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
      ...(data.mobile !== undefined ? { mobile: data.mobile ?? null } : {}),
      ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      ...(data.notes !== undefined ? { notes: data.notes ?? null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findSupplierContactById(tenantId, id, client)
}

export async function softDeleteSupplierContact(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierContact.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

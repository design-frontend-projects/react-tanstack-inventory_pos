import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SupplierAddressWriteInput {
  supplierId: string
  addressType?: string
  line1: string
  line2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryCode?: string | null
  isPrimary?: boolean
  isActive?: boolean
}

export function listSupplierAddresses(
  tenantId: string,
  supplierId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierAddress.findMany({
    where: { tenantId, supplierId, deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { addressType: 'asc' }],
  })
}

export function findSupplierAddressById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierAddress.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createSupplierAddress(
  tenantId: string,
  input: SupplierAddressWriteInput,
  client: PrismaClientLike = prisma,
) {
  return client.podSupplierAddress.create({
    data: {
      tenantId,
      supplierId: input.supplierId,
      addressType: input.addressType ?? 'billing',
      line1: input.line1.trim(),
      line2: input.line2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      countryCode: input.countryCode ?? null,
      isPrimary: input.isPrimary ?? false,
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateSupplierAddress(
  tenantId: string,
  id: string,
  data: Partial<Omit<SupplierAddressWriteInput, 'supplierId'>>,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierAddress.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.addressType !== undefined
        ? { addressType: data.addressType }
        : {}),
      ...(data.line1 !== undefined ? { line1: data.line1.trim() } : {}),
      ...(data.line2 !== undefined ? { line2: data.line2 ?? null } : {}),
      ...(data.city !== undefined ? { city: data.city ?? null } : {}),
      ...(data.state !== undefined ? { state: data.state ?? null } : {}),
      ...(data.postalCode !== undefined
        ? { postalCode: data.postalCode ?? null }
        : {}),
      ...(data.countryCode !== undefined
        ? { countryCode: data.countryCode ?? null }
        : {}),
      ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findSupplierAddressById(tenantId, id, client)
}

export async function softDeleteSupplierAddress(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podSupplierAddress.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

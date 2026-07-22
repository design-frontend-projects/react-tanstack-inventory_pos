import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'
import type { PriceListType } from '#/server/db/generated/prisma/client'

export interface PriceListWriteInput {
  code: string
  name: string
  currencyCode?: string
  type?: PriceListType
  validFrom?: Date | null
  validTo?: Date | null
  isDefault?: boolean
  isActive?: boolean
}

export interface ProductPriceWriteInput {
  priceListId: string
  productId: string
  variantId?: string | null
  uomId: string
  minQty?: number | string
  unitPrice: number | string
  taxIncluded?: boolean
  validFrom?: Date | null
  validTo?: Date | null
}

export function findPriceListById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.priceList.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { _count: { select: { prices: true } } },
  })
}

export function listPriceLists(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.priceList.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { prices: true } } },
  })
}

export async function createPriceList(
  tenantId: string,
  input: PriceListWriteInput,
  client: PrismaClientLike = prisma,
) {
  // Only one default list per tenant: demote siblings before promoting this one.
  if (input.isDefault) {
    await client.priceList.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    })
  }

  return client.priceList.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      currencyCode: input.currencyCode?.trim() || 'USD',
      type: input.type ?? 'SALES',
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
    },
    include: { _count: { select: { prices: true } } },
  })
}

export async function updatePriceList(
  tenantId: string,
  id: string,
  data: Partial<PriceListWriteInput>,
  client: PrismaClientLike = prisma,
) {
  if (data.isDefault) {
    await client.priceList.updateMany({
      where: { tenantId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    })
  }

  const result = await client.priceList.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.code !== undefined ? { code: data.code.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.currencyCode !== undefined
        ? { currencyCode: data.currencyCode.trim() }
        : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.validFrom !== undefined ? { validFrom: data.validFrom } : {}),
      ...(data.validTo !== undefined ? { validTo: data.validTo } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findPriceListById(tenantId, id, client)
}

export async function softDeletePriceList(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.priceList.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, isDefault: false },
  })

  return result.count > 0
}

export function listProductPrices(
  tenantId: string,
  filters: { priceListId?: string; productId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.productPrice.findMany({
    where: {
      tenantId,
      ...(filters.priceListId ? { priceListId: filters.priceListId } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: [{ productId: 'asc' }, { minQty: 'asc' }],
    include: {
      product: { select: { id: true, sku: true, name: true } },
      priceList: { select: { id: true, code: true, name: true } },
    },
  })
}

export function findProductPriceById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.productPrice.findFirst({
    where: { id, tenantId },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      priceList: { select: { id: true, code: true, name: true } },
    },
  })
}

// Upsert on the natural grain (priceList × product × variant × uom × minQty)
// so re-submitting the same tier updates the price instead of erroring.
export async function upsertProductPrice(
  tenantId: string,
  input: ProductPriceWriteInput,
  client: PrismaClientLike = prisma,
) {
  const existing = await client.productPrice.findFirst({
    where: {
      tenantId,
      priceListId: input.priceListId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      uomId: input.uomId,
      minQty: input.minQty ?? 1,
    },
  })

  if (existing) {
    return client.productPrice.update({
      where: { id: existing.id },
      data: {
        unitPrice: input.unitPrice,
        taxIncluded: input.taxIncluded ?? existing.taxIncluded,
        validFrom: input.validFrom ?? existing.validFrom,
        validTo: input.validTo ?? existing.validTo,
      },
      include: {
        product: { select: { id: true, sku: true, name: true } },
        priceList: { select: { id: true, code: true, name: true } },
      },
    })
  }

  return client.productPrice.create({
    data: {
      tenantId,
      priceListId: input.priceListId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      uomId: input.uomId,
      minQty: input.minQty ?? 1,
      unitPrice: input.unitPrice,
      taxIncluded: input.taxIncluded ?? false,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
    },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      priceList: { select: { id: true, code: true, name: true } },
    },
  })
}

export async function deleteProductPrice(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.productPrice.deleteMany({
    where: { id, tenantId },
  })

  return result.count > 0
}

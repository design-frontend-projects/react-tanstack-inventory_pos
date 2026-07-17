import { prisma } from '#/server/db/client'
import type {
  CostingMethod,
  Prisma,
  ProductStatus,
  ProductType,
  TrackingPolicy,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ProductWriteInput {
  sku: string
  name: string
  slug?: string | null
  description?: string | null
  productType?: ProductType
  trackingPolicy?: TrackingPolicy
  isStockTracked?: boolean
  hasExpiry?: boolean
  shelfLifeDays?: number | null
  categoryId?: string | null
  brandId?: string | null
  baseUomId: string
  salesUomId?: string | null
  purchaseUomId?: string | null
  costingMethod?: CostingMethod
  standardCost?: Prisma.Decimal | string | number | null
  defaultPrice?: Prisma.Decimal | string | number | null
  taxRateId?: string | null
  barcode?: string | null
  reorderPoint?: Prisma.Decimal | string | number | null
  reorderQty?: Prisma.Decimal | string | number | null
  minStock?: Prisma.Decimal | string | number | null
  maxStock?: Prisma.Decimal | string | number | null
  safetyStock?: Prisma.Decimal | string | number | null
  leadTimeDays?: number | null
  preferredSupplierId?: string | null
  status?: ProductStatus
  isActive?: boolean
}

const productWithVariants = {
  variants: {
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.ProductInclude

export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: typeof productWithVariants
}>

export function findProductById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<ProductWithVariants | null> {
  return client.product.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: productWithVariants,
  })
}

export interface ListProductsFilters {
  search?: string
  categoryId?: string
  brandId?: string
  productType?: ProductType
  status?: ProductStatus
  take?: number
  skip?: number
}

export function listProducts(
  tenantId: string,
  filters: ListProductsFilters = {},
  client: PrismaClientLike = prisma,
) {
  return client.product.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.productType ? { productType: filters.productType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { sku: { contains: filters.search, mode: 'insensitive' } },
              { barcode: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
    take: filters.take ?? 50,
    skip: filters.skip ?? 0,
  })
}

export function countProducts(
  tenantId: string,
  filters: ListProductsFilters = {},
  client: PrismaClientLike = prisma,
) {
  return client.product.count({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.productType ? { productType: filters.productType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { sku: { contains: filters.search, mode: 'insensitive' } },
              { barcode: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  })
}

export function createProduct(
  tenantId: string,
  input: ProductWriteInput,
  client: PrismaClientLike = prisma,
) {
  return client.product.create({
    data: {
      tenantId,
      sku: input.sku.trim(),
      name: input.name.trim(),
      slug: input.slug ?? null,
      description: input.description ?? null,
      productType: input.productType ?? 'SIMPLE',
      trackingPolicy: input.trackingPolicy ?? 'NONE',
      isStockTracked: input.isStockTracked ?? true,
      hasExpiry: input.hasExpiry ?? false,
      shelfLifeDays: input.shelfLifeDays ?? null,
      categoryId: input.categoryId ?? null,
      brandId: input.brandId ?? null,
      baseUomId: input.baseUomId,
      salesUomId: input.salesUomId ?? null,
      purchaseUomId: input.purchaseUomId ?? null,
      costingMethod: input.costingMethod ?? 'WEIGHTED_AVERAGE',
      standardCost: input.standardCost ?? null,
      defaultPrice: input.defaultPrice ?? null,
      taxRateId: input.taxRateId ?? null,
      barcode: input.barcode ?? null,
      reorderPoint: input.reorderPoint ?? null,
      reorderQty: input.reorderQty ?? null,
      minStock: input.minStock ?? null,
      maxStock: input.maxStock ?? null,
      safetyStock: input.safetyStock ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
      preferredSupplierId: input.preferredSupplierId ?? null,
      status: input.status ?? 'ACTIVE',
      isActive: input.isActive ?? true,
    },
  })
}

export async function updateProduct(
  tenantId: string,
  id: string,
  data: Partial<ProductWriteInput>,
  client: PrismaClientLike = prisma,
) {
  const result = await client.product.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(data.sku !== undefined ? { sku: data.sku.trim() } : {}),
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.slug !== undefined ? { slug: data.slug ?? null } : {}),
      ...(data.description !== undefined
        ? { description: data.description ?? null }
        : {}),
      ...(data.productType !== undefined
        ? { productType: data.productType }
        : {}),
      ...(data.trackingPolicy !== undefined
        ? { trackingPolicy: data.trackingPolicy }
        : {}),
      ...(data.isStockTracked !== undefined
        ? { isStockTracked: data.isStockTracked }
        : {}),
      ...(data.hasExpiry !== undefined ? { hasExpiry: data.hasExpiry } : {}),
      ...(data.shelfLifeDays !== undefined
        ? { shelfLifeDays: data.shelfLifeDays ?? null }
        : {}),
      ...(data.categoryId !== undefined
        ? { categoryId: data.categoryId ?? null }
        : {}),
      ...(data.brandId !== undefined ? { brandId: data.brandId ?? null } : {}),
      ...(data.baseUomId !== undefined ? { baseUomId: data.baseUomId } : {}),
      ...(data.salesUomId !== undefined
        ? { salesUomId: data.salesUomId ?? null }
        : {}),
      ...(data.purchaseUomId !== undefined
        ? { purchaseUomId: data.purchaseUomId ?? null }
        : {}),
      ...(data.costingMethod !== undefined
        ? { costingMethod: data.costingMethod }
        : {}),
      ...(data.standardCost !== undefined
        ? { standardCost: data.standardCost ?? null }
        : {}),
      ...(data.defaultPrice !== undefined
        ? { defaultPrice: data.defaultPrice ?? null }
        : {}),
      ...(data.taxRateId !== undefined
        ? { taxRateId: data.taxRateId ?? null }
        : {}),
      ...(data.barcode !== undefined ? { barcode: data.barcode ?? null } : {}),
      ...(data.reorderPoint !== undefined
        ? { reorderPoint: data.reorderPoint ?? null }
        : {}),
      ...(data.reorderQty !== undefined
        ? { reorderQty: data.reorderQty ?? null }
        : {}),
      ...(data.minStock !== undefined
        ? { minStock: data.minStock ?? null }
        : {}),
      ...(data.maxStock !== undefined
        ? { maxStock: data.maxStock ?? null }
        : {}),
      ...(data.safetyStock !== undefined
        ? { safetyStock: data.safetyStock ?? null }
        : {}),
      ...(data.leadTimeDays !== undefined
        ? { leadTimeDays: data.leadTimeDays ?? null }
        : {}),
      ...(data.preferredSupplierId !== undefined
        ? { preferredSupplierId: data.preferredSupplierId ?? null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  })

  if (result.count === 0) {
    return null
  }

  return findProductById(tenantId, id, client)
}

export async function softDeleteProduct(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.product.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, status: 'ARCHIVED' },
  })

  return result.count > 0
}

export interface ProductTracking {
  trackingPolicy: TrackingPolicy
  hasExpiry: boolean
  shelfLifeDays: number | null
  baseUomId: string
}

// Minimal projection the movement engine needs to enforce lot/serial rules — a
// single indexed PK lookup, kept narrow to stay cheap on the hot posting path.
// `baseUomId` lets manufacturing resolve the finished-good unit of measure.
export async function getProductTracking(
  tenantId: string,
  productId: string,
  client: PrismaClientLike = prisma,
): Promise<ProductTracking | null> {
  const product = await client.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      trackingPolicy: true,
      hasExpiry: true,
      shelfLifeDays: true,
      baseUomId: true,
    },
  })

  return product
}

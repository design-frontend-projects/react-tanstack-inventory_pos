import { prisma } from '#/server/db/client'
import type {
  Prisma,
  ProductionOrderStatus,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ProductionMaterialInput {
  componentProductId: string
  componentVariantId?: string | null
  fromLocationId: string
  uomId: string
  plannedQty: Prisma.Decimal | string | number
  lotId?: string | null
  serialId?: string | null
}

export interface ProductionOrderCreateInput {
  documentNumber: string
  productId: string
  variantId?: string | null
  bomId?: string | null
  warehouseId: string
  outputLocationId: string
  plannedQty: Prisma.Decimal | string | number
  overheadCost?: Prisma.Decimal | string | number
  plannedStartDate?: Date | null
  plannedEndDate?: Date | null
  notes?: string | null
  createdByProfileId?: string | null
  materials: Array<ProductionMaterialInput>
}

const orderWithDetail = {
  materials: { orderBy: { lineNo: 'asc' } },
  outputs: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.ProductionOrderInclude

export type ProductionOrderWithDetail = Prisma.ProductionOrderGetPayload<{
  include: typeof orderWithDetail
}>

export function findProductionOrderById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<ProductionOrderWithDetail | null> {
  return client.productionOrder.findFirst({
    where: { id, tenantId },
    include: orderWithDetail,
  })
}

export function listProductionOrders(
  tenantId: string,
  filters: { status?: ProductionOrderStatus; productId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.productionOrder.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createProductionOrder(
  tenantId: string,
  input: ProductionOrderCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.productionOrder.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      productId: input.productId,
      variantId: input.variantId ?? null,
      bomId: input.bomId ?? null,
      warehouseId: input.warehouseId,
      outputLocationId: input.outputLocationId,
      plannedQty: input.plannedQty,
      overheadCost: input.overheadCost ?? 0,
      plannedStartDate: input.plannedStartDate ?? null,
      plannedEndDate: input.plannedEndDate ?? null,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      materials: {
        create: input.materials.map((material, index) => ({
          tenantId,
          lineNo: index + 1,
          componentProductId: material.componentProductId,
          componentVariantId: material.componentVariantId ?? null,
          fromLocationId: material.fromLocationId,
          uomId: material.uomId,
          plannedQty: material.plannedQty,
          lotId: material.lotId ?? null,
          serialId: material.serialId ?? null,
        })),
      },
    },
    include: orderWithDetail,
  })
}

export async function updateProductionOrderStatus(
  tenantId: string,
  id: string,
  status: ProductionOrderStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.productionOrder.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

// Records a component consumption on its material line (qty + WAC issue cost).
export function setMaterialConsumed(
  lineId: string,
  data: {
    consumedQty: Prisma.Decimal | string | number
    unitCost: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  return client.productionMaterial.update({
    where: { id: lineId },
    data: { consumedQty: data.consumedQty, unitCost: data.unitCost, isConsumed: true },
  })
}

// Rolls the accumulated cost totals onto the order header.
export async function setProductionCosts(
  tenantId: string,
  id: string,
  data: {
    materialCost?: Prisma.Decimal | string | number
    outputCost?: Prisma.Decimal | string | number
    producedQty?: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  await client.productionOrder.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.materialCost !== undefined ? { materialCost: data.materialCost } : {}),
      ...(data.outputCost !== undefined ? { outputCost: data.outputCost } : {}),
      ...(data.producedQty !== undefined ? { producedQty: data.producedQty } : {}),
    },
  })
}

export function addProductionOutput(
  tenantId: string,
  productionOrderId: string,
  input: {
    lineNo: number
    productId: string
    variantId?: string | null
    toLocationId: string
    uomId: string
    quantity: Prisma.Decimal | string | number
    unitCost: Prisma.Decimal | string | number
    lotId?: string | null
  },
  client: PrismaClientLike = prisma
) {
  return client.productionOutput.create({
    data: {
      tenantId,
      productionOrderId,
      lineNo: input.lineNo,
      productId: input.productId,
      variantId: input.variantId ?? null,
      toLocationId: input.toLocationId,
      uomId: input.uomId,
      quantity: input.quantity,
      unitCost: input.unitCost,
      lotId: input.lotId ?? null,
    },
  })
}

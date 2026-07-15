import { prisma } from '#/server/db/client'
import type { BomStatus, Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface BomComponentInput {
  componentProductId: string
  componentVariantId?: string | null
  quantity: Prisma.Decimal | string | number
  uomId: string
  scrapPercent?: Prisma.Decimal | string | number
  notes?: string | null
}

export interface BomCreateInput {
  productId: string
  variantId?: string | null
  name: string
  version?: number
  isDefault?: boolean
  outputQty: Prisma.Decimal | string | number
  uomId: string
  overheadCost?: Prisma.Decimal | string | number
  notes?: string | null
  components: Array<BomComponentInput>
}

const bomWithComponents = {
  components: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.BillOfMaterialsInclude

export type BomWithComponents = Prisma.BillOfMaterialsGetPayload<{
  include: typeof bomWithComponents
}>

export function findBomById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<BomWithComponents | null> {
  return client.billOfMaterials.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: bomWithComponents,
  })
}

export function listBoms(
  tenantId: string,
  filters: { productId?: string; status?: BomStatus; take?: number } = {},
  client: PrismaClientLike = prisma
): Promise<Array<BomWithComponents>> {
  return client.billOfMaterials.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: bomWithComponents,
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createBom(
  tenantId: string,
  input: BomCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.billOfMaterials.create({
    data: {
      tenantId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      name: input.name,
      version: input.version ?? 1,
      isDefault: input.isDefault ?? false,
      outputQty: input.outputQty,
      uomId: input.uomId,
      overheadCost: input.overheadCost ?? 0,
      notes: input.notes ?? null,
      components: {
        create: input.components.map((component, index) => ({
          tenantId,
          lineNo: index + 1,
          componentProductId: component.componentProductId,
          componentVariantId: component.componentVariantId ?? null,
          quantity: component.quantity,
          uomId: component.uomId,
          scrapPercent: component.scrapPercent ?? 0,
          notes: component.notes ?? null,
        })),
      },
    },
    include: bomWithComponents,
  })
}

export async function updateBomStatus(
  tenantId: string,
  id: string,
  status: BomStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.billOfMaterials.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { status },
  })

  return result.count > 0
}

import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface RfqItemInput {
  productId: string
  variantId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  requiredDate?: Date | null
  specification?: string | null
  notes?: string | null
}

export interface RfqCreateInput {
  documentNumber: string
  title?: string | null
  requisitionId?: string | null
  warehouseId?: string | null
  currencyCode?: string
  expiryDate?: Date | null
  buyerProfileId?: string | null
  notes?: string | null
  createdBy?: string | null
  items: Array<RfqItemInput>
  supplierIds: Array<string>
}

const rfqInclude = {
  items: { orderBy: { lineNo: 'asc' } },
  suppliers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PodRfqInclude

export type RfqWithRelations = Prisma.PodRfqGetPayload<{
  include: typeof rfqInclude
}>

export function findRfqById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<RfqWithRelations | null> {
  return client.podRfq.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: rfqInclude,
  })
}

export function listRfqs(
  tenantId: string,
  options: { statusCode?: string; supplierId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podRfq.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.supplierId
        ? { suppliers: { some: { supplierId: options.supplierId } } }
        : {}),
    },
    include: rfqInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export function createRfq(
  tenantId: string,
  input: RfqCreateInput,
  client: PrismaClientLike = prisma,
): Promise<RfqWithRelations> {
  const now = new Date()

  return client.podRfq.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      title: input.title ?? null,
      requisitionId: input.requisitionId ?? null,
      warehouseId: input.warehouseId ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      expiryDate: input.expiryDate ?? null,
      buyerProfileId: input.buyerProfileId ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      items: {
        create: input.items.map((item, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: item.productId,
          variantId: item.variantId ?? null,
          uomId: item.uomId,
          quantity: item.quantity,
          requiredDate: item.requiredDate ?? null,
          specification: item.specification ?? null,
          notes: item.notes ?? null,
        })),
      },
      suppliers: {
        create: input.supplierIds.map((supplierId) => ({
          tenantId,
          supplierId,
          invitedAt: now,
        })),
      },
    },
    include: rfqInclude,
  })
}

// Revision replaces the item set and bumps the revision counter; the BEFORE
// UPDATE trigger on pod_rfqs bumps version_number/updated_at automatically.
export async function reviseRfq(
  tenantId: string,
  id: string,
  input: {
    title?: string | null
    expiryDate?: Date | null
    notes?: string | null
    updatedBy?: string | null
    items: Array<RfqItemInput>
  },
  client: PrismaClientLike = prisma,
): Promise<RfqWithRelations | null> {
  const existing = await client.podRfq.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { revision: true },
  })

  if (!existing) {
    return null
  }

  await client.podRfqItem.deleteMany({ where: { tenantId, rfqId: id } })

  return client.podRfq.update({
    where: { id },
    data: {
      revision: existing.revision + 1,
      ...(input.title !== undefined ? { title: input.title ?? null } : {}),
      ...(input.expiryDate !== undefined
        ? { expiryDate: input.expiryDate ?? null }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      updatedBy: input.updatedBy ?? null,
      items: {
        create: input.items.map((item, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: item.productId,
          variantId: item.variantId ?? null,
          uomId: item.uomId,
          quantity: item.quantity,
          requiredDate: item.requiredDate ?? null,
          specification: item.specification ?? null,
          notes: item.notes ?? null,
        })),
      },
    },
    include: rfqInclude,
  })
}

export async function updateRfqStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  extra: {
    awardedSupplierId?: string | null
    awardedQuotationId?: string | null
    updatedBy?: string | null
  } = {},
  client: PrismaClientLike = prisma,
) {
  const result = await client.podRfq.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      ...(extra.awardedSupplierId !== undefined
        ? { awardedSupplierId: extra.awardedSupplierId }
        : {}),
      ...(extra.awardedQuotationId !== undefined
        ? { awardedQuotationId: extra.awardedQuotationId }
        : {}),
      ...(extra.updatedBy !== undefined ? { updatedBy: extra.updatedBy } : {}),
    },
  })

  return result.count > 0
}

export async function updateRfqSupplierStatus(
  tenantId: string,
  rfqId: string,
  supplierId: string,
  statusCode: string,
  extra: { respondedAt?: Date | null } = {},
  client: PrismaClientLike = prisma,
) {
  const result = await client.podRfqSupplier.updateMany({
    where: { tenantId, rfqId, supplierId },
    data: {
      statusCode,
      ...(extra.respondedAt !== undefined
        ? { respondedAt: extra.respondedAt }
        : {}),
    },
  })

  return result.count > 0
}

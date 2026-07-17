import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface LandedCostChargeInput {
  costTypeId?: string | null
  description?: string | null
  amount: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number | null
  supplierId?: string | null
}

export interface LandedCostVoucherCreateInput {
  documentNumber: string
  goodsReceiptId?: string | null
  purchaseOrderId?: string | null
  supplierInvoiceId?: string | null
  allocationBasis?: string
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | string | number | null
  notes?: string | null
  createdBy?: string | null
  charges: Array<LandedCostChargeInput>
}

export interface LandedCostAllocationRowInput {
  goodsReceiptLineId?: string | null
  purchaseOrderLineId?: string | null
  productId?: string | null
  basisValue: Prisma.Decimal | string | number
  allocatedAmount: Prisma.Decimal | string | number
}

const voucherInclude = {
  charges: { orderBy: { lineNo: 'asc' } },
  allocations: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PodLandedCostVoucherInclude

export type LandedCostVoucherWithRelations =
  Prisma.PodLandedCostVoucherGetPayload<{
    include: typeof voucherInclude
  }>

export function findVoucherById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<LandedCostVoucherWithRelations | null> {
  return client.podLandedCostVoucher.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: voucherInclude,
  })
}

export function listVouchers(
  tenantId: string,
  options: { statusCode?: string; goodsReceiptId?: string; take?: number } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podLandedCostVoucher.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.goodsReceiptId
        ? { goodsReceiptId: options.goodsReceiptId }
        : {}),
    },
    include: voucherInclude,
    orderBy: { createdAt: 'desc' },
    take: options.take ?? 100,
  })
}

export function createVoucher(
  tenantId: string,
  input: LandedCostVoucherCreateInput,
  client: PrismaClientLike = prisma,
): Promise<LandedCostVoucherWithRelations> {
  return client.podLandedCostVoucher.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      goodsReceiptId: input.goodsReceiptId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      supplierInvoiceId: input.supplierInvoiceId ?? null,
      allocationBasis: input.allocationBasis ?? 'value',
      currencyCode: input.currencyCode ?? 'USD',
      exchangeRate: input.exchangeRate ?? 1,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
      charges: {
        create: input.charges.map((charge, index) => ({
          tenantId,
          lineNo: index + 1,
          costTypeId: charge.costTypeId ?? null,
          description: charge.description ?? null,
          amount: charge.amount,
          taxAmount: charge.taxAmount ?? 0,
          supplierId: charge.supplierId ?? null,
        })),
      },
    },
    include: voucherInclude,
  })
}

// Allocation rows are derived data — replaced wholesale on every (re-)allocate.
export async function replaceAllocations(
  tenantId: string,
  voucherId: string,
  rows: Array<LandedCostAllocationRowInput>,
  client: PrismaClientLike = prisma,
) {
  await client.podLandedCostAllocation.deleteMany({
    where: { tenantId, voucherId },
  })

  if (rows.length === 0) {
    return
  }

  await client.podLandedCostAllocation.createMany({
    data: rows.map((row) => ({
      tenantId,
      voucherId,
      goodsReceiptLineId: row.goodsReceiptLineId ?? null,
      purchaseOrderLineId: row.purchaseOrderLineId ?? null,
      productId: row.productId ?? null,
      basisValue: row.basisValue,
      allocatedAmount: row.allocatedAmount,
    })),
  })
}

export async function updateVoucherStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podLandedCostVoucher.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { statusCode, updatedBy },
  })

  return result.count > 0
}

export async function markVoucherPosted(
  tenantId: string,
  id: string,
  postedByProfileId: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podLandedCostVoucher.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode: 'posted',
      isPosted: true,
      postedAt: new Date(),
      postedByProfileId,
      updatedBy: postedByProfileId,
    },
  })

  return result.count > 0
}

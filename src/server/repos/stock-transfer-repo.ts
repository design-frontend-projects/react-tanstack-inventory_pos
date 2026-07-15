import { prisma } from '#/server/db/client'
import type { Prisma, TransferStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface TransferLineInput {
  productId: string
  variantId?: string | null
  fromLocationId: string
  toLocationId: string
  uomId: string
  requestedQty: Prisma.Decimal | string | number
  lotId?: string | null
  serialId?: string | null
}

export interface TransferCreateInput {
  documentNumber: string
  fromWarehouseId: string
  toWarehouseId: string
  notes?: string | null
  createdByProfileId?: string | null
  lines: Array<TransferLineInput>
}

const transferWithLines = {
  lines: { orderBy: { lineNo: 'asc' } },
} satisfies Prisma.StockTransferInclude

export type TransferWithLines = Prisma.StockTransferGetPayload<{
  include: typeof transferWithLines
}>

export function findTransferById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
): Promise<TransferWithLines | null> {
  return client.stockTransfer.findFirst({
    where: { id, tenantId },
    include: transferWithLines,
  })
}

export function listTransfers(
  tenantId: string,
  filters: { status?: TransferStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.stockTransfer.findMany({
    where: { tenantId, ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createTransfer(
  tenantId: string,
  input: TransferCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.stockTransfer.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          uomId: line.uomId,
          requestedQty: line.requestedQty,
          lotId: line.lotId ?? null,
          serialId: line.serialId ?? null,
        })),
      },
    },
    include: transferWithLines,
  })
}

export async function updateTransferStatus(
  tenantId: string,
  id: string,
  status: TransferStatus,
  extra: Partial<{
    shipDate: Date
    receiveDate: Date
    shippedByProfileId: string
    receivedByProfileId: string
  }> = {},
  client: PrismaClientLike = prisma
) {
  const result = await client.stockTransfer.updateMany({
    where: { id, tenantId },
    data: { status, ...extra },
  })

  return result.count > 0
}

export function setLineShippedQty(
  lineId: string,
  shippedQty: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.stockTransferLine.update({
    where: { id: lineId },
    data: { shippedQty },
  })
}

export function setLineReceivedQty(
  lineId: string,
  receivedQty: Prisma.Decimal | string | number,
  client: PrismaClientLike = prisma
) {
  return client.stockTransferLine.update({
    where: { id: lineId },
    data: { receivedQty },
  })
}

import { prisma } from '#/server/db/client'
import type {
  Prisma,
  StockCountStatus,
} from '#/server/db/generated/prisma/client'

type PrismaClientLike = Prisma.TransactionClient | typeof prisma

export interface StockCountLineInput {
  productId: string
  variantId?: string | null
  locationId: string
  lotId?: string | null
  serialId?: string | null
  uomId: string
  systemQty: Prisma.Decimal | string | number
  unitCost?: Prisma.Decimal | string | number | null
  notes?: string | null
}

export interface CreateStockCountInput {
  documentNumber: string
  warehouseId: string
  isCycleCount?: boolean
  notes?: string | null
  createdByProfileId?: string | null
  lines: Array<StockCountLineInput>
}

export function createStockCount(
  tenantId: string,
  input: CreateStockCountInput,
  client: PrismaClientLike = prisma,
) {
  return client.stockCountSession.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      warehouseId: input.warehouseId,
      isCycleCount: input.isCycleCount ?? false,
      notes: input.notes ?? null,
      createdByProfileId: input.createdByProfileId ?? null,
      lines: {
        create: input.lines.map((line, index) => ({
          tenantId,
          lineNo: index + 1,
          productId: line.productId,
          variantId: line.variantId ?? null,
          locationId: line.locationId,
          lotId: line.lotId ?? null,
          serialId: line.serialId ?? null,
          uomId: line.uomId,
          systemQty: line.systemQty,
          unitCost: line.unitCost ?? null,
          notes: line.notes ?? null,
        })),
      },
    },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
}

export function listStockCounts(
  tenantId: string,
  filters: {
    status?: StockCountStatus
    warehouseId?: string
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.stockCountSession.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function findStockCountById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.stockCountSession.findFirst({
    where: { tenantId, id },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
}

export function updateStockCountStatus(
  tenantId: string,
  id: string,
  status: StockCountStatus,
  extra: Prisma.StockCountSessionUpdateInput = {},
  client: PrismaClientLike = prisma,
) {
  return client.stockCountSession.update({
    where: { id, tenantId },
    data: { status, ...extra },
  })
}

// Counted quantities arrive as a bulk edit from the count-entry grid; each line
// is updated individually so partial saves never clobber untouched lines.
export async function recordCountedQuantities(
  tenantId: string,
  sessionId: string,
  entries: Array<{
    lineId: string
    countedQty: string | number
    notes?: string | null
  }>,
  client: PrismaClientLike = prisma,
) {
  const countedAt = new Date()

  for (const entry of entries) {
    await client.stockCountLine.updateMany({
      where: { id: entry.lineId, tenantId, sessionId },
      data: {
        countedQty: entry.countedQty,
        countedAt,
        ...(entry.notes === undefined ? {} : { notes: entry.notes }),
      },
    })
  }
}

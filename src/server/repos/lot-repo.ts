import { prisma } from '#/server/db/client'
import type {
  LotStatus,
  Prisma,
  SourceDocType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface LotCreateInput {
  productId: string
  variantId?: string | null
  lotNumber: string
  manufactureDate?: Date | null
  expiryDate?: Date | null
  receivedDate?: Date | null
  supplierId?: string | null
  initialQty?: Prisma.Decimal | string | number
  sourceDocType?: SourceDocType | null
  sourceDocId?: string | null
  notes?: string | null
}

export function findLotById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.lot.findFirst({ where: { id, tenantId } })
}

export function findLotByNumber(
  tenantId: string,
  productId: string,
  lotNumber: string,
  client: PrismaClientLike = prisma
) {
  return client.lot.findFirst({ where: { tenantId, productId, lotNumber } })
}

export function createLot(
  tenantId: string,
  input: LotCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.lot.create({
    data: {
      tenantId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      lotNumber: input.lotNumber,
      manufactureDate: input.manufactureDate ?? null,
      expiryDate: input.expiryDate ?? null,
      receivedDate: input.receivedDate ?? null,
      supplierId: input.supplierId ?? null,
      initialQty: input.initialQty ?? 0,
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
      notes: input.notes ?? null,
    },
  })
}

export function listLots(
  tenantId: string,
  filters: { productId?: string; status?: LotStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.lot.findMany({
    where: {
      tenantId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    take: filters.take ?? 100,
  })
}

// Active lots for a product ordered nearest-expiry-first — the FEFO candidate
// list. Lots with no expiry sort last (Prisma nulls-last on asc).
export function listActiveLotsFefo(
  tenantId: string,
  productId: string,
  client: PrismaClientLike = prisma
) {
  return client.lot.findMany({
    where: { tenantId, productId, status: 'ACTIVE' },
    orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  })
}

export function findExpiredLots(
  tenantId: string,
  now: Date,
  take = 200,
  client: PrismaClientLike = prisma
) {
  return client.lot.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'QUARANTINE'] },
      expiryDate: { not: null, lt: now },
    },
    take,
  })
}

export async function updateLotStatus(
  id: string,
  status: LotStatus,
  client: PrismaClientLike = prisma
) {
  await client.lot.update({ where: { id }, data: { status } })
}

import { prisma } from '#/server/db/client'
import type {
  Prisma,
  ReservationStatus,
  ReservationType,
  SourceDocType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface StockReservationCreateInput {
  reservationType: ReservationType
  productId: string
  variantId?: string | null
  warehouseId: string
  locationId: string
  lotId?: string | null
  serialId?: string | null
  uomId: string
  quantity: Prisma.Decimal | string | number
  sourceDocType?: SourceDocType | null
  sourceDocId?: string | null
  sourceDocLineId?: string | null
  sourceDocNumber?: string | null
  expiresAt?: Date | null
  reservedByProfileId?: string | null
  notes?: string | null
}

export function createReservation(
  tenantId: string,
  input: StockReservationCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.create({
    data: {
      tenantId,
      reservationType: input.reservationType,
      productId: input.productId,
      variantId: input.variantId ?? null,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      lotId: input.lotId ?? null,
      serialId: input.serialId ?? null,
      uomId: input.uomId,
      quantity: input.quantity,
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
      sourceDocLineId: input.sourceDocLineId ?? null,
      sourceDocNumber: input.sourceDocNumber ?? null,
      expiresAt: input.expiresAt ?? null,
      reservedByProfileId: input.reservedByProfileId ?? null,
      notes: input.notes ?? null,
    },
  })
}

export function findReservationById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.findFirst({ where: { id, tenantId } })
}

// Active (or partially fulfilled) holds still consuming `reserved` — used to
// release or convert holds when a source document is fulfilled or cancelled.
export function findOpenReservationsForSource(
  tenantId: string,
  sourceDocId: string,
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.findMany({
    where: {
      tenantId,
      sourceDocId,
      status: { in: ['ACTIVE', 'PARTIALLY_FULFILLED'] },
    },
  })
}

export function findOpenReservationsForSourceLine(
  tenantId: string,
  sourceDocLineId: string,
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.findMany({
    where: {
      tenantId,
      sourceDocLineId,
      status: { in: ['ACTIVE', 'PARTIALLY_FULFILLED'] },
    },
  })
}

export function listReservations(
  tenantId: string,
  filters: { status?: ReservationStatus; productId?: string; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 100,
  })
}

// Active holds whose expiry has lapsed (candidates for the release sweep).
export function findExpiredReservations(
  tenantId: string,
  now: Date,
  take = 200,
  client: PrismaClientLike = prisma
) {
  return client.stockReservation.findMany({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'PARTIALLY_FULFILLED'] },
      expiresAt: { not: null, lt: now },
    },
    take,
  })
}

export async function updateReservation(
  id: string,
  data: {
    status?: ReservationStatus
    fulfilledQty?: Prisma.Decimal | string | number
    releasedQty?: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  await client.stockReservation.update({
    where: { id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.fulfilledQty !== undefined ? { fulfilledQty: data.fulfilledQty } : {}),
      ...(data.releasedQty !== undefined ? { releasedQty: data.releasedQty } : {}),
    },
  })
}

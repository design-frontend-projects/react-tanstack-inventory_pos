import { prisma } from '#/server/db/client'
import type {
  SerialStatus,
  SourceDocType,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SerialCreateInput {
  productId: string
  variantId?: string | null
  serialNumber: string
  status?: SerialStatus
  currentWarehouseId?: string | null
  currentLocationId?: string | null
  lotId?: string | null
  supplierId?: string | null
  warrantyExpiresAt?: Date | null
  sourceDocType?: SourceDocType | null
  sourceDocId?: string | null
}

export function findSerialById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.serialNumber.findFirst({ where: { id, tenantId } })
}

export function findSerialByNumber(
  tenantId: string,
  productId: string,
  serialNumber: string,
  client: PrismaClientLike = prisma
) {
  return client.serialNumber.findFirst({ where: { tenantId, productId, serialNumber } })
}

export function createSerial(
  tenantId: string,
  input: SerialCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.serialNumber.create({
    data: {
      tenantId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      serialNumber: input.serialNumber,
      status: input.status ?? 'IN_STOCK',
      currentWarehouseId: input.currentWarehouseId ?? null,
      currentLocationId: input.currentLocationId ?? null,
      lotId: input.lotId ?? null,
      supplierId: input.supplierId ?? null,
      warrantyExpiresAt: input.warrantyExpiresAt ?? null,
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
    },
  })
}

export function listSerials(
  tenantId: string,
  filters: {
    productId?: string
    status?: SerialStatus
    currentLocationId?: string
    take?: number
  } = {},
  client: PrismaClientLike = prisma
) {
  return client.serialNumber.findMany({
    where: {
      tenantId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.currentLocationId ? { currentLocationId: filters.currentLocationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.take ?? 100,
  })
}

// Advances a serial's lifecycle state and (optionally) its current location as it
// moves through the ledger. `soldAt` is stamped when the serial is sold.
export async function updateSerialState(
  id: string,
  data: {
    status: SerialStatus
    currentWarehouseId?: string | null
    currentLocationId?: string | null
    soldAt?: Date | null
  },
  client: PrismaClientLike = prisma
) {
  await client.serialNumber.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.currentWarehouseId !== undefined
        ? { currentWarehouseId: data.currentWarehouseId }
        : {}),
      ...(data.currentLocationId !== undefined
        ? { currentLocationId: data.currentLocationId }
        : {}),
      ...(data.soldAt !== undefined ? { soldAt: data.soldAt } : {}),
    },
  })
}

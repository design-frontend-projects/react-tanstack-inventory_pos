import { prisma } from '#/server/db/client'
import type { Prisma, PosSessionStatus } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface SessionCreateInput {
  registerId: string
  cashierProfileId: string
  warehouseId?: string | null
  openingFloat?: Prisma.Decimal | string | number
}

export function findSessionById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.posSession.findFirst({ where: { id, tenantId } })
}

export function listSessions(
  tenantId: string,
  filters: { status?: PosSessionStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.posSession.findMany({
    where: { tenantId, ...(filters.status ? { status: filters.status } : {}) },
    orderBy: { openedAt: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createSession(
  tenantId: string,
  input: SessionCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.posSession.create({
    data: {
      tenantId,
      registerId: input.registerId,
      cashierProfileId: input.cashierProfileId,
      warehouseId: input.warehouseId ?? null,
      openingFloat: input.openingFloat ?? 0,
    },
  })
}

export async function closeSession(
  tenantId: string,
  id: string,
  data: {
    closingCash: Prisma.Decimal | string | number
    expectedCash: Prisma.Decimal | string | number
    variance: Prisma.Decimal | string | number
  },
  client: PrismaClientLike = prisma
) {
  const result = await client.posSession.updateMany({
    where: { id, tenantId, status: 'OPEN' },
    data: {
      status: 'CLOSED',
      closingCash: data.closingCash,
      expectedCash: data.expectedCash,
      variance: data.variance,
      closedAt: new Date(),
    },
  })

  return result.count > 0
}

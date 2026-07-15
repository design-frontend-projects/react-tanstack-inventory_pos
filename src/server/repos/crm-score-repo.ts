import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Model-agnostic prediction store. Producers upsert one row per
// (tenant, customer, scoreType); the churn heuristic is the first producer,
// future ML pipelines write the same shape.

export interface ScoreUpsertInput {
  scoreType: string
  score?: Prisma.Decimal | string | number | null
  payloadJson?: Prisma.InputJsonValue | null
  modelName: string
  modelVersion: string
  featuresJson?: Prisma.InputJsonValue | null
  computedAt?: Date
}

export function upsertScore(
  tenantId: string,
  customerId: string,
  input: ScoreUpsertInput,
  client: PrismaClientLike = prisma
) {
  const data = {
    score: input.score ?? null,
    payloadJson: input.payloadJson ?? undefined,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    featuresJson: input.featuresJson ?? undefined,
    computedAt: input.computedAt ?? new Date(),
  }

  return client.crmCustomerScore.upsert({
    where: {
      tenantId_customerId_scoreType: {
        tenantId,
        customerId,
        scoreType: input.scoreType,
      },
    },
    create: { tenantId, customerId, scoreType: input.scoreType, ...data },
    update: data,
  })
}

export function listScoresForCustomer(
  tenantId: string,
  customerId: string,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerScore.findMany({
    where: { tenantId, customerId },
    orderBy: { scoreType: 'asc' },
  })
}

export function listTopByScoreType(
  tenantId: string,
  scoreType: string,
  take = 25,
  client: PrismaClientLike = prisma
) {
  return client.crmCustomerScore.findMany({
    where: { tenantId, scoreType },
    orderBy: { score: 'desc' },
    take: Math.min(take, 200),
  })
}

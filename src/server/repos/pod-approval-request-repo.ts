import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ApprovalRequestCreateInput {
  workflowId?: string | null
  entityType: string
  entityId: string
  statusCode?: string
  currentStepOrder?: number
  amount?: Prisma.Decimal | string | number | null
  currencyCode?: string | null
  requestedByProfileId?: string | null
}

export interface ApprovalActionInput {
  stepOrder: number
  actionCode: string
  actorProfileId?: string | null
  delegatedToProfileId?: string | null
  comment?: string | null
}

const requestInclude = {
  actions: { orderBy: { actedAt: 'asc' } },
} satisfies Prisma.PodApprovalRequestInclude

export type ApprovalRequestWithActions = Prisma.PodApprovalRequestGetPayload<{
  include: typeof requestInclude
}>

export function findRequestById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<ApprovalRequestWithActions | null> {
  return client.podApprovalRequest.findFirst({
    where: { id, tenantId },
    include: requestInclude,
  })
}

export function findRequestForEntity(
  tenantId: string,
  entityType: string,
  entityId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podApprovalRequest.findFirst({
    where: {
      tenantId,
      entityType,
      entityId,
      statusCode: { in: ['pending', 'escalated'] },
    },
    include: requestInclude,
    orderBy: { requestedAt: 'desc' },
  })
}

export function listRequests(
  tenantId: string,
  options: { statusCode?: string; entityType?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podApprovalRequest.findMany({
    where: {
      tenantId,
      ...(options.statusCode ? { statusCode: options.statusCode } : {}),
      ...(options.entityType ? { entityType: options.entityType } : {}),
    },
    include: requestInclude,
    orderBy: { requestedAt: 'desc' },
  })
}

export function createRequest(
  tenantId: string,
  input: ApprovalRequestCreateInput,
  client: PrismaClientLike = prisma,
): Promise<ApprovalRequestWithActions> {
  return client.podApprovalRequest.create({
    data: {
      tenantId,
      workflowId: input.workflowId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      statusCode: input.statusCode ?? 'pending',
      currentStepOrder: input.currentStepOrder ?? 1,
      amount: input.amount ?? null,
      currencyCode: input.currencyCode ?? null,
      requestedByProfileId: input.requestedByProfileId ?? null,
    },
    include: requestInclude,
  })
}

export async function updateRequest(
  tenantId: string,
  id: string,
  data: {
    statusCode?: string
    currentStepOrder?: number
    completedAt?: Date | null
  },
  client: PrismaClientLike = prisma,
) {
  const result = await client.podApprovalRequest.updateMany({
    where: { id, tenantId },
    data: {
      ...(data.statusCode !== undefined ? { statusCode: data.statusCode } : {}),
      ...(data.currentStepOrder !== undefined
        ? { currentStepOrder: data.currentStepOrder }
        : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
    },
  })

  return result.count > 0
}

export function recordAction(
  tenantId: string,
  requestId: string,
  input: ApprovalActionInput,
  client: PrismaClientLike = prisma,
) {
  return client.podApprovalAction.create({
    data: {
      tenantId,
      requestId,
      stepOrder: input.stepOrder,
      actionCode: input.actionCode,
      actorProfileId: input.actorProfileId ?? null,
      delegatedToProfileId: input.delegatedToProfileId ?? null,
      comment: input.comment ?? null,
    },
  })
}

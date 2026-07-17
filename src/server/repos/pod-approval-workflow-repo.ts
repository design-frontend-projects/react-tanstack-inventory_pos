import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface WorkflowStepInput {
  stepOrder: number
  name: string
  approverRoleCode?: string | null
  approverProfileId?: string | null
  minAmount?: Prisma.Decimal | string | number | null
  condition?: Prisma.InputJsonValue | null
  isFinal?: boolean
  allowDelegate?: boolean
  escalateAfterHours?: number | null
}

export interface WorkflowWriteInput {
  code: string
  name: string
  entityType: string
  minAmount?: Prisma.Decimal | string | number | null
  maxAmount?: Prisma.Decimal | string | number | null
  currencyCode?: string | null
  autoApprove?: boolean
  notes?: string | null
  isActive?: boolean
  steps: Array<WorkflowStepInput>
}

const workflowInclude = {
  steps: { orderBy: { stepOrder: 'asc' } },
} satisfies Prisma.PodApprovalWorkflowInclude

export type WorkflowWithSteps = Prisma.PodApprovalWorkflowGetPayload<{
  include: typeof workflowInclude
}>

export function listWorkflows(
  tenantId: string,
  options: { entityType?: string; includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.podApprovalWorkflow.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(options.entityType ? { entityType: options.entityType } : {}),
      ...(options.includeInactive ? {} : { isActive: true }),
    },
    include: workflowInclude,
    orderBy: { code: 'asc' },
  })
}

export function findWorkflowById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
): Promise<WorkflowWithSteps | null> {
  return client.podApprovalWorkflow.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: workflowInclude,
  })
}

function stepData(tenantId: string, steps: Array<WorkflowStepInput>) {
  return steps.map((step) => ({
    tenantId,
    stepOrder: step.stepOrder,
    name: step.name,
    approverRoleCode: step.approverRoleCode ?? null,
    approverProfileId: step.approverProfileId ?? null,
    minAmount: step.minAmount ?? null,
    condition: step.condition ?? Prisma.DbNull,
    isFinal: step.isFinal ?? false,
    allowDelegate: step.allowDelegate ?? true,
    escalateAfterHours: step.escalateAfterHours ?? null,
  }))
}

export function createWorkflow(
  tenantId: string,
  input: WorkflowWriteInput,
  client: PrismaClientLike = prisma,
): Promise<WorkflowWithSteps> {
  return client.podApprovalWorkflow.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      entityType: input.entityType,
      minAmount: input.minAmount ?? null,
      maxAmount: input.maxAmount ?? null,
      currencyCode: input.currencyCode ?? null,
      autoApprove: input.autoApprove ?? false,
      notes: input.notes ?? null,
      isActive: input.isActive ?? true,
      steps: { create: stepData(tenantId, input.steps) },
    },
    include: workflowInclude,
  })
}

// Replaces the whole step set on update so the workflow definition stays a
// single edit surface.
export async function updateWorkflow(
  tenantId: string,
  id: string,
  input: Partial<WorkflowWriteInput>,
  client: PrismaClientLike = prisma,
): Promise<WorkflowWithSteps | null> {
  const existing = await client.podApprovalWorkflow.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  })

  if (!existing) {
    return null
  }

  if (input.steps) {
    await client.podApprovalWorkflowStep.deleteMany({
      where: { tenantId, workflowId: id },
    })
  }

  return client.podApprovalWorkflow.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.entityType !== undefined
        ? { entityType: input.entityType }
        : {}),
      ...(input.minAmount !== undefined
        ? { minAmount: input.minAmount ?? null }
        : {}),
      ...(input.maxAmount !== undefined
        ? { maxAmount: input.maxAmount ?? null }
        : {}),
      ...(input.currencyCode !== undefined
        ? { currencyCode: input.currencyCode ?? null }
        : {}),
      ...(input.autoApprove !== undefined
        ? { autoApprove: input.autoApprove }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.steps
        ? { steps: { create: stepData(tenantId, input.steps) } }
        : {}),
    },
    include: workflowInclude,
  })
}

export async function softDeleteWorkflow(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.podApprovalWorkflow.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })

  return result.count > 0
}

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { appendDomainEvent } from '#/server/events/event-outbox'
import {
  notify,
  resolveStepRecipients,
} from '#/server/notifications/notification-service'
import { syncHrDocumentStatus } from '#/server/hr/approval-sync'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as workflowRepo from '#/server/repos/pod-approval-workflow-repo'
import * as requestRepo from '#/server/repos/pod-approval-request-repo'
import * as invoiceRepo from '#/server/repos/pod-supplier-invoice-repo'
import * as paymentRepo from '#/server/repos/pod-supplier-payment-repo'
import * as poRepo from '#/server/repos/purchase-order-repo'
import {
  serializeApprovalRequest,
  serializeWorkflow,
} from '#/server/purchasing/approval-dto'
import {
  applicableSteps,
  findStep,
  isEligibleApprover,
  nextStepOrder,
  selectWorkflow,
  shouldAutoApprove,
} from '#/server/purchasing/approval-routing'
import type { RoutableWorkflow } from '#/server/purchasing/approval-routing'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

// The single place where an approval decision syncs the owning document's own
// status. Kept here (not in each document service) so the side effect is
// auditable in one spot; entity types are added as later phases wire in.
async function applyApprovalToDocument(
  tenantId: string,
  entityType: string,
  entityId: string,
  outcome: 'approved' | 'rejected',
  actorProfileId: string,
  tx: PrismaClientLike,
): Promise<void> {
  if (entityType === 'purchase_order') {
    await poRepo.updatePurchaseOrderStatus(
      tenantId,
      entityId,
      outcome === 'approved' ? 'APPROVED' : 'REJECTED',
      outcome === 'approved' ? { approvedByProfileId: actorProfileId } : {},
      tx,
    )
  }

  if (entityType === 'supplier_invoice') {
    // The invoice lifecycle has no 'rejected' status — a rejection returns the
    // document to draft (pending_approval -> draft is a seeded transition).
    await invoiceRepo.updateInvoiceStatus(
      tenantId,
      entityId,
      outcome === 'approved' ? 'approved' : 'draft',
      { updatedBy: actorProfileId },
      tx,
    )
  }

  if (entityType === 'supplier_payment') {
    // Same shape as invoices: no 'rejected' status — rejection returns the
    // payment to draft for correction or cancellation.
    await paymentRepo.updatePaymentStatus(
      tenantId,
      entityId,
      outcome === 'approved' ? 'approved' : 'draft',
      actorProfileId,
      tx,
    )
  }

  // HR documents (loans, advances, payroll runs, expense/travel, promotions,
  // offers, timesheets, overtime, workforce/budget plans) route through the
  // same generic engine; the HR module owns their status mapping.
  await syncHrDocumentStatus(tenantId, entityType, entityId, outcome, actorProfileId, tx)
  // Future: 'purchase_requisition' lands in its phase.
}

function toRoutable(
  workflow: workflowRepo.WorkflowWithSteps,
): RoutableWorkflow {
  return {
    id: workflow.id,
    entityType: workflow.entityType,
    minAmount: workflow.minAmount?.toString() ?? null,
    maxAmount: workflow.maxAmount?.toString() ?? null,
    autoApprove: workflow.autoApprove,
    isActive: workflow.isActive,
    steps: workflow.steps.map((step) => ({
      stepOrder: step.stepOrder,
      approverRoleCode: step.approverRoleCode,
      approverProfileId: step.approverProfileId,
      minAmount: step.minAmount?.toString() ?? null,
      isFinal: step.isFinal,
      allowDelegate: step.allowDelegate,
    })),
  }
}

export interface OpenApprovalInput {
  entityType: string
  entityId: string
  amount?: string | number | null
  currencyCode?: string | null
}

export interface OpenApprovalResult {
  requestId: string | null
  statusCode: 'approved' | 'pending'
  workflowId: string | null
}

// Opens an approval request for a document. Returns immediately-approved when no
// workflow matches or the matched workflow auto-approves — so callers can gate
// their own status transition on `statusCode`. Runs inside the caller's tx so
// the request and the document's status change commit together.
export async function openApprovalRequest(
  context: CurrentUserContext,
  tenantId: string,
  tx: PrismaClientLike,
  input: OpenApprovalInput,
): Promise<OpenApprovalResult> {
  const amount =
    input.amount === null || input.amount === undefined
      ? 0
      : Number(input.amount)
  const workflows = await workflowRepo.listWorkflows(
    tenantId,
    { entityType: input.entityType },
    tx,
  )

  const workflow = selectWorkflow(
    workflows.map(toRoutable),
    input.entityType,
    amount,
  )

  if (!workflow || shouldAutoApprove(workflow, amount)) {
    return {
      requestId: null,
      statusCode: 'approved',
      workflowId: workflow?.id ?? null,
    }
  }

  const steps = applicableSteps(workflow, amount)
  const request = await requestRepo.createRequest(
    tenantId,
    {
      workflowId: workflow.id,
      entityType: input.entityType,
      entityId: input.entityId,
      statusCode: 'pending',
      currentStepOrder: steps[0].stepOrder,
      amount: input.amount ?? null,
      currencyCode: input.currencyCode ?? null,
      requestedByProfileId: context.profileId,
    },
    tx,
  )

  await appendDomainEvent(tx, {
    tenantId,
    eventType: 'purchase_approval.decided',
    aggregateType: 'pod_approval_request',
    aggregateId: request.id,
    actorProfileId: context.profileId,
    payload: {
      requestId: request.id,
      entityType: input.entityType,
      entityId: input.entityId,
      statusCode: 'pending',
      actorProfileId: context.profileId,
    },
  })

  // Alert the first step's approvers (role members or the named profile).
  await notify(
    tx,
    tenantId,
    await resolveStepRecipients(tenantId, steps[0], tx),
    context.profileId,
    {
      eventType: 'approval.requested',
      title: `Approval requested: ${input.entityType.replace(/_/g, ' ')}`,
      body: input.amount
        ? `Amount ${input.amount} ${input.currencyCode ?? ''}`.trim()
        : null,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  )

  return {
    requestId: request.id,
    statusCode: 'pending',
    workflowId: workflow.id,
  }
}

export type ApprovalAction = 'approve' | 'reject' | 'delegate' | 'escalate'

export interface ActOnApprovalInput {
  action: ApprovalAction
  comment?: string | null
  delegateToProfileId?: string | null
}

export interface ApprovalDecision {
  request: ReturnType<typeof serializeApprovalRequest>
  outcome: 'approved' | 'rejected' | 'pending' | 'escalated'
}

// Records an approver's decision on the current step and advances the request.
// Approvals walk the applicable steps; the final step's approval completes the
// request. Reject / escalate are terminal-ish transitions handled explicitly.
export async function actOnApproval(
  context: CurrentUserContext,
  tenantId: string,
  requestId: string,
  input: ActOnApprovalInput,
): Promise<ApprovalDecision> {
  const decision = await prisma.$transaction(async (tx) => {
    const request = await requestRepo.findRequestById(tenantId, requestId, tx)

    if (!request) {
      throw new NotFoundError('Approval request not found.')
    }

    if (!['pending', 'escalated'].includes(request.statusCode)) {
      throw new ConflictError('This approval request is already resolved.')
    }

    if (!request.workflowId) {
      throw new ConflictError('Approval request has no workflow.')
    }

    const workflow = await workflowRepo.findWorkflowById(
      tenantId,
      request.workflowId,
      tx,
    )

    if (!workflow) {
      throw new NotFoundError('Approval workflow not found.')
    }

    const routable = toRoutable(workflow)
    const amount = request.amount ? Number(request.amount) : 0
    const steps = applicableSteps(routable, amount)
    const currentStep = findStep(steps, request.currentStepOrder)

    if (!currentStep) {
      throw new ConflictError('Approval request is on an invalid step.')
    }

    const approver = { profileId: context.profileId, roles: context.roles }

    // A prior delegation on this step lets the delegate act even if they don't
    // otherwise match the step's role/profile.
    const delegatedToMe = request.actions.some(
      (action) =>
        action.stepOrder === currentStep.stepOrder &&
        action.actionCode === 'delegate' &&
        action.delegatedToProfileId === context.profileId,
    )

    if (
      input.action !== 'escalate' &&
      !delegatedToMe &&
      !isEligibleApprover(currentStep, approver)
    ) {
      throw new ForbiddenError('You are not an approver for this step.')
    }

    if (input.action === 'delegate' && !currentStep.allowDelegate) {
      throw new ConflictError('This step does not allow delegation.')
    }

    await requestRepo.recordAction(
      tenantId,
      requestId,
      {
        stepOrder: currentStep.stepOrder,
        actionCode: input.action,
        actorProfileId: context.profileId,
        delegatedToProfileId: input.delegateToProfileId ?? null,
        comment: input.comment ?? null,
      },
      tx,
    )

    let outcome: ApprovalDecision['outcome']
    let statusCode: string
    let currentStepOrder = request.currentStepOrder
    let completedAt: Date | null = null

    if (input.action === 'reject') {
      statusCode = 'rejected'
      outcome = 'rejected'
      completedAt = new Date()
    } else if (input.action === 'delegate') {
      statusCode = request.statusCode
      outcome = request.statusCode === 'escalated' ? 'escalated' : 'pending'
    } else if (input.action === 'escalate') {
      statusCode = 'escalated'
      outcome = 'escalated'
    } else {
      // approve
      const next = nextStepOrder(steps, currentStep.stepOrder)
      if (next === null) {
        statusCode = 'approved'
        outcome = 'approved'
        completedAt = new Date()
      } else {
        statusCode = 'pending'
        outcome = 'pending'
        currentStepOrder = next
      }
    }

    await requestRepo.updateRequest(
      tenantId,
      requestId,
      { statusCode, currentStepOrder, completedAt },
      tx,
    )

    if (outcome === 'approved' || outcome === 'rejected') {
      await applyApprovalToDocument(
        tenantId,
        request.entityType,
        request.entityId,
        outcome,
        context.profileId,
        tx,
      )

      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'purchase_approval.decided',
        aggregateType: 'pod_approval_request',
        aggregateId: requestId,
        actorProfileId: context.profileId,
        payload: {
          requestId,
          entityType: request.entityType,
          entityId: request.entityId,
          statusCode,
          actorProfileId: context.profileId,
        },
      })
    }

    // In-app alerts: the requester learns the outcome; an advanced request
    // alerts the next step's approvers; a delegation alerts the delegate.
    const entityLabel = request.entityType.replace(/_/g, ' ')

    if (outcome === 'approved' || outcome === 'rejected') {
      await notify(
        tx,
        tenantId,
        request.requestedByProfileId ? [request.requestedByProfileId] : [],
        context.profileId,
        {
          eventType: `approval.${outcome}`,
          title: `Your ${entityLabel} was ${outcome}`,
          entityType: request.entityType,
          entityId: request.entityId,
        },
      )
    } else if (input.action === 'approve') {
      const nextStep = findStep(steps, currentStepOrder)

      if (nextStep) {
        await notify(
          tx,
          tenantId,
          await resolveStepRecipients(tenantId, nextStep, tx),
          context.profileId,
          {
            eventType: 'approval.requested',
            title: `Approval requested: ${entityLabel}`,
            body: request.amount
              ? `Amount ${request.amount.toString()} ${request.currencyCode ?? ''}`.trim()
              : null,
            entityType: request.entityType,
            entityId: request.entityId,
          },
        )
      }
    } else if (input.action === 'delegate' && input.delegateToProfileId) {
      await notify(
        tx,
        tenantId,
        [input.delegateToProfileId],
        context.profileId,
        {
          eventType: 'approval.delegated',
          title: `An approval was delegated to you: ${entityLabel}`,
          entityType: request.entityType,
          entityId: request.entityId,
        },
      )
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: `purchase.approval_${input.action}`,
        entityType: 'pod_approval_request',
        entityId: requestId,
        newValues: { action: input.action, statusCode },
      },
      tx,
    )

    const refreshed = (await requestRepo.findRequestById(
      tenantId,
      requestId,
      tx,
    ))!
    return { request: serializeApprovalRequest(refreshed), outcome }
  })

  return decision
}

// --- Reads & config ---------------------------------------------------------

export async function listApprovalRequests(
  _context: CurrentUserContext,
  tenantId: string,
  options: { statusCode?: string; entityType?: string } = {},
) {
  const requests = await requestRepo.listRequests(tenantId, options)
  return requests.map(serializeApprovalRequest)
}

export async function getApprovalRequest(
  _context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const request = await requestRepo.findRequestById(tenantId, id)

  if (!request) {
    throw new NotFoundError('Approval request not found.')
  }

  return serializeApprovalRequest(request)
}

// Pending requests the caller can act on: current step targets their profile,
// one of their roles, is unrestricted, or was delegated to them.
export async function listMyApprovals(
  context: CurrentUserContext,
  tenantId: string,
) {
  const pending = await requestRepo.listRequests(tenantId, {
    statusCode: 'pending',
  })
  const escalated = await requestRepo.listRequests(tenantId, {
    statusCode: 'escalated',
  })
  const workflowCache = new Map<string, workflowRepo.WorkflowWithSteps | null>()

  const mine = []
  for (const request of [...pending, ...escalated]) {
    if (!request.workflowId) {
      continue
    }

    if (!workflowCache.has(request.workflowId)) {
      workflowCache.set(
        request.workflowId,
        await workflowRepo.findWorkflowById(tenantId, request.workflowId),
      )
    }
    const workflow = workflowCache.get(request.workflowId)
    if (!workflow) {
      continue
    }

    const routable = toRoutable(workflow)
    const amount = request.amount ? Number(request.amount) : 0
    const step = findStep(
      applicableSteps(routable, amount),
      request.currentStepOrder,
    )
    const delegatedToMe = request.actions.some(
      (action) =>
        action.actionCode === 'delegate' &&
        action.delegatedToProfileId === context.profileId,
    )

    if (
      step &&
      (delegatedToMe ||
        isEligibleApprover(step, {
          profileId: context.profileId,
          roles: context.roles,
        }))
    ) {
      mine.push(serializeApprovalRequest(request))
    }
  }

  return mine
}

export async function listWorkflows(
  _context: CurrentUserContext,
  tenantId: string,
) {
  const workflows = await workflowRepo.listWorkflows(tenantId, {
    includeInactive: true,
  })
  return workflows.map(serializeWorkflow)
}

export async function createWorkflow(
  context: CurrentUserContext,
  tenantId: string,
  input: workflowRepo.WorkflowWriteInput,
) {
  let workflow
  try {
    workflow = await workflowRepo.createWorkflow(tenantId, input)
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw new ConflictError(
        `A workflow with code "${input.code}" already exists.`,
      )
    }
    throw error
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.config_manage',
    entityType: 'pod_approval_workflow',
    entityId: workflow.id,
    newValues: { code: workflow.code },
  })

  return serializeWorkflow(workflow)
}

export async function updateWorkflow(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<workflowRepo.WorkflowWriteInput>,
) {
  const workflow = await workflowRepo.updateWorkflow(tenantId, id, input)

  if (!workflow) {
    throw new NotFoundError('Approval workflow not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.config_manage',
    entityType: 'pod_approval_workflow',
    entityId: id,
    newValues: { action: 'update' },
  })

  return serializeWorkflow(workflow)
}

export async function deleteWorkflow(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await workflowRepo.softDeleteWorkflow(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Approval workflow not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'purchase.config_manage',
    entityType: 'pod_approval_workflow',
    entityId: id,
    newValues: { action: 'delete' },
  })

  return { id }
}

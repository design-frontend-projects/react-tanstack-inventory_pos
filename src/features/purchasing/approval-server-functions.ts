import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as approvals from '#/server/purchasing/approval-engine'
import { submitPurchaseOrderForApproval } from '#/server/inventory/documents/purchase-order-service'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  approvalActSchema,
  approvalListSchema,
  workflowCreateSchema,
  workflowUpdateSchema,
} from '#/features/purchasing/approval-validation'

const accessTokenSchema = z.string().min(1)
const tenantIdSchema = z.string().uuid()
const idSchema = z.string().uuid()

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

const base = z.object({
  accessToken: accessTokenSchema,
  tenantId: tenantIdSchema,
})
const withId = base.extend({ id: idSchema })

// --- Approval requests -------------------------------------------------------

export const listApprovalsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: approvalListSchema.optional() }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.approval_action',
      'purchase.po_view',
    ])

    return approvals.listApprovalRequests(
      context,
      data.tenantId,
      data.input ?? {},
    )
  })

export const listMyApprovalsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.approval_action')

    return approvals.listMyApprovals(context, data.tenantId)
  })

export const getApprovalServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, [
      'purchase.approval_action',
      'purchase.po_view',
    ])

    return approvals.getApprovalRequest(context, data.tenantId, data.id)
  })

export const actOnApprovalServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: approvalActSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.approval_action')

    return approvals.actOnApproval(context, data.tenantId, data.id, data.input)
  })

export const submitPurchaseOrderForApprovalServerFn = createServerFn({
  method: 'POST',
})
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.po_approve')

    return submitPurchaseOrderForApproval(context, data.tenantId, data.id)
  })

// --- Workflow configuration --------------------------------------------------

export const listWorkflowsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return approvals.listWorkflows(context, data.tenantId)
  })

export const createWorkflowServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: workflowCreateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return approvals.createWorkflow(context, data.tenantId, data.input)
  })

export const updateWorkflowServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId.extend({ input: workflowUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return approvals.updateWorkflow(context, data.tenantId, data.id, data.input)
  })

export const deleteWorkflowServerFn = createServerFn({ method: 'POST' })
  .inputValidator(withId)
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'purchase.config_manage')

    return approvals.deleteWorkflow(context, data.tenantId, data.id)
  })

import type { WorkflowWithSteps } from '#/server/repos/pod-approval-workflow-repo'
import type { ApprovalRequestWithActions } from '#/server/repos/pod-approval-request-repo'

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeWorkflow(workflow: WorkflowWithSteps) {
  return {
    ...workflow,
    minAmount: dec(workflow.minAmount),
    maxAmount: dec(workflow.maxAmount),
    steps: workflow.steps.map((step) => ({
      ...step,
      minAmount: dec(step.minAmount),
    })),
  }
}

export function serializeApprovalRequest(request: ApprovalRequestWithActions) {
  return {
    ...request,
    amount: dec(request.amount),
  }
}

export type WorkflowDto = ReturnType<typeof serializeWorkflow>
export type ApprovalRequestDto = ReturnType<typeof serializeApprovalRequest>

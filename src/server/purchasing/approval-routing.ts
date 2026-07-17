// Pure approval-routing decisions — no database, fully unit-testable. The engine
// (approval-engine.ts) wraps these with persistence, events, and audit.

export interface RoutableWorkflow {
  id: string
  entityType: string
  minAmount: string | null
  maxAmount: string | null
  autoApprove: boolean
  isActive: boolean
  steps: Array<RoutableStep>
}

export interface RoutableStep {
  stepOrder: number
  approverRoleCode: string | null
  approverProfileId: string | null
  minAmount: string | null
  isFinal: boolean
  allowDelegate: boolean
}

export interface ApproverIdentity {
  profileId: string
  roles: Array<string>
}

// Selects the most specific active workflow whose entityType matches and whose
// amount band contains `amount`. Ties break toward the narrowest band (highest
// minAmount), so a "high value" workflow wins over a catch-all.
export function selectWorkflow(
  workflows: Array<RoutableWorkflow>,
  entityType: string,
  amount: number,
): RoutableWorkflow | null {
  const candidates = workflows
    .filter(
      (workflow) => workflow.isActive && workflow.entityType === entityType,
    )
    .filter((workflow) => {
      const min =
        workflow.minAmount === null ? -Infinity : Number(workflow.minAmount)
      const max =
        workflow.maxAmount === null ? Infinity : Number(workflow.maxAmount)
      return amount >= min && amount <= max
    })

  if (candidates.length === 0) {
    return null
  }

  return candidates.sort((a, b) => {
    const aMin = a.minAmount === null ? -Infinity : Number(a.minAmount)
    const bMin = b.minAmount === null ? -Infinity : Number(b.minAmount)
    return bMin - aMin
  })[0]
}

// Steps that actually apply to this amount (a step with minAmount only engages
// once the amount reaches its threshold — cheap requests skip senior approvers).
export function applicableSteps(
  workflow: RoutableWorkflow,
  amount: number,
): Array<RoutableStep> {
  return workflow.steps
    .filter(
      (step) => step.minAmount === null || amount >= Number(step.minAmount),
    )
    .sort((a, b) => a.stepOrder - b.stepOrder)
}

// Auto-approve when the workflow says so, or when no steps apply at this amount.
export function shouldAutoApprove(
  workflow: RoutableWorkflow,
  amount: number,
): boolean {
  return workflow.autoApprove || applicableSteps(workflow, amount).length === 0
}

export function findStep(
  steps: Array<RoutableStep>,
  stepOrder: number,
): RoutableStep | null {
  return steps.find((step) => step.stepOrder === stepOrder) ?? null
}

// An approver is eligible if the step targets their profile directly, targets a
// role they hold, or is unrestricted (any approver). Delegation targets are
// resolved by the engine before this check.
export function isEligibleApprover(
  step: RoutableStep,
  approver: ApproverIdentity,
): boolean {
  if (step.approverProfileId) {
    return step.approverProfileId === approver.profileId
  }
  if (step.approverRoleCode) {
    return approver.roles.includes(step.approverRoleCode)
  }
  return true
}

// Given the current step, returns the next applicable step order, or null when
// the current step is the last one (→ the request is fully approved).
export function nextStepOrder(
  steps: Array<RoutableStep>,
  currentStepOrder: number,
): number | null {
  const current = findStep(steps, currentStepOrder)
  if (current?.isFinal) {
    return null
  }
  const remaining = steps
    .filter((step) => step.stepOrder > currentStepOrder)
    .sort((a, b) => a.stepOrder - b.stepOrder)
  return remaining.length > 0 ? remaining[0].stepOrder : null
}

import { describe, expect, it } from 'vitest'
import {
  applicableSteps,
  isEligibleApprover,
  nextStepOrder,
  selectWorkflow,
  shouldAutoApprove,
  type RoutableStep,
  type RoutableWorkflow,
} from '#/server/purchasing/approval-routing'
import {
  approvalActSchema,
  workflowCreateSchema,
} from '#/features/purchasing/approval-validation'

function step(
  partial: Partial<RoutableStep> & { stepOrder: number },
): RoutableStep {
  return {
    approverRoleCode: null,
    approverProfileId: null,
    minAmount: null,
    isFinal: false,
    allowDelegate: true,
    ...partial,
  }
}

function workflow(partial: Partial<RoutableWorkflow>): RoutableWorkflow {
  return {
    id: 'wf',
    entityType: 'purchase_order',
    minAmount: null,
    maxAmount: null,
    autoApprove: false,
    isActive: true,
    steps: [],
    ...partial,
  }
}

describe('selectWorkflow', () => {
  const catchAll = workflow({ id: 'catch', minAmount: null, maxAmount: null })
  const highValue = workflow({
    id: 'high',
    minAmount: '10000',
    maxAmount: null,
  })

  it('picks the narrowest band containing the amount', () => {
    expect(
      selectWorkflow([catchAll, highValue], 'purchase_order', 25000)?.id,
    ).toBe('high')
    expect(
      selectWorkflow([catchAll, highValue], 'purchase_order', 500)?.id,
    ).toBe('catch')
  })

  it('ignores inactive workflows and other entity types', () => {
    const inactive = workflow({ id: 'x', isActive: false })
    expect(selectWorkflow([inactive], 'purchase_order', 100)).toBeNull()
    const invoice = workflow({ id: 'inv', entityType: 'supplier_invoice' })
    expect(selectWorkflow([invoice], 'purchase_order', 100)).toBeNull()
  })
})

describe('applicableSteps & shouldAutoApprove', () => {
  const wf = workflow({
    autoApprove: false,
    steps: [
      step({ stepOrder: 1, minAmount: null }),
      step({ stepOrder: 2, minAmount: '5000', isFinal: true }),
    ],
  })

  it('engages threshold steps only above the threshold', () => {
    expect(applicableSteps(wf, 1000).map((s) => s.stepOrder)).toEqual([1])
    expect(applicableSteps(wf, 8000).map((s) => s.stepOrder)).toEqual([1, 2])
  })

  it('auto-approves when no steps apply', () => {
    const thresholdOnly = workflow({
      steps: [step({ stepOrder: 1, minAmount: '5000' })],
    })
    expect(shouldAutoApprove(thresholdOnly, 100)).toBe(true)
    expect(shouldAutoApprove(thresholdOnly, 6000)).toBe(false)
  })

  it('auto-approves when the workflow flag is set', () => {
    expect(
      shouldAutoApprove(
        workflow({ autoApprove: true, steps: [step({ stepOrder: 1 })] }),
        100,
      ),
    ).toBe(true)
  })
})

describe('isEligibleApprover', () => {
  const roleStep = step({ stepOrder: 1, approverRoleCode: 'admin' })
  const profileStep = step({ stepOrder: 1, approverProfileId: 'user-1' })
  const openStep = step({ stepOrder: 1 })

  it('matches by role', () => {
    expect(
      isEligibleApprover(roleStep, { profileId: 'u', roles: ['admin'] }),
    ).toBe(true)
    expect(
      isEligibleApprover(roleStep, { profileId: 'u', roles: ['cashier'] }),
    ).toBe(false)
  })

  it('matches by profile', () => {
    expect(
      isEligibleApprover(profileStep, { profileId: 'user-1', roles: [] }),
    ).toBe(true)
    expect(
      isEligibleApprover(profileStep, { profileId: 'user-2', roles: [] }),
    ).toBe(false)
  })

  it('treats an unrestricted step as open to anyone', () => {
    expect(
      isEligibleApprover(openStep, { profileId: 'anyone', roles: [] }),
    ).toBe(true)
  })
})

describe('nextStepOrder', () => {
  const steps = [step({ stepOrder: 1 }), step({ stepOrder: 2, isFinal: true })]

  it('advances to the next step', () => {
    expect(nextStepOrder(steps, 1)).toBe(2)
  })

  it('returns null after a final step', () => {
    expect(nextStepOrder(steps, 2)).toBeNull()
  })
})

describe('approval validation', () => {
  it('accepts a decision payload', () => {
    expect(approvalActSchema.safeParse({ action: 'approve' }).success).toBe(
      true,
    )
    expect(
      approvalActSchema.safeParse({ action: 'delegate', comment: 'to finance' })
        .success,
    ).toBe(true)
    expect(approvalActSchema.safeParse({ action: 'nope' }).success).toBe(false)
  })

  it('accepts a workflow definition with steps', () => {
    const parsed = workflowCreateSchema.safeParse({
      code: 'PO-DEFAULT',
      name: 'PO Approval',
      entityType: 'purchase_order',
      steps: [
        {
          stepOrder: 1,
          name: 'Admin',
          approverRoleCode: 'admin',
          minAmount: '1000',
        },
      ],
    })
    expect(parsed.success).toBe(true)
    expect(
      workflowCreateSchema.safeParse({
        code: 'X',
        name: 'X',
        entityType: 'po',
        steps: [],
      }).success,
    ).toBe(false)
  })
})

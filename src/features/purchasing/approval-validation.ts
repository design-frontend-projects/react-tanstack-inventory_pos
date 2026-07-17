import { z } from 'zod'

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const approvalActSchema = z.object({
  action: z.enum(['approve', 'reject', 'delegate', 'escalate']),
  comment: z.string().max(2000).nullish(),
  delegateToProfileId: z.string().uuid().nullish(),
})

export const approvalListSchema = z.object({
  statusCode: z.string().max(60).optional(),
  entityType: z.string().max(60).optional(),
})

export const workflowStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  name: z.string().min(1).max(120),
  approverRoleCode: z.string().max(60).nullish(),
  approverProfileId: z.string().uuid().nullish(),
  minAmount: decimalInput.nullish(),
  isFinal: z.boolean().optional(),
  allowDelegate: z.boolean().optional(),
  escalateAfterHours: z.number().int().min(0).max(8760).nullish(),
})

export const workflowCreateSchema = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  entityType: z.string().min(1).max(60),
  minAmount: decimalInput.nullish(),
  maxAmount: decimalInput.nullish(),
  currencyCode: z.string().length(3).nullish(),
  autoApprove: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
  steps: z.array(workflowStepSchema).min(1),
})

export const workflowUpdateSchema = workflowCreateSchema.partial()

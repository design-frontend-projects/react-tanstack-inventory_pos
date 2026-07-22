import { z } from 'zod'

// Zod schemas for the workforce-planning server functions.

const decimalInput = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])

export const skillWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  nameAr: z.string().max(120).nullish(),
  category: z
    .enum(['technical', 'soft', 'language', 'certification', 'leadership'])
    .optional(),
  isActive: z.boolean().optional(),
})

export const employeeSkillSchema = z.object({
  employeeId: z.string().uuid(),
  skillId: z.string().uuid(),
  proficiency: z.number().int().min(1).max(5).optional(),
  yearsExperience: decimalInput.nullish(),
  isCertified: z.boolean().optional(),
})

export const workforcePlanWriteSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  fiscalYear: z.number().int().min(2000).max(2100),
  departmentId: z.string().uuid().nullish(),
  currentHeadcount: z.number().int().min(0).optional(),
  plannedHeadcount: z.number().int().min(0).optional(),
  statusCode: z.string().max(32).optional(),
  isActive: z.boolean().optional(),
})

export const workforceRequirementSchema = z.object({
  planId: z.string().uuid(),
  positionId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  requiredCount: z.number().int().min(0).optional(),
  currentCount: z.number().int().min(0).optional(),
  targetQuarter: z.string().max(16).nullish(),
  estimatedCost: decimalInput.nullish(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
})

export const skillRequirementSchema = z.object({
  positionId: z.string().uuid(),
  skillId: z.string().uuid(),
  minProficiency: z.number().int().min(1).max(5).optional(),
  isMandatory: z.boolean().optional(),
})

export type SkillWriteInput = z.infer<typeof skillWriteSchema>
export type EmployeeSkillInput = z.infer<typeof employeeSkillSchema>
export type WorkforcePlanWriteInput = z.infer<typeof workforcePlanWriteSchema>
export type WorkforceRequirementInput = z.infer<
  typeof workforceRequirementSchema
>
export type SkillRequirementInput = z.infer<typeof skillRequirementSchema>

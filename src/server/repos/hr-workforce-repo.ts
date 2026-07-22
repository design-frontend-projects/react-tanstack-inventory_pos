import { prisma } from '#/server/db/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for workforce planning: the skills catalog,
// per-employee skill assessments, workforce plans (with headcount targets),
// their position/department requirements, and per-position skill requirements.
// All reads filter by tenantId; the security boundary lives in the guards.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- Skills catalog ---------------------------------------------------------

export interface SkillWriteInput {
  code: string
  name: string
  nameAr?: string | null
  category?: string
  isActive?: boolean
}

export function listSkills(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrSkill.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findSkillById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrSkill.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function createSkill(
  tenantId: string,
  input: SkillWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrSkill.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      category: input.category ?? 'technical',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateSkill(
  tenantId: string,
  id: string,
  input: Partial<SkillWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSkill.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findSkillById(tenantId, id, client)
}

export async function softDeleteSkill(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrSkill.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  void actorId
  return result.count > 0
}

// --- Employee skills --------------------------------------------------------

export interface EmployeeSkillUpsertInput {
  employeeId: string
  skillId: string
  proficiency?: number
  yearsExperience?: string | number | null
  isCertified?: boolean
}

export function listEmployeeSkills(
  tenantId: string,
  filters: { employeeId?: string; skillId?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrEmployeeSkill.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.skillId ? { skillId: filters.skillId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}

export async function upsertEmployeeSkill(
  tenantId: string,
  input: EmployeeSkillUpsertInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const existing = await client.hrEmployeeSkill.findFirst({
    where: {
      tenantId,
      employeeId: input.employeeId,
      skillId: input.skillId,
      deletedAt: null,
    },
  })
  if (existing) {
    return client.hrEmployeeSkill.update({
      where: { id: existing.id },
      data: {
        ...(input.proficiency !== undefined
          ? { proficiency: input.proficiency }
          : {}),
        ...(input.yearsExperience !== undefined
          ? { yearsExperience: input.yearsExperience ?? null }
          : {}),
        ...(input.isCertified !== undefined
          ? { isCertified: input.isCertified }
          : {}),
        updatedBy: actorId,
      },
    })
  }
  return client.hrEmployeeSkill.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      skillId: input.skillId,
      proficiency: input.proficiency ?? 1,
      yearsExperience: input.yearsExperience ?? null,
      isCertified: input.isCertified ?? false,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function deleteEmployeeSkill(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrEmployeeSkill.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return result.count > 0
}

// --- Workforce plans --------------------------------------------------------

export interface WorkforcePlanWriteInput {
  code: string
  name: string
  fiscalYear: number
  departmentId?: string | null
  currentHeadcount?: number
  plannedHeadcount?: number
  statusCode?: string
  isActive?: boolean
}

export function listPlans(
  tenantId: string,
  filters: { fiscalYear?: number } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrWorkforcePlan.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.fiscalYear ? { fiscalYear: filters.fiscalYear } : {}),
    },
    orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
  })
}

export function findPlanById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrWorkforcePlan.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createPlan(
  tenantId: string,
  input: WorkforcePlanWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrWorkforcePlan.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      fiscalYear: input.fiscalYear,
      departmentId: input.departmentId ?? null,
      currentHeadcount: input.currentHeadcount ?? 0,
      plannedHeadcount: input.plannedHeadcount ?? 0,
      statusCode: input.statusCode ?? 'draft',
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updatePlan(
  tenantId: string,
  id: string,
  input: Partial<WorkforcePlanWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrWorkforcePlan.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.fiscalYear !== undefined
        ? { fiscalYear: input.fiscalYear }
        : {}),
      ...(input.departmentId !== undefined
        ? { departmentId: input.departmentId ?? null }
        : {}),
      ...(input.currentHeadcount !== undefined
        ? { currentHeadcount: input.currentHeadcount }
        : {}),
      ...(input.plannedHeadcount !== undefined
        ? { plannedHeadcount: input.plannedHeadcount }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findPlanById(tenantId, id, client)
}

export async function softDeletePlan(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrWorkforcePlan.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  void actorId
  return result.count > 0
}

// --- Workforce requirements -------------------------------------------------

export interface WorkforceRequirementCreateInput {
  planId: string
  positionId?: string | null
  departmentId?: string | null
  requiredCount?: number
  currentCount?: number
  targetQuarter?: string | null
  estimatedCost?: string | number | null
  priority?: string
}

export function listRequirementsForPlan(
  tenantId: string,
  planId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrWorkforceRequirement.findMany({
    where: { tenantId, planId },
    orderBy: { createdAt: 'asc' },
  })
}

export function createRequirement(
  tenantId: string,
  input: WorkforceRequirementCreateInput,
  client: PrismaClientLike = prisma,
) {
  const required = input.requiredCount ?? 0
  const current = input.currentCount ?? 0
  return client.hrWorkforceRequirement.create({
    data: {
      tenantId,
      planId: input.planId,
      positionId: input.positionId ?? null,
      departmentId: input.departmentId ?? null,
      requiredCount: required,
      currentCount: current,
      gapCount: Math.max(required - current, 0),
      targetQuarter: input.targetQuarter ?? null,
      estimatedCost: input.estimatedCost ?? null,
      priority: input.priority ?? 'medium',
    },
  })
}

// --- Skill requirements -----------------------------------------------------

export interface SkillRequirementCreateInput {
  positionId: string
  skillId: string
  minProficiency?: number
  isMandatory?: boolean
}

export function listSkillRequirementsForPosition(
  tenantId: string,
  positionId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrSkillRequirement.findMany({
    where: { tenantId, positionId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createSkillRequirement(
  tenantId: string,
  input: SkillRequirementCreateInput,
  client: PrismaClientLike = prisma,
) {
  const existing = await client.hrSkillRequirement.findFirst({
    where: { tenantId, positionId: input.positionId, skillId: input.skillId },
  })
  if (existing) {
    return client.hrSkillRequirement.update({
      where: { id: existing.id },
      data: {
        minProficiency: input.minProficiency ?? existing.minProficiency,
        isMandatory: input.isMandatory ?? existing.isMandatory,
      },
    })
  }
  return client.hrSkillRequirement.create({
    data: {
      tenantId,
      positionId: input.positionId,
      skillId: input.skillId,
      minProficiency: input.minProficiency ?? 1,
      isMandatory: input.isMandatory ?? true,
    },
  })
}

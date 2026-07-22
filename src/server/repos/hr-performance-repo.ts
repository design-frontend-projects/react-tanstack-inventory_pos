import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant-scoped data access for the performance sub-domain: KPI library, employee
// goals with their progress ledger, review templates, performance reviews, and the
// per-criterion review scores. All reads filter by tenantId.

const activeWhere = (tenantId: string, includeInactive: boolean) => ({
  tenantId,
  deletedAt: null,
  ...(includeInactive ? {} : { isActive: true }),
})

// --- KPIs -------------------------------------------------------------------

export interface KpiWriteInput {
  code: string
  name: string
  nameAr?: string | null
  category?: string
  measureUnit?: string | null
  targetValue?: string | number | null
  weight?: string | number | null
  isActive?: boolean
}

export function listKpis(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrKpi.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findKpiById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrKpi.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function createKpi(
  tenantId: string,
  input: KpiWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrKpi.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      category: input.category ?? 'general',
      measureUnit: input.measureUnit ?? null,
      targetValue: input.targetValue ?? null,
      weight: input.weight ?? null,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateKpi(
  tenantId: string,
  id: string,
  input: Partial<KpiWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrKpi.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.measureUnit !== undefined
        ? { measureUnit: input.measureUnit ?? null }
        : {}),
      ...(input.targetValue !== undefined
        ? { targetValue: input.targetValue ?? null }
        : {}),
      ...(input.weight !== undefined ? { weight: input.weight ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findKpiById(tenantId, id, client)
}

export async function softDeleteKpi(
  tenantId: string,
  id: string,
  _actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrKpi.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  return result.count > 0
}

// --- Goals ------------------------------------------------------------------

export interface GoalWriteInput {
  employeeId: string
  kpiId?: string | null
  title: string
  description?: string | null
  category?: string
  weight?: string | number | null
  targetValue?: string | number | null
  startDate?: Date | null
  dueDate?: Date | null
  statusCode?: string
}

export function listGoals(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrGoal.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findGoalById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrGoal.findFirst({ where: { id, tenantId, deletedAt: null } })
}

export function createGoal(
  tenantId: string,
  input: GoalWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrGoal.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      kpiId: input.kpiId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      category: input.category ?? 'performance',
      weight: input.weight ?? null,
      targetValue: input.targetValue ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateGoal(
  tenantId: string,
  id: string,
  input: Partial<GoalWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrGoal.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.kpiId !== undefined ? { kpiId: input.kpiId ?? null } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() ?? null }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.weight !== undefined ? { weight: input.weight ?? null } : {}),
      ...(input.targetValue !== undefined
        ? { targetValue: input.targetValue ?? null }
        : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ?? null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findGoalById(tenantId, id, client)
}

// Sets the goal's rolled-up progress percentage (and optionally its status) — the
// authoritative snapshot after a progress entry is recorded.
export function updateGoalProgress(
  tenantId: string,
  id: string,
  progressPct: string | number,
  statusCode: string | undefined,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrGoal.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      progressPct,
      ...(statusCode !== undefined ? { statusCode } : {}),
      updatedBy: actorId,
    },
  })
}

export async function softDeleteGoal(
  tenantId: string,
  id: string,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrGoal.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false, deletedBy: actorId },
  })
  return result.count > 0
}

// --- Goal progress ----------------------------------------------------------

export interface GoalProgressCreateInput {
  goalId: string
  progressPct: string | number
  actualValue?: string | number | null
  note?: string | null
}

export function createGoalProgress(
  tenantId: string,
  input: GoalProgressCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrGoalProgress.create({
    data: {
      tenantId,
      goalId: input.goalId,
      progressPct: input.progressPct,
      actualValue: input.actualValue ?? null,
      note: input.note ?? null,
      recordedById: actorId,
    },
  })
}

export function listProgressForGoal(
  tenantId: string,
  goalId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrGoalProgress.findMany({
    where: { tenantId, goalId },
    orderBy: { recordedAt: 'desc' },
  })
}

// --- Review templates -------------------------------------------------------

export interface ReviewTemplateWriteInput {
  code: string
  name: string
  nameAr?: string | null
  reviewType?: string
  sectionsJson?: Prisma.InputJsonValue | null
  ratingScaleMax?: number
  isActive?: boolean
}

export function listReviewTemplates(
  tenantId: string,
  options: { includeInactive?: boolean } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrReviewTemplate.findMany({
    where: activeWhere(tenantId, options.includeInactive ?? true),
    orderBy: { name: 'asc' },
  })
}

export function findReviewTemplateById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrReviewTemplate.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
}

export function createReviewTemplate(
  tenantId: string,
  input: ReviewTemplateWriteInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrReviewTemplate.create({
    data: {
      tenantId,
      code: input.code.trim(),
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() ?? null,
      reviewType: input.reviewType ?? 'annual',
      sectionsJson: input.sectionsJson ?? undefined,
      ratingScaleMax: input.ratingScaleMax ?? 5,
      isActive: input.isActive ?? true,
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateReviewTemplate(
  tenantId: string,
  id: string,
  input: Partial<ReviewTemplateWriteInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrReviewTemplate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameAr !== undefined
        ? { nameAr: input.nameAr?.trim() ?? null }
        : {}),
      ...(input.reviewType !== undefined
        ? { reviewType: input.reviewType }
        : {}),
      ...(input.sectionsJson !== undefined
        ? { sectionsJson: input.sectionsJson ?? undefined }
        : {}),
      ...(input.ratingScaleMax !== undefined
        ? { ratingScaleMax: input.ratingScaleMax }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findReviewTemplateById(tenantId, id, client)
}

export async function softDeleteReviewTemplate(
  tenantId: string,
  id: string,
  _actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrReviewTemplate.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  })
  return result.count > 0
}

// --- Performance reviews ----------------------------------------------------

const reviewInclude = {
  scores: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.HrPerformanceReviewInclude

export type PerformanceReviewWithScores = Prisma.HrPerformanceReviewGetPayload<{
  include: typeof reviewInclude
}>

export interface PerformanceReviewCreateInput {
  employeeId: string
  templateId?: string | null
  reviewerId?: string | null
  reviewType?: string
  periodStart?: Date | null
  periodEnd?: Date | null
  strengths?: string | null
  improvements?: string | null
  comments?: string | null
  statusCode?: string
}

export function listReviews(
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
  client: PrismaClientLike = prisma,
) {
  return client.hrPerformanceReview.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.statusCode ? { statusCode: filters.statusCode } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
}

export function findReviewById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrPerformanceReview.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: reviewInclude,
  })
}

export function createReview(
  tenantId: string,
  input: PerformanceReviewCreateInput,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPerformanceReview.create({
    data: {
      tenantId,
      employeeId: input.employeeId,
      templateId: input.templateId ?? null,
      reviewerId: input.reviewerId ?? null,
      reviewType: input.reviewType ?? 'annual',
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      comments: input.comments ?? null,
      statusCode: input.statusCode ?? 'draft',
      createdBy: actorId,
      updatedBy: actorId,
    },
  })
}

export async function updateReview(
  tenantId: string,
  id: string,
  input: Partial<PerformanceReviewCreateInput>,
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.hrPerformanceReview.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      ...(input.templateId !== undefined
        ? { templateId: input.templateId ?? null }
        : {}),
      ...(input.reviewerId !== undefined
        ? { reviewerId: input.reviewerId ?? null }
        : {}),
      ...(input.reviewType !== undefined
        ? { reviewType: input.reviewType }
        : {}),
      ...(input.periodStart !== undefined
        ? { periodStart: input.periodStart ?? null }
        : {}),
      ...(input.periodEnd !== undefined
        ? { periodEnd: input.periodEnd ?? null }
        : {}),
      ...(input.strengths !== undefined
        ? { strengths: input.strengths ?? null }
        : {}),
      ...(input.improvements !== undefined
        ? { improvements: input.improvements ?? null }
        : {}),
      ...(input.comments !== undefined
        ? { comments: input.comments ?? null }
        : {}),
      ...(input.statusCode !== undefined
        ? { statusCode: input.statusCode }
        : {}),
      updatedBy: actorId,
    },
  })
  if (result.count === 0) return null
  return findReviewById(tenantId, id, client)
}

// Transitions a review status (e.g. draft → finalized), optionally stamping the
// computed overall score and rating label.
export function updateReviewStatus(
  tenantId: string,
  id: string,
  statusCode: string,
  extras: {
    overallScore?: string | number | null
    ratingLabel?: string | null
  },
  actorId: string | null,
  client: PrismaClientLike = prisma,
) {
  return client.hrPerformanceReview.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: {
      statusCode,
      ...(extras.overallScore !== undefined
        ? { overallScore: extras.overallScore ?? null }
        : {}),
      ...(extras.ratingLabel !== undefined
        ? { ratingLabel: extras.ratingLabel ?? null }
        : {}),
      updatedBy: actorId,
    },
  })
}

// --- Review scores ----------------------------------------------------------

export interface ReviewScoreInput {
  kpiId?: string | null
  criterion: string
  weight?: string | number | null
  score?: string | number
  reviewerType?: string
  comments?: string | null
}

export function createReviewScores(
  tenantId: string,
  reviewId: string,
  scores: Array<ReviewScoreInput>,
  client: PrismaClientLike = prisma,
) {
  return client.hrReviewScore.createMany({
    data: scores.map((entry) => ({
      tenantId,
      reviewId,
      kpiId: entry.kpiId ?? null,
      criterion: entry.criterion.trim(),
      weight: entry.weight ?? null,
      score: entry.score ?? 0,
      reviewerType: entry.reviewerType ?? 'manager',
      comments: entry.comments ?? null,
    })),
  })
}

export function listScoresForReview(
  tenantId: string,
  reviewId: string,
  client: PrismaClientLike = prisma,
) {
  return client.hrReviewScore.findMany({
    where: { tenantId, reviewId },
    orderBy: { createdAt: 'asc' },
  })
}

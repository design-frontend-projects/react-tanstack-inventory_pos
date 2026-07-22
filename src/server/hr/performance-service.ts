import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as performanceRepo from '#/server/repos/hr-performance-repo'
import type { CurrentUserContext } from '#/types/auth'

// Performance service. Goals carry a rolled-up progressPct that is refreshed each
// time a progress entry is appended to the immutable hr_goal_progress ledger.
// Reviews accumulate per-criterion scores and settle to a weighted overall score
// when finalized (draft → finalized, one-way). Audit trail on every mutation.

function audit(
  context: CurrentUserContext,
  tenantId: string,
  actionKey: string,
  entityType: string,
  entityId: string,
  newValues?: Record<string, unknown> | null,
) {
  return createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey,
    entityType,
    entityId,
    newValues: newValues ?? null,
  })
}

// --- KPIs -------------------------------------------------------------------

export async function listKpis(_c: CurrentUserContext, tenantId: string) {
  return serializeRecords(await performanceRepo.listKpis(tenantId))
}

export async function createKpi(
  context: CurrentUserContext,
  tenantId: string,
  input: performanceRepo.KpiWriteInput,
) {
  const kpi = await performanceRepo.createKpi(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.performance_manage', 'hr_kpi', kpi.id, {
    code: kpi.code,
  })
  return serializeRecord(kpi)
}

export async function updateKpi(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<performanceRepo.KpiWriteInput>,
) {
  const kpi = await performanceRepo.updateKpi(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!kpi) throw new NotFoundError('KPI not found.')
  await audit(context, tenantId, 'hr.performance_manage', 'hr_kpi', id, null)
  return serializeRecord(kpi)
}

export async function deleteKpi(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await performanceRepo.softDeleteKpi(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('KPI not found.')
  await audit(context, tenantId, 'hr.performance_manage', 'hr_kpi', id, null)
  return { id, deleted: true }
}

// --- Goals ------------------------------------------------------------------

export async function listGoals(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await performanceRepo.listGoals(tenantId, filters))
}

export async function createGoal(
  context: CurrentUserContext,
  tenantId: string,
  input: performanceRepo.GoalWriteInput,
) {
  const goal = await performanceRepo.createGoal(
    tenantId,
    input,
    context.profileId,
  )
  await audit(context, tenantId, 'hr.performance_manage', 'hr_goal', goal.id, {
    title: goal.title,
  })
  return serializeRecord(goal)
}

export async function updateGoal(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<performanceRepo.GoalWriteInput>,
) {
  const goal = await performanceRepo.updateGoal(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!goal) throw new NotFoundError('Goal not found.')
  await audit(context, tenantId, 'hr.performance_manage', 'hr_goal', id, null)
  return serializeRecord(goal)
}

export async function deleteGoal(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await performanceRepo.softDeleteGoal(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Goal not found.')
  await audit(context, tenantId, 'hr.performance_manage', 'hr_goal', id, null)
  return { id, deleted: true }
}

export interface GoalProgressInput {
  goalId: string
  progressPct: number
  actualValue?: string | number | null
  note?: string | null
}

// Appends a progress entry to the ledger and refreshes the goal's rolled-up
// progressPct in one transaction — a goal auto-completes at 100%.
export async function recordProgress(
  context: CurrentUserContext,
  tenantId: string,
  input: GoalProgressInput,
) {
  const goal = await performanceRepo.findGoalById(tenantId, input.goalId)
  if (!goal) throw new NotFoundError('Goal not found.')

  const clamped = Math.max(0, Math.min(100, input.progressPct))
  const nextStatus = clamped >= 100 ? 'completed' : 'in_progress'

  const entry = await prisma.$transaction(async (tx) => {
    const created = await performanceRepo.createGoalProgress(
      tenantId,
      {
        goalId: input.goalId,
        progressPct: clamped,
        actualValue: input.actualValue ?? null,
        note: input.note ?? null,
      },
      context.profileId,
      tx,
    )

    await performanceRepo.updateGoalProgress(
      tenantId,
      input.goalId,
      clamped,
      nextStatus,
      context.profileId,
      tx,
    )

    return created
  })

  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_goal',
    input.goalId,
    {
      progressPct: clamped,
    },
  )

  return serializeRecord(entry)
}

export async function listProgress(
  _c: CurrentUserContext,
  tenantId: string,
  goalId: string,
) {
  return serializeRecords(
    await performanceRepo.listProgressForGoal(tenantId, goalId),
  )
}

// --- Review templates -------------------------------------------------------

export async function listReviewTemplates(
  _c: CurrentUserContext,
  tenantId: string,
) {
  return serializeRecords(await performanceRepo.listReviewTemplates(tenantId))
}

export async function createReviewTemplate(
  context: CurrentUserContext,
  tenantId: string,
  input: performanceRepo.ReviewTemplateWriteInput,
) {
  const template = await performanceRepo.createReviewTemplate(
    tenantId,
    input,
    context.profileId,
  )
  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_review_template',
    template.id,
    {
      code: template.code,
    },
  )
  return serializeRecord(template)
}

export async function updateReviewTemplate(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<performanceRepo.ReviewTemplateWriteInput>,
) {
  const template = await performanceRepo.updateReviewTemplate(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!template) throw new NotFoundError('Review template not found.')
  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_review_template',
    id,
    null,
  )
  return serializeRecord(template)
}

export async function deleteReviewTemplate(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const deleted = await performanceRepo.softDeleteReviewTemplate(
    tenantId,
    id,
    context.profileId,
  )
  if (!deleted) throw new NotFoundError('Review template not found.')
  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_review_template',
    id,
    null,
  )
  return { id, deleted: true }
}

// --- Performance reviews ----------------------------------------------------

export async function listReviews(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await performanceRepo.listReviews(tenantId, filters))
}

export async function getReview(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const review = await performanceRepo.findReviewById(tenantId, id)
  if (!review) throw new NotFoundError('Performance review not found.')
  return { ...serializeRecord(review), scores: serializeRecords(review.scores) }
}

export interface ReviewInput {
  employeeId: string
  templateId?: string | null
  reviewerId?: string | null
  reviewType?: string
  periodStart?: Date | null
  periodEnd?: Date | null
  strengths?: string | null
  improvements?: string | null
  comments?: string | null
  scores?: Array<performanceRepo.ReviewScoreInput>
}

export async function createReview(
  context: CurrentUserContext,
  tenantId: string,
  input: ReviewInput,
) {
  const review = await prisma.$transaction(async (tx) => {
    const created = await performanceRepo.createReview(
      tenantId,
      {
        employeeId: input.employeeId,
        templateId: input.templateId ?? null,
        reviewerId: input.reviewerId ?? context.profileId,
        reviewType: input.reviewType ?? 'annual',
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        strengths: input.strengths ?? null,
        improvements: input.improvements ?? null,
        comments: input.comments ?? null,
        statusCode: 'draft',
      },
      context.profileId,
      tx,
    )

    if (input.scores && input.scores.length > 0) {
      await performanceRepo.createReviewScores(
        tenantId,
        created.id,
        input.scores,
        tx,
      )
    }

    return created
  })

  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_performance_review',
    review.id,
    {
      employeeId: review.employeeId,
    },
  )

  return serializeRecord(review)
}

export async function updateReview(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: Partial<ReviewInput>,
) {
  const existing = await performanceRepo.findReviewById(tenantId, id)
  if (!existing) throw new NotFoundError('Performance review not found.')
  if (existing.statusCode === 'finalized') {
    throw new ConflictError('A finalized review can no longer be edited.')
  }
  const review = await performanceRepo.updateReview(
    tenantId,
    id,
    input,
    context.profileId,
  )
  if (!review) throw new NotFoundError('Performance review not found.')
  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_performance_review',
    id,
    null,
  )
  return serializeRecord(review)
}

// Computes the weighted overall score from the review's criterion scores and
// transitions the review draft → finalized (one-way).
export async function finalizeReview(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  ratingLabel?: string | null,
) {
  const existing = await performanceRepo.findReviewById(tenantId, id)
  if (!existing) throw new NotFoundError('Performance review not found.')
  if (existing.statusCode === 'finalized') {
    throw new ConflictError('This review is already finalized.')
  }

  let weightSum = 0
  let weightedScore = 0
  let simpleSum = 0
  for (const entry of existing.scores) {
    const score = Number(entry.score)
    const weight = entry.weight === null ? 0 : Number(entry.weight)
    simpleSum += score
    if (weight > 0) {
      weightSum += weight
      weightedScore += score * weight
    }
  }
  const overallScore =
    existing.scores.length === 0
      ? 0
      : weightSum > 0
        ? weightedScore / weightSum
        : simpleSum / existing.scores.length

  const rounded = Math.round(overallScore * 100) / 100

  const updated = await prisma.$transaction(async (tx) => {
    await performanceRepo.updateReviewStatus(
      tenantId,
      id,
      'finalized',
      { overallScore: rounded, ratingLabel: ratingLabel ?? null },
      context.profileId,
      tx,
    )
    return performanceRepo.findReviewById(tenantId, id, tx)
  })

  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_performance_review',
    id,
    {
      action: 'finalize',
      overallScore: rounded,
    },
  )

  return updated
    ? { ...serializeRecord(updated), scores: serializeRecords(updated.scores) }
    : null
}

export async function addReviewScores(
  context: CurrentUserContext,
  tenantId: string,
  reviewId: string,
  scores: Array<performanceRepo.ReviewScoreInput>,
) {
  const existing = await performanceRepo.findReviewById(tenantId, reviewId)
  if (!existing) throw new NotFoundError('Performance review not found.')
  if (existing.statusCode === 'finalized') {
    throw new ConflictError('Cannot add scores to a finalized review.')
  }
  await performanceRepo.createReviewScores(tenantId, reviewId, scores, prisma)
  await audit(
    context,
    tenantId,
    'hr.performance_manage',
    'hr_performance_review',
    reviewId,
    {
      action: 'add_scores',
      count: scores.length,
    },
  )
  return serializeRecords(
    await performanceRepo.listScoresForReview(tenantId, reviewId),
  )
}

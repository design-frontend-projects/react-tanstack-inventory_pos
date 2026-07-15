import { buildCustomerFacts } from '#/server/crm/customer-facts'
import {
  evaluateSegmentRule,
  segmentRuleSchema,
} from '#/server/crm/segment-evaluator'
import type { SegmentRuleGroup } from '#/server/crm/segment-evaluator'
import { appendDomainEvent } from '#/server/events/event-outbox'
import { ConflictError, NotFoundError, ValidationError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import type { CrmSegment } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as segmentRepo from '#/server/repos/crm-segment-repo'
import type { CurrentUserContext } from '#/types/auth'

// Segmentation context. Membership is materialized: a full rebuild scans every
// customer with metrics; the incremental path (driven by the projector)
// re-evaluates a single customer against every active segment after each event.
// Enter/exit transitions emit crm.segment_entered/.exited (→ timeline).

function parseRule(segment: CrmSegment): SegmentRuleGroup {
  return segmentRuleSchema.parse(segment.ruleJson)
}

function serializeSegment(segment: CrmSegment) {
  return { ...segment }
}

export async function listSegments(_context: CurrentUserContext, tenantId: string) {
  const segments = await segmentRepo.listSegments(tenantId)

  return segments.map(serializeSegment)
}

export async function upsertSegment(
  context: CurrentUserContext,
  tenantId: string,
  input: {
    id?: string
    code: string
    name: string
    description?: string | null
    ruleJson: unknown
    isActive?: boolean
  }
) {
  // Validate the rule tree before it is persisted.
  const parsed = segmentRuleSchema.safeParse(input.ruleJson)

  if (!parsed.success) {
    throw new ValidationError('Invalid segment rule.')
  }

  const ruleJson = parsed.data as never

  if (input.id) {
    const updated = await segmentRepo.updateSegment(tenantId, input.id, {
      name: input.name,
      description: input.description,
      ruleJson,
      isActive: input.isActive,
    })

    if (!updated) {
      throw new NotFoundError('Segment not found.')
    }

    await createAuditLog({
      tenantId,
      actorProfileId: context.profileId,
      actorEmail: context.email,
      actionKey: 'crm.segment_update',
      entityType: 'crm_segment',
      entityId: input.id,
    })

    return { id: input.id }
  }

  const existing = await prisma.crmSegment.findFirst({
    where: { tenantId, code: input.code, deletedAt: null },
  })

  if (existing) {
    throw new ConflictError(`A segment with code "${input.code}" already exists.`)
  }

  const segment = await segmentRepo.createSegment(tenantId, {
    code: input.code,
    name: input.name,
    description: input.description,
    ruleJson,
    isActive: input.isActive,
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.segment_create',
    entityType: 'crm_segment',
    entityId: segment.id,
    newValues: { code: segment.code },
  })

  return serializeSegment(segment)
}

export async function deleteSegment(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const deleted = await segmentRepo.softDeleteSegment(tenantId, id)

  if (!deleted) {
    throw new NotFoundError('Segment not found.')
  }

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.segment_delete',
    entityType: 'crm_segment',
    entityId: id,
  })

  return { id, deleted: true }
}

// Full rebuild: scan every customer with metrics, evaluate the rule, replace
// the membership set. Used on rule change or on demand.
export async function rebuildSegment(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const segment = await segmentRepo.findSegmentById(tenantId, id)

  if (!segment) {
    throw new NotFoundError('Segment not found.')
  }

  const rule = parseRule(segment)
  const now = new Date()
  const candidates = await prisma.crmCustomerMetrics.findMany({
    where: { tenantId },
    select: { customerId: true },
  })

  const members: Array<string> = []

  for (const candidate of candidates) {
    const facts = await buildCustomerFacts(tenantId, candidate.customerId, now)

    if (evaluateSegmentRule(rule, facts)) {
      members.push(candidate.customerId)
    }
  }

  const count = await prisma.$transaction(async (tx) => {
    const replaced = await segmentRepo.replaceMembers(tenantId, id, members, tx)
    await segmentRepo.setSegmentStats(id, replaced, now, tx)

    return replaced
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.segment_rebuild',
    entityType: 'crm_segment',
    entityId: id,
    newValues: { memberCount: count },
  })

  return { id, memberCount: count }
}

export async function listSegmentMembers(
  _context: CurrentUserContext,
  tenantId: string,
  segmentId: string,
  take = 100
) {
  const members = await segmentRepo.listMembers(tenantId, segmentId, take)

  return members.map((member) => ({ ...member }))
}

// Incremental: re-evaluate one customer against every active segment, applying
// membership deltas and emitting enter/exit events. Runs inside the projector
// transaction (pass tx).
export async function evaluateCustomerSegments(
  tx: PrismaClientLike,
  tenantId: string,
  customerId: string,
  now: Date
) {
  const segments = await segmentRepo.listActiveSegments(tenantId, tx)

  if (segments.length === 0) {
    return
  }

  const facts = await buildCustomerFacts(tenantId, customerId, now, tx)

  for (const segment of segments) {
    const parsed = segmentRuleSchema.safeParse(segment.ruleJson)

    if (!parsed.success) {
      continue
    }

    const shouldBeMember = evaluateSegmentRule(parsed.data, facts)
    const currentlyMember = Boolean(
      await segmentRepo.isMember(tenantId, segment.id, customerId, tx)
    )

    if (shouldBeMember && !currentlyMember) {
      await segmentRepo.addMember(tenantId, segment.id, customerId, tx)
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'crm.segment_entered',
        aggregateType: 'crm_segment',
        aggregateId: segment.id,
        customerId,
        payload: { segmentId: segment.id, segmentCode: segment.code },
      })
    } else if (!shouldBeMember && currentlyMember) {
      await segmentRepo.removeMember(tenantId, segment.id, customerId, tx)
      await appendDomainEvent(tx, {
        tenantId,
        eventType: 'crm.segment_exited',
        aggregateType: 'crm_segment',
        aggregateId: segment.id,
        customerId,
        payload: { segmentId: segment.id, segmentCode: segment.code },
      })
    }
  }
}

import { NotFoundError } from '#/server/auth/errors'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as customerRepo from '#/server/repos/customer-repo'
import * as timelineRepo from '#/server/repos/crm-timeline-repo'
import type { CurrentUserContext } from '#/types/auth'

// Timeline reads + manual notes. Event-sourced entries are written only by the
// projector; this service never fabricates them.

export async function listCustomerTimeline(
  _context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  filters: { entryType?: string; before?: Date; take?: number } = {}
) {
  const entries = await timelineRepo.listTimeline(tenantId, customerId, filters)

  return entries.map((entry) => ({ ...entry }))
}

export async function addManualNote(
  context: CurrentUserContext,
  tenantId: string,
  customerId: string,
  note: string
) {
  const customer = await customerRepo.findCustomerById(tenantId, customerId)

  if (!customer) {
    throw new NotFoundError('Customer not found.')
  }

  const entry = await timelineRepo.appendEntry(tenantId, {
    customerId,
    entryType: 'note',
    title: note.length > 120 ? `${note.slice(0, 117)}...` : note,
    summaryJson: { note },
    occurredAt: new Date(),
    createdByProfileId: context.profileId,
  })

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'crm.timeline_note',
    entityType: 'crm_timeline_entry',
    entityId: entry?.id ?? null,
    newValues: { customerId },
  })

  return entry ? { ...entry } : null
}

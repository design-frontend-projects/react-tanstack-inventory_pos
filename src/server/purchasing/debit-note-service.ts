import { NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as debitNoteLineRepo from '#/server/repos/pod-debit-note-line-repo'
import { serializeDebitNoteLine } from '#/server/purchasing/ap-dto'
import type { DebitNoteLineInput } from '#/server/repos/pod-debit-note-line-repo'
import type { CurrentUserContext } from '#/types/auth'

// Spec-005 extension of the Spec-002 debit note: itemised lines attached to an
// existing `financial_notes` header. The header's amount/lifecycle stays owned
// by the Spec-002 financial-note flow.

export async function setDebitNoteLines(
  context: CurrentUserContext,
  tenantId: string,
  financialNoteId: string,
  lines: Array<DebitNoteLineInput>,
) {
  const result = await prisma.$transaction(async (tx) => {
    const note = await tx.financialNote.findFirst({
      where: { id: financialNoteId, tenantId },
      select: { id: true, noteType: true },
    })

    if (!note) {
      throw new NotFoundError('Financial note not found.')
    }

    const replaced = await debitNoteLineRepo.replaceDebitNoteLines(
      tenantId,
      financialNoteId,
      lines,
      tx,
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'purchase.debit_note_lines',
        entityType: 'financial_note',
        entityId: financialNoteId,
        newValues: { lineCount: replaced.length },
      },
      tx,
    )

    return replaced
  })

  return result.map(serializeDebitNoteLine)
}

export async function listDebitNoteLines(
  _context: CurrentUserContext,
  tenantId: string,
  financialNoteId: string,
) {
  const lines = await debitNoteLineRepo.listDebitNoteLines(
    tenantId,
    financialNoteId,
  )

  return lines.map(serializeDebitNoteLine)
}

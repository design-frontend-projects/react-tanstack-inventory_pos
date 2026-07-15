import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { serializeFinancialNote } from '#/server/inventory/returns-dto'
import { assertTransition } from '#/server/inventory/state-machine'
import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as noteRepo from '#/server/repos/financial-note-repo'
import * as purchaseReturnRepo from '#/server/repos/purchase-return-repo'
import * as salesReturnRepo from '#/server/repos/sales-return-repo'
import type { CurrentUserContext } from '#/types/auth'

const ZERO = new Prisma.Decimal(0)

// A credit note settles a customer's account for a sales return: it carries the
// return's grand total and applies against the customer's receivable balance. No
// inventory effect — stock already re-entered when the return was received.
export async function createCreditNoteFromReturn(
  context: CurrentUserContext,
  tenantId: string,
  salesReturnId: string
) {
  const note = await prisma.$transaction(async (tx) => {
    const salesReturn = await salesReturnRepo.findSalesReturnById(tenantId, salesReturnId, tx)

    if (!salesReturn) {
      throw new NotFoundError('Sales return not found.')
    }

    if (!salesReturn.isPosted) {
      throw new ConflictError('Cannot issue a credit note before the return is received.')
    }

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'CREDIT_NOTE',
    })

    const created = await noteRepo.createNote(
      tenantId,
      {
        documentNumber,
        noteType: 'CREDIT',
        customerId: salesReturn.customerId,
        salesReturnId: salesReturn.id,
        reason: salesReturn.reason.toLowerCase(),
        currencyCode: salesReturn.currencyCode,
        amount: new Prisma.Decimal(salesReturn.grandTotal),
        createdByProfileId: context.profileId,
      },
      tx
    )

    // The return has been financially settled by the note.
    if (salesReturn.status.toLowerCase() === 'received') {
      await salesReturnRepo.updateSalesReturnStatus(tenantId, salesReturn.id, 'CREDITED', tx)
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'note.create',
        entityType: 'financial_note',
        entityId: created.id,
        newValues: { documentNumber, noteType: 'credit', salesReturnId: salesReturn.id },
      },
      tx
    )

    return created
  })

  return serializeFinancialNote(note)
}

// A debit note is the AP mirror: it records what a supplier owes for a posted
// purchase return, valued from the returned lines (qty × unit cost).
export async function createDebitNoteFromPurchaseReturn(
  context: CurrentUserContext,
  tenantId: string,
  purchaseReturnId: string
) {
  const note = await prisma.$transaction(async (tx) => {
    const purchaseReturn = await purchaseReturnRepo.findPurchaseReturnById(
      tenantId,
      purchaseReturnId,
      tx
    )

    if (!purchaseReturn) {
      throw new NotFoundError('Purchase return not found.')
    }

    if (!purchaseReturn.isPosted) {
      throw new ConflictError('Cannot issue a debit note before the return is shipped.')
    }

    const amount = purchaseReturn.lines.reduce((total, line) => {
      if (line.unitCost === null) {
        return total
      }

      return total.plus(new Prisma.Decimal(line.quantity).times(new Prisma.Decimal(line.unitCost)))
    }, ZERO)

    const documentNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'DEBIT_NOTE',
    })

    const created = await noteRepo.createNote(
      tenantId,
      {
        documentNumber,
        noteType: 'DEBIT',
        supplierId: purchaseReturn.supplierId,
        purchaseReturnId: purchaseReturn.id,
        reason: purchaseReturn.reason,
        amount,
        createdByProfileId: context.profileId,
      },
      tx
    )

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'note.create',
        entityType: 'financial_note',
        entityId: created.id,
        newValues: { documentNumber, noteType: 'debit', purchaseReturnId: purchaseReturn.id },
      },
      tx
    )

    return created
  })

  return serializeFinancialNote(note)
}

export async function issueNote(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const note = await noteRepo.findNoteById(tenantId, id)

  if (!note) {
    throw new NotFoundError('Note not found.')
  }

  assertTransition('note', note.status.toLowerCase(), 'issued')
  await noteRepo.issueNote(tenantId, id)

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'note.issue',
    entityType: 'financial_note',
    entityId: id,
  })

  const refreshed = await noteRepo.findNoteById(tenantId, id)

  return serializeFinancialNote(refreshed!)
}

// Applies (part of) the note against the counterparty balance; fully applied
// notes advance to APPLIED, partial applications stay ISSUED.
export async function applyNote(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  amount: Prisma.Decimal | string | number
) {
  const note = await prisma.$transaction(async (tx) => {
    const current = await noteRepo.findNoteById(tenantId, id, tx)

    if (!current) {
      throw new NotFoundError('Note not found.')
    }

    const applied = new Prisma.Decimal(amount)

    if (applied.lte(ZERO)) {
      throw new ConflictError('Applied amount must be positive.')
    }

    const newApplied = new Prisma.Decimal(current.appliedAmount).plus(applied)
    const total = new Prisma.Decimal(current.amount)

    if (newApplied.gt(total)) {
      throw new ConflictError('Applied amount exceeds the note total.')
    }

    const fullyApplied = newApplied.gte(total)

    if (fullyApplied) {
      assertTransition('note', current.status.toLowerCase(), 'applied')
    }

    await noteRepo.applyNote(tenantId, id, newApplied, fullyApplied ? 'APPLIED' : 'ISSUED', tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actorEmail: context.email,
        actionKey: 'note.apply',
        entityType: 'financial_note',
        entityId: id,
        newValues: { amount: applied.toString(), appliedAmount: newApplied.toString() },
      },
      tx
    )

    const refreshed = await noteRepo.findNoteById(tenantId, id, tx)

    return refreshed!
  })

  return serializeFinancialNote(note)
}

export async function cancelNote(
  context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const note = await noteRepo.findNoteById(tenantId, id)

  if (!note) {
    throw new NotFoundError('Note not found.')
  }

  assertTransition('note', note.status.toLowerCase(), 'cancelled')
  await noteRepo.updateNoteStatus(tenantId, id, 'CANCELLED')

  await createAuditLog({
    tenantId,
    actorProfileId: context.profileId,
    actorEmail: context.email,
    actionKey: 'note.cancel',
    entityType: 'financial_note',
    entityId: id,
  })

  const refreshed = await noteRepo.findNoteById(tenantId, id)

  return serializeFinancialNote(refreshed!)
}

export async function listNotes(_context: CurrentUserContext, tenantId: string) {
  const notes = await noteRepo.listNotes(tenantId, {})

  return notes.map(serializeFinancialNote)
}

export async function getNote(
  _context: CurrentUserContext,
  tenantId: string,
  id: string
) {
  const note = await noteRepo.findNoteById(tenantId, id)

  if (!note) {
    throw new NotFoundError('Note not found.')
  }

  return serializeFinancialNote(note)
}

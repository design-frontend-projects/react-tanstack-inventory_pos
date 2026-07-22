import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { serializeRecord, serializeRecords } from '#/server/hr/hr-dto'
import type { JournalLineInput } from '#/server/finance/journal-balancing'
import {
  createDraftEntry,
  postDraftEntry,
} from '#/server/finance/journal-service'
import { nextDocumentNumber } from '#/server/inventory/document-number-service'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as repo from '#/server/repos/hr-assets-expense-repo'
import type { CurrentUserContext } from '#/types/auth'

// Asset assignment (inventory integration) + travel & expense. Expense
// reimbursements post to the GL via the finance journal service (Dr expense,
// Cr payable/cash) — the same idempotent, balance-checked path payroll uses.

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

// --- Assets -----------------------------------------------------------------

export async function listAssets(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await repo.listAssets(tenantId, filters))
}

export async function assignAsset(
  context: CurrentUserContext,
  tenantId: string,
  input: repo.AssetWriteInput,
) {
  const asset = await repo.createAsset(tenantId, input, context.profileId)
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_employee_asset',
    asset.id,
    {
      name: asset.name,
    },
  )
  return serializeRecord(asset)
}

export async function returnAsset(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  conditionIn?: string | null,
) {
  const asset = await repo.returnAsset(
    tenantId,
    id,
    conditionIn ?? null,
    context.profileId,
  )
  if (!asset) throw new NotFoundError('Assigned asset not found.')
  await audit(
    context,
    tenantId,
    'hr.employee_manage',
    'hr_employee_asset',
    id,
    { action: 'return' },
  )
  return serializeRecord(asset)
}

// --- Travel -----------------------------------------------------------------

export async function listTravel(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { statusCode?: string } = {},
) {
  return serializeRecords(await repo.listTravel(tenantId, filters))
}

export interface TravelSubmitInput {
  employeeId: string
  purpose: string
  destination?: string | null
  travelType?: string
  departDate?: Date | null
  returnDate?: Date | null
  estimatedCost?: string | number
  advanceAmount?: string | number
  currencyCode?: string
}

export async function submitTravel(
  context: CurrentUserContext,
  tenantId: string,
  input: TravelSubmitInput,
) {
  const travel = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_TRAVEL_REQUEST',
    })
    return repo.createTravel(
      tenantId,
      { ...input, requestNumber },
      context.profileId,
      tx,
    )
  })
  await audit(
    context,
    tenantId,
    'hr.expense_manage',
    'hr_travel_request',
    travel.id,
    {
      requestNumber: travel.requestNumber,
    },
  )
  return serializeRecord(travel)
}

export async function decideTravel(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  decision: 'approved' | 'rejected',
) {
  await repo.updateTravelStatus(tenantId, id, decision, context.profileId)
  await audit(
    context,
    tenantId,
    'hr.expense_approve',
    'hr_travel_request',
    id,
    { decision },
  )
  return { id, statusCode: decision }
}

// --- Expense claims ---------------------------------------------------------

export async function listClaims(
  _c: CurrentUserContext,
  tenantId: string,
  filters: { employeeId?: string; statusCode?: string } = {},
) {
  return serializeRecords(await repo.listClaims(tenantId, filters))
}

export async function getClaim(
  _c: CurrentUserContext,
  tenantId: string,
  id: string,
) {
  const claim = await repo.findClaimById(tenantId, id)
  if (!claim) throw new NotFoundError('Expense claim not found.')
  return { ...serializeRecord(claim), lines: serializeRecords(claim.lines) }
}

export interface ExpenseClaimInput {
  employeeId: string
  title: string
  travelRequestId?: string | null
  claimDate?: Date | null
  currencyCode?: string
  costCenterId?: string | null
  lines: Array<{
    expenseDate?: Date | null
    category?: string
    description?: string | null
    amount: string | number
    taxAmount?: string | number
    receiptUrl?: string | null
  }>
}

export async function submitClaim(
  context: CurrentUserContext,
  tenantId: string,
  input: ExpenseClaimInput,
) {
  if (input.lines.length === 0) {
    throw new ValidationError('An expense claim needs at least one line.')
  }
  const total = input.lines.reduce(
    (sum, line) => sum + Number(line.amount) + Number(line.taxAmount ?? 0),
    0,
  )

  const claim = await prisma.$transaction(async (tx) => {
    const claimNumber = await nextDocumentNumber(tx, {
      tenantId,
      documentType: 'HR_EXPENSE_CLAIM',
    })
    return repo.createClaim(
      tenantId,
      { ...input, claimNumber },
      total,
      context.profileId,
      tx,
    )
  })

  await audit(
    context,
    tenantId,
    'hr.expense_manage',
    'hr_expense_claim',
    claim.id,
    {
      claimNumber: claim.claimNumber,
      total,
    },
  )
  return { ...serializeRecord(claim), lines: serializeRecords(claim.lines) }
}

export async function decideClaim(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  decision: 'approved' | 'rejected',
) {
  const claim = await repo.findClaimById(tenantId, id)
  if (!claim) throw new NotFoundError('Expense claim not found.')
  if (claim.statusCode !== 'submitted') {
    throw new ConflictError('Only a submitted claim can be decided.')
  }
  await repo.updateClaimStatus(
    tenantId,
    id,
    decision,
    decision === 'approved' ? { approvedAmount: claim.totalAmount } : {},
    context.profileId,
  )
  await audit(context, tenantId, 'hr.expense_approve', 'hr_expense_claim', id, {
    decision,
  })
  return { id, statusCode: decision }
}

export interface ReimburseInput {
  expenseAccountId: string
  payableAccountId: string
}

// Reimburses an approved claim: Dr expense, Cr cash/payable, records the
// reimbursement, and flips the claim to 'posted'. Requires finance configured.
export async function reimburseClaim(
  context: CurrentUserContext,
  tenantId: string,
  id: string,
  input: ReimburseInput,
) {
  const claim = await repo.findClaimById(tenantId, id)
  if (!claim) throw new NotFoundError('Expense claim not found.')
  if (claim.statusCode !== 'approved') {
    throw new ConflictError('Only an approved claim can be reimbursed.')
  }

  const amount = Number(claim.approvedAmount) || Number(claim.totalAmount)
  const currency = claim.currencyCode
  const lines: Array<JournalLineInput> = [
    {
      accountId: input.expenseAccountId,
      currencyCode: currency,
      debitAmount: amount,
      description: `Expense claim ${claim.claimNumber}`,
    },
    {
      accountId: input.payableAccountId,
      currencyCode: currency,
      creditAmount: amount,
      description: `Reimbursement ${claim.claimNumber}`,
    },
  ]

  const draft = await createDraftEntry(context, tenantId, {
    journalTypeCode: 'general',
    entryDate: new Date(),
    referenceNumber: claim.claimNumber,
    memo: `Expense reimbursement ${claim.claimNumber}`,
    lines,
  })
  await postDraftEntry(context, tenantId, draft.id)

  await prisma.$transaction(async (tx) => {
    await repo.createReimbursement(
      tenantId,
      {
        claimId: id,
        employeeId: claim.employeeId,
        amount,
        currencyCode: currency,
        journalEntryId: draft.id,
      },
      context.profileId,
      tx,
    )
    await repo.updateClaimStatus(
      tenantId,
      id,
      'posted',
      { journalEntryId: draft.id },
      context.profileId,
      tx,
    )
  })

  await audit(context, tenantId, 'hr.expense_approve', 'hr_expense_claim', id, {
    action: 'reimburse',
    journalEntryId: draft.id,
  })
  return { id, statusCode: 'posted', journalEntryId: draft.id }
}

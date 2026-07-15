import { prisma } from '#/server/db/client'
import type {
  NoteStatus,
  NoteType,
  Prisma,
} from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface FinancialNoteCreateInput {
  documentNumber: string
  noteType: NoteType
  customerId?: string | null
  supplierId?: string | null
  salesReturnId?: string | null
  purchaseReturnId?: string | null
  salesInvoiceId?: string | null
  reason?: string | null
  currencyCode?: string
  amount: Prisma.Decimal | string | number
  createdByProfileId?: string | null
}

export function findNoteById(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  return client.financialNote.findFirst({ where: { id, tenantId } })
}

export function listNotes(
  tenantId: string,
  filters: { noteType?: NoteType; status?: NoteStatus; take?: number } = {},
  client: PrismaClientLike = prisma
) {
  return client.financialNote.findMany({
    where: {
      tenantId,
      ...(filters.noteType ? { noteType: filters.noteType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { noteDate: 'desc' },
    take: filters.take ?? 50,
  })
}

export function createNote(
  tenantId: string,
  input: FinancialNoteCreateInput,
  client: PrismaClientLike = prisma
) {
  return client.financialNote.create({
    data: {
      tenantId,
      documentNumber: input.documentNumber,
      noteType: input.noteType,
      customerId: input.customerId ?? null,
      supplierId: input.supplierId ?? null,
      salesReturnId: input.salesReturnId ?? null,
      purchaseReturnId: input.purchaseReturnId ?? null,
      salesInvoiceId: input.salesInvoiceId ?? null,
      reason: input.reason ?? null,
      currencyCode: input.currencyCode ?? 'USD',
      amount: input.amount,
      createdByProfileId: input.createdByProfileId ?? null,
    },
  })
}

export async function issueNote(
  tenantId: string,
  id: string,
  client: PrismaClientLike = prisma
) {
  const result = await client.financialNote.updateMany({
    where: { id, tenantId, status: 'DRAFT' },
    data: { status: 'ISSUED', issuedAt: new Date() },
  })

  return result.count > 0
}

export async function applyNote(
  tenantId: string,
  id: string,
  appliedAmount: Prisma.Decimal | string | number,
  status: NoteStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.financialNote.updateMany({
    where: { id, tenantId },
    data: { appliedAmount, status },
  })

  return result.count > 0
}

export async function updateNoteStatus(
  tenantId: string,
  id: string,
  status: NoteStatus,
  client: PrismaClientLike = prisma
) {
  const result = await client.financialNote.updateMany({
    where: { id, tenantId },
    data: { status },
  })

  return result.count > 0
}

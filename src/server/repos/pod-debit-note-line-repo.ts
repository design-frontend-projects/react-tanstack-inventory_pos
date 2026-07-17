import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface DebitNoteLineInput {
  reasonId?: string | null
  productId?: string | null
  description?: string | null
  quantity?: Prisma.Decimal | string | number | null
  unitCost?: Prisma.Decimal | string | number | null
  amount: Prisma.Decimal | string | number
  taxAmount?: Prisma.Decimal | string | number | null
  purchaseReturnId?: string | null
}

// Debit-note line items attach to an existing `financial_notes` header (the
// Spec-002 debit note). Lines are replaced as a set — the note's `amount`
// stays owned by the note itself.
export async function replaceDebitNoteLines(
  tenantId: string,
  financialNoteId: string,
  lines: Array<DebitNoteLineInput>,
  client: PrismaClientLike = prisma,
) {
  await client.podDebitNoteLine.deleteMany({
    where: { tenantId, financialNoteId },
  })

  if (lines.length === 0) {
    return []
  }

  await client.podDebitNoteLine.createMany({
    data: lines.map((line, index) => ({
      tenantId,
      financialNoteId,
      lineNo: index + 1,
      reasonId: line.reasonId ?? null,
      productId: line.productId ?? null,
      description: line.description ?? null,
      quantity: line.quantity ?? null,
      unitCost: line.unitCost ?? null,
      amount: line.amount,
      taxAmount: line.taxAmount ?? 0,
      purchaseReturnId: line.purchaseReturnId ?? null,
    })),
  })

  return listDebitNoteLines(tenantId, financialNoteId, client)
}

export function listDebitNoteLines(
  tenantId: string,
  financialNoteId: string,
  client: PrismaClientLike = prisma,
) {
  return client.podDebitNoteLine.findMany({
    where: { tenantId, financialNoteId },
    orderBy: { lineNo: 'asc' },
  })
}

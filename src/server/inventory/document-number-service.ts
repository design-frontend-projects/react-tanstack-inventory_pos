import { Prisma } from '#/server/db/generated/prisma/client'
import type { DocumentType } from '#/server/db/generated/prisma/client'

// Per-tenant, per-document-type sequential number generator. The counter is
// advanced with an atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` so
// concurrent callers never collide on a number, without holding an application
// lock. It MUST run inside the document's posting transaction (takes a
// `Prisma.TransactionClient`) so the number and the document commit together.

const DEFAULT_PREFIX: Record<DocumentType, string> = {
  PURCHASE_REQUISITION: 'PR',
  PURCHASE_ORDER: 'PO',
  GOODS_RECEIPT: 'GRN',
  PURCHASE_RETURN: 'PRT',
  DEBIT_NOTE: 'DN',
  SALES_ORDER: 'SO',
  SALES_INVOICE: 'INV',
  POS_SALE: 'POS',
  SALES_RETURN: 'SRT',
  CREDIT_NOTE: 'CN',
  STOCK_TRANSFER: 'TRF',
  STOCK_ADJUSTMENT: 'ADJ',
  STOCK_COUNT: 'CNT',
  PRODUCTION_ORDER: 'MO',
}

export interface NextDocumentNumberInput {
  tenantId: string
  documentType: DocumentType
  scope?: string
  periodKey?: string
  prefix?: string
  padding?: number
}

export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  input: NextDocumentNumberInput
): Promise<string> {
  const scope = input.scope ?? 'default'
  const periodKey = input.periodKey ?? 'all'
  const padding = input.padding ?? 6
  const prefix = input.prefix ?? DEFAULT_PREFIX[input.documentType]

  const rows = await tx.$queryRaw<Array<{ consumed: number }>>(Prisma.sql`
    INSERT INTO document_sequences
      (id, tenant_id, document_type, scope, period_key, prefix, padding, next_value, created_at, updated_at)
    VALUES
      (gen_random_uuid(), ${input.tenantId}::uuid, ${input.documentType}::"DocumentType",
       ${scope}, ${periodKey}, ${prefix}, ${padding}, 2, now(), now())
    ON CONFLICT (tenant_id, document_type, scope, period_key)
    DO UPDATE SET next_value = document_sequences.next_value + 1, updated_at = now()
    RETURNING (document_sequences.next_value - 1)::int AS consumed
  `)

  const consumed = rows[0]?.consumed ?? 1

  return formatDocumentNumber({ prefix, scope, periodKey, consumed, padding })
}

export function formatDocumentNumber(input: {
  prefix: string
  scope: string
  periodKey: string
  consumed: number
  padding: number
}): string {
  const sequence = String(input.consumed).padStart(input.padding, '0')
  const segments = [input.prefix]

  if (input.periodKey !== 'all') {
    segments.push(input.periodKey)
  }

  if (input.scope !== 'default') {
    segments.push(input.scope)
  }

  segments.push(sequence)

  return segments.join('-')
}

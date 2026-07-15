import { prisma } from '#/server/db/client'
import type { ResSequenceType } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

export interface ResNumberSequenceWriteInput {
  branchId: string
  sequenceType: ResSequenceType
  prefix?: string | null
  pattern?: string | null
  padding?: number
  periodKey?: string
}

export function listSequences(
  tenantId: string,
  branchId: string,
  client: PrismaClientLike = prisma
) {
  return client.resNumberSequence.findMany({
    where: { tenantId, branchId },
    orderBy: { sequenceType: 'asc' },
  })
}

export function upsertSequence(
  tenantId: string,
  input: ResNumberSequenceWriteInput,
  client: PrismaClientLike = prisma
) {
  const periodKey = input.periodKey ?? '-'
  return client.resNumberSequence.upsert({
    where: {
      tenantId_branchId_sequenceType_periodKey: {
        tenantId,
        branchId: input.branchId,
        sequenceType: input.sequenceType,
        periodKey,
      },
    },
    create: {
      tenantId,
      branchId: input.branchId,
      sequenceType: input.sequenceType,
      prefix: input.prefix ?? null,
      pattern: input.pattern ?? null,
      padding: input.padding ?? 4,
      periodKey,
    },
    update: {
      ...(input.prefix !== undefined ? { prefix: input.prefix ?? null } : {}),
      ...(input.pattern !== undefined ? { pattern: input.pattern ?? null } : {}),
      ...(input.padding !== undefined ? { padding: input.padding } : {}),
    },
  })
}

export interface IssuedNumber {
  value: bigint
  formatted: string
}

// Atomically issue the next number for (tenant, branch, sequenceType, periodKey).
// The row-level `increment` serializes concurrent callers; the issued value is the
// pre-increment `nextValue`. Pass a transaction client to enlist in the caller's tx.
export async function issueNextNumber(
  tenantId: string,
  input: { branchId: string; sequenceType: ResSequenceType; periodKey?: string },
  client: PrismaClientLike = prisma
): Promise<IssuedNumber> {
  const periodKey = input.periodKey ?? '-'

  // Ensure the sequence row exists (no-op update keeps it idempotent).
  const seq = await client.resNumberSequence.upsert({
    where: {
      tenantId_branchId_sequenceType_periodKey: {
        tenantId,
        branchId: input.branchId,
        sequenceType: input.sequenceType,
        periodKey,
      },
    },
    create: {
      tenantId,
      branchId: input.branchId,
      sequenceType: input.sequenceType,
      periodKey,
    },
    update: {},
  })

  const updated = await client.resNumberSequence.update({
    where: { id: seq.id },
    data: { nextValue: { increment: 1 } },
  })

  const issued = updated.nextValue - 1n
  return { value: issued, formatted: formatSequenceValue(seq.prefix, seq.padding, issued) }
}

export function formatSequenceValue(
  prefix: string | null,
  padding: number,
  value: bigint
): string {
  const digits = value.toString().padStart(Math.max(0, padding), '0')
  return `${prefix ?? ''}${digits}`
}

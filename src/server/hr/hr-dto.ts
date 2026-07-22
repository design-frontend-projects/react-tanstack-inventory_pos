import type { Prisma } from '#/server/db/generated/prisma/client'

// Serializers for the HR module. Prisma `Decimal` and `DateTime` values are
// converted to primitives (string / ISO string) so the wire payload is plain
// JSON — mirrors the inventory/finance DTO convention.

type DecimalLike = Prisma.Decimal | number | string | null | undefined

export function decimalToString(value: DecimalLike): string | null {
  if (value === null || value === undefined) {
    return null
  }

  return typeof value === 'string' ? value : value.toString()
}

export function dateToIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

// Generic pass-through serializer that stringifies any Decimal columns found on
// a record. Feature code reads the returned plain object directly.
export function serializeRecord<T extends Record<string, unknown>>(
  record: T,
): { [K in keyof T]: T[K] extends Prisma.Decimal ? string : T[K] } {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object' && 'toFixed' in value) {
      output[key] = (value as Prisma.Decimal).toString()
    } else {
      output[key] = value
    }
  }

  return output as {
    [K in keyof T]: T[K] extends Prisma.Decimal ? string : T[K]
  }
}

export function serializeRecords<T extends Record<string, unknown>>(
  records: Array<T>,
): Array<{ [K in keyof T]: T[K] extends Prisma.Decimal ? string : T[K] }> {
  return records.map(serializeRecord)
}

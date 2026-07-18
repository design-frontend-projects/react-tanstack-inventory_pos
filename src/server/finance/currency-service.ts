import { Prisma } from '#/server/db/generated/prisma/client'
import { prisma } from '#/server/db/client'
import { ConflictError } from '#/server/auth/errors'
import * as currencyRepo from '#/server/repos/fin-currency-repo'
import type { PrismaClientLike } from '#/server/db/types'

// Currency conversion for the posting engine: effective-dated rate lookup with
// inverse-pair fallback. Base = txn amount x rate, rounded to 4dp.

const ONE = new Prisma.Decimal(1)

// Pure.
export function convertToBase(
  amount: Prisma.Decimal | string | number,
  rate: Prisma.Decimal | string | number,
): Prisma.Decimal {
  return new Prisma.Decimal(amount)
    .times(new Prisma.Decimal(rate))
    .toDecimalPlaces(4)
}

// Pure.
export function invertRate(
  rate: Prisma.Decimal | string | number,
): Prisma.Decimal {
  const value = new Prisma.Decimal(rate)

  if (value.isZero()) {
    throw new ConflictError('Cannot invert a zero exchange rate.')
  }

  return ONE.dividedBy(value).toDecimalPlaces(8)
}

// Rate from → to effective at a date. Falls back to the inverse pair; same
// currency is always 1. Throws when no rate exists so mispriced postings are
// never silently created.
export async function getEffectiveRate(
  tenantId: string,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  onDate: Date,
  rateType = 'spot',
  client: PrismaClientLike = prisma,
): Promise<Prisma.Decimal> {
  if (fromCurrencyCode === toCurrencyCode) {
    return ONE
  }

  const direct = await currencyRepo.findEffectiveRate(
    tenantId,
    fromCurrencyCode,
    toCurrencyCode,
    onDate,
    rateType,
    client,
  )

  if (direct) {
    return direct.rate
  }

  const inverse = await currencyRepo.findEffectiveRate(
    tenantId,
    toCurrencyCode,
    fromCurrencyCode,
    onDate,
    rateType,
    client,
  )

  if (inverse) {
    return invertRate(inverse.rate)
  }

  throw new ConflictError(
    `No ${rateType} exchange rate for ${fromCurrencyCode} -> ${toCurrencyCode} on or before ${onDate.toISOString().slice(0, 10)}.`,
  )
}

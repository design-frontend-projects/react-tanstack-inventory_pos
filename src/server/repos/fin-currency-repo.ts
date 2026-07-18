import { prisma } from '#/server/db/client'
import { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Accounting currency master (system rows + tenant overrides) and
// effective-dated exchange rates.

export function listCurrencies(
  tenantId: string,
  client: PrismaClientLike = prisma,
) {
  return client.finCurrency.findMany({
    where: { OR: [{ tenantId }, { tenantId: null }], isActive: true },
    orderBy: { code: 'asc' },
  })
}

export function findCurrencyByCode(
  tenantId: string,
  code: string,
  client: PrismaClientLike = prisma,
) {
  return client.finCurrency.findFirst({
    where: { code, OR: [{ tenantId }, { tenantId: null }], isActive: true },
    orderBy: { tenantId: { sort: 'desc', nulls: 'last' } },
  })
}

// Latest rate at or before the given date for (from → to, rateType); the
// caller falls back to the inverse pair or a default when nothing matches.
export function findEffectiveRate(
  tenantId: string,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  onDate: Date,
  rateType = 'spot',
  client: PrismaClientLike = prisma,
) {
  return client.finExchangeRate.findFirst({
    where: {
      tenantId,
      fromCurrencyCode,
      toCurrencyCode,
      rateType,
      rateDate: { lte: onDate },
    },
    orderBy: { rateDate: 'desc' },
  })
}

export interface FinExchangeRateUpsertInput {
  fromCurrencyCode: string
  toCurrencyCode: string
  rateDate: Date
  rate: Prisma.Decimal | string | number
  rateType?: string
  source?: string
}

export function upsertRate(
  tenantId: string,
  input: FinExchangeRateUpsertInput,
  createdBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  return client.finExchangeRate.upsert({
    where: {
      tenantId_fromCurrencyCode_toCurrencyCode_rateDate_rateType: {
        tenantId,
        fromCurrencyCode: input.fromCurrencyCode,
        toCurrencyCode: input.toCurrencyCode,
        rateDate: input.rateDate,
        rateType: input.rateType ?? 'spot',
      },
    },
    create: {
      tenantId,
      fromCurrencyCode: input.fromCurrencyCode,
      toCurrencyCode: input.toCurrencyCode,
      rateDate: input.rateDate,
      rate: new Prisma.Decimal(input.rate),
      rateType: input.rateType ?? 'spot',
      source: input.source ?? 'manual',
      createdBy,
    },
    update: {
      rate: new Prisma.Decimal(input.rate),
      source: input.source ?? 'manual',
    },
  })
}

export function listRates(
  tenantId: string,
  options: {
    fromCurrencyCode?: string
    toCurrencyCode?: string
    take?: number
  } = {},
  client: PrismaClientLike = prisma,
) {
  return client.finExchangeRate.findMany({
    where: {
      tenantId,
      ...(options.fromCurrencyCode
        ? { fromCurrencyCode: options.fromCurrencyCode }
        : {}),
      ...(options.toCurrencyCode
        ? { toCurrencyCode: options.toCurrencyCode }
        : {}),
    },
    orderBy: { rateDate: 'desc' },
    take: options.take ?? 100,
  })
}

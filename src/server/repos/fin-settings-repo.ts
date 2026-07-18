import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'
import type { PrismaClientLike } from '#/server/db/types'

// Per-tenant finance settings singleton (default accounts, base currency,
// posting behavior). Created by initializeTenantFinance().

export type FinSettingsRecord = Prisma.FinSettingsGetPayload<object>

export function findSettings(
  tenantId: string,
  client: PrismaClientLike = prisma,
): Promise<FinSettingsRecord | null> {
  return client.finSettings.findFirst({ where: { tenantId } })
}

export type FinSettingsUpdateInput = Partial<
  Pick<
    Prisma.FinSettingsUncheckedCreateInput,
    | 'baseCurrencyCode'
    | 'retainedEarningsAccountId'
    | 'fxRealizedGainAccountId'
    | 'fxRealizedLossAccountId'
    | 'fxUnrealizedGainAccountId'
    | 'fxUnrealizedLossAccountId'
    | 'roundingAccountId'
    | 'suspenseAccountId'
    | 'defaultArControlAccountId'
    | 'defaultApControlAccountId'
    | 'grniAccountId'
    | 'inventoryAccountId'
    | 'cogsAccountId'
    | 'salesRevenueAccountId'
    | 'salesDiscountAccountId'
    | 'bankClearingAccountId'
    | 'writeOffAccountId'
    | 'strictAccountResolution'
    | 'financeStartDate'
  >
> & { postingModes?: Prisma.InputJsonValue }

export function createSettings(
  tenantId: string,
  input: FinSettingsUpdateInput & { isInitialized?: boolean },
  createdBy: string | null = null,
  client: PrismaClientLike = prisma,
): Promise<FinSettingsRecord> {
  return client.finSettings.create({
    data: {
      tenantId,
      ...input,
      createdBy,
      updatedBy: createdBy,
    },
  })
}

export async function updateSettings(
  tenantId: string,
  input: FinSettingsUpdateInput & { isInitialized?: boolean },
  updatedBy: string | null = null,
  client: PrismaClientLike = prisma,
) {
  const result = await client.finSettings.updateMany({
    where: { tenantId },
    data: { ...input, updatedBy, versionNumber: { increment: 1 } },
  })

  return result.count > 0
}

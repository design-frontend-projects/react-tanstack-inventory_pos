import { ConflictError, NotFoundError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as accountRepo from '#/server/repos/fin-account-repo'
import * as settingsRepo from '#/server/repos/fin-settings-repo'
import { serializeSettings } from '#/server/finance/finance-dto'
import type { FinSettingsDto } from '#/server/finance/finance-dto'
import type { CurrentUserContext } from '#/types/auth'
import type { PrismaClientLike } from '#/server/db/types'

// Tenant finance settings: default accounts, base currency, posting behavior.

export async function requireSettings(
  tenantId: string,
  client: PrismaClientLike = prisma,
): Promise<settingsRepo.FinSettingsRecord> {
  const settings = await settingsRepo.findSettings(tenantId, client)

  if (!settings) {
    throw new ConflictError(
      'Finance is not initialized for this tenant. Run finance bootstrap first.',
    )
  }

  return settings
}

export async function getSettings(tenantId: string): Promise<FinSettingsDto> {
  return serializeSettings(await requireSettings(tenantId))
}

const ACCOUNT_REFERENCE_FIELDS = [
  'retainedEarningsAccountId',
  'fxRealizedGainAccountId',
  'fxRealizedLossAccountId',
  'fxUnrealizedGainAccountId',
  'fxUnrealizedLossAccountId',
  'roundingAccountId',
  'suspenseAccountId',
  'defaultArControlAccountId',
  'defaultApControlAccountId',
  'grniAccountId',
  'inventoryAccountId',
  'cogsAccountId',
  'salesRevenueAccountId',
  'salesDiscountAccountId',
  'bankClearingAccountId',
  'writeOffAccountId',
] as const satisfies ReadonlyArray<keyof settingsRepo.FinSettingsUpdateInput>

export async function updateSettings(
  context: CurrentUserContext,
  tenantId: string,
  input: settingsRepo.FinSettingsUpdateInput,
): Promise<FinSettingsDto> {
  await requireSettings(tenantId)

  // Every referenced account must exist, be active, and belong to the tenant.
  for (const field of ACCOUNT_REFERENCE_FIELDS) {
    const accountId = input[field]

    if (typeof accountId === 'string') {
      const account = await accountRepo.findAccountById(tenantId, accountId)

      if (!account || !account.isActive) {
        throw new NotFoundError(
          `Settings field ${field} references a missing or inactive account.`,
        )
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await settingsRepo.updateSettings(tenantId, input, context.profileId, tx)

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.settings_updated',
        entityType: 'fin_settings',
        newValues: input as Record<string, unknown>,
      },
      tx,
    )
  })

  return getSettings(tenantId)
}

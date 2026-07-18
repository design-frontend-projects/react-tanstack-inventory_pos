import { ConflictError } from '#/server/auth/errors'
import { prisma } from '#/server/db/client'
import { createAuditLog } from '#/server/repos/audit-log-repo'
import * as accountRepo from '#/server/repos/fin-account-repo'
import * as fiscalRepo from '#/server/repos/fin-fiscal-repo'
import * as settingsRepo from '#/server/repos/fin-settings-repo'
import {
  DEFAULT_COA_TEMPLATE,
  templateLevel,
  templatePath,
  validateCoaTemplate,
} from '#/server/finance/coa-template'
import {
  generatePeriods,
  yearEndDate,
} from '#/server/finance/period-resolution'
import type { CurrentUserContext } from '#/types/auth'

// One-time tenant finance bootstrap: settings singleton + default COA +
// current fiscal year (first period open). Idempotent: refuses to run twice.

export interface InitializeTenantFinanceInput {
  baseCurrencyCode?: string
  fiscalYearStart: Date
  fiscalYearCode?: string
  includeAdjustmentPeriod?: boolean
}

export async function initializeTenantFinance(
  context: CurrentUserContext,
  tenantId: string,
  input: InitializeTenantFinanceInput,
): Promise<{ accountCount: number; fiscalYearId: string }> {
  const existing = await settingsRepo.findSettings(tenantId)

  if (existing?.isInitialized) {
    throw new ConflictError('Finance is already initialized for this tenant.')
  }

  validateCoaTemplate(DEFAULT_COA_TEMPLATE)

  const accountTypes = await accountRepo.listAccountTypes(tenantId)
  const typeByCode = new Map(accountTypes.map((type) => [type.code, type]))

  for (const entry of DEFAULT_COA_TEMPLATE) {
    if (!typeByCode.has(entry.accountTypeCode)) {
      throw new ConflictError(
        `Seeded account type ${entry.accountTypeCode} is missing — run migrations first.`,
      )
    }
  }

  const byCode = new Map(
    DEFAULT_COA_TEMPLATE.map((entry) => [entry.code, entry]),
  )

  const result = await prisma.$transaction(async (tx) => {
    // 1. Chart of accounts (parents before children — template is ordered,
    //    but resolve parent ids explicitly to be safe).
    const idByCode = new Map<string, string>()
    const settingsAccounts: Record<string, string> = {}

    for (const entry of DEFAULT_COA_TEMPLATE) {
      const parentId = entry.parentCode
        ? (idByCode.get(entry.parentCode) ?? null)
        : null

      const account = await accountRepo.createAccount(
        tenantId,
        {
          code: entry.code,
          name: entry.name,
          nameAr: entry.nameAr,
          parentAccountId: parentId,
          accountTypeId: typeByCode.get(entry.accountTypeCode)!.id,
          level: templateLevel(entry, byCode),
          path: templatePath(entry, byCode),
          isLeaf: !DEFAULT_COA_TEMPLATE.some(
            (candidate) => candidate.parentCode === entry.code,
          ),
          isControlAccount: entry.isControlAccount ?? false,
          controlDomain: entry.controlDomain ?? null,
          allowManualJournal: entry.allowManualJournal ?? true,
          createdBy: context.profileId,
        },
        tx,
      )

      idByCode.set(entry.code, account.id)

      if (entry.settingsRole) {
        settingsAccounts[entry.settingsRole] = account.id
      }
    }

    // 2. Fiscal year with monthly periods; first period opens immediately.
    const periods = generatePeriods(input.fiscalYearStart, 12, {
      includeAdjustmentPeriod: input.includeAdjustmentPeriod ?? false,
    })

    const fiscalYear = await fiscalRepo.createFiscalYear(
      tenantId,
      {
        code:
          input.fiscalYearCode ?? `FY${input.fiscalYearStart.getUTCFullYear()}`,
        startDate: input.fiscalYearStart,
        endDate: yearEndDate(periods),
        createdBy: context.profileId,
        periods: periods.map((period, index) => ({
          ...period,
          statusCode: index === 0 ? 'open' : 'future',
        })),
      },
      tx,
    )

    // 3. Settings singleton wired to the template's role accounts.
    if (existing) {
      await settingsRepo.updateSettings(
        tenantId,
        {
          baseCurrencyCode: input.baseCurrencyCode ?? 'USD',
          ...settingsAccounts,
          isInitialized: true,
        },
        context.profileId,
        tx,
      )
    } else {
      await settingsRepo.createSettings(
        tenantId,
        {
          baseCurrencyCode: input.baseCurrencyCode ?? 'USD',
          ...settingsAccounts,
          isInitialized: true,
        },
        context.profileId,
        tx,
      )
    }

    await createAuditLog(
      {
        tenantId,
        actorProfileId: context.profileId,
        actionKey: 'finance.initialized',
        entityType: 'fin_settings',
        newValues: {
          baseCurrencyCode: input.baseCurrencyCode ?? 'USD',
          accountCount: idByCode.size,
          fiscalYearId: fiscalYear.id,
        },
      },
      tx,
    )

    return { accountCount: idByCode.size, fiscalYearId: fiscalYear.id }
  })

  return result
}

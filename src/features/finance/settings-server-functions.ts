import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import * as bootstrapService from '#/server/finance/bootstrap-service'
import * as settingsService from '#/server/finance/settings-service'
import {
  serializeExchangeRate,
  serializePostingRule,
} from '#/server/finance/finance-dto'
import * as currencyRepo from '#/server/repos/fin-currency-repo'
import * as postingRuleRepo from '#/server/repos/fin-posting-rule-repo'
import { getCurrentUserContext } from '#/server/auth/session'
import {
  requirePermission,
  requireTenantAccess,
} from '#/server/auth/tenant-guard'
import type { CurrentUserContext } from '#/types/auth'
import {
  bootstrapSchema,
  exchangeRateListSchema,
  exchangeRateUpsertSchema,
  postingRuleUpsertSchema,
  settingsUpdateSchema,
} from '#/features/finance/finance-validation'

const base = z.object({
  accessToken: z.string().min(1),
  tenantId: z.string().uuid(),
})

async function resolveContext(
  data: { accessToken: string; tenantId: string },
  permission: Array<string> | string,
): Promise<CurrentUserContext> {
  return requirePermission(
    requireTenantAccess(
      await getCurrentUserContext({
        accessToken: data.accessToken,
        tenantId: data.tenantId,
      }),
      data.tenantId,
    ),
    permission,
  )
}

export const getFinSettingsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.settings_manage')
    return settingsService.getSettings(data.tenantId)
  })

export const updateFinSettingsServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: settingsUpdateSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.settings_manage')
    return settingsService.updateSettings(context, data.tenantId, data.input)
  })

export const initializeFinanceServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: bootstrapSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.settings_manage')
    return bootstrapService.initializeTenantFinance(
      context,
      data.tenantId,
      data.input,
    )
  })

export const listFinCurrenciesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.settings_manage')
    return currencyRepo.listCurrencies(data.tenantId)
  })

export const listExchangeRatesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: exchangeRateListSchema.optional() }))
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.settings_manage')
    const rates = await currencyRepo.listRates(data.tenantId, data.input ?? {})
    return rates.map(serializeExchangeRate)
  })

export const upsertExchangeRateServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: exchangeRateUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.settings_manage')
    const rate = await currencyRepo.upsertRate(
      data.tenantId,
      data.input,
      context.profileId,
    )
    return serializeExchangeRate(rate)
  })

export const listPostingRulesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base)
  .handler(async ({ data }) => {
    await resolveContext(data, 'finance.posting_manage')
    const rules = await postingRuleRepo.listRules(data.tenantId)
    return rules.map(serializePostingRule)
  })

export const upsertPostingRuleServerFn = createServerFn({ method: 'POST' })
  .inputValidator(base.extend({ input: postingRuleUpsertSchema }))
  .handler(async ({ data }) => {
    const context = await resolveContext(data, 'finance.posting_manage')
    const rule = await postingRuleRepo.upsertTenantRule(
      data.tenantId,
      data.input,
      context.profileId,
    )
    return serializePostingRule(rule)
  })

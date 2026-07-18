import type { Prisma } from '#/server/db/generated/prisma/client'
import type { FinAccountWithType } from '#/server/repos/fin-account-repo'
import type { FinFiscalYearWithPeriods } from '#/server/repos/fin-fiscal-repo'
import type { FinJournalEntryWithLines } from '#/server/repos/fin-journal-repo'
import type { FinPostingRuleWithLines } from '#/server/repos/fin-posting-rule-repo'
import type { FinSettingsRecord } from '#/server/repos/fin-settings-repo'
import type { TrialBalanceRow } from '#/server/repos/fin-gl-balance-repo'

// Network-boundary serializers: Prisma Decimal -> string, Date passthrough
// (TanStack serializes Dates natively). Every server function returns these.

export function serializeAccount(account: FinAccountWithType) {
  return {
    ...account,
    accountType: {
      ...account.accountType,
      accountClass: { ...account.accountType.accountClass },
    },
  }
}

export type FinAccountDto = ReturnType<typeof serializeAccount>

export function serializeFiscalYear(year: FinFiscalYearWithPeriods) {
  return {
    ...year,
    periods: year.periods.map((period) => ({ ...period })),
  }
}

export type FiscalYearDto = ReturnType<typeof serializeFiscalYear>

export function serializeJournalEntry(entry: FinJournalEntryWithLines) {
  return {
    ...entry,
    totalBaseDebit: entry.totalBaseDebit.toString(),
    totalBaseCredit: entry.totalBaseCredit.toString(),
    lines: entry.lines.map((line) => ({
      ...line,
      exchangeRate: line.exchangeRate.toString(),
      debitAmount: line.debitAmount.toString(),
      creditAmount: line.creditAmount.toString(),
      baseDebitAmount: line.baseDebitAmount.toString(),
      baseCreditAmount: line.baseCreditAmount.toString(),
    })),
  }
}

export type JournalEntryDto = ReturnType<typeof serializeJournalEntry>

export function serializeSettings(settings: FinSettingsRecord) {
  return { ...settings }
}

export type FinSettingsDto = ReturnType<typeof serializeSettings>

export function serializePostingRule(rule: FinPostingRuleWithLines) {
  return {
    ...rule,
    lines: rule.lines.map((line) => ({ ...line })),
  }
}

export type FinPostingRuleDto = ReturnType<typeof serializePostingRule>

export function serializeTrialBalanceRow(row: TrialBalanceRow) {
  return {
    ...row,
    totalBaseDebit: row.totalBaseDebit.toString(),
    totalBaseCredit: row.totalBaseCredit.toString(),
  }
}

export type TrialBalanceRowDto = ReturnType<typeof serializeTrialBalanceRow>

export function serializeExchangeRate(
  rate: Prisma.FinExchangeRateGetPayload<object>,
) {
  return { ...rate, rate: rate.rate.toString() }
}

export type ExchangeRateDto = ReturnType<typeof serializeExchangeRate>

import { ConflictError } from '#/server/auth/errors'

// Pure account-resolution core for the posting engine. Given a posting-rule
// line and the posting context, resolve which GL account receives the line:
//   1. accountSource 'fixed'            → the rule line's own accountId
//   2. accountSource 'mapping'          → walk fin_account_mappings candidates
//      most-specific-first (the caller supplies candidates in specificity
//      order, e.g. product → category chain → warehouse → branch → code)
//   3. accountSource 'settings_default' → named column on fin_settings
//   4. fallback                         → strict ? throw : suspense account
// The engine feeds this with pre-fetched data so it stays I/O-free.

export class PostingAccountUnresolvedError extends ConflictError {
  constructor(message: string) {
    super(message)
    this.name = 'PostingAccountUnresolvedError'
  }
}

export interface RuleLineLike {
  lineRole: string
  side: string
  accountSource: string
  accountId?: string | null
  mappingEntityType?: string | null
  mappingRole?: string | null
  settingsField?: string | null
}

export interface MappingCandidate {
  entityType: string
  entityId?: string | null
  entityCode?: string | null
}

export interface MappingRecord {
  entityType: string
  entityId: string | null
  entityCode: string | null
  mappingRole: string
  accountId: string
}

export interface SettingsAccounts {
  [field: string]: string | null | undefined
}

export interface AccountResolutionContext {
  // Candidates for mapping lookups, most specific first.
  mappingCandidates: Array<MappingCandidate>
  mappings: Array<MappingRecord>
  settings: SettingsAccounts
  strictAccountResolution: boolean
  suspenseAccountId?: string | null
}

export interface ResolvedAccount {
  accountId: string
  usedSuspense: boolean
}

export function resolveMappedAccount(
  mappings: Array<MappingRecord>,
  candidates: Array<MappingCandidate>,
  mappingEntityType: string | null | undefined,
  mappingRole: string,
): string | null {
  const scoped = mappingEntityType
    ? candidates.filter((c) => c.entityType === mappingEntityType)
    : candidates

  for (const candidate of scoped) {
    const match = mappings.find(
      (mapping) =>
        mapping.mappingRole === mappingRole &&
        mapping.entityType === candidate.entityType &&
        (candidate.entityId
          ? mapping.entityId === candidate.entityId
          : mapping.entityId === null) &&
        (candidate.entityCode
          ? mapping.entityCode === candidate.entityCode
          : mapping.entityCode === null),
    )

    if (match) {
      return match.accountId
    }
  }

  return null
}

export function resolveAccount(
  line: RuleLineLike,
  context: AccountResolutionContext,
): ResolvedAccount {
  if (line.accountSource === 'fixed' && line.accountId) {
    return { accountId: line.accountId, usedSuspense: false }
  }

  if (line.accountSource === 'mapping' && line.mappingRole) {
    const mapped = resolveMappedAccount(
      context.mappings,
      context.mappingCandidates,
      line.mappingEntityType,
      line.mappingRole,
    )

    if (mapped) {
      return { accountId: mapped, usedSuspense: false }
    }
  }

  if (line.accountSource === 'settings_default' && line.settingsField) {
    const fromSettings = context.settings[line.settingsField]

    if (fromSettings) {
      return { accountId: fromSettings, usedSuspense: false }
    }
  }

  if (!context.strictAccountResolution && context.suspenseAccountId) {
    return { accountId: context.suspenseAccountId, usedSuspense: true }
  }

  throw new PostingAccountUnresolvedError(
    `No account resolvable for posting line role "${line.lineRole}" (source ${line.accountSource}).`,
  )
}

// Pick the applicable rule: tenant rules shadow system rules; highest priority
// wins inside a scope. Pure so rule-selection is unit-testable.
export interface SelectableRule {
  tenantId: string | null
  eventType: string
  priority: number
  isActive: boolean
}

export function selectRule<T extends SelectableRule>(
  rules: Array<T>,
  eventType: string,
): T | null {
  const applicable = rules
    .filter((rule) => rule.isActive && rule.eventType === eventType)
    .sort((a, b) => {
      if ((a.tenantId === null) !== (b.tenantId === null)) {
        return a.tenantId === null ? 1 : -1
      }

      return b.priority - a.priority
    })

  return applicable[0] ?? null
}

// Amount selection from a normalized posting context total map. Zero-amount
// lines are dropped by the engine.
export function selectAmount(
  amounts: Record<string, string | number | undefined>,
  amountSelector: string,
): string | number {
  const amount = amounts[amountSelector]

  if (amount === undefined) {
    throw new PostingAccountUnresolvedError(
      `Posting context does not provide amount "${amountSelector}".`,
    )
  }

  return amount
}

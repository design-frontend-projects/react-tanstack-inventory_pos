'use client'

import * as React from 'react'

import { filterSelectClassName } from '#/components/data/filter-bar'
import { Field, fieldInputClassName } from '#/components/forms/drawer-form'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { usePermissions } from '#/features/auth/use-permissions'
import { CurrencyPanel } from '#/features/finance/settings-currency-panel'
import { MappingsPanel } from '#/features/finance/settings-mappings-panel'
import { PostingRulesPanel } from '#/features/finance/settings-posting-rules-panel'
import { useFinAccounts } from '#/features/finance/use-fin-accounts'
import type { FinSettingsValues } from '#/features/finance/use-fin-settings'
import {
  useFinSettings,
  useFinSettingsMutations,
} from '#/features/finance/use-fin-settings'
import { getErrorMessage, notifySuccess } from '#/lib/toast/toast-store'

const SETTINGS_PERMISSIONS = ['finance.settings_manage']
const POSTING_PERMISSIONS = ['finance.posting_manage']

type DefaultAccountField = keyof Pick<
  FinSettingsValues,
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
>

const DEFAULT_ACCOUNT_GROUPS: Array<{
  title: string
  fields: Array<{ key: DefaultAccountField; label: string }>
}> = [
  {
    title: 'Equity & suspense',
    fields: [
      { key: 'retainedEarningsAccountId', label: 'Retained earnings' },
      { key: 'suspenseAccountId', label: 'Suspense' },
      { key: 'roundingAccountId', label: 'Rounding differences' },
      { key: 'writeOffAccountId', label: 'Write-offs' },
    ],
  },
  {
    title: 'Subledger controls',
    fields: [
      { key: 'defaultArControlAccountId', label: 'AR control (receivables)' },
      { key: 'defaultApControlAccountId', label: 'AP control (payables)' },
      { key: 'inventoryAccountId', label: 'Inventory' },
      { key: 'grniAccountId', label: 'Goods received not invoiced' },
      { key: 'bankClearingAccountId', label: 'Bank clearing' },
    ],
  },
  {
    title: 'Trading',
    fields: [
      { key: 'salesRevenueAccountId', label: 'Sales revenue' },
      { key: 'salesDiscountAccountId', label: 'Sales discounts' },
      { key: 'cogsAccountId', label: 'Cost of goods sold' },
    ],
  },
  {
    title: 'Foreign exchange',
    fields: [
      { key: 'fxRealizedGainAccountId', label: 'Realized FX gain' },
      { key: 'fxRealizedLossAccountId', label: 'Realized FX loss' },
      { key: 'fxUnrealizedGainAccountId', label: 'Unrealized FX gain' },
      { key: 'fxUnrealizedLossAccountId', label: 'Unrealized FX loss' },
    ],
  },
]

function BootstrapPanel() {
  const { initializeFinance } = useFinSettingsMutations()
  const [baseCurrency, setBaseCurrency] = React.useState('USD')
  const [fiscalStart, setFiscalStart] = React.useState('')
  const [fiscalCode, setFiscalCode] = React.useState('')
  const [withAdjustment, setWithAdjustment] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  async function handleInitialize() {
    setError(null)
    try {
      await initializeFinance.mutateAsync({
        baseCurrencyCode: baseCurrency.trim().toUpperCase(),
        fiscalYearStart: new Date(fiscalStart),
        fiscalYearCode: fiscalCode.trim() || undefined,
        includeAdjustmentPeriod: withAdjustment,
      })
      notifySuccess(
        'Finance initialized',
        'Default chart of accounts, settings, and first fiscal year are ready.',
      )
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Setup"
      title="Initialize finance for this workspace"
      description="One-time bootstrap: seeds the default chart of accounts (English + Arabic), wires the default posting accounts, and opens the first fiscal year."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Base currency" htmlFor="bootstrap-currency" required>
          <input
            id="bootstrap-currency"
            className={fieldInputClassName}
            value={baseCurrency}
            onChange={(event) =>
              setBaseCurrency(event.target.value.toUpperCase())
            }
            maxLength={3}
          />
        </Field>
        <Field label="Fiscal year starts" htmlFor="bootstrap-start" required>
          <input
            id="bootstrap-start"
            type="date"
            className={fieldInputClassName}
            value={fiscalStart}
            onChange={(event) => setFiscalStart(event.target.value)}
          />
        </Field>
        <Field
          label="Fiscal year code"
          htmlFor="bootstrap-code"
          hint="Defaults to the start year."
        >
          <input
            id="bootstrap-code"
            className={fieldInputClassName}
            value={fiscalCode}
            onChange={(event) => setFiscalCode(event.target.value)}
            placeholder="e.g. FY2026"
            maxLength={40}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={withAdjustment}
            onChange={(event) => setWithAdjustment(event.target.checked)}
          />
          Include adjustment period
        </label>
      </div>
      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <Button
          disabled={
            initializeFinance.isPending ||
            baseCurrency.trim().length !== 3 ||
            fiscalStart === ''
          }
          onClick={() => void handleInitialize()}
        >
          {initializeFinance.isPending ? 'Initializing…' : 'Initialize finance'}
        </Button>
      </div>
    </WorkspacePanel>
  )
}

function DefaultsForm() {
  const settingsQuery = useFinSettings()
  const accountsQuery = useFinAccounts({ isActive: true })
  const { updateSettings } = useFinSettingsMutations()

  const settings = settingsQuery.data ?? null
  const accounts = React.useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  )

  const [draft, setDraft] = React.useState<FinSettingsValues>({})
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (settings) {
      setDraft({
        baseCurrencyCode: settings.baseCurrencyCode,
        strictAccountResolution: settings.strictAccountResolution,
        retainedEarningsAccountId: settings.retainedEarningsAccountId,
        fxRealizedGainAccountId: settings.fxRealizedGainAccountId,
        fxRealizedLossAccountId: settings.fxRealizedLossAccountId,
        fxUnrealizedGainAccountId: settings.fxUnrealizedGainAccountId,
        fxUnrealizedLossAccountId: settings.fxUnrealizedLossAccountId,
        roundingAccountId: settings.roundingAccountId,
        suspenseAccountId: settings.suspenseAccountId,
        defaultArControlAccountId: settings.defaultArControlAccountId,
        defaultApControlAccountId: settings.defaultApControlAccountId,
        grniAccountId: settings.grniAccountId,
        inventoryAccountId: settings.inventoryAccountId,
        cogsAccountId: settings.cogsAccountId,
        salesRevenueAccountId: settings.salesRevenueAccountId,
        salesDiscountAccountId: settings.salesDiscountAccountId,
        bankClearingAccountId: settings.bankClearingAccountId,
        writeOffAccountId: settings.writeOffAccountId,
      })
    }
  }, [settings])

  async function handleSave() {
    setError(null)
    try {
      await updateSettings.mutateAsync(draft)
      notifySuccess('Settings saved', 'Financial defaults updated.')
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>
  }

  if (!settings) {
    return (
      <WorkspaceEmptyState
        title="Settings unavailable"
        description="Initialize finance first — the defaults appear once the foundation is seeded."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          label="Base currency"
          htmlFor="settings-base-currency"
          hint="Every posting stores a base-currency equivalent."
        >
          <input
            id="settings-base-currency"
            className={fieldInputClassName}
            value={draft.baseCurrencyCode ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                baseCurrencyCode: event.target.value.toUpperCase(),
              }))
            }
            maxLength={3}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            checked={draft.strictAccountResolution ?? false}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                strictAccountResolution: event.target.checked,
              }))
            }
          />
          <span>
            Strict account resolution
            <span className="block text-xs text-muted-foreground">
              Fail postings that cannot resolve an account instead of using
              suspense.
            </span>
          </span>
        </label>
      </div>

      {DEFAULT_ACCOUNT_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.fields.map((field) => (
              <Field key={field.key} label={field.label}>
                <select
                  aria-label={field.label}
                  className={filterSelectClassName}
                  value={draft[field.key] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Not set</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </div>
      ))}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div>
        <Button
          disabled={updateSettings.isPending}
          onClick={() => void handleSave()}
        >
          {updateSettings.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  )
}

export function FinanceSettingsWorkspace() {
  const { can } = usePermissions()
  const canManageSettings = can(SETTINGS_PERMISSIONS)
  const canManagePosting = can(POSTING_PERMISSIONS)

  const settingsQuery = useFinSettings()
  const needsBootstrap =
    settingsQuery.isError ||
    (settingsQuery.data ? !settingsQuery.data.isInitialized : false)

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Settings"
      title="Financial settings, defaults, and posting configuration."
      description="Base currency, default posting accounts, entity-to-account mappings, exchange rates, and the rules that turn business events into journals."
      metrics={[
        {
          label: 'Status',
          value: settingsQuery.isLoading
            ? '—'
            : needsBootstrap
              ? 'Setup needed'
              : 'Initialized',
          hint: needsBootstrap
            ? 'Run the one-time finance bootstrap'
            : 'Finance foundation is live',
          tone: needsBootstrap ? 'accent' : 'red',
        },
        {
          label: 'Base currency',
          value: settingsQuery.data?.baseCurrencyCode ?? '—',
          hint: 'Reporting and balancing currency',
          tone: 'neutral',
        },
        {
          label: 'Resolution mode',
          value: settingsQuery.data
            ? settingsQuery.data.strictAccountResolution
              ? 'Strict'
              : 'Suspense'
            : '—',
          hint: 'How unresolvable postings are handled',
          tone: 'neutral',
        },
      ]}
    >
      {needsBootstrap && canManageSettings ? <BootstrapPanel /> : null}

      <WorkspacePanel
        eyebrow="Configuration"
        title="Finance configuration"
        description="Grouped into defaults, account mappings, currencies and rates, and posting rules."
      >
        <Tabs defaultValue="defaults">
          <TabsList>
            <TabsTrigger value="defaults">General & Defaults</TabsTrigger>
            <TabsTrigger value="mappings">Account Mapping</TabsTrigger>
            <TabsTrigger value="currency">Currency & Rates</TabsTrigger>
            <TabsTrigger value="rules">Posting Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="defaults" className="pt-4">
            <DefaultsForm />
          </TabsContent>
          <TabsContent value="mappings" className="pt-4">
            <MappingsPanel canManage={canManagePosting} />
          </TabsContent>
          <TabsContent value="currency" className="pt-4">
            <CurrencyPanel canManage={canManageSettings} />
          </TabsContent>
          <TabsContent value="rules" className="pt-4">
            <PostingRulesPanel canManage={canManagePosting} />
          </TabsContent>
        </Tabs>
      </WorkspacePanel>
    </WorkspacePage>
  )
}

'use client'

import * as React from 'react'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { Input } from '#/components/ui/input'
import { StatusChip } from '#/components/board/status-chip'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useEarnRules,
  useLoyaltyAdminMutations,
  useLoyaltySettings,
  useLoyaltyTiers,
} from '#/features/crm/use-loyalty-admin'
import {
  errorMessage,
  formatMoney,
  formatNumber,
} from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Loyalty program administration: tenant settings, tier ladder, earn rules.
// The customer-facing balances live on the customer 360 loyalty tab.

const RULE_TYPES = [
  'BASE',
  'CATEGORY_BONUS',
  'PRODUCT_BONUS',
  'BIRTHDAY',
  'ANNIVERSARY',
  'CHANNEL',
] as const

type TierRow = NonNullable<ReturnType<typeof useLoyaltyTiers>['data']>[number]
type RuleRow = NonNullable<ReturnType<typeof useEarnRules>['data']>[number]

interface SettingsFormState {
  pointsPerCurrencyUnit: string
  redemptionValuePerPoint: string
  minRedeemPoints: string
  expiryMonths: string
  birthdayBonusPoints: string
  anniversaryBonusPoints: string
  isActive: boolean
}

interface TierFormState {
  code: string
  name: string
  rank: string
  minLifetimePoints: string
  earnMultiplier: string
}

interface RuleFormState {
  id?: string
  name: string
  ruleType: (typeof RULE_TYPES)[number]
  multiplier: string
  fixedPoints: string
  priority: string
  isActive: boolean
}

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

export function CrmLoyaltyWorkspace() {
  const { can } = usePermissions()
  const canManage = can(['crm.loyalty_manage'])

  const settingsQuery = useLoyaltySettings()
  const tiersQuery = useLoyaltyTiers()
  const rulesQuery = useEarnRules()
  const { updateSettings, upsertTier, upsertEarnRule } =
    useLoyaltyAdminMutations()

  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [settingsForm, setSettingsForm] =
    React.useState<SettingsFormState | null>(null)
  const [tierOpen, setTierOpen] = React.useState(false)
  const [tierForm, setTierForm] = React.useState<TierFormState>({
    code: '',
    name: '',
    rank: '0',
    minLifetimePoints: '0',
    earnMultiplier: '1',
  })
  const [ruleOpen, setRuleOpen] = React.useState(false)
  const [ruleForm, setRuleForm] = React.useState<RuleFormState>({
    name: '',
    ruleType: 'BASE',
    multiplier: '',
    fixedPoints: '',
    priority: '0',
    isActive: true,
  })

  const settings = settingsQuery.data

  function openSettings() {
    setSettingsForm({
      pointsPerCurrencyUnit: settings?.pointsPerCurrencyUnit.toString() ?? '1',
      redemptionValuePerPoint:
        settings?.redemptionValuePerPoint.toString() ?? '0.01',
      minRedeemPoints: String(settings?.minRedeemPoints ?? 0),
      expiryMonths: settings?.expiryMonths ? String(settings.expiryMonths) : '',
      birthdayBonusPoints: String(settings?.birthdayBonusPoints ?? 0),
      anniversaryBonusPoints: String(settings?.anniversaryBonusPoints ?? 0),
      isActive: settings?.isActive ?? true,
    })
    setSettingsOpen(true)
  }

  const tierColumns: DataTableColumn<TierRow>[] = [
    {
      id: 'tier',
      header: 'Tier',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-xs text-muted-foreground">{row.code}</span>
        </div>
      ),
      sortValue: (row) => row.rank,
      exportValue: (row) => row.name,
      alwaysVisible: true,
    },
    {
      id: 'rank',
      header: 'Rank',
      align: 'end',
      cell: (row) => formatNumber(row.rank),
      sortValue: (row) => row.rank,
    },
    {
      id: 'threshold',
      header: 'Min lifetime points',
      align: 'end',
      cell: (row) => formatNumber(row.minLifetimePoints),
      sortValue: (row) => row.minLifetimePoints,
    },
    {
      id: 'multiplier',
      header: 'Earn multiplier',
      align: 'end',
      cell: (row) => `×${row.earnMultiplier}`,
      sortValue: (row) => Number(row.earnMultiplier),
    },
    {
      id: 'minSpend',
      header: 'Min annual spend',
      align: 'end',
      defaultHidden: true,
      cell: (row) =>
        row.minAnnualSpend ? formatMoney(row.minAnnualSpend) : '—',
      sortValue: (row) => Number(row.minAnnualSpend ?? 0),
    },
  ]

  const ruleColumns: DataTableColumn<RuleRow>[] = [
    {
      id: 'name',
      header: 'Rule',
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
      alwaysVisible: true,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <StatusChip tone="info">
          {row.ruleType.toLowerCase().replace(/_/g, ' ')}
        </StatusChip>
      ),
      sortValue: (row) => row.ruleType,
    },
    {
      id: 'effect',
      header: 'Effect',
      cell: (row) =>
        row.fixedPoints
          ? `+${formatNumber(row.fixedPoints)} pts`
          : row.multiplier
            ? `×${row.multiplier}`
            : '—',
      exportValue: (row) =>
        row.fixedPoints ? `+${row.fixedPoints}` : (row.multiplier ?? ''),
    },
    {
      id: 'priority',
      header: 'Priority',
      align: 'end',
      cell: (row) => formatNumber(row.priority),
      sortValue: (row) => row.priority,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 1 : 0),
    },
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Loyalty program"
      title="Points, tiers, and earn rules in one place."
      description="The append-only ledger is the source of truth; earning folds from sales events, and redemption is synchronous so points can never be spent twice."
      actions={
        canManage ? (
          <Button size="sm" onClick={openSettings}>
            Program settings
          </Button>
        ) : undefined
      }
      metrics={[
        {
          label: 'Earn rate',
          value: settings ? `${settings.pointsPerCurrencyUnit} pt` : '—',
          hint: 'Points per currency unit',
          tone: 'red',
        },
        {
          label: 'Point value',
          value: settings ? formatMoney(settings.redemptionValuePerPoint) : '—',
          hint: 'Redemption value per point',
          tone: 'accent',
        },
        {
          label: 'Expiry',
          value: settings?.expiryMonths
            ? `${settings.expiryMonths} mo`
            : 'Never',
          hint: 'FIFO lot expiration',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Ladder"
        title="Loyalty tiers"
        description="Customers climb by lifetime points; higher tiers multiply every earn."
      >
        <div className="flex flex-col gap-3">
          {canManage ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTierForm({
                    code: '',
                    name: '',
                    rank: '0',
                    minLifetimePoints: '0',
                    earnMultiplier: '1',
                  })
                  setTierOpen(true)
                }}
              >
                Add tier
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={tierColumns}
            rows={tiersQuery.data ?? []}
            rowKey={(row) => row.id}
            isLoading={tiersQuery.isLoading}
            isError={tiersQuery.isError}
            onRowClick={
              canManage
                ? (row) => {
                    setTierForm({
                      code: row.code,
                      name: row.name,
                      rank: String(row.rank),
                      minLifetimePoints: String(row.minLifetimePoints),
                      earnMultiplier: String(row.earnMultiplier),
                    })
                    setTierOpen(true)
                  }
                : undefined
            }
            emptyTitle="No tiers yet"
            emptyDescription="Create Bronze/Silver/Gold-style tiers to reward loyal customers."
          />
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Earning"
        title="Earn rules"
        description="Bonus rules layered on top of the base earn rate, in priority order."
      >
        <div className="flex flex-col gap-3">
          {canManage ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRuleForm({
                    name: '',
                    ruleType: 'BASE',
                    multiplier: '',
                    fixedPoints: '',
                    priority: '0',
                    isActive: true,
                  })
                  setRuleOpen(true)
                }}
              >
                Add rule
              </Button>
            </div>
          ) : null}
          <DataTable
            columns={ruleColumns}
            rows={rulesQuery.data ?? []}
            rowKey={(row) => row.id}
            isLoading={rulesQuery.isLoading}
            isError={rulesQuery.isError}
            onRowClick={
              canManage
                ? (row) => {
                    setRuleForm({
                      id: row.id,
                      name: row.name,
                      ruleType: row.ruleType as RuleFormState['ruleType'],
                      multiplier: row.multiplier?.toString() ?? '',
                      fixedPoints: row.fixedPoints
                        ? String(row.fixedPoints)
                        : '',
                      priority: String(row.priority),
                      isActive: row.isActive,
                    })
                    setRuleOpen(true)
                  }
                : undefined
            }
            emptyTitle="No earn rules"
            emptyDescription="Add birthday bonuses, category multipliers, or channel promotions."
          />
        </div>
      </WorkspacePanel>

      <DrawerForm
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Loyalty program settings"
        isPending={updateSettings.isPending}
        onSubmit={async () => {
          if (!settingsForm) {
            return
          }
          for (const [label, value] of [
            ['Earn rate', settingsForm.pointsPerCurrencyUnit],
            ['Point value', settingsForm.redemptionValuePerPoint],
          ] as const) {
            if (!DECIMAL_PATTERN.test(value.trim())) {
              notifyError(`${label} must be a number.`)
              return
            }
          }
          try {
            await updateSettings.mutateAsync({
              pointsPerCurrencyUnit: settingsForm.pointsPerCurrencyUnit.trim(),
              redemptionValuePerPoint:
                settingsForm.redemptionValuePerPoint.trim(),
              minRedeemPoints: Number(settingsForm.minRedeemPoints) || 0,
              expiryMonths: settingsForm.expiryMonths.trim()
                ? Number(settingsForm.expiryMonths)
                : null,
              birthdayBonusPoints:
                Number(settingsForm.birthdayBonusPoints) || 0,
              anniversaryBonusPoints:
                Number(settingsForm.anniversaryBonusPoints) || 0,
              isActive: settingsForm.isActive,
            })
            notifySuccess('Loyalty settings saved')
            setSettingsOpen(false)
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        {settingsForm ? (
          <>
            <Field label="Points per currency unit" required>
              <Input
                value={settingsForm.pointsPerCurrencyUnit}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    pointsPerCurrencyUnit: event.target.value,
                  })
                }
                inputMode="decimal"
              />
            </Field>
            <Field label="Redemption value per point" required>
              <Input
                value={settingsForm.redemptionValuePerPoint}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    redemptionValuePerPoint: event.target.value,
                  })
                }
                inputMode="decimal"
              />
            </Field>
            <Field label="Minimum points per redemption">
              <Input
                value={settingsForm.minRedeemPoints}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    minRedeemPoints: event.target.value,
                  })
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Expiry (months)" hint="Blank = points never expire">
              <Input
                value={settingsForm.expiryMonths}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    expiryMonths: event.target.value,
                  })
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Birthday bonus points">
              <Input
                value={settingsForm.birthdayBonusPoints}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    birthdayBonusPoints: event.target.value,
                  })
                }
                inputMode="numeric"
              />
            </Field>
            <Field label="Anniversary bonus points">
              <Input
                value={settingsForm.anniversaryBonusPoints}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    anniversaryBonusPoints: event.target.value,
                  })
                }
                inputMode="numeric"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsForm.isActive}
                onChange={(event) =>
                  setSettingsForm({
                    ...settingsForm,
                    isActive: event.target.checked,
                  })
                }
                className="size-4 accent-primary"
              />
              Program active
            </label>
          </>
        ) : null}
      </DrawerForm>

      <DrawerForm
        open={tierOpen}
        onOpenChange={setTierOpen}
        title={
          tierForm.code ? `Tier: ${tierForm.name || tierForm.code}` : 'Add tier'
        }
        description="Tiers are upserted by code."
        isPending={upsertTier.isPending}
        onSubmit={async () => {
          if (tierForm.code.trim() === '' || tierForm.name.trim() === '') {
            notifyError('Code and name are required.')
            return
          }
          if (!DECIMAL_PATTERN.test(tierForm.earnMultiplier.trim())) {
            notifyError('Earn multiplier must be a number.')
            return
          }
          try {
            await upsertTier.mutateAsync({
              code: tierForm.code.trim().toLowerCase(),
              name: tierForm.name.trim(),
              rank: Number(tierForm.rank) || 0,
              minLifetimePoints: Number(tierForm.minLifetimePoints) || 0,
              earnMultiplier: tierForm.earnMultiplier.trim(),
            })
            notifySuccess('Tier saved')
            setTierOpen(false)
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        <Field label="Code" required hint="Lowercase, e.g. gold">
          <Input
            value={tierForm.code}
            onChange={(event) =>
              setTierForm({ ...tierForm, code: event.target.value })
            }
          />
        </Field>
        <Field label="Name" required>
          <Input
            value={tierForm.name}
            onChange={(event) =>
              setTierForm({ ...tierForm, name: event.target.value })
            }
          />
        </Field>
        <Field label="Rank" hint="Higher rank = better tier">
          <Input
            value={tierForm.rank}
            onChange={(event) =>
              setTierForm({ ...tierForm, rank: event.target.value })
            }
            inputMode="numeric"
          />
        </Field>
        <Field label="Min lifetime points">
          <Input
            value={tierForm.minLifetimePoints}
            onChange={(event) =>
              setTierForm({
                ...tierForm,
                minLifetimePoints: event.target.value,
              })
            }
            inputMode="numeric"
          />
        </Field>
        <Field label="Earn multiplier" hint="e.g. 1.5">
          <Input
            value={tierForm.earnMultiplier}
            onChange={(event) =>
              setTierForm({ ...tierForm, earnMultiplier: event.target.value })
            }
            inputMode="decimal"
          />
        </Field>
      </DrawerForm>

      <DrawerForm
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        title={ruleForm.id ? `Rule: ${ruleForm.name}` : 'Add earn rule'}
        isPending={upsertEarnRule.isPending}
        onSubmit={async () => {
          if (ruleForm.name.trim() === '') {
            notifyError('Rule name is required.')
            return
          }
          const multiplier = ruleForm.multiplier.trim()
          if (multiplier !== '' && !DECIMAL_PATTERN.test(multiplier)) {
            notifyError('Multiplier must be a number.')
            return
          }
          try {
            await upsertEarnRule.mutateAsync({
              id: ruleForm.id,
              name: ruleForm.name.trim(),
              ruleType: ruleForm.ruleType,
              multiplier: multiplier || null,
              fixedPoints: ruleForm.fixedPoints.trim()
                ? Number(ruleForm.fixedPoints)
                : null,
              priority: Number(ruleForm.priority) || 0,
              isActive: ruleForm.isActive,
            })
            notifySuccess('Earn rule saved')
            setRuleOpen(false)
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        <Field label="Name" required>
          <Input
            value={ruleForm.name}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, name: event.target.value })
            }
          />
        </Field>
        <Field label="Type">
          <select
            className={fieldInputClassName}
            value={ruleForm.ruleType}
            onChange={(event) =>
              setRuleForm({
                ...ruleForm,
                ruleType: event.target.value as RuleFormState['ruleType'],
              })
            }
          >
            {RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Multiplier" hint="Leave blank when using fixed points">
          <Input
            value={ruleForm.multiplier}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, multiplier: event.target.value })
            }
            inputMode="decimal"
          />
        </Field>
        <Field label="Fixed points" hint="Flat bonus instead of a multiplier">
          <Input
            value={ruleForm.fixedPoints}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, fixedPoints: event.target.value })
            }
            inputMode="numeric"
          />
        </Field>
        <Field label="Priority">
          <Input
            value={ruleForm.priority}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, priority: event.target.value })
            }
            inputMode="numeric"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ruleForm.isActive}
            onChange={(event) =>
              setRuleForm({ ...ruleForm, isActive: event.target.checked })
            }
            className="size-4 accent-primary"
          />
          Rule active
        </label>
      </DrawerForm>
    </WorkspacePage>
  )
}

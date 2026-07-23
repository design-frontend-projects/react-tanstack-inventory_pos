'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import { DrawerForm, Field } from '#/components/forms/drawer-form'
import { Input } from '#/components/ui/input'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { KpiGrid, StatCard } from '#/components/data/stat-card'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  useCustomer360Mutations,
  useLoyaltyAccount,
  useLoyaltyLedger,
} from '#/features/crm/use-customer-360'
import {
  errorMessage,
  formatDateTime,
  formatMoney,
  formatNumber,
} from '#/features/crm/crm-format'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

// Loyalty tab of the customer 360: account balance/tier, the append-only
// ledger, and gated redeem/adjust operations.

const LEDGER_TONE: Record<string, StatusTone> = {
  EARN: 'success',
  BONUS: 'success',
  REDEEM: 'primary',
  ADJUST: 'info',
  EXPIRE: 'warning',
  REVERSAL: 'danger',
}

type LedgerRow = NonNullable<
  ReturnType<typeof useLoyaltyLedger>['data']
>[number]

export function CustomerLoyaltyTab({ customerId }: { customerId: string }) {
  const { can } = usePermissions()
  const accountQuery = useLoyaltyAccount(customerId)
  const ledgerQuery = useLoyaltyLedger(customerId)
  const { redeemPoints, adjustPoints } = useCustomer360Mutations(customerId)

  const [redeemOpen, setRedeemOpen] = React.useState(false)
  const [redeemForm, setRedeemForm] = React.useState({ points: '', note: '' })
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [adjustForm, setAdjustForm] = React.useState({ points: '', note: '' })

  const account = accountQuery.data

  const columns: DataTableColumn<LedgerRow>[] = [
    {
      id: 'when',
      header: 'When',
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => new Date(row.createdAt).getTime(),
      exportValue: (row) => new Date(row.createdAt).toISOString(),
      alwaysVisible: true,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <StatusChip tone={LEDGER_TONE[row.entryType] ?? 'neutral'}>
          {row.entryType.toLowerCase()}
        </StatusChip>
      ),
      sortValue: (row) => row.entryType,
      exportValue: (row) => row.entryType,
    },
    {
      id: 'points',
      header: 'Points',
      align: 'end',
      cell: (row) => (
        <span
          className={
            row.points >= 0
              ? 'font-semibold text-emerald-600 dark:text-emerald-300'
              : 'font-semibold text-destructive'
          }
        >
          {row.points >= 0 ? `+${row.points}` : row.points}
        </span>
      ),
      sortValue: (row) => row.points,
      exportValue: (row) => row.points,
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: (row) => (row.expiresAt ? formatDateTime(row.expiresAt) : '—'),
      sortValue: (row) =>
        row.expiresAt ? new Date(row.expiresAt).getTime() : 0,
      exportValue: (row) =>
        row.expiresAt ? new Date(row.expiresAt).toISOString() : '',
      defaultHidden: true,
    },
    {
      id: 'note',
      header: 'Note',
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{row.note ?? '—'}</span>
      ),
      exportValue: (row) => row.note ?? '',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid columns={4}>
        <StatCard
          label="Points balance"
          value={account ? formatNumber(account.pointsBalance) : '—'}
          hint="Available to redeem"
          tone="primary"
          isLoading={accountQuery.isLoading}
        />
        <StatCard
          label="Lifetime points"
          value={account ? formatNumber(account.lifetimePoints) : '—'}
          hint="All-time earned"
          isLoading={accountQuery.isLoading}
        />
        <StatCard
          label="Wallet"
          value={account ? formatMoney(account.walletBalance) : '—'}
          hint="Cashback balance"
          isLoading={accountQuery.isLoading}
        />
        <StatCard
          label="Tier"
          value={account?.tier?.name ?? 'No tier'}
          hint={
            account?.tier
              ? `Earn ×${account.tier.earnMultiplier}`
              : 'Reached via lifetime points'
          }
          tone={account?.tier ? 'success' : 'neutral'}
          isLoading={accountQuery.isLoading}
        />
      </KpiGrid>

      <div className="flex flex-wrap gap-2">
        {can(['crm.loyalty_redeem']) ? (
          <Button size="sm" onClick={() => setRedeemOpen(true)}>
            Redeem points
          </Button>
        ) : null}
        {can(['crm.loyalty_adjust']) ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdjustOpen(true)}
          >
            Manual adjustment
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={ledgerQuery.data ?? []}
        rowKey={(row) => row.id}
        isLoading={ledgerQuery.isLoading}
        isError={ledgerQuery.isError}
        exportFileName="loyalty-ledger"
        pageSize={15}
        emptyTitle="No loyalty activity"
        emptyDescription="Earned and redeemed points appear here as sales flow through the loyalty projection."
      />

      <DrawerForm
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        title="Redeem points"
        description="Deducts points synchronously against the FIFO expiry lots."
        isPending={redeemPoints.isPending}
        onSubmit={async () => {
          const points = Number(redeemForm.points)
          if (!Number.isInteger(points) || points <= 0) {
            notifyError('Enter a positive whole number of points.')
            return
          }
          try {
            await redeemPoints.mutateAsync({
              points,
              note: redeemForm.note.trim() || null,
            })
            notifySuccess(`${points} points redeemed`)
            setRedeemOpen(false)
            setRedeemForm({ points: '', note: '' })
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        <Field label="Points" required>
          <Input
            value={redeemForm.points}
            onChange={(event) =>
              setRedeemForm((previous) => ({
                ...previous,
                points: event.target.value,
              }))
            }
            inputMode="numeric"
          />
        </Field>
        <Field label="Note">
          <Input
            value={redeemForm.note}
            onChange={(event) =>
              setRedeemForm((previous) => ({
                ...previous,
                note: event.target.value,
              }))
            }
          />
        </Field>
      </DrawerForm>

      <DrawerForm
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        title="Manual adjustment"
        description="Positive numbers add points, negative numbers remove them. A note is required for the audit trail."
        isPending={adjustPoints.isPending}
        onSubmit={async () => {
          const points = Number(adjustForm.points)
          if (!Number.isInteger(points) || points === 0) {
            notifyError('Enter a non-zero whole number of points.')
            return
          }
          if (adjustForm.note.trim() === '') {
            notifyError('A note explaining the adjustment is required.')
            return
          }
          try {
            await adjustPoints.mutateAsync({
              points,
              note: adjustForm.note.trim(),
            })
            notifySuccess('Adjustment recorded')
            setAdjustOpen(false)
            setAdjustForm({ points: '', note: '' })
          } catch (error: unknown) {
            notifyError(errorMessage(error))
          }
        }}
      >
        <Field label="Points" required hint="e.g. 500 or -250">
          <Input
            value={adjustForm.points}
            onChange={(event) =>
              setAdjustForm((previous) => ({
                ...previous,
                points: event.target.value,
              }))
            }
            inputMode="numeric"
          />
        </Field>
        <Field label="Reason" required>
          <Input
            value={adjustForm.note}
            onChange={(event) =>
              setAdjustForm((previous) => ({
                ...previous,
                note: event.target.value,
              }))
            }
          />
        </Field>
      </DrawerForm>
    </div>
  )
}

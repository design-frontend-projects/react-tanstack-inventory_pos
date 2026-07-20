'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  useGiftCard,
  useGiftCards,
  usePromotionMutations,
} from '#/features/restaurant/promotions/use-promotions'
import {
  errorMessage,
  formatMoney,
  titleCase,
} from '#/features/restaurant/shared/format'

const STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: 'success',
  FROZEN: 'info',
  EXPIRED: 'neutral',
  DEPLETED: 'neutral',
}

interface CardRow {
  id: string
  code: string
  status: string
  balance: string
  issuedAmount: string
  expiresAt: string | Date | null
  createdAt: string | Date
}

export function GiftCardsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.giftcards.manage')

  const cardsQuery = useGiftCards()
  const mutations = usePromotionMutations()

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const cardQuery = useGiftCard(selectedId)
  const [drawer, setDrawer] = React.useState<'issue' | 'reload' | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const cards = (cardsQuery.data ?? []) as Array<CardRow>
  const activeCards = cards.filter((row) => row.status === 'ACTIVE')
  const liability = cards.reduce((sum, row) => sum + Number(row.balance), 0)

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  async function submitDrawer() {
    setFormError(null)
    try {
      if (drawer === 'issue') {
        await mutations.issueGiftCard.mutateAsync({
          code: field('code'),
          initialBalance: field('initialBalance'),
          expiresAt: field('expiresAt')
            ? new Date(field('expiresAt')).toISOString()
            : null,
        })
      } else if (drawer === 'reload' && selectedId) {
        await mutations.reloadGiftCard.mutateAsync({
          id: selectedId,
          amount: field('amount'),
        })
      }
      setDrawer(null)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<CardRow>> = [
    {
      id: 'code',
      header: 'Card',
      cell: (row) => <span className="font-mono font-medium">{row.code}</span>,
      sortValue: (row) => row.code,
    },
    {
      id: 'balance',
      header: 'Balance',
      align: 'end',
      cell: (row) => formatMoney(row.balance),
      sortValue: (row) => Number(row.balance),
    },
    {
      id: 'issued',
      header: 'Issued',
      align: 'end',
      cell: (row) => formatMoney(row.issuedAmount),
      sortValue: (row) => Number(row.issuedAmount),
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: (row) =>
        row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusChip tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
          {titleCase(row.status)}
        </StatusChip>
      ),
    },
  ]

  return (
    <AccessGuard
      permissions={['res.giftcards.view', 'res.giftcards.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need gift card access to view cards."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Growth"
        title="Gift cards."
        description="Issue, reload, and redeem stored-value cards with a full transaction ledger."
        actions={
          canManage ? (
            <Button
              type="button"
              onClick={() => {
                setFields({})
                setFormError(null)
                setDrawer('issue')
              }}
            >
              Issue card
            </Button>
          ) : undefined
        }
        metrics={[
          {
            label: 'Outstanding',
            value: cardsQuery.data ? formatMoney(String(liability)) : '—',
            hint: 'Total card liability',
            tone: 'red',
          },
          {
            label: 'Active cards',
            value: cardsQuery.data ? String(activeCards.length) : '—',
            hint: `${cards.length} issued in total`,
            tone: 'neutral',
          },
          {
            label: 'Issued value',
            value: cardsQuery.data
              ? formatMoney(
                  String(
                    cards.reduce(
                      (sum, row) => sum + Number(row.issuedAmount),
                      0,
                    ),
                  ),
                )
              : '—',
            hint: 'Lifetime top-ups',
            tone: 'accent',
          },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <WorkspacePanel
            eyebrow="Cards"
            title="All gift cards"
            description="Click a card for its ledger."
          >
            <DataTable
              columns={columns}
              rows={cards}
              rowKey={(row) => row.id}
              isLoading={cardsQuery.isLoading}
              isError={cardsQuery.isError}
              pageSize={12}
              onRowClick={(row) => setSelectedId(row.id)}
              emptyTitle="No gift cards"
              emptyDescription="Issue the first card to open the program."
            />
          </WorkspacePanel>

          <WorkspacePanel
            eyebrow="Ledger"
            title={
              cardQuery.data ? `Card ${cardQuery.data.code}` : 'Transactions'
            }
            description={
              cardQuery.data
                ? `Balance ${formatMoney(cardQuery.data.balance)}`
                : 'Select a card to see its history.'
            }
          >
            {cardQuery.data ? (
              <div className="flex flex-col gap-3">
                {canManage && cardQuery.data.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => {
                      setFields({})
                      setFormError(null)
                      setDrawer('reload')
                    }}
                  >
                    Reload
                  </Button>
                ) : null}
                <ul className="flex flex-col gap-1.5">
                  {(cardQuery.data.transactions ?? []).map((txn) => (
                    <li
                      key={txn.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <StatusChip
                          tone={
                            txn.kind === 'REDEEM'
                              ? 'danger'
                              : txn.kind === 'ISSUE'
                                ? 'primary'
                                : 'success'
                          }
                        >
                          {titleCase(txn.kind)}
                        </StatusChip>
                        <span className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleString()}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {txn.kind === 'REDEEM' ? '−' : '+'}
                        {formatMoney(txn.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <WorkspaceEmptyState
                title="No card selected"
                description="Pick a card from the table."
              />
            )}
          </WorkspacePanel>
        </div>
      </WorkspacePage>

      <DrawerForm
        open={drawer !== null}
        onOpenChange={(open) => {
          if (!open) setDrawer(null)
        }}
        title={drawer === 'issue' ? 'Issue gift card' : 'Reload card'}
        onSubmit={submitDrawer}
        isPending={
          mutations.issueGiftCard.isPending || mutations.reloadGiftCard.isPending
        }
        error={formError}
        submitLabel={drawer === 'issue' ? 'Issue' : 'Reload'}
      >
        {drawer === 'issue' ? (
          <>
            <Field label="Card code" required hint="Printed on the card">
              <input
                className={fieldInputClassName}
                value={field('code')}
                onChange={(event) => setField('code', event.target.value)}
                required
              />
            </Field>
            <Field label="Initial balance" required>
              <input
                className={fieldInputClassName}
                type="number"
                min={1}
                step="0.01"
                value={field('initialBalance')}
                onChange={(event) =>
                  setField('initialBalance', event.target.value)
                }
                required
              />
            </Field>
            <Field label="Expires">
              <input
                className={fieldInputClassName}
                type="date"
                value={field('expiresAt')}
                onChange={(event) => setField('expiresAt', event.target.value)}
              />
            </Field>
          </>
        ) : (
          <Field label="Reload amount" required>
            <input
              className={fieldInputClassName}
              type="number"
              min={1}
              step="0.01"
              value={field('amount')}
              onChange={(event) => setField('amount', event.target.value)}
              required
            />
          </Field>
        )}
      </DrawerForm>
    </AccessGuard>
  )
}

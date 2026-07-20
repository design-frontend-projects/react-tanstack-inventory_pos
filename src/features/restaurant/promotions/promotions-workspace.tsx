'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { FormWizard } from '#/components/forms/form-wizard'
import type { WizardStep } from '#/components/forms/form-wizard'
import {
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { StatusChip } from '#/components/board/status-chip'
import type { StatusTone } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import {
  usePromotionAnalytics,
  usePromotionMutations,
  usePromotions,
} from '#/features/restaurant/promotions/use-promotions'
import {
  errorMessage,
  formatMoney,
  titleCase,
} from '#/features/restaurant/shared/format'

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  PAUSED: 'warning',
  ENDED: 'neutral',
}

interface PromotionRow {
  id: string
  name: string
  kind: string
  status: string
  priority: number
  stacking: string
  usedCount: number
  usageLimit: number | null
  startsAt: string | Date | null
  endsAt: string | Date | null
  coupons?: Array<{ id: string; code: string; usedCount: number }>
}

export function PromotionsWorkspace() {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canManage = hasPermission(permissions, 'res.promotions.manage')

  const promotionsQuery = usePromotions()
  const mutations = usePromotionMutations()

  const [wizardOpen, setWizardOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<PromotionRow | null>(null)
  const analyticsQuery = usePromotionAnalytics(selected?.id ?? null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})

  const promotions = (promotionsQuery.data ?? []) as Array<PromotionRow>
  const active = promotions.filter((row) => row.status === 'ACTIVE')

  function field(key: string): string {
    return fields[key] ?? ''
  }
  function setField(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }))
  }

  function buildAction(): Record<string, unknown> {
    const kind = field('kind') || 'PERCENT'
    if (kind === 'FIXED') {
      return { type: 'FIXED', value: field('value') || '0' }
    }
    // HAPPY_HOUR / CASHBACK / BUNDLE reduce to percent-style actions for now;
    // BOGO/FREE_ITEM keep their dedicated shapes.
    return { type: 'PERCENT', value: field('value') || '0' }
  }

  function buildConditions(): Record<string, unknown> {
    const conditions: Record<string, unknown> = {}
    if (field('minSubtotal')) conditions.minSubtotal = field('minSubtotal')
    if (field('channels')) {
      conditions.channels = field('channels')
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    }
    if (field('orderTypes')) {
      conditions.orderTypes = field('orderTypes')
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    }
    if (field('kind') === 'HAPPY_HOUR' || field('startHour')) {
      const startHour = Number(field('startHour') || '17')
      const endHour = Number(field('endHour') || '19')
      conditions.timeWindow = {
        startMinute: startHour * 60,
        endMinute: endHour * 60,
      }
    }
    return conditions
  }

  const steps: Array<WizardStep> = [
    {
      id: 'basics',
      title: 'Basics',
      description: 'Name the promotion and pick its mechanic.',
      validate: () => (field('name').trim() ? null : 'Give the promotion a name'),
    },
    {
      id: 'rules',
      title: 'Rules',
      description: 'Conditions that must hold for the discount to apply.',
    },
    {
      id: 'value',
      title: 'Value',
      description: 'What the guest gets when the rules match.',
      validate: () =>
        Number(field('value')) > 0 ? null : 'Set a discount value above zero',
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Confirm and create as a draft — activate when ready.',
    },
  ]

  async function completeWizard() {
    setFormError(null)
    try {
      await mutations.createPromotion.mutateAsync({
        name: field('name'),
        kind: (field('kind') || 'PERCENT') as never,
        priority: Number(field('priority') || '10'),
        stacking: (field('stacking') || 'STACKABLE') as never,
        conditions: buildConditions() as never,
        action: buildAction() as never,
        usageLimit: field('usageLimit') ? Number(field('usageLimit')) : null,
        couponCode: field('couponCode') || null,
      })
      setWizardOpen(false)
    } catch (error: unknown) {
      setFormError(errorMessage(error))
    }
  }

  const columns: Array<DataTableColumn<PromotionRow>> = [
    {
      id: 'name',
      header: 'Promotion',
      cell: (row) => (
        <span>
          <span className="font-medium">{row.name}</span>
          {row.coupons?.length ? (
            <span className="ms-2 text-xs text-muted-foreground">
              {row.coupons.map((coupon) => coupon.code).join(', ')}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.name,
    },
    { id: 'kind', header: 'Kind', cell: (row) => titleCase(row.kind) },
    {
      id: 'priority',
      header: 'Priority',
      align: 'end',
      cell: (row) => row.priority,
      sortValue: (row) => row.priority,
    },
    {
      id: 'stacking',
      header: 'Stacking',
      cell: (row) => titleCase(row.stacking),
    },
    {
      id: 'usage',
      header: 'Used',
      align: 'end',
      cell: (row) =>
        row.usageLimit ? `${row.usedCount}/${row.usageLimit}` : row.usedCount,
      sortValue: (row) => row.usedCount,
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
    {
      id: 'actions',
      header: '',
      align: 'end',
      cell: (row) =>
        canManage ? (
          <div className="flex justify-end gap-1.5">
            {row.status === 'DRAFT' || row.status === 'PAUSED' ? (
              <Button
                type="button"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation()
                  void mutations.setPromotionStatus.mutateAsync({
                    id: row.id,
                    status: 'ACTIVE',
                  })
                }}
              >
                Activate
              </Button>
            ) : null}
            {row.status === 'ACTIVE' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation()
                  void mutations.setPromotionStatus.mutateAsync({
                    id: row.id,
                    status: 'PAUSED',
                  })
                }}
              >
                Pause
              </Button>
            ) : null}
          </div>
        ) : null,
    },
  ]

  return (
    <AccessGuard
      permissions={['res.promotions.view', 'res.promotions.manage']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need promotions access to manage offers."
        />
      }
    >
      <WorkspacePage
        variant="compact"
        eyebrow="Growth"
        title="Promotions."
        description="Rule-driven discounts with priorities, stacking control, coupons, and usage caps — applied at the register in one tap."
        actions={
          canManage ? (
            <Button
              type="button"
              onClick={() => {
                setFields({
                  kind: 'PERCENT',
                  priority: '10',
                  stacking: 'STACKABLE',
                })
                setFormError(null)
                setWizardOpen(true)
              }}
            >
              New promotion
            </Button>
          ) : undefined
        }
        metrics={[
          {
            label: 'Active',
            value: promotionsQuery.data ? String(active.length) : '—',
            hint: 'Applying right now',
            tone: 'red',
          },
          {
            label: 'Total',
            value: promotionsQuery.data ? String(promotions.length) : '—',
            hint: 'Across all states',
            tone: 'neutral',
          },
          {
            label: 'Applications',
            value: promotionsQuery.data
              ? String(
                  promotions.reduce((sum, row) => sum + row.usedCount, 0),
                )
              : '—',
            hint: 'Lifetime uses',
            tone: 'accent',
          },
        ]}
      >
        <WorkspacePanel
          eyebrow="Catalog"
          title="All promotions"
          description="Click a row for its performance."
        >
          <DataTable
            columns={columns}
            rows={promotions}
            rowKey={(row) => row.id}
            isLoading={promotionsQuery.isLoading}
            isError={promotionsQuery.isError}
            pageSize={12}
            onRowClick={(row) => setSelected(row)}
            emptyTitle="No promotions yet"
            emptyDescription="Build the first offer with the wizard."
          />
        </WorkspacePanel>

        {selected ? (
          <WorkspacePanel
            eyebrow="Performance"
            title={selected.name}
            description="Applications recorded at the register."
          >
            {analyticsQuery.data ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <p className="ops-panel-label">Applications</p>
                    <strong className="text-2xl tabular-nums">
                      {analyticsQuery.data.applicationCount}
                    </strong>
                  </div>
                  <div>
                    <p className="ops-panel-label">Total discount</p>
                    <strong className="text-2xl tabular-nums">
                      {formatMoney(analyticsQuery.data.totalDiscount)}
                    </strong>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() => setSelected(null)}
                >
                  Close
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </WorkspacePanel>
        ) : null}
      </WorkspacePage>

      {/* Builder wizard */}
      <Sheet open={wizardOpen} onOpenChange={setWizardOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Promotion builder</SheetTitle>
            <SheetDescription>
              Four steps: basics, rules, value, review.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FormWizard
              steps={steps}
              onComplete={completeWizard}
              onCancel={() => setWizardOpen(false)}
              isPending={mutations.createPromotion.isPending}
              error={formError}
              completeLabel="Create draft"
              renderStep={(step) => {
                if (step.id === 'basics') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field label="Name" required>
                        <input
                          className={fieldInputClassName}
                          value={field('name')}
                          onChange={(event) =>
                            setField('name', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Mechanic">
                        <select
                          className={fieldInputClassName}
                          value={field('kind') || 'PERCENT'}
                          onChange={(event) =>
                            setField('kind', event.target.value)
                          }
                        >
                          {[
                            'PERCENT',
                            'FIXED',
                            'HAPPY_HOUR',
                            'CASHBACK',
                          ].map((kind) => (
                            <option key={kind} value={kind}>
                              {titleCase(kind)}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Priority" hint="Higher applies first">
                          <input
                            className={fieldInputClassName}
                            type="number"
                            min={0}
                            value={field('priority')}
                            onChange={(event) =>
                              setField('priority', event.target.value)
                            }
                          />
                        </Field>
                        <Field label="Stacking">
                          <select
                            className={fieldInputClassName}
                            value={field('stacking') || 'STACKABLE'}
                            onChange={(event) =>
                              setField('stacking', event.target.value)
                            }
                          >
                            <option value="STACKABLE">Stackable</option>
                            <option value="EXCLUSIVE">Exclusive</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  )
                }
                if (step.id === 'rules') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field label="Minimum subtotal">
                        <input
                          className={fieldInputClassName}
                          type="number"
                          min={0}
                          step="0.01"
                          value={field('minSubtotal')}
                          onChange={(event) =>
                            setField('minSubtotal', event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Channels"
                        hint="Comma-separated: POS, QR, WEBSITE… empty = all"
                      >
                        <input
                          className={fieldInputClassName}
                          value={field('channels')}
                          onChange={(event) =>
                            setField('channels', event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Order types"
                        hint="DINE_IN, TAKEAWAY, DELIVERY… empty = all"
                      >
                        <input
                          className={fieldInputClassName}
                          value={field('orderTypes')}
                          onChange={(event) =>
                            setField('orderTypes', event.target.value)
                          }
                        />
                      </Field>
                      {field('kind') === 'HAPPY_HOUR' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Start hour">
                            <input
                              className={fieldInputClassName}
                              type="number"
                              min={0}
                              max={23}
                              value={field('startHour') || '17'}
                              onChange={(event) =>
                                setField('startHour', event.target.value)
                              }
                            />
                          </Field>
                          <Field label="End hour">
                            <input
                              className={fieldInputClassName}
                              type="number"
                              min={1}
                              max={24}
                              value={field('endHour') || '19'}
                              onChange={(event) =>
                                setField('endHour', event.target.value)
                              }
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  )
                }
                if (step.id === 'value') {
                  return (
                    <div className="flex flex-col gap-4">
                      <Field
                        label={
                          field('kind') === 'FIXED'
                            ? 'Discount amount'
                            : 'Discount percent'
                        }
                        required
                      >
                        <input
                          className={fieldInputClassName}
                          type="number"
                          min={0}
                          step="0.01"
                          value={field('value')}
                          onChange={(event) =>
                            setField('value', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Usage limit" hint="Blank = unlimited">
                        <input
                          className={fieldInputClassName}
                          type="number"
                          min={1}
                          value={field('usageLimit')}
                          onChange={(event) =>
                            setField('usageLimit', event.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Coupon code"
                        hint="Optional — guests must present this code"
                      >
                        <input
                          className={fieldInputClassName}
                          value={field('couponCode')}
                          onChange={(event) =>
                            setField('couponCode', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )
                }
                return (
                  <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-7">
                    <p>
                      <strong>{field('name')}</strong> —{' '}
                      {titleCase(field('kind') || 'PERCENT')},{' '}
                      {field('kind') === 'FIXED'
                        ? formatMoney(field('value') || '0')
                        : `${field('value') || '0'}%`}{' '}
                      off · priority {field('priority') || '10'} ·{' '}
                      {titleCase(field('stacking') || 'STACKABLE')}
                    </p>
                    {field('minSubtotal') ? (
                      <p>Min subtotal {formatMoney(field('minSubtotal'))}</p>
                    ) : null}
                    {field('couponCode') ? (
                      <p>Coupon: {field('couponCode')}</p>
                    ) : null}
                    <p className="text-muted-foreground">
                      Created as a draft — activate from the list.
                    </p>
                  </div>
                )
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AccessGuard>
  )
}

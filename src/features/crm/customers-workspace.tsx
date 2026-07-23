'use client'

import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  FilterTabs,
  filterSelectClassName,
} from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import { usePermissions } from '#/features/auth/use-permissions'
import { assignTagServerFn } from '#/features/crm/server-functions'
import { crmPayload, useTenantId } from '#/features/crm/use-crm-base'
import {
  useCrmCustomerSummary,
  useCrmCustomers,
  useCrmTags,
} from '#/features/crm/use-crm-customers'
import type { CrmDirectoryRow } from '#/features/crm/use-crm-customers'
import { CustomerWizard } from '#/features/crm/customer-wizard'
import {
  LIFECYCLE_STATUSES,
  churnRisk,
  formatDate,
  formatLifecycle,
  formatMoney,
  formatNumber,
  formatRfmSegment,
  lifecycleTone,
  rfmTone,
} from '#/features/crm/crm-format'
import type { LifecycleStatus } from '#/features/crm/crm-format'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const PAGE_SIZE = 25

export function CrmCustomersWorkspace() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const tenantId = useTenantId()
  const queryClient = useQueryClient()

  const [search, setSearch] = React.useState('')
  const [lifecycle, setLifecycle] = React.useState('')
  const [tagId, setTagId] = React.useState('')
  const [scope, setScope] = React.useState('active')
  const [page, setPage] = React.useState(0)
  const [selectedIds, setSelectedIds] = React.useState<Array<string>>([])
  const [bulkTagId, setBulkTagId] = React.useState('')
  const [wizardOpen, setWizardOpen] = React.useState(false)

  const filters = React.useMemo(
    () => ({
      search: search || undefined,
      lifecycleStatus: (lifecycle || undefined) as LifecycleStatus | undefined,
      tagId: tagId || undefined,
      includeInactive: scope === 'all',
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, lifecycle, tagId, scope, page],
  )

  const customersQuery = useCrmCustomers(filters)
  const summaryQuery = useCrmCustomerSummary()
  const tagsQuery = useCrmTags()

  const summary = summaryQuery.data
  const rows = customersQuery.data?.items ?? []
  const total = customersQuery.data?.total ?? 0

  const resetPage = () => setPage(0)

  const bulkAssignTag = useMutation({
    mutationFn: async (args: { tagId: string; customerIds: Array<string> }) => {
      const payload = await crmPayload(tenantId)
      for (const customerId of args.customerIds) {
        await assignTagServerFn({
          data: { ...payload, customerId, tagId: args.tagId },
        })
      }
    },
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers', tenantId] })
      setSelectedIds([])
      notifySuccess(`Tag applied to ${args.customerIds.length} customers.`)
    },
    onError: () => notifyError('Could not apply the tag to every customer.'),
  })

  const columns: DataTableColumn<CrmDirectoryRow>[] = React.useMemo(
    () => [
      {
        id: 'customer',
        header: 'Customer',
        alwaysVisible: true,
        cell: (row) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {row.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('')}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.code}</span>
            </div>
          </div>
        ),
        sortValue: (row) => row.name,
        exportValue: (row) => row.name,
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: (row) => (
          <div className="flex flex-col text-xs">
            <span>{row.email ?? '—'}</span>
            <span className="text-muted-foreground">{row.phone ?? '—'}</span>
          </div>
        ),
        exportValue: (row) => row.email ?? row.phone ?? '',
      },
      {
        id: 'lifecycle',
        header: 'Lifecycle',
        cell: (row) =>
          row.lifecycleStatus ? (
            <StatusChip
              tone={lifecycleTone[row.lifecycleStatus as LifecycleStatus]}
              dot
            >
              {formatLifecycle(row.lifecycleStatus)}
            </StatusChip>
          ) : (
            <span className="text-xs text-muted-foreground">No profile</span>
          ),
        sortValue: (row) => row.lifecycleStatus ?? '',
        exportValue: (row) => row.lifecycleStatus ?? '',
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: (row) =>
          row.tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex max-w-52 flex-wrap gap-1">
              {row.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-border px-2 py-0.5 text-[0.68rem] font-medium"
                  style={
                    tag.color
                      ? { borderColor: tag.color, color: tag.color }
                      : undefined
                  }
                >
                  {tag.name}
                </span>
              ))}
              {row.tags.length > 3 ? (
                <span className="text-[0.68rem] text-muted-foreground">
                  +{row.tags.length - 3}
                </span>
              ) : null}
            </div>
          ),
        exportValue: (row) => row.tags.map((tag) => tag.name).join('; '),
      },
      {
        id: 'loyalty',
        header: 'Loyalty',
        cell: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium tabular-nums">
              {formatNumber(row.pointsBalance)} pts
            </span>
            <span className="text-muted-foreground">
              {row.tierName ?? 'No tier'}
            </span>
          </div>
        ),
        sortValue: (row) => row.pointsBalance,
        exportValue: (row) => row.pointsBalance,
      },
      {
        id: 'orders',
        header: 'Orders',
        align: 'end',
        cell: (row) => formatNumber(row.ordersCount),
        sortValue: (row) => row.ordersCount,
      },
      {
        id: 'spend',
        header: 'Total spend',
        align: 'end',
        cell: (row) => formatMoney(row.totalSpend),
        sortValue: (row) => Number(row.totalSpend),
        exportValue: (row) => row.totalSpend,
      },
      {
        id: 'lastPurchase',
        header: 'Last purchase',
        cell: (row) => formatDate(row.lastPurchaseAt),
        sortValue: (row) =>
          row.lastPurchaseAt ? new Date(row.lastPurchaseAt).getTime() : 0,
        exportValue: (row) =>
          row.lastPurchaseAt ? new Date(row.lastPurchaseAt).toISOString() : '',
      },
      {
        id: 'rfm',
        header: 'RFM',
        cell: (row) =>
          row.rfmSegment ? (
            <StatusChip tone={rfmTone[row.rfmSegment] ?? 'neutral'}>
              {formatRfmSegment(row.rfmSegment)}
            </StatusChip>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        sortValue: (row) => row.rfmSegment ?? '',
        exportValue: (row) => row.rfmSegment ?? '',
      },
      {
        id: 'churn',
        header: 'Churn risk',
        defaultHidden: true,
        cell: (row) => {
          const meta = churnRisk(row.churnScore)
          return <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
        },
        sortValue: (row) => Number(row.churnScore ?? 0),
        exportValue: (row) => row.churnScore ?? '',
      },
      {
        id: 'clv',
        header: 'CLV',
        align: 'end',
        defaultHidden: true,
        cell: (row) => formatMoney(row.clvEstimate),
        sortValue: (row) => Number(row.clvEstimate ?? 0),
        exportValue: (row) => row.clvEstimate ?? '',
      },
      {
        id: 'type',
        header: 'Type',
        defaultHidden: true,
        cell: (row) => (
          <span className="text-xs">{row.customerType.toLowerCase()}</span>
        ),
        sortValue: (row) => row.customerType,
        exportValue: (row) => row.customerType,
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
        exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
      },
    ],
    [],
  )

  const canManageProfiles = can(['crm.profile_manage'])
  const canCreateCustomers = can(['customer.manage'])
  const tags = tagsQuery.data ?? []

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Customer 360"
      title="Every customer relationship on one screen."
      description="Search the directory, filter by lifecycle, tags, and loyalty state, then open a customer for the full 360° workspace."
      actions={
        canCreateCustomers ? (
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            New customer
          </Button>
        ) : undefined
      }
      metrics={[
        {
          label: 'Customers',
          value: summary ? formatNumber(summary.total) : '—',
          hint: 'All customer records',
          tone: 'red',
        },
        {
          label: 'Active',
          value: formatNumber(summary?.byLifecycle.ACTIVE ?? 0),
          hint: 'Lifecycle status: active',
          tone: 'accent',
        },
        {
          label: 'At risk',
          value: formatNumber(summary?.byLifecycle.AT_RISK ?? 0),
          hint: 'No recent purchases',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Directory"
        title="Customer directory"
        description="Master records enriched with lifecycle, loyalty balance, and behavioral metrics."
      >
        <div className="flex flex-col gap-3">
          <FilterBar>
            <FilterSearch
              value={search}
              onChange={(value) => {
                setSearch(value)
                resetPage()
              }}
              placeholder="Search name, code, phone, email…"
            />
            <FilterSelect
              label="Lifecycle"
              value={lifecycle}
              allLabel="All lifecycles"
              onChange={(value) => {
                setLifecycle(value)
                resetPage()
              }}
              options={LIFECYCLE_STATUSES.map((status) => ({
                value: status,
                label: formatLifecycle(status),
              }))}
            />
            <FilterSelect
              label="Tag"
              value={tagId}
              allLabel="All tags"
              onChange={(value) => {
                setTagId(value)
                resetPage()
              }}
              options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            />
            <FilterTabs
              value={scope}
              onChange={(value) => {
                setScope(value)
                resetPage()
              }}
              tabs={[
                { value: 'active', label: 'Active' },
                { value: 'all', label: 'All' },
              ]}
            />
          </FilterBar>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            isLoading={customersQuery.isLoading}
            isError={customersQuery.isError}
            enableColumnVisibility
            exportFileName="crm-customers"
            onRowClick={(row) =>
              void navigate({
                to: '/crm/customers/$customerId',
                params: { customerId: row.id },
              })
            }
            selection={
              canManageProfiles
                ? {
                    selectedIds,
                    onChange: setSelectedIds,
                    bulkActions: (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Tag to apply"
                          className={filterSelectClassName}
                          value={bulkTagId}
                          onChange={(event) => setBulkTagId(event.target.value)}
                        >
                          <option value="">Choose tag…</option>
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!bulkTagId || bulkAssignTag.isPending}
                          onClick={() =>
                            bulkAssignTag.mutate({
                              tagId: bulkTagId,
                              customerIds: selectedIds,
                            })
                          }
                        >
                          {bulkAssignTag.isPending ? 'Applying…' : 'Apply tag'}
                        </Button>
                      </div>
                    ),
                  }
                : undefined
            }
            pagination={{
              mode: 'server',
              page,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: setPage,
            }}
            emptyTitle="No customers match"
            emptyDescription="Adjust the filters, or create the first customer record."
          />
        </div>
      </WorkspacePanel>

      <CustomerWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </WorkspacePage>
  )
}

'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  SupplierFormDialog
  
} from '#/features/suppliers/supplier-form-dialog'
import type {SupplierFormValues} from '#/features/suppliers/supplier-form-dialog';
import { useSuppliers } from '#/features/suppliers/use-suppliers'

function StatusBadge({ statusCode }: { statusCode: string }) {
  const label = statusCode.replace(/_/g, ' ')
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium capitalize">
      {label}
    </span>
  )
}

export function SupplierWorkspace() {
  const [search, setSearch] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SupplierFormValues | null>(null)
  const suppliersQuery = useSuppliers({
    search: search || undefined,
    includeInactive: true,
  })

  const data = suppliersQuery.data
  const items = data?.items ?? []
  const preferredCount = items.filter((supplier) => supplier.isPreferred).length
  const activeCount = items.filter((supplier) => supplier.isActive).length

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (supplier: SupplierFormValues) => {
    setEditing(supplier)
    setDialogOpen(true)
  }

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Suppliers"
      title="Manage the supplier master: profiles, contacts, banking, and terms."
      description="A single controlled register for every vendor — category, rating, lead time, credit, and running balance — feeding requisitions, RFQs, purchase orders, and payables."
      actions={<Button onClick={openCreate}>New supplier</Button>}
      metrics={[
        {
          label: 'Suppliers',
          value: data ? String(data.total) : '—',
          hint: `${activeCount} active on this page`,
          tone: 'red',
        },
        {
          label: 'Preferred',
          value: data ? String(preferredCount) : '—',
          hint: 'Flagged for priority sourcing',
          tone: 'accent',
        },
        {
          label: 'Page',
          value: data ? `${data.page}` : '—',
          hint: data ? `${data.pageSize} per page` : 'Loading',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Supplier register"
        title="Vendor master"
        description="Search by code, name, or email. Preferred suppliers surface first."
      >
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search suppliers…"
            className="w-full max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
        </div>

        {suppliersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading suppliers…</p>
        ) : suppliersQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load suppliers"
            description="Check your connection and permissions, then retry."
          />
        ) : items.length === 0 ? (
          <WorkspaceEmptyState
            title="No suppliers yet"
            description="Create your first supplier to start building purchase requisitions and orders."
          >
            <Button onClick={openCreate}>Create supplier</Button>
          </WorkspaceEmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-184 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Currency</th>
                  <th className="py-2 pr-4 text-right font-medium">Balance</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Lead time
                  </th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {supplier.code}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.isPreferred ? (
                        <span className="ml-2 text-xs font-semibold text-primary">
                          ★ preferred
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge statusCode={supplier.statusCode} />
                    </td>
                    <td className="py-2 pr-4">{supplier.currencyCode}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {supplier.currentBalance}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {supplier.leadTimeDays ?? '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => openEdit(supplier)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspacePanel>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editing}
      />
    </WorkspacePage>
  )
}

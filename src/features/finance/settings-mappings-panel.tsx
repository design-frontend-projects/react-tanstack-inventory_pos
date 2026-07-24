'use client'

import * as React from 'react'

import { DataTable } from '#/components/data/data-table'
import type { DataTableColumn } from '#/components/data/data-table'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { filterSelectClassName } from '#/components/data/filter-bar'
import { Button } from '#/components/ui/button'
import type {
  FinAccountMappingRow,
  FinAccountRow,
} from '#/features/finance/use-fin-accounts'
import {
  useFinAccountMappings,
  useFinAccountMutations,
  useFinAccounts,
} from '#/features/finance/use-fin-accounts'
import {
  getErrorMessage,
  notifyError,
  notifySuccess,
} from '#/lib/toast/toast-store'

// Operational-entity → GL account mappings: how automated postings resolve the
// account for a warehouse, category, payment method, tax code, and so on.

const ENTITY_TYPES = [
  'warehouse',
  'branch',
  'product_category',
  'payment_method',
  'tax_code',
  'customer_group',
  'supplier_group',
  'expense_type',
]

const MAPPING_ROLES = [
  'inventory',
  'cogs',
  'revenue',
  'discount',
  'clearing',
  'tax_payable',
  'tax_receivable',
  'expense',
  'writeoff',
]

export function MappingsPanel({ canManage }: { canManage: boolean }) {
  const mappingsQuery = useFinAccountMappings()
  const accountsQuery = useFinAccounts({ isActive: true })
  const { upsertMapping, deleteMapping } = useFinAccountMutations()

  const [open, setOpen] = React.useState(false)
  const [entityType, setEntityType] = React.useState(ENTITY_TYPES[0])
  const [entityCode, setEntityCode] = React.useState('')
  const [mappingRole, setMappingRole] = React.useState(MAPPING_ROLES[0])
  const [accountId, setAccountId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] =
    React.useState<FinAccountMappingRow | null>(null)

  const accounts = React.useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  )
  const accountById = React.useMemo(
    () =>
      new Map(
        accounts.map((account) => [
          account.id,
          `${account.code} — ${account.name}`,
        ]),
      ),
    [accounts],
  )

  const columns: Array<DataTableColumn<FinAccountMappingRow>> = [
    {
      id: 'entityType',
      header: 'Entity Type',
      cell: (row) => <span className="font-medium">{row.entityType}</span>,
      sortValue: (row) => row.entityType,
    },
    {
      id: 'entity',
      header: 'Entity',
      cell: (row) => row.entityCode ?? row.entityId ?? 'All (default)',
      sortValue: (row) => row.entityCode ?? row.entityId ?? '',
      exportValue: (row) => row.entityCode ?? row.entityId ?? 'default',
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => row.mappingRole,
      sortValue: (row) => row.mappingRole,
    },
    {
      id: 'account',
      header: 'Account',
      cell: (row) => accountById.get(row.accountId) ?? row.accountId,
      sortValue: (row) => accountById.get(row.accountId) ?? '',
      exportValue: (row) => accountById.get(row.accountId) ?? row.accountId,
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      alwaysVisible: true,
      cell: (row) =>
        canManage ? (
          <Button
            size="xs"
            variant="destructive"
            onClick={() => setPendingDelete(row)}
          >
            Remove
          </Button>
        ) : null,
    },
  ]

  async function handleUpsert() {
    setError(null)
    try {
      await upsertMapping.mutateAsync({
        entityType,
        entityCode: entityCode.trim() || null,
        mappingRole,
        accountId,
      })
      notifySuccess(
        'Mapping saved',
        `${entityType} / ${mappingRole} now posts to ${accountById.get(accountId) ?? 'the selected account'}.`,
      )
      setOpen(false)
      setEntityCode('')
      setAccountId('')
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Automated postings look up the target account by entity + role. A
          mapping without an entity code acts as the default for its type.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            New mapping
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={mappingsQuery.data ?? []}
        rowKey={(row) => row.id}
        isLoading={mappingsQuery.isLoading}
        isError={mappingsQuery.isError}
        errorMessage="Could not load account mappings."
        emptyTitle="No mappings yet"
        emptyDescription="Without mappings, automated postings fall back to the default accounts in General settings."
        pageSize={15}
        exportFileName="account-mappings"
      />

      <DrawerForm
        open={open}
        onOpenChange={setOpen}
        title="New account mapping"
        description="Route an operational entity's postings to a specific GL account."
        onSubmit={handleUpsert}
        submitLabel="Save mapping"
        isPending={upsertMapping.isPending}
        error={error}
        submitDisabled={accountId === ''}
      >
        <Field label="Entity type" htmlFor="mapping-entity-type" required>
          <select
            id="mapping-entity-type"
            className={filterSelectClassName}
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          >
            {ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Entity code"
          htmlFor="mapping-entity-code"
          hint="Leave empty to make this the default mapping for the type."
        >
          <input
            id="mapping-entity-code"
            className={fieldInputClassName}
            value={entityCode}
            onChange={(event) => setEntityCode(event.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Mapping role" htmlFor="mapping-role" required>
          <select
            id="mapping-role"
            className={filterSelectClassName}
            value={mappingRole}
            onChange={(event) => setMappingRole(event.target.value)}
          >
            {MAPPING_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account" htmlFor="mapping-account" required>
          <select
            id="mapping-account"
            className={filterSelectClassName}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Select account…</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
        </Field>
      </DrawerForm>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingDelete(null)
          }
        }}
        title="Remove mapping?"
        description={
          pendingDelete
            ? `Postings for ${pendingDelete.entityType} / ${pendingDelete.mappingRole} will fall back to the default accounts.`
            : undefined
        }
        confirmLabel="Remove"
        tone="destructive"
        isPending={deleteMapping.isPending}
        onConfirm={async () => {
          if (!pendingDelete) {
            return
          }
          try {
            await deleteMapping.mutateAsync(pendingDelete.id)
            notifySuccess('Mapping removed')
            setPendingDelete(null)
          } catch (deleteError: unknown) {
            notifyError(deleteError, 'Could not remove the mapping')
          }
        }}
      />
    </div>
  )
}

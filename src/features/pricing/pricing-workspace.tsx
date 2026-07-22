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
  FilterBar,
  FilterSearch,
  FilterSelect,
} from '#/components/data/filter-bar'
import { StatusChip } from '#/components/board/status-chip'
import { Button } from '#/components/ui/button'
import {
  DrawerForm,
  Field,
  fieldInputClassName,
} from '#/components/forms/drawer-form'
import { ConfirmDialog } from '#/components/feedback/confirm-dialog'
import { AccessGuard } from '#/features/auth/access-guard'
import { usePermissions } from '#/features/auth/use-permissions'
import {
  usePriceLists,
  usePricingMutations,
  useProductPrices,
} from '#/features/pricing/use-pricing'
import { useUoms } from '#/features/products/use-master-data'
import { useProductsPage } from '#/features/products/use-products'
import { notifyError, notifySuccess } from '#/lib/toast/toast-store'

const VIEW = ['product.view', 'product.manage_pricing']
const MANAGE = ['product.manage_pricing']

type PriceListRow = NonNullable<
  ReturnType<typeof usePriceLists>['data']
>[number]

type ProductPriceRow = NonNullable<
  ReturnType<typeof useProductPrices>['data']
>[number]

type PriceListType = 'SALES' | 'PURCHASE'

function formatDate(value: string | Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : null
}

function formatValidity(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
) {
  if (!from && !to) {
    return 'Always valid'
  }
  return `${formatDate(from) ?? '…'} → ${formatDate(to) ?? '…'}`
}

// Prefills a native <input type="date"> from a serialized timestamp.
function toDateInputValue(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

function formatQty(value: string) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString() : value
}

function formatMoney(value: string, currencyCode: string | undefined) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }
  if (!currencyCode) {
    return numeric.toLocaleString()
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(numeric)
  } catch {
    return `${currencyCode} ${numeric.toLocaleString()}`
  }
}

const priceListTypeTone = {
  SALES: 'primary',
  PURCHASE: 'info',
} as const

// Create/edit drawer for a price list header.
function PriceListDrawer({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: PriceListRow | null
}) {
  const { createPriceList, updatePriceList } = usePricingMutations()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [currency, setCurrency] = React.useState('')
  const [type, setType] = React.useState<PriceListType>('SALES')
  const [validFrom, setValidFrom] = React.useState('')
  const [validTo, setValidTo] = React.useState('')
  const [isDefault, setIsDefault] = React.useState(false)
  const [isActive, setIsActive] = React.useState(true)
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setCode(editing?.code ?? '')
      setName(editing?.name ?? '')
      setCurrency(editing?.currencyCode ?? '')
      setType((editing?.type as PriceListType | undefined) ?? 'SALES')
      setValidFrom(toDateInputValue(editing?.validFrom))
      setValidTo(toDateInputValue(editing?.validTo))
      setIsDefault(editing?.isDefault ?? false)
      setIsActive(editing?.isActive ?? true)
      setFormError(null)
    }
  }, [open, editing])

  const isPending = createPriceList.isPending || updatePriceList.isPending

  async function submit() {
    const trimmedCode = code.trim()
    const trimmedName = name.trim()
    const trimmedCurrency = currency.trim().toUpperCase()

    if (!trimmedCode || !trimmedName) {
      setFormError('Code and name are required.')
      return
    }
    if (trimmedCurrency && trimmedCurrency.length !== 3) {
      setFormError('Currency must be a 3-letter ISO code (e.g. USD).')
      return
    }

    setFormError(null)

    const input = {
      code: trimmedCode,
      name: trimmedName,
      currencyCode: trimmedCurrency || undefined,
      type,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      isDefault,
      isActive,
    }

    try {
      if (editing) {
        await updatePriceList.mutateAsync({ id: editing.id, input })
        notifySuccess('Price list updated', trimmedName)
      } else {
        await createPriceList.mutateAsync(input)
        notifySuccess('Price list created', trimmedName)
      }
      onOpenChange(false)
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not save the price list.',
      )
      notifyError(error, 'Could not save the price list')
    }
  }

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit price list' : 'New price list'}
      description="A price list groups product prices under one currency and validity window."
      submitLabel={editing ? 'Save changes' : 'Create price list'}
      isPending={isPending}
      error={formError}
      submitDisabled={!code.trim() || !name.trim()}
      onSubmit={submit}
    >
      <Field label="Code" required>
        <input
          className={fieldInputClassName}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="RETAIL-2026"
          maxLength={50}
        />
      </Field>

      <Field label="Name" required>
        <input
          className={fieldInputClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Retail price list"
          maxLength={200}
        />
      </Field>

      <Field label="Type">
        <select
          className={fieldInputClassName}
          value={type}
          onChange={(event) => setType(event.target.value as PriceListType)}
        >
          <option value="SALES">Sales</option>
          <option value="PURCHASE">Purchase</option>
        </select>
      </Field>

      <Field
        label="Currency"
        hint="3-letter ISO code. Leave blank for the tenant default."
      >
        <input
          className={fieldInputClassName}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          placeholder="USD"
          maxLength={3}
        />
      </Field>

      <Field label="Valid from">
        <input
          type="date"
          className={fieldInputClassName}
          value={validFrom}
          onChange={(event) => setValidFrom(event.target.value)}
        />
      </Field>

      <Field label="Valid to">
        <input
          type="date"
          className={fieldInputClassName}
          value={validTo}
          onChange={(event) => setValidTo(event.target.value)}
        />
      </Field>

      <Field
        label="Default list"
        hint="The default list is picked automatically when no list is specified."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={isDefault}
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          Use as the default price list
        </label>
      </Field>

      <Field label="Active">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Prices on this list can be applied
        </label>
      </Field>
    </DrawerForm>
  )
}

// Drawer that adds (or re-tiers) a product price on a list.
function PriceEntryDrawer({
  open,
  onOpenChange,
  priceLists,
  defaultPriceListId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  priceLists: PriceListRow[]
  defaultPriceListId: string | null
}) {
  const { upsertProductPrice } = usePricingMutations()
  const productsQuery = useProductsPage({ take: 200 })
  const uomsQuery = useUoms()

  const [priceListId, setPriceListId] = React.useState('')
  const [productId, setProductId] = React.useState('')
  const [uomId, setUomId] = React.useState('')
  const [minQty, setMinQty] = React.useState('')
  const [unitPrice, setUnitPrice] = React.useState('')
  const [taxIncluded, setTaxIncluded] = React.useState(false)
  const [validFrom, setValidFrom] = React.useState('')
  const [validTo, setValidTo] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setPriceListId(defaultPriceListId ?? '')
      setProductId('')
      setUomId('')
      setMinQty('')
      setUnitPrice('')
      setTaxIncluded(false)
      setValidFrom('')
      setValidTo('')
      setFormError(null)
    }
  }, [open, defaultPriceListId])

  async function submit() {
    if (!priceListId || !productId || !uomId) {
      setFormError('Price list, product, and unit of measure are required.')
      return
    }

    const price = Number(unitPrice)
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Enter a unit price of zero or more.')
      return
    }

    const tier = minQty.trim() === '' ? undefined : Number(minQty)
    if (tier !== undefined && (!Number.isFinite(tier) || tier < 0)) {
      setFormError('Minimum quantity must be zero or more.')
      return
    }

    setFormError(null)

    try {
      await upsertProductPrice.mutateAsync({
        priceListId,
        productId,
        uomId,
        minQty: tier,
        unitPrice: price,
        taxIncluded,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
      })
      notifySuccess('Price saved', 'The product price is now on the list.')
      onOpenChange(false)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Could not save the price.',
      )
      notifyError(error, 'Could not save the price')
    }
  }

  return (
    <DrawerForm
      open={open}
      onOpenChange={onOpenChange}
      title="Add price"
      description="Saving the same product, unit, and tier again updates the existing entry."
      submitLabel="Save price"
      isPending={upsertProductPrice.isPending}
      error={formError}
      submitDisabled={!priceListId || !productId || !uomId || !unitPrice}
      onSubmit={submit}
    >
      <Field label="Price list" required>
        <select
          className={fieldInputClassName}
          value={priceListId}
          onChange={(event) => setPriceListId(event.target.value)}
        >
          <option value="">Select a price list…</option>
          {priceLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name} ({list.code})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Product" required>
        <select
          className={fieldInputClassName}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          <option value="">Select a product…</option>
          {(productsQuery.data?.items ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · {product.sku}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Unit of measure" required>
        <select
          className={fieldInputClassName}
          value={uomId}
          onChange={(event) => setUomId(event.target.value)}
        >
          <option value="">Select a unit…</option>
          {(uomsQuery.data ?? []).map((uom) => (
            <option key={uom.id} value={uom.id}>
              {uom.name} ({uom.code})
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Minimum quantity"
        hint="Quantity-break tier. Leave blank for the base price."
      >
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          className={fieldInputClassName}
          value={minQty}
          onChange={(event) => setMinQty(event.target.value)}
          placeholder="0"
        />
      </Field>

      <Field label="Unit price" required>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          className={fieldInputClassName}
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          placeholder="0.00"
        />
      </Field>

      <Field label="Tax">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={taxIncluded}
            onChange={(event) => setTaxIncluded(event.target.checked)}
          />
          Price is tax inclusive
        </label>
      </Field>

      <Field label="Valid from">
        <input
          type="date"
          className={fieldInputClassName}
          value={validFrom}
          onChange={(event) => setValidFrom(event.target.value)}
        />
      </Field>

      <Field label="Valid to">
        <input
          type="date"
          className={fieldInputClassName}
          value={validTo}
          onChange={(event) => setValidTo(event.target.value)}
        />
      </Field>
    </DrawerForm>
  )
}

export function PricingWorkspace() {
  const { permissions, roles, can } = usePermissions()
  const canManage = can(MANAGE)

  const [selectedListId, setSelectedListId] = React.useState<string | null>(
    null,
  )
  const [entrySearch, setEntrySearch] = React.useState('')
  const [listDrawerOpen, setListDrawerOpen] = React.useState(false)
  const [editingList, setEditingList] = React.useState<PriceListRow | null>(
    null,
  )
  const [entryDrawerOpen, setEntryDrawerOpen] = React.useState(false)
  const [deleteListTarget, setDeleteListTarget] =
    React.useState<PriceListRow | null>(null)
  const [deleteEntryTarget, setDeleteEntryTarget] =
    React.useState<ProductPriceRow | null>(null)

  const listsQuery = usePriceLists()
  const pricesQuery = useProductPrices(
    selectedListId ? { priceListId: selectedListId } : {},
  )
  const uomsQuery = useUoms()
  const { deletePriceList, deleteProductPrice } = usePricingMutations()

  const lists = listsQuery.data ?? []
  const prices = pricesQuery.data ?? []

  const activeCount = lists.filter((list) => list.isActive).length
  const entryCount = lists.reduce((sum, list) => sum + list.priceCount, 0)
  const defaultList = lists.find((list) => list.isDefault)
  const selectedList = selectedListId
    ? (lists.find((list) => list.id === selectedListId) ?? null)
    : null

  const uomLabelById = React.useMemo(
    () =>
      new Map(
        (uomsQuery.data ?? []).map((uom) => [
          uom.id,
          `${uom.name} (${uom.code})`,
        ]),
      ),
    [uomsQuery.data],
  )

  const currencyByListId = React.useMemo(
    () => new Map(lists.map((list) => [list.id, list.currencyCode])),
    [lists],
  )

  // Product search narrows the loaded entries client-side.
  const entryRows = prices.filter((price) => {
    if (!entrySearch) {
      return true
    }
    const needle = entrySearch.toLowerCase()
    return (
      price.product.sku.toLowerCase().includes(needle) ||
      price.product.name.toLowerCase().includes(needle)
    )
  })

  function openCreateList() {
    setEditingList(null)
    setListDrawerOpen(true)
  }

  function openEditList(list: PriceListRow) {
    setEditingList(list)
    setListDrawerOpen(true)
  }

  async function confirmDeleteList() {
    if (!deleteListTarget) {
      return
    }
    try {
      await deletePriceList.mutateAsync(deleteListTarget.id)
      notifySuccess('Price list deleted', deleteListTarget.name)
      if (selectedListId === deleteListTarget.id) {
        setSelectedListId(null)
      }
      setDeleteListTarget(null)
    } catch (error) {
      notifyError(error, 'Could not delete the price list')
    }
  }

  async function confirmDeleteEntry() {
    if (!deleteEntryTarget) {
      return
    }
    try {
      await deleteProductPrice.mutateAsync(deleteEntryTarget.id)
      notifySuccess('Price removed', deleteEntryTarget.product.name)
      setDeleteEntryTarget(null)
    } catch (error) {
      notifyError(error, 'Could not remove the price')
    }
  }

  const listColumns: DataTableColumn<PriceListRow>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: (row) => (
        <span
          className={
            row.id === selectedListId
              ? 'font-mono text-xs font-semibold text-primary'
              : 'font-mono text-xs'
          }
        >
          {row.code}
        </span>
      ),
      sortValue: (row) => row.code,
      exportValue: (row) => row.code,
      alwaysVisible: true,
    },
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium">{row.name}</span>
          {row.isDefault ? (
            <StatusChip tone="primary">Default</StatusChip>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.name,
      exportValue: (row) => row.name,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <StatusChip tone={priceListTypeTone[row.type as PriceListType]} dot>
          {row.type === 'PURCHASE' ? 'Purchase' : 'Sales'}
        </StatusChip>
      ),
      sortValue: (row) => row.type,
      exportValue: (row) => row.type,
    },
    {
      id: 'currency',
      header: 'Currency',
      cell: (row) => row.currencyCode,
      sortValue: (row) => row.currencyCode,
      exportValue: (row) => row.currencyCode,
    },
    {
      id: 'validity',
      header: 'Validity',
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatValidity(row.validFrom, row.validTo)}
        </span>
      ),
      sortValue: (row) =>
        row.validFrom ? new Date(row.validFrom).getTime() : 0,
      exportValue: (row) => formatValidity(row.validFrom, row.validTo),
    },
    {
      id: 'active',
      header: 'Active',
      cell: (row) => (
        <StatusChip tone={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusChip>
      ),
      sortValue: (row) => (row.isActive ? 1 : 0),
      exportValue: (row) => (row.isActive ? 'active' : 'inactive'),
    },
    {
      id: 'priceCount',
      header: 'Prices',
      align: 'end',
      cell: (row) => row.priceCount.toLocaleString(),
      sortValue: (row) => row.priceCount,
      exportValue: (row) => row.priceCount,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'end',
            alwaysVisible: true,
            cell: (row) => (
              <span
                className="inline-flex items-center gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => openEditList(row)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setDeleteListTarget(row)}
                >
                  Delete
                </Button>
              </span>
            ),
          } satisfies DataTableColumn<PriceListRow>,
        ]
      : []),
  ]

  const entryColumns: DataTableColumn<ProductPriceRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.product.name}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {row.product.sku}
          </span>
        </span>
      ),
      sortValue: (row) => row.product.name,
      exportValue: (row) => `${row.product.sku} ${row.product.name}`,
      alwaysVisible: true,
    },
    {
      id: 'priceList',
      header: 'Price list',
      cell: (row) => (
        <span className="whitespace-nowrap text-xs">
          {row.priceList.name}{' '}
          <span className="font-mono text-muted-foreground">
            ({row.priceList.code})
          </span>
        </span>
      ),
      sortValue: (row) => row.priceList.name,
      exportValue: (row) => row.priceList.code,
    },
    {
      id: 'uom',
      header: 'Unit',
      cell: (row) => uomLabelById.get(row.uomId) ?? '—',
      sortValue: (row) => uomLabelById.get(row.uomId) ?? '',
      exportValue: (row) => uomLabelById.get(row.uomId) ?? row.uomId,
    },
    {
      id: 'minQty',
      header: 'Min qty',
      align: 'end',
      cell: (row) => formatQty(row.minQty),
      sortValue: (row) => Number(row.minQty),
      exportValue: (row) => row.minQty,
    },
    {
      id: 'unitPrice',
      header: 'Unit price',
      align: 'end',
      cell: (row) => (
        <span className="font-medium">
          {formatMoney(row.unitPrice, currencyByListId.get(row.priceListId))}
        </span>
      ),
      sortValue: (row) => Number(row.unitPrice),
      exportValue: (row) => row.unitPrice,
    },
    {
      id: 'tax',
      header: 'Tax',
      cell: (row) => (
        <StatusChip tone={row.taxIncluded ? 'info' : 'neutral'}>
          {row.taxIncluded ? 'Incl. tax' : 'Excl. tax'}
        </StatusChip>
      ),
      sortValue: (row) => (row.taxIncluded ? 1 : 0),
      exportValue: (row) => (row.taxIncluded ? 'included' : 'excluded'),
    },
    {
      id: 'validity',
      header: 'Validity',
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatValidity(row.validFrom, row.validTo)}
        </span>
      ),
      sortValue: (row) =>
        row.validFrom ? new Date(row.validFrom).getTime() : 0,
      exportValue: (row) => formatValidity(row.validFrom, row.validTo),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'end',
            alwaysVisible: true,
            cell: (row) => (
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="text-destructive"
                onClick={() => setDeleteEntryTarget(row)}
              >
                Delete
              </Button>
            ),
          } satisfies DataTableColumn<ProductPriceRow>,
        ]
      : []),
  ]

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory · Pricing"
      title="Product Pricing"
      description="Maintain sales and purchase price lists, then load each list with per-product, per-unit prices and quantity-break tiers."
      actions={
        canManage ? (
          <Button type="button" onClick={openCreateList}>
            New price list
          </Button>
        ) : null
      }
      metrics={[
        {
          label: 'Price lists',
          value: listsQuery.isLoading ? '—' : lists.length.toLocaleString(),
          hint: 'Sales and purchase lists',
          tone: 'red',
        },
        {
          label: 'Active lists',
          value: listsQuery.isLoading ? '—' : activeCount.toLocaleString(),
          hint: 'Currently applicable',
          tone: 'accent',
        },
        {
          label: 'Price entries',
          value: listsQuery.isLoading ? '—' : entryCount.toLocaleString(),
          hint: 'Across all lists',
          tone: 'neutral',
        },
        {
          label: 'Default list',
          value: listsQuery.isLoading ? '—' : (defaultList?.name ?? 'None'),
          hint: 'Used when no list is specified',
          tone: 'neutral',
        },
      ]}
    >
      <AccessGuard
        permissions={VIEW}
        userRoles={roles}
        userPermissions={permissions}
        fallback={
          <WorkspaceEmptyState
            title="You don't have access to product pricing"
            description="Ask an administrator for the 'View Products' or 'Manage Pricing' permission."
          />
        }
      >
        <WorkspacePanel
          eyebrow="Catalog"
          title="Price lists"
          description="Click a list to filter its price entries below. The default list is applied when no list is specified."
        >
          <DataTable
            columns={listColumns}
            rows={lists}
            rowKey={(row) => row.id}
            isLoading={listsQuery.isLoading}
            isError={listsQuery.isError}
            errorMessage="Could not load price lists. Check your connection and permissions, then retry."
            emptyTitle="No price lists yet"
            emptyDescription="Create a price list to start assigning product prices."
            emptyChildren={
              canManage ? (
                <Button type="button" onClick={openCreateList}>
                  Create price list
                </Button>
              ) : null
            }
            onRowClick={(row) =>
              setSelectedListId((current) =>
                current === row.id ? null : row.id,
              )
            }
            enableColumnVisibility
            exportFileName="price-lists"
            pageSize={10}
          />
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Entries"
          title="Price entries"
          description={
            selectedList
              ? `Prices on ${selectedList.name} (${selectedList.code}).`
              : 'Prices across all lists. Select a price list above to narrow the view.'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterBar>
              <FilterSelect
                label="Price list"
                value={selectedListId ?? ''}
                onChange={(value) => setSelectedListId(value || null)}
                options={[
                  { value: '', label: 'All price lists' },
                  ...lists.map((list) => ({
                    value: list.id,
                    label: `${list.name} (${list.code})`,
                  })),
                ]}
                includeAll={false}
              />
              <FilterSearch
                value={entrySearch}
                onChange={setEntrySearch}
                placeholder="Search product SKU or name…"
              />
            </FilterBar>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setEntryDrawerOpen(true)}
              >
                Add price
              </Button>
            ) : null}
          </div>

          <div className="mt-4">
            <DataTable
              columns={entryColumns}
              rows={entryRows}
              rowKey={(row) => row.id}
              isLoading={pricesQuery.isLoading}
              isError={pricesQuery.isError}
              errorMessage="Could not load price entries. Check your connection and permissions, then retry."
              emptyTitle="No price entries"
              emptyDescription={
                selectedList
                  ? 'This price list has no prices yet. Add the first one.'
                  : 'Add a price to put a product on a price list.'
              }
              emptyChildren={
                canManage ? (
                  <Button
                    type="button"
                    onClick={() => setEntryDrawerOpen(true)}
                  >
                    Add price
                  </Button>
                ) : null
              }
              enableColumnVisibility
              exportFileName="product-prices"
              pageSize={20}
            />
          </div>
        </WorkspacePanel>
      </AccessGuard>

      <PriceListDrawer
        open={listDrawerOpen}
        onOpenChange={setListDrawerOpen}
        editing={editingList}
      />

      <PriceEntryDrawer
        open={entryDrawerOpen}
        onOpenChange={setEntryDrawerOpen}
        priceLists={lists}
        defaultPriceListId={selectedListId}
      />

      <ConfirmDialog
        open={Boolean(deleteListTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteListTarget(null)
          }
        }}
        title="Delete this price list?"
        description={
          deleteListTarget
            ? `${deleteListTarget.name} (${deleteListTarget.code}) and its ${deleteListTarget.priceCount.toLocaleString()} price entrie(s) will be removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete price list"
        tone="destructive"
        isPending={deletePriceList.isPending}
        onConfirm={confirmDeleteList}
      />

      <ConfirmDialog
        open={Boolean(deleteEntryTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteEntryTarget(null)
          }
        }}
        title="Remove this price?"
        description={
          deleteEntryTarget
            ? `${deleteEntryTarget.product.name} (${deleteEntryTarget.product.sku}) will no longer have this price on ${deleteEntryTarget.priceList.name}.`
            : undefined
        }
        confirmLabel="Remove price"
        tone="destructive"
        isPending={deleteProductPrice.isPending}
        onConfirm={confirmDeleteEntry}
      />
    </WorkspacePage>
  )
}

'use client'

import * as React from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  useBrands,
  useCategories,
  useSuppliersLookup,
  useTaxRates,
  useUoms,
} from '#/features/products/use-master-data'
import { useProductMutations } from '#/features/products/use-products'
import { productCreateSchema } from '#/features/products/validation'

export type ProductFormValues = {
  id: string
  sku: string
  name: string
  description: string | null
  productType: string
  trackingPolicy: string
  isStockTracked: boolean
  hasExpiry: boolean
  shelfLifeDays: number | null
  categoryId: string | null
  brandId: string | null
  baseUomId: string
  salesUomId: string | null
  purchaseUomId: string | null
  costingMethod: string
  standardCost: string | null
  defaultPrice: string | null
  taxRateId: string | null
  barcode: string | null
  reorderPoint: string | null
  reorderQty: string | null
  minStock: string | null
  maxStock: string | null
  safetyStock: string | null
  leadTimeDays: number | null
  preferredSupplierId: string | null
  status: string
  isActive: boolean
}

const PRODUCT_TYPES = [
  'SIMPLE',
  'VARIANT',
  'BUNDLE',
  'KIT',
  'SERVICE',
  'COMPOSITE',
]
const TRACKING_POLICIES = ['NONE', 'LOT', 'SERIAL', 'LOT_SERIAL']
const COSTING_METHODS = ['WEIGHTED_AVERAGE', 'FIFO', 'STANDARD']
const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED']

type FormState = {
  sku: string
  name: string
  description: string
  productType: string
  trackingPolicy: string
  isStockTracked: boolean
  hasExpiry: boolean
  shelfLifeDays: string
  categoryId: string
  brandId: string
  baseUomId: string
  salesUomId: string
  purchaseUomId: string
  costingMethod: string
  standardCost: string
  defaultPrice: string
  taxRateId: string
  barcode: string
  reorderPoint: string
  reorderQty: string
  minStock: string
  maxStock: string
  safetyStock: string
  leadTimeDays: string
  preferredSupplierId: string
  status: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  sku: '',
  name: '',
  description: '',
  productType: 'SIMPLE',
  trackingPolicy: 'NONE',
  isStockTracked: true,
  hasExpiry: false,
  shelfLifeDays: '',
  categoryId: '',
  brandId: '',
  baseUomId: '',
  salesUomId: '',
  purchaseUomId: '',
  costingMethod: 'WEIGHTED_AVERAGE',
  standardCost: '',
  defaultPrice: '',
  taxRateId: '',
  barcode: '',
  reorderPoint: '',
  reorderQty: '',
  minStock: '',
  maxStock: '',
  safetyStock: '',
  leadTimeDays: '',
  preferredSupplierId: '',
  status: 'ACTIVE',
  isActive: true,
}

function toFormState(product: ProductFormValues | null): FormState {
  if (!product) {
    return EMPTY_FORM
  }

  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    productType: product.productType,
    trackingPolicy: product.trackingPolicy,
    isStockTracked: product.isStockTracked,
    hasExpiry: product.hasExpiry,
    shelfLifeDays:
      product.shelfLifeDays === null ? '' : String(product.shelfLifeDays),
    categoryId: product.categoryId ?? '',
    brandId: product.brandId ?? '',
    baseUomId: product.baseUomId,
    salesUomId: product.salesUomId ?? '',
    purchaseUomId: product.purchaseUomId ?? '',
    costingMethod: product.costingMethod,
    standardCost: product.standardCost ?? '',
    defaultPrice: product.defaultPrice ?? '',
    taxRateId: product.taxRateId ?? '',
    barcode: product.barcode ?? '',
    reorderPoint: product.reorderPoint ?? '',
    reorderQty: product.reorderQty ?? '',
    minStock: product.minStock ?? '',
    maxStock: product.maxStock ?? '',
    safetyStock: product.safetyStock ?? '',
    leadTimeDays:
      product.leadTimeDays === null ? '' : String(product.leadTimeDays),
    preferredSupplierId: product.preferredSupplierId ?? '',
    status: product.status,
    isActive: product.isActive,
  }
}

// Trims optional text inputs to `null` and coerces numerics so the payload
// matches productCreateSchema before it leaves the browser.
function toPayload(form: FormState) {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  const int = (value: string) => (value.trim() === '' ? null : Number(value))

  return {
    sku: form.sku.trim(),
    name: form.name.trim(),
    description: text(form.description),
    productType: form.productType,
    trackingPolicy: form.trackingPolicy,
    isStockTracked: form.isStockTracked,
    hasExpiry: form.hasExpiry,
    shelfLifeDays: int(form.shelfLifeDays),
    categoryId: text(form.categoryId),
    brandId: text(form.brandId),
    baseUomId: form.baseUomId,
    salesUomId: text(form.salesUomId),
    purchaseUomId: text(form.purchaseUomId),
    costingMethod: form.costingMethod,
    standardCost: text(form.standardCost),
    defaultPrice: text(form.defaultPrice),
    taxRateId: text(form.taxRateId),
    barcode: text(form.barcode),
    reorderPoint: text(form.reorderPoint),
    reorderQty: text(form.reorderQty),
    minStock: text(form.minStock),
    maxStock: text(form.maxStock),
    safetyStock: text(form.safetyStock),
    leadTimeDays: int(form.leadTimeDays),
    preferredSupplierId: text(form.preferredSupplierId),
    status: form.status,
    isActive: form.isActive,
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

function EnumSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<string>
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={selectClassName}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replace(/_/g, ' ').toLowerCase()}
        </option>
      ))}
    </select>
  )
}

function LookupSelect({
  value,
  onChange,
  placeholder,
  items,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  items: Array<{ id: string; name: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={selectClassName}
    >
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  )
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductFormValues | null
}) {
  const isEdit = product !== null
  const [form, setForm] = React.useState<FormState>(() => toFormState(product))
  const [error, setError] = React.useState<string | null>(null)
  const categoriesQuery = useCategories()
  const brandsQuery = useBrands()
  const uomsQuery = useUoms()
  const taxRatesQuery = useTaxRates()
  const suppliersQuery = useSuppliersLookup()
  const { createProduct, updateProduct, deleteProduct } = useProductMutations()
  const isBusy =
    createProduct.isPending ||
    updateProduct.isPending ||
    deleteProduct.isPending

  React.useEffect(() => {
    if (open) {
      setForm(toFormState(product))
      setError(null)
    }
  }, [open, product])

  const set = <TKey extends keyof FormState>(key: TKey, value: FormState[TKey]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const uoms = uomsQuery.data ?? []

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = productCreateSchema.safeParse(toPayload(form))

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateProduct.mutateAsync({ id: product.id, input: parsed.data })
      } else {
        await createProduct.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the product.',
      )
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteProduct.mutateAsync(product.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the product.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the product master record. Changes are audit-logged.'
              : 'Register a product in the catalog. SKU and base unit are required.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SKU *">
              <Input
                value={form.sku}
                onChange={(event) => set('sku', event.target.value)}
                placeholder="SKU-0001"
                required
              />
            </Field>
            <Field label="Barcode">
              <Input
                value={form.barcode}
                onChange={(event) => set('barcode', event.target.value)}
                placeholder="EAN / UPC"
              />
            </Field>
          </div>

          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Arabica beans 1kg"
              required
            />
          </Field>

          <Field label="Description">
            <Input
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Type">
              <EnumSelect
                value={form.productType}
                options={PRODUCT_TYPES}
                onChange={(value) => set('productType', value)}
              />
            </Field>
            <Field label="Category">
              <LookupSelect
                value={form.categoryId}
                onChange={(value) => set('categoryId', value)}
                placeholder="Uncategorised"
                items={categoriesQuery.data ?? []}
              />
            </Field>
            <Field label="Brand">
              <LookupSelect
                value={form.brandId}
                onChange={(value) => set('brandId', value)}
                placeholder="No brand"
                items={brandsQuery.data ?? []}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Base unit *">
              <select
                value={form.baseUomId}
                onChange={(event) => set('baseUomId', event.target.value)}
                className={selectClassName}
                required
              >
                <option value="">Select unit…</option>
                {uoms.map((uom) => (
                  <option key={uom.id} value={uom.id}>
                    {uom.name} ({uom.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sales unit">
              <LookupSelect
                value={form.salesUomId}
                onChange={(value) => set('salesUomId', value)}
                placeholder="Same as base"
                items={uoms}
              />
            </Field>
            <Field label="Purchase unit">
              <LookupSelect
                value={form.purchaseUomId}
                onChange={(value) => set('purchaseUomId', value)}
                placeholder="Same as base"
                items={uoms}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Costing">
              <EnumSelect
                value={form.costingMethod}
                options={COSTING_METHODS}
                onChange={(value) => set('costingMethod', value)}
              />
            </Field>
            <Field label="Standard cost">
              <Input
                inputMode="decimal"
                value={form.standardCost}
                onChange={(event) => set('standardCost', event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Default price">
              <Input
                inputMode="decimal"
                value={form.defaultPrice}
                onChange={(event) => set('defaultPrice', event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Tax rate">
              <LookupSelect
                value={form.taxRateId}
                onChange={(value) => set('taxRateId', value)}
                placeholder="No tax"
                items={taxRatesQuery.data ?? []}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tracking">
              <EnumSelect
                value={form.trackingPolicy}
                options={TRACKING_POLICIES}
                onChange={(value) => set('trackingPolicy', value)}
              />
            </Field>
            <Field label="Status">
              <EnumSelect
                value={form.status}
                options={PRODUCT_STATUSES}
                onChange={(value) => set('status', value)}
              />
            </Field>
            <Field label="Shelf life (days)">
              <Input
                inputMode="numeric"
                value={form.shelfLifeDays}
                onChange={(event) => set('shelfLifeDays', event.target.value)}
                disabled={!form.hasExpiry}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Reorder point">
              <Input
                inputMode="decimal"
                value={form.reorderPoint}
                onChange={(event) => set('reorderPoint', event.target.value)}
              />
            </Field>
            <Field label="Reorder qty">
              <Input
                inputMode="decimal"
                value={form.reorderQty}
                onChange={(event) => set('reorderQty', event.target.value)}
              />
            </Field>
            <Field label="Safety stock">
              <Input
                inputMode="decimal"
                value={form.safetyStock}
                onChange={(event) => set('safetyStock', event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Min stock">
              <Input
                inputMode="decimal"
                value={form.minStock}
                onChange={(event) => set('minStock', event.target.value)}
              />
            </Field>
            <Field label="Max stock">
              <Input
                inputMode="decimal"
                value={form.maxStock}
                onChange={(event) => set('maxStock', event.target.value)}
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                inputMode="numeric"
                value={form.leadTimeDays}
                onChange={(event) => set('leadTimeDays', event.target.value)}
              />
            </Field>
            <Field label="Preferred supplier">
              <LookupSelect
                value={form.preferredSupplierId}
                onChange={(value) => set('preferredSupplierId', value)}
                placeholder="None"
                items={suppliersQuery.data ?? []}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isStockTracked}
                onChange={(event) =>
                  set('isStockTracked', event.target.checked)
                }
                className="size-4 accent-primary"
              />
              Stock tracked
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hasExpiry}
                onChange={(event) => set('hasExpiry', event.target.checked)}
                className="size-4 accent-primary"
              />
              Has expiry
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => set('isActive', event.target.checked)}
                className="size-4 accent-primary"
              />
              Active
            </label>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isBusy}
                onClick={handleDelete}
                className="sm:mr-auto"
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

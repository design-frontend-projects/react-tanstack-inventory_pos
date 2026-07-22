'use client'

import * as React from 'react'
import { FormWizard } from '#/components/forms/form-wizard'
import { Field, fieldInputClassName } from '#/components/forms/drawer-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  useBrands,
  useCategories,
  useTaxRates,
  useUoms,
} from '#/features/products/use-master-data'
import { useProductMutations } from '#/features/products/use-products'
import { productCreateSchema } from '#/features/products/validation'
import { notifySuccess } from '#/lib/toast/toast-store'
import type { WizardStep } from '#/components/forms/form-wizard'

// Guided, multi-step alternative to the quick-create ProductFormDialog. Walks
// the product master record in domain order (identity → classification →
// units → costing → stock policy → review) and submits the same
// productCreateSchema payload through the same create mutation.

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

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

type WizardFormState = {
  sku: string
  name: string
  description: string
  productType: string
  status: string
  categoryId: string
  brandId: string
  taxRateId: string
  baseUomId: string
  salesUomId: string
  purchaseUomId: string
  costingMethod: string
  standardCost: string
  defaultPrice: string
  isStockTracked: boolean
  trackingPolicy: string
  hasExpiry: boolean
  reorderPoint: string
  reorderQty: string
  minStock: string
  maxStock: string
  safetyStock: string
  leadTimeDays: string
}

const EMPTY_FORM: WizardFormState = {
  sku: '',
  name: '',
  description: '',
  productType: 'SIMPLE',
  status: 'ACTIVE',
  categoryId: '',
  brandId: '',
  taxRateId: '',
  baseUomId: '',
  salesUomId: '',
  purchaseUomId: '',
  costingMethod: 'WEIGHTED_AVERAGE',
  standardCost: '',
  defaultPrice: '',
  isStockTracked: true,
  trackingPolicy: 'NONE',
  hasExpiry: false,
  reorderPoint: '',
  reorderQty: '',
  minStock: '',
  maxStock: '',
  safetyStock: '',
  leadTimeDays: '',
}

// Trims optional text inputs to `null` and coerces ints so the payload matches
// productCreateSchema before it leaves the browser (decimals stay as strings).
function toPayload(form: WizardFormState) {
  const text = (value: string) => (value.trim() === '' ? null : value.trim())
  const int = (value: string) => (value.trim() === '' ? null : Number(value))

  return {
    sku: form.sku.trim(),
    name: form.name.trim(),
    description: text(form.description),
    productType: form.productType,
    status: form.status,
    categoryId: text(form.categoryId),
    brandId: text(form.brandId),
    taxRateId: text(form.taxRateId),
    baseUomId: form.baseUomId,
    salesUomId: text(form.salesUomId),
    purchaseUomId: text(form.purchaseUomId),
    costingMethod: form.costingMethod,
    standardCost: text(form.standardCost),
    defaultPrice: text(form.defaultPrice),
    isStockTracked: form.isStockTracked,
    trackingPolicy: form.trackingPolicy,
    hasExpiry: form.hasExpiry,
    reorderPoint: text(form.reorderPoint),
    reorderQty: text(form.reorderQty),
    minStock: text(form.minStock),
    maxStock: text(form.maxStock),
    safetyStock: text(form.safetyStock),
    leadTimeDays: int(form.leadTimeDays),
  }
}

function validateDecimals(
  form: WizardFormState,
  fields: Array<{ key: keyof WizardFormState; label: string }>,
): string | null {
  for (const field of fields) {
    const value = String(form[field.key]).trim()
    if (value !== '' && !DECIMAL_PATTERN.test(value)) {
      return `${field.label} must be a number.`
    }
  }
  return null
}

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
      className={fieldInputClassName}
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
      className={fieldInputClassName}
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

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function ProductCreateWizard({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = React.useState<WizardFormState>(EMPTY_FORM)
  const [error, setError] = React.useState<string | null>(null)
  const categoriesQuery = useCategories()
  const brandsQuery = useBrands()
  const uomsQuery = useUoms()
  const taxRatesQuery = useTaxRates()
  const { createProduct } = useProductMutations()

  React.useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setError(null)
    }
  }, [open])

  const set = <TKey extends keyof WizardFormState>(
    key: TKey,
    value: WizardFormState[TKey],
  ) => setForm((previous) => ({ ...previous, [key]: value }))

  const uoms = uomsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const brands = brandsQuery.data ?? []
  const taxRates = taxRatesQuery.data ?? []

  const lookupName = (
    items: Array<{ id: string; name: string }>,
    id: string,
    fallback: string,
  ) => {
    if (id === '') {
      return fallback
    }
    return items.find((item) => item.id === id)?.name ?? fallback
  }

  const uomName = (id: string, fallback: string) => {
    if (id === '') {
      return fallback
    }
    const uom = uoms.find((item) => item.id === id)
    return uom ? `${uom.name} (${uom.code})` : fallback
  }

  const enumLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase()
  const orDash = (value: string) => (value.trim() === '' ? '—' : value.trim())

  const steps: Array<WizardStep> = [
    {
      id: 'general',
      title: 'General',
      description: 'Identify the product: SKU, name, type, and lifecycle.',
      validate: () => {
        if (form.sku.trim() === '') {
          return 'SKU is required.'
        }
        if (form.sku.trim().length > 64) {
          return 'SKU must be 64 characters or fewer.'
        }
        if (form.name.trim() === '') {
          return 'Name is required.'
        }
        if (form.name.trim().length > 200) {
          return 'Name must be 200 characters or fewer.'
        }
        if (form.description.trim().length > 2000) {
          return 'Description must be 2000 characters or fewer.'
        }
        return null
      },
    },
    {
      id: 'classification',
      title: 'Classification',
      description: 'Group the product for reporting, filtering, and tax.',
    },
    {
      id: 'units',
      title: 'Units',
      description:
        'The base unit drives stock keeping; sales and purchase units default to it.',
      validate: () => (form.baseUomId === '' ? 'Base unit is required.' : null),
    },
    {
      id: 'pricing',
      title: 'Pricing & costing',
      description: 'How the product is valued and its default sell price.',
      validate: () =>
        validateDecimals(form, [
          { key: 'standardCost', label: 'Standard cost' },
          { key: 'defaultPrice', label: 'Default price' },
        ]),
    },
    {
      id: 'stock',
      title: 'Stock policies',
      description: 'Tracking, expiry, and replenishment thresholds.',
      validate: () => {
        const decimalError = validateDecimals(form, [
          { key: 'reorderPoint', label: 'Reorder point' },
          { key: 'reorderQty', label: 'Reorder qty' },
          { key: 'minStock', label: 'Min stock' },
          { key: 'maxStock', label: 'Max stock' },
          { key: 'safetyStock', label: 'Safety stock' },
        ])
        if (decimalError) {
          return decimalError
        }
        const leadTime = form.leadTimeDays.trim()
        if (leadTime !== '') {
          const parsed = Number(leadTime)
          if (!Number.isInteger(parsed) || parsed < 0) {
            return 'Lead time must be a whole number of days (0 or more).'
          }
        }
        return null
      },
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Confirm the record, then finish to create the product.',
    },
  ]

  async function handleComplete() {
    setError(null)

    const parsed = productCreateSchema.safeParse(toPayload(form))

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      await createProduct.mutateAsync(parsed.data)
      notifySuccess(
        'Product created',
        `${parsed.data.name} was added to the catalog.`,
      )
      onOpenChange(false)
      setForm(EMPTY_FORM)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not create the product.',
      )
    }
  }

  function renderStep(step: WizardStep) {
    switch (step.id) {
      case 'general':
        return (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SKU" required>
                <Input
                  value={form.sku}
                  onChange={(event) => set('sku', event.target.value)}
                  placeholder="SKU-0001"
                />
              </Field>
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(event) => set('name', event.target.value)}
                  placeholder="Arabica beans 1kg"
                />
              </Field>
            </div>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(event) => set('description', event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <EnumSelect
                  value={form.productType}
                  options={PRODUCT_TYPES}
                  onChange={(value) => set('productType', value)}
                />
              </Field>
              <Field label="Status">
                <EnumSelect
                  value={form.status}
                  options={PRODUCT_STATUSES}
                  onChange={(value) => set('status', value)}
                />
              </Field>
            </div>
          </div>
        )
      case 'classification':
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category">
              <LookupSelect
                value={form.categoryId}
                onChange={(value) => set('categoryId', value)}
                placeholder="Uncategorised"
                items={categories}
              />
            </Field>
            <Field label="Brand">
              <LookupSelect
                value={form.brandId}
                onChange={(value) => set('brandId', value)}
                placeholder="No brand"
                items={brands}
              />
            </Field>
            <Field label="Tax rate">
              <LookupSelect
                value={form.taxRateId}
                onChange={(value) => set('taxRateId', value)}
                placeholder="No tax"
                items={taxRates}
              />
            </Field>
          </div>
        )
      case 'units':
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Base unit" required>
              <select
                value={form.baseUomId}
                onChange={(event) => set('baseUomId', event.target.value)}
                className={fieldInputClassName}
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
        )
      case 'pricing':
        return (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Costing method">
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
          </div>
        )
      case 'stock':
        return (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-5">
              <CheckboxField
                label="Stock tracked"
                checked={form.isStockTracked}
                onChange={(checked) => set('isStockTracked', checked)}
              />
              <CheckboxField
                label="Has expiry"
                checked={form.hasExpiry}
                onChange={(checked) => set('hasExpiry', checked)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tracking policy">
                <EnumSelect
                  value={form.trackingPolicy}
                  options={TRACKING_POLICIES}
                  onChange={(value) => set('trackingPolicy', value)}
                />
              </Field>
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
              <Field label="Safety stock">
                <Input
                  inputMode="decimal"
                  value={form.safetyStock}
                  onChange={(event) => set('safetyStock', event.target.value)}
                />
              </Field>
              <Field label="Lead time (days)">
                <Input
                  inputMode="numeric"
                  value={form.leadTimeDays}
                  onChange={(event) => set('leadTimeDays', event.target.value)}
                />
              </Field>
            </div>
          </div>
        )
      case 'review':
        return (
          <dl className="grid gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3">
            <ReviewItem label="SKU" value={orDash(form.sku)} />
            <ReviewItem label="Name" value={orDash(form.name)} />
            <ReviewItem label="Description" value={orDash(form.description)} />
            <ReviewItem label="Type" value={enumLabel(form.productType)} />
            <ReviewItem label="Status" value={enumLabel(form.status)} />
            <ReviewItem
              label="Category"
              value={lookupName(categories, form.categoryId, 'Uncategorised')}
            />
            <ReviewItem
              label="Brand"
              value={lookupName(brands, form.brandId, 'No brand')}
            />
            <ReviewItem
              label="Tax rate"
              value={lookupName(taxRates, form.taxRateId, 'No tax')}
            />
            <ReviewItem
              label="Base unit"
              value={uomName(form.baseUomId, '—')}
            />
            <ReviewItem
              label="Sales unit"
              value={uomName(form.salesUomId, 'Same as base')}
            />
            <ReviewItem
              label="Purchase unit"
              value={uomName(form.purchaseUomId, 'Same as base')}
            />
            <ReviewItem
              label="Costing method"
              value={enumLabel(form.costingMethod)}
            />
            <ReviewItem
              label="Standard cost"
              value={orDash(form.standardCost)}
            />
            <ReviewItem
              label="Default price"
              value={orDash(form.defaultPrice)}
            />
            <ReviewItem
              label="Stock tracked"
              value={form.isStockTracked ? 'Yes' : 'No'}
            />
            <ReviewItem
              label="Tracking policy"
              value={enumLabel(form.trackingPolicy)}
            />
            <ReviewItem
              label="Has expiry"
              value={form.hasExpiry ? 'Yes' : 'No'}
            />
            <ReviewItem
              label="Reorder point"
              value={orDash(form.reorderPoint)}
            />
            <ReviewItem label="Reorder qty" value={orDash(form.reorderQty)} />
            <ReviewItem label="Min stock" value={orDash(form.minStock)} />
            <ReviewItem label="Max stock" value={orDash(form.maxStock)} />
            <ReviewItem label="Safety stock" value={orDash(form.safetyStock)} />
            <ReviewItem
              label="Lead time (days)"
              value={orDash(form.leadTimeDays)}
            />
          </dl>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Guided product create</DialogTitle>
          <DialogDescription>
            Register a product step by step — identity, classification, units,
            costing, and stock policy — then review before saving.
          </DialogDescription>
        </DialogHeader>

        <FormWizard
          steps={steps}
          renderStep={renderStep}
          onComplete={handleComplete}
          onCancel={() => onOpenChange(false)}
          completeLabel="Create product"
          isPending={createProduct.isPending}
          error={error}
        />
      </DialogContent>
    </Dialog>
  )
}

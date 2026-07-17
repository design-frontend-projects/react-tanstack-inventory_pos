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
  useCategories,
  useMasterDataMutations,
} from '#/features/products/use-master-data'
import {
  brandWriteSchema,
  categoryWriteSchema,
  uomWriteSchema,
} from '#/features/products/validation'

// Small create/edit dialogs for the catalog master data (categories, brands,
// units of measure). Same local-state + Zod safeParse pattern as the larger
// form dialogs.

const UOM_TYPES = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'TIME']

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function ErrorNote({ error }: { error: string | null }) {
  if (!error) {
    return null
  }

  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {error}
    </p>
  )
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

// --- Categories ---------------------------------------------------------------

export type CategoryFormValues = {
  id: string
  code: string
  name: string
  parentId: string | null
  displayOrder: number
  isActive: boolean
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: CategoryFormValues | null
}) {
  const isEdit = category !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [parentId, setParentId] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const categoriesQuery = useCategories()
  const { createCategory, updateCategory, deleteCategory } =
    useMasterDataMutations()
  const isBusy =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending

  React.useEffect(() => {
    if (open) {
      setCode(category?.code ?? '')
      setName(category?.name ?? '')
      setParentId(category?.parentId ?? '')
      setIsActive(category?.isActive ?? true)
      setError(null)
    }
  }, [open, category])

  // A category cannot be its own parent; deeper cycles are rejected server-side.
  const parentOptions = (categoriesQuery.data ?? []).filter(
    (option) => option.id !== category?.id,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = categoryWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      parentId: parentId || null,
      isActive,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateCategory.mutateAsync({
          id: category.id,
          input: parsed.data,
        })
      } else {
        await createCategory.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(toMessage(submitError, 'Could not save the category.'))
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteCategory.mutateAsync(category.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(toMessage(deleteError, 'Could not delete the category.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories organise the catalog into a hierarchy for filtering and
            reporting.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="BEVERAGES"
                required
              />
            </Field>
            <Field label="Parent">
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                className={selectClassName}
              >
                <option value="">Top level</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Name *">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Beverages"
              required
            />
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 accent-primary"
            />
            Active
          </label>

          <ErrorNote error={error} />

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
              {isEdit ? 'Save changes' : 'Create category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Brands ---------------------------------------------------------------

export type BrandFormValues = {
  id: string
  code: string
  name: string
  isActive: boolean
}

export function BrandFormDialog({
  open,
  onOpenChange,
  brand,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand: BrandFormValues | null
}) {
  const isEdit = brand !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { createBrand, updateBrand, deleteBrand } = useMasterDataMutations()
  const isBusy =
    createBrand.isPending || updateBrand.isPending || deleteBrand.isPending

  React.useEffect(() => {
    if (open) {
      setCode(brand?.code ?? '')
      setName(brand?.name ?? '')
      setIsActive(brand?.isActive ?? true)
      setError(null)
    }
  }, [open, brand])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = brandWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      isActive,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateBrand.mutateAsync({ id: brand.id, input: parsed.data })
      } else {
        await createBrand.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(toMessage(submitError, 'Could not save the brand.'))
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteBrand.mutateAsync(brand.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(toMessage(deleteError, 'Could not delete the brand.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit brand' : 'New brand'}</DialogTitle>
          <DialogDescription>
            Brands group products by manufacturer or label.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="ACME"
                required
              />
            </Field>
            <Field label="Name *">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Foods"
                required
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 accent-primary"
            />
            Active
          </label>

          <ErrorNote error={error} />

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
              {isEdit ? 'Save changes' : 'Create brand'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Units of measure -------------------------------------------------------

export type UomFormValues = {
  id: string
  code: string
  name: string
  symbol: string | null
  uomType: string
  isBaseUnit: boolean
  decimalPlaces: number
  isActive: boolean
}

export function UomFormDialog({
  open,
  onOpenChange,
  uom,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  uom: UomFormValues | null
}) {
  const isEdit = uom !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [symbol, setSymbol] = React.useState('')
  const [uomType, setUomType] = React.useState('COUNT')
  const [decimalPlaces, setDecimalPlaces] = React.useState('0')
  const [isBaseUnit, setIsBaseUnit] = React.useState(false)
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { createUom, updateUom } = useMasterDataMutations()
  const isBusy = createUom.isPending || updateUom.isPending

  React.useEffect(() => {
    if (open) {
      setCode(uom?.code ?? '')
      setName(uom?.name ?? '')
      setSymbol(uom?.symbol ?? '')
      setUomType(uom?.uomType ?? 'COUNT')
      setDecimalPlaces(String(uom?.decimalPlaces ?? 0))
      setIsBaseUnit(uom?.isBaseUnit ?? false)
      setIsActive(uom?.isActive ?? true)
      setError(null)
    }
  }, [open, uom])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = uomWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      symbol: symbol.trim() || null,
      uomType,
      isBaseUnit,
      decimalPlaces: Number(decimalPlaces),
      isActive,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateUom.mutateAsync({ id: uom.id, input: parsed.data })
      } else {
        await createUom.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(toMessage(submitError, 'Could not save the unit.'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit unit of measure' : 'New unit of measure'}
          </DialogTitle>
          <DialogDescription>
            Units drive quantities across purchasing, stock, and sales.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="KG"
                required
              />
            </Field>
            <Field label="Symbol">
              <Input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                placeholder="kg"
              />
            </Field>
            <Field label="Type">
              <select
                value={uomType}
                onChange={(event) => setUomType(event.target.value)}
                className={selectClassName}
              >
                {UOM_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Name *">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Kilogram"
              required
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Decimal places">
              <Input
                inputMode="numeric"
                value={decimalPlaces}
                onChange={(event) => setDecimalPlaces(event.target.value)}
              />
            </Field>
            <div className="flex items-end gap-5 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isBaseUnit}
                  onChange={(event) => setIsBaseUnit(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Base unit
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Active
              </label>
            </div>
          </div>

          <ErrorNote error={error} />

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isEdit ? 'Save changes' : 'Create unit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

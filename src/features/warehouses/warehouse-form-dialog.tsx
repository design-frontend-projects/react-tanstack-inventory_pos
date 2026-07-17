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
import { useWarehouseMutations } from '#/features/warehouses/use-warehouses'
import { warehouseWriteSchema } from '#/features/warehouses/validation'

export type WarehouseFormValues = {
  id: string
  code: string
  name: string
  warehouseType: string
  isDefault: boolean
  allowNegativeStock: boolean
  isActive: boolean
}

const WAREHOUSE_TYPES = [
  'WAREHOUSE',
  'STORE',
  'OUTLET',
  'VIRTUAL',
  'TRANSIT',
  'QUARANTINE',
]

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

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: WarehouseFormValues | null
}) {
  const isEdit = warehouse !== null
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [warehouseType, setWarehouseType] = React.useState('WAREHOUSE')
  const [isDefault, setIsDefault] = React.useState(false)
  const [allowNegativeStock, setAllowNegativeStock] = React.useState(false)
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { createWarehouse, updateWarehouse, deleteWarehouse } =
    useWarehouseMutations()
  const isBusy =
    createWarehouse.isPending ||
    updateWarehouse.isPending ||
    deleteWarehouse.isPending

  React.useEffect(() => {
    if (open) {
      setCode(warehouse?.code ?? '')
      setName(warehouse?.name ?? '')
      setWarehouseType(warehouse?.warehouseType ?? 'WAREHOUSE')
      setIsDefault(warehouse?.isDefault ?? false)
      setAllowNegativeStock(warehouse?.allowNegativeStock ?? false)
      setIsActive(warehouse?.isActive ?? true)
      setError(null)
    }
  }, [open, warehouse])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = warehouseWriteSchema.safeParse({
      code: code.trim(),
      name: name.trim(),
      warehouseType,
      isDefault,
      allowNegativeStock,
      isActive,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`)
      return
    }

    try {
      if (isEdit) {
        await updateWarehouse.mutateAsync({
          id: warehouse.id,
          input: parsed.data,
        })
      } else {
        await createWarehouse.mutateAsync(parsed.data)
      }
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the warehouse.',
      )
    }
  }

  async function handleDelete() {
    if (!isEdit) {
      return
    }

    setError(null)
    try {
      await deleteWarehouse.mutateAsync(warehouse.id)
      onOpenChange(false)
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the warehouse.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit warehouse' : 'New warehouse'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the warehouse profile. Changes are audit-logged.'
              : 'Register a warehouse, store, or outlet for stock keeping.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Code *">
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="WH-MAIN"
                required
              />
            </Field>
            <Field label="Type">
              <select
                value={warehouseType}
                onChange={(event) => setWarehouseType(event.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
              >
                {WAREHOUSE_TYPES.map((option) => (
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
              placeholder="Main distribution center"
              required
            />
          </Field>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="size-4 accent-primary"
              />
              Default warehouse
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowNegativeStock}
                onChange={(event) =>
                  setAllowNegativeStock(event.target.checked)
                }
                className="size-4 accent-primary"
              />
              Allow negative stock
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
              {isEdit ? 'Save changes' : 'Create warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

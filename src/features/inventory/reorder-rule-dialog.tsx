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
import { useReorderRuleMutations } from '#/features/inventory/use-inventory-analytics'
import { useProductsPage } from '#/features/products/use-products'
import { useWarehouses } from '#/features/warehouses/use-warehouses'

// Upsert dialog for per-product × warehouse replenishment thresholds. Launched
// from the dashboard's reorder table (prefilled) or standalone.

export type ReorderRulePrefill = {
  productId: string
  warehouseId: string
} | null

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

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

export function ReorderRuleDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill: ReorderRulePrefill
}) {
  const [productId, setProductId] = React.useState('')
  const [warehouseId, setWarehouseId] = React.useState('')
  const [reorderPoint, setReorderPoint] = React.useState('')
  const [reorderQty, setReorderQty] = React.useState('')
  const [minStock, setMinStock] = React.useState('')
  const [maxStock, setMaxStock] = React.useState('')
  const [safetyStock, setSafetyStock] = React.useState('')
  const [leadTimeDays, setLeadTimeDays] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const productsQuery = useProductsPage({ take: 200 })
  const warehousesQuery = useWarehouses()
  const { upsertReorderRule } = useReorderRuleMutations()

  React.useEffect(() => {
    if (open) {
      setProductId(prefill?.productId ?? '')
      setWarehouseId(prefill?.warehouseId ?? '')
      setReorderPoint('')
      setReorderQty('')
      setMinStock('')
      setMaxStock('')
      setSafetyStock('')
      setLeadTimeDays('')
      setIsActive(true)
      setError(null)
    }
  }, [open, prefill])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!productId || !warehouseId) {
      setError('Product and warehouse are required.')
      return
    }

    const decimal = (value: string) =>
      value.trim() === '' ? undefined : value.trim()

    try {
      await upsertReorderRule.mutateAsync({
        productId,
        warehouseId,
        reorderPoint: decimal(reorderPoint),
        reorderQty: decimal(reorderQty),
        minStock: decimal(minStock),
        maxStock: decimal(maxStock),
        safetyStock: decimal(safetyStock),
        leadTimeDays: leadTimeDays.trim() === '' ? null : Number(leadTimeDays),
        isActive,
      })
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the reorder rule.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reorder rule</DialogTitle>
          <DialogDescription>
            Set replenishment thresholds for a product at a specific warehouse.
            Saving overwrites the existing rule for that pair.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Product *">
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select product…</option>
              {(productsQuery.data?.items ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Warehouse *">
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select warehouse…</option>
              {(warehousesQuery.data ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reorder point">
              <Input
                inputMode="decimal"
                value={reorderPoint}
                onChange={(event) => setReorderPoint(event.target.value)}
                placeholder="20"
              />
            </Field>
            <Field label="Reorder qty">
              <Input
                inputMode="decimal"
                value={reorderQty}
                onChange={(event) => setReorderQty(event.target.value)}
                placeholder="50"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Min stock">
              <Input
                inputMode="decimal"
                value={minStock}
                onChange={(event) => setMinStock(event.target.value)}
              />
            </Field>
            <Field label="Max stock">
              <Input
                inputMode="decimal"
                value={maxStock}
                onChange={(event) => setMaxStock(event.target.value)}
              />
            </Field>
            <Field label="Safety stock">
              <Input
                inputMode="decimal"
                value={safetyStock}
                onChange={(event) => setSafetyStock(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lead time (days)">
              <Input
                inputMode="numeric"
                value={leadTimeDays}
                onChange={(event) => setLeadTimeDays(event.target.value)}
              />
            </Field>
            <div className="flex items-end pb-1">
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

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={upsertReorderRule.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={upsertReorderRule.isPending}>
              Save rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import * as React from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
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
import { Textarea } from '#/components/ui/textarea'
import { useMenuItemOrderingDetail } from '#/features/restaurant/menu/use-menu'
import { useOrderMutations } from '#/features/restaurant/orders/use-orders'
import { errorMessage, formatMoney } from '#/features/restaurant/shared/format'
import { cn } from '#/lib/utils'

const selectClassName =
  'h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50'

const PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'WALLET',
  'LOYALTY',
  'GIFT_CARD',
  'ONLINE',
  'THIRD_PARTY',
] as const

// --- New order (takeaway / pickup / delivery) --------------------------------

export function NewOrderDialog({
  open,
  onOpenChange,
  branchId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  onCreated: (orderId: string) => void
}) {
  const { createOrder } = useOrderMutations()
  const [orderType, setOrderType] = React.useState('TAKEAWAY')
  const [guestCount, setGuestCount] = React.useState('1')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setOrderType('TAKEAWAY')
      setGuestCount('1')
      setNotes('')
      setError(null)
    }
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const order = await createOrder.mutateAsync({
        branchId,
        orderType: orderType as 'TAKEAWAY' | 'PICKUP' | 'DELIVERY' | 'DRIVE_THRU',
        guestCount: Math.max(1, Number(guestCount) || 1),
        notes: notes.trim() === '' ? null : notes.trim(),
      })
      onOpenChange(false)
      onCreated(order.id)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>
            Dine-in orders start from the live floor — this creates takeaway,
            pickup, delivery, or drive-thru orders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Order type
              </span>
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value)}
                className={selectClassName}
              >
                {['TAKEAWAY', 'PICKUP', 'DELIVERY', 'DRIVE_THRU'].map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Guests
              </span>
              <Input
                type="number"
                min={1}
                max={100}
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value)}
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Notes (optional)
            </span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createOrder.isPending}>
              Start order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Item configuration (variant + modifiers) --------------------------------

export function ItemConfigDialog({
  open,
  onOpenChange,
  orderId,
  menuItemId,
  currencyCode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  menuItemId: string | null
  currencyCode?: string
}) {
  const detailQuery = useMenuItemOrderingDetail(open ? menuItemId : null)
  const { addItem } = useOrderMutations()
  const [quantity, setQuantity] = React.useState(1)
  const [variantId, setVariantId] = React.useState<string | null>(null)
  const [selections, setSelections] = React.useState<
    Record<string, Array<string>>
  >({})
  const [specialRequest, setSpecialRequest] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const detail = detailQuery.data

  React.useEffect(() => {
    if (open && detail) {
      setQuantity(1)
      setVariantId(
        detail.variants.find((variant) => variant.isDefault)?.id ?? null,
      )
      const defaults: Record<string, Array<string>> = {}
      for (const group of detail.modifierGroups) {
        defaults[group.groupId] = group.modifiers
          .filter((modifier) => modifier.isDefault)
          .map((modifier) => modifier.id)
      }
      setSelections(defaults)
      setSpecialRequest('')
      setError(null)
    }
  }, [open, detail])

  if (!detail && !detailQuery.isLoading && open) {
    return null
  }

  const toggleModifier = (
    groupId: string,
    modifierId: string,
    selectionType: string,
    maxSelect: number | null,
  ) => {
    setSelections((previous) => {
      const current = previous[groupId] ?? []
      if (selectionType === 'SINGLE') {
        return {
          ...previous,
          [groupId]: current.includes(modifierId) ? [] : [modifierId],
        }
      }
      if (current.includes(modifierId)) {
        return {
          ...previous,
          [groupId]: current.filter((id) => id !== modifierId),
        }
      }
      if (maxSelect !== null && current.length >= maxSelect) {
        return previous
      }
      return { ...previous, [groupId]: [...current, modifierId] }
    })
  }

  const groupProblems = (detail?.modifierGroups ?? []).filter((group) => {
    const count = (selections[group.groupId] ?? []).length
    const min = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect
    return count < min
  })

  const variant = detail?.variants.find((candidate) => candidate.id === variantId)
  const unitPrice =
    Number(detail?.item.basePrice ?? 0) + Number(variant?.priceDelta ?? 0)
  const selectedModifiers = (detail?.modifierGroups ?? []).flatMap((group) =>
    group.modifiers.filter((modifier) =>
      (selections[group.groupId] ?? []).includes(modifier.id),
    ),
  )
  const modifiersPerUnit = selectedModifiers.reduce(
    (sum, modifier) => sum + Number(modifier.priceDelta),
    0,
  )
  const lineTotal = (unitPrice + modifiersPerUnit) * quantity

  const submit = async () => {
    if (!detail || groupProblems.length > 0) {
      return
    }
    setError(null)
    try {
      await addItem.mutateAsync({
        orderId,
        menuItemId: detail.item.id,
        variantId: variantId ?? null,
        quantity,
        unitPrice: unitPrice.toFixed(2),
        specialRequest: specialRequest.trim() === '' ? null : specialRequest.trim(),
        modifiers: selectedModifiers.map((modifier) => ({
          modifierId: modifier.id,
          name: modifier.name,
          priceDelta: modifier.priceDelta,
          quantity,
        })),
      })
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {detailQuery.isLoading || !detail ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading item…
          </p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{detail.item.name}</DialogTitle>
              <DialogDescription>
                {detail.item.description ??
                  `Base price ${formatMoney(detail.item.basePrice, currencyCode)}`}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              {detail.variants.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Variant
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.variants.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setVariantId(option.id)}
                        className={cn(
                          'pin-pill border px-3 py-1.5 text-sm font-medium',
                          variantId === option.id
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border bg-card',
                        )}
                      >
                        {option.name}
                        {Number(option.priceDelta) !== 0
                          ? ` (${Number(option.priceDelta) > 0 ? '+' : ''}${formatMoney(option.priceDelta, currencyCode)})`
                          : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail.modifierGroups.map((group) => {
                const selected = selections[group.groupId] ?? []
                const min = group.isRequired
                  ? Math.max(1, group.minSelect)
                  : group.minSelect
                return (
                  <div key={group.groupId}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.name}
                      {group.isRequired ? ' · required' : ''}
                      {group.maxSelect !== null && group.selectionType === 'MULTI'
                        ? ` · up to ${group.maxSelect}`
                        : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.modifiers.map((modifier) => {
                        const isSelected = selected.includes(modifier.id)
                        return (
                          <button
                            key={modifier.id}
                            type="button"
                            onClick={() =>
                              toggleModifier(
                                group.groupId,
                                modifier.id,
                                group.selectionType,
                                group.maxSelect,
                              )
                            }
                            className={cn(
                              'pin-pill border px-3 py-1.5 text-sm font-medium',
                              isSelected
                                ? 'border-primary/50 bg-primary/10 text-primary'
                                : 'border-border bg-card',
                            )}
                          >
                            {modifier.name}
                            {Number(modifier.priceDelta) !== 0
                              ? ` (+${formatMoney(modifier.priceDelta, currencyCode)})`
                              : ''}
                          </button>
                        )
                      })}
                    </div>
                    {selected.length < min ? (
                      <p className="mt-1.5 text-xs text-destructive">
                        Choose at least {min}
                      </p>
                    ) : null}
                  </div>
                )
              })}

              <label>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Special request (optional)
                </span>
                <Textarea
                  value={specialRequest}
                  onChange={(event) => setSpecialRequest(event.target.value)}
                  rows={2}
                  placeholder="No onions, extra spicy…"
                />
              </label>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="min-w-8 text-center text-lg font-bold">
                    {quantity}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => setQuantity((value) => Math.min(999, value + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
                <span className="text-lg font-bold">
                  {formatMoney(lineTotal, currencyCode)}
                </span>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={addItem.isPending || groupProblems.length > 0}
                >
                  Add to order
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- Payment / checkout ------------------------------------------------------

interface PaymentRow {
  method: string
  amount: string
  splitLabel: string
}

export function PaymentDialog({
  open,
  onOpenChange,
  order,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    id: string
    orderNumber: string
    grandTotal: string
    amountPaid: string
    currencyCode: string
  }
  onCompleted?: () => void
}) {
  const { completeOrder } = useOrderMutations()
  const [rows, setRows] = React.useState<Array<PaymentRow>>([])
  const [useSplits, setUseSplits] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const due = Math.max(0, Number(order.grandTotal) - Number(order.amountPaid))

  React.useEffect(() => {
    if (open) {
      setRows([{ method: 'CASH', amount: due.toFixed(2), splitLabel: '' }])
      setUseSplits(false)
      setError(null)
    }
  }, [open, due])

  const updateRow = (index: number, patch: Partial<PaymentRow>) => {
    setRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    )
  }

  const totalEntered = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const remaining = due - totalEntered
  const change = totalEntered > due ? totalEntered - due : 0
  const canSubmit =
    rows.length > 0 &&
    rows.every((row) => Number(row.amount) > 0) &&
    totalEntered >= due &&
    (!useSplits || rows.every((row) => row.splitLabel.trim() !== ''))

  const submit = async () => {
    setError(null)
    try {
      await completeOrder.mutateAsync({
        id: order.id,
        payments: rows.map((row) => ({
          method: row.method as (typeof PAYMENT_METHODS)[number],
          amount: Number(row.amount).toFixed(2),
          splitLabel: useSplits ? row.splitLabel.trim() : null,
        })),
      })
      onOpenChange(false)
      onCompleted?.()
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take payment — {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Due {formatMoney(due, order.currencyCode)}. Add rows to combine
            methods, or name splits to divide the bill.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useSplits}
              onChange={(event) => setUseSplits(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Split the bill (name each share)
          </label>

          {rows.map((row, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
            >
              {useSplits ? (
                <Input
                  value={row.splitLabel}
                  onChange={(event) =>
                    updateRow(index, { splitLabel: event.target.value })
                  }
                  placeholder={`Guest ${index + 1}`}
                  className="w-28"
                />
              ) : null}
              <select
                value={row.method}
                onChange={(event) => updateRow(index, { method: event.target.value })}
                className={cn(selectClassName, 'w-32')}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method.replace(/_/g, ' ').toLowerCase()}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(event) => updateRow(index, { amount: event.target.value })}
                className="w-28"
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  updateRow(index, {
                    amount: Math.max(
                      0,
                      due -
                        rows.reduce(
                          (sum, other, otherIndex) =>
                            otherIndex === index
                              ? sum
                              : sum + (Number(other.amount) || 0),
                          0,
                        ),
                    ).toFixed(2),
                  })
                }
              >
                Exact
              </Button>
              {rows.length > 1 ? (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() =>
                    setRows((previous) =>
                      previous.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  <Trash2 />
                  <span className="sr-only">Remove payment row</span>
                </Button>
              ) : null}
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() =>
              setRows((previous) => [
                ...previous,
                { method: 'CARD', amount: '', splitLabel: '' },
              ])
            }
          >
            <Plus data-icon="inline-start" /> Add payment row
          </Button>

          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due</span>
              <span className="font-semibold">
                {formatMoney(due, order.currencyCode)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entered</span>
              <span className="font-semibold">
                {formatMoney(totalEntered, order.currencyCode)}
              </span>
            </div>
            {remaining > 0 ? (
              <div className="flex justify-between text-destructive">
                <span>Remaining</span>
                <span className="font-semibold">
                  {formatMoney(remaining, order.currencyCode)}
                </span>
              </div>
            ) : null}
            {change > 0 ? (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Change</span>
                <span className="font-semibold">
                  {formatMoney(change, order.currencyCode)}
                </span>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!canSubmit || completeOrder.isPending}
            >
              Complete order
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Reason dialog (void order / void line) ----------------------------------

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: (reason: string | null) => Promise<void>
  isPending: boolean
}) {
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  const confirm = async () => {
    setError(null)
    try {
      await onConfirm(reason.trim() === '' ? null : reason.trim())
      onOpenChange(false)
    } catch (confirmError: unknown) {
      setError(errorMessage(confirmError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="Reason (optional)"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

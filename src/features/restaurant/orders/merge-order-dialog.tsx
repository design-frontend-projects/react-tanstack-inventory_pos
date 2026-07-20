'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { useOrderMutations, useOrders } from '#/features/restaurant/orders/use-orders'
import {
  StatusPill,
  errorMessage,
  formatMoney,
} from '#/features/restaurant/shared/format'
import { cn } from '#/lib/utils'

// Absorb another open order into the current one. Sources with captured
// payments are blocked server-side; the picker shows open orders on the same
// branch so a waiter can merge two tabs in two taps.

const MERGEABLE_STATUSES = new Set([
  'DRAFT',
  'OPEN',
  'CONFIRMED',
  'PREPARING',
  'COOKING',
  'READY',
])

export function MergeOrderDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: {
    id: string
    orderNumber: string
    branchId: string
    currencyCode: string
  }
}) {
  const { mergeOrders } = useOrderMutations()
  const ordersQuery = useOrders({ branchId: target.branchId })
  const [sourceId, setSourceId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setSourceId(null)
      setError(null)
    }
  }, [open])

  const candidates = (ordersQuery.data ?? []).filter(
    (order) =>
      order.id !== target.id &&
      MERGEABLE_STATUSES.has(order.status) &&
      Number(order.amountPaid) === 0,
  )

  const submit = async () => {
    if (!sourceId) {
      return
    }
    setError(null)
    try {
      await mergeOrders.mutateAsync({ targetId: target.id, sourceId })
      onOpenChange(false)
    } catch (submitError: unknown) {
      setError(errorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge into {target.orderNumber}</DialogTitle>
          <DialogDescription>
            Pick the order to absorb. Its items move here, and it is voided
            with an audit trail. Orders with captured payments cannot merge.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {ordersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading open orders…</p>
          ) : candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/60 px-3 py-4 text-sm text-muted-foreground">
              No other open, unpaid orders on this branch.
            </p>
          ) : (
            candidates.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSourceId(order.id)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors',
                  sourceId === order.id
                    ? 'border-primary bg-primary/[0.06]'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{order.orderNumber}</span>
                  <StatusPill status={order.status} />
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(order.grandTotal, target.currencyCode)}
                </span>
              </button>
            ))
          )}

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeOrders.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!sourceId || mergeOrders.isPending}
          >
            {mergeOrders.isPending ? 'Merging…' : 'Merge orders'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

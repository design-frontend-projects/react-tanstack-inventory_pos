'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Flame, Trash2 } from 'lucide-react'
import { WorkspaceEmptyState } from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { AccessGuard } from '#/features/auth/access-guard'
import { hasPermission } from '#/features/auth/permissions'
import { useSessionBootstrap } from '#/features/auth/use-session-bootstrap'
import { useFloorStatus } from '#/features/restaurant/floor/use-floor'
import {
  useMenuCategories,
  useMenuItems,
  useMenus,
} from '#/features/restaurant/menu/use-menu'
import {
  ItemConfigDialog,
  PaymentDialog,
  ReasonDialog,
} from '#/features/restaurant/orders/order-dialogs'
import { useOrder, useOrderMutations } from '#/features/restaurant/orders/use-orders'
import {
  errorMessage,
  formatElapsed,
  formatMoney,
  StatusPill,
  titleCase,
  useNowTick,
} from '#/features/restaurant/shared/format'
import { useRestaurantRealtime } from '#/features/restaurant/shared/use-restaurant-realtime'
import { cn } from '#/lib/utils'

const EDITABLE_STATUSES = ['DRAFT', 'OPEN', 'CONFIRMED', 'PREPARING', 'COOKING', 'READY']
const PAYABLE_STATUSES = ['READY', 'SERVED']
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED', 'VOIDED']

export function OrderWorkspace({ orderId }: { orderId: string }) {
  const session = useSessionBootstrap()
  const permissions = session.context?.permissions ?? []
  const roles = session.context?.roles ?? []
  const canUpdate =
    hasPermission(permissions, 'res.orders.update') ||
    hasPermission(permissions, 'res.orders.create')
  const canVoid = hasPermission(permissions, 'res.orders.cancel')
  const canPay =
    hasPermission(permissions, 'res.cashier.access') ||
    hasPermission(permissions, 'res.orders.create')

  const orderQuery = useOrder(orderId)
  const order = orderQuery.data
  const mutations = useOrderMutations()
  useRestaurantRealtime()
  const now = useNowTick(30_000)

  const menusQuery = useMenus(order?.branchId ?? null)
  const menu = (menusQuery.data ?? []).at(0) ?? null
  const categoriesQuery = useMenuCategories(menu?.id ?? null)
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const itemsQuery = useMenuItems(categoryId)
  const floorQuery = useFloorStatus(order?.branchId ?? null)

  const [configItemId, setConfigItemId] = React.useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [voidOrderOpen, setVoidOrderOpen] = React.useState(false)
  const [voidLine, setVoidLine] = React.useState<{ id: string; name: string } | null>(
    null,
  )
  const [actionError, setActionError] = React.useState<string | null>(null)

  const tableCode = React.useMemo(() => {
    if (!order?.tableId) {
      return null
    }
    for (const area of floorQuery.data?.areas ?? []) {
      for (const section of area.sections) {
        for (const table of section.tables) {
          if (table.id === order.tableId) {
            return table.code
          }
        }
      }
    }
    return null
  }, [order?.tableId, floorQuery.data])

  if (orderQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading order…</p>
  }

  if (!order) {
    return (
      <WorkspaceEmptyState
        title="Order not found"
        description="It may have been removed, or you may not have access."
      >
        <Button asChild variant="outline">
          <Link to="/restaurant/orders">Back to orders</Link>
        </Button>
      </WorkspaceEmptyState>
    )
  }

  const items = order.items ?? []
  const liveItems = items.filter((item) => item.status !== 'VOIDED')
  const pendingItems = liveItems.filter((item) => item.status === 'PENDING')
  const isTerminal = TERMINAL_STATUSES.includes(order.status)
  const canEdit = canUpdate && EDITABLE_STATUSES.includes(order.status)
  const canTakePayment = canPay && PAYABLE_STATUSES.includes(order.status)
  const menuItems = (itemsQuery.data ?? []).filter(
    (item) => item.status === 'ACTIVE' && item.visibility === 'VISIBLE',
  )

  const fire = async () => {
    setActionError(null)
    try {
      if (order.status === 'DRAFT' || order.status === 'OPEN') {
        await mutations.transition.mutateAsync({
          id: order.id,
          toStatus: 'CONFIRMED',
        })
      }
      if (pendingItems.length > 0) {
        await mutations.updateItemStatus.mutateAsync({
          orderId: order.id,
          itemIds: pendingItems.map((item) => item.id),
          toStatus: 'FIRED',
        })
      }
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const markServed = async () => {
    setActionError(null)
    try {
      await mutations.transition.mutateAsync({ id: order.id, toStatus: 'SERVED' })
    } catch (error: unknown) {
      setActionError(errorMessage(error))
    }
  }

  const fireLabel =
    order.status === 'DRAFT' || order.status === 'OPEN'
      ? 'Fire to kitchen'
      : 'Fire new items'
  const showFire =
    canEdit &&
    (order.status === 'DRAFT' || order.status === 'OPEN'
      ? liveItems.length > 0
      : pendingItems.length > 0)

  return (
    <AccessGuard
      permissions={['res.orders.view']}
      userRoles={roles}
      userPermissions={permissions}
      fallback={
        <WorkspaceEmptyState
          title="Access denied"
          description="You need order-view access to open orders."
        />
      }
    >
      <div className="flex flex-col gap-4 pb-24 xl:pb-0">
        <div className="ops-panel flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 md:px-5">
          <Button asChild size="icon-sm" variant="ghost">
            <Link to="/restaurant/orders">
              <ArrowLeft />
              <span className="sr-only">Back to orders</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight md:text-xl">
                {order.orderNumber}
              </h1>
              <StatusPill status={order.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {titleCase(order.orderType)}
              {tableCode ? ` · Table ${tableCode}` : ''} · {order.guestCount} guest
              {order.guestCount === 1 ? '' : 's'} ·{' '}
              {formatElapsed(String(order.createdAt), now)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.status === 'READY' && canUpdate ? (
              <Button
                size="sm"
                variant="outline"
                disabled={mutations.transition.isPending}
                onClick={markServed}
              >
                Mark served
              </Button>
            ) : null}
            {canTakePayment ? (
              <Button size="sm" onClick={() => setPaymentOpen(true)}>
                Take payment
              </Button>
            ) : null}
            {canVoid && !isTerminal ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVoidOrderOpen(true)}
              >
                Void
              </Button>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {canEdit ? (
            <section className="ops-panel rounded-2xl p-4 md:p-5">
              <span className="ops-kicker">Menu</span>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryId(null)}
                  className={cn(
                    'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                    categoryId === null
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  All items
                </button>
                {(categoriesQuery.data ?? []).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      'pin-pill shrink-0 border px-3 py-1.5 text-xs font-semibold',
                      categoryId === category.id
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {itemsQuery.isLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Loading menu…
                </p>
              ) : menuItems.length === 0 ? (
                <WorkspaceEmptyState
                  className="mt-4"
                  title="No menu items"
                  description="Add items to the menu before taking orders."
                />
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConfigItemId(item.id)}
                      className="pin-card flex flex-col overflow-hidden text-left"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-2xl font-bold text-muted-foreground">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-between gap-1 p-3">
                        <p className="line-clamp-2 text-sm font-semibold">
                          {item.name}
                        </p>
                        <p className="text-sm font-bold text-primary">
                          {formatMoney(item.basePrice, order.currencyCode)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="ops-panel h-fit rounded-2xl p-4 md:p-5">
            <span className="ops-kicker">Order</span>

            {liveItems.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No items yet — pick from the menu.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border/60">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'flex items-start justify-between gap-3 py-2.5',
                      item.status === 'VOIDED' && 'opacity-50',
                    )}
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          item.status === 'VOIDED' && 'line-through',
                        )}
                      >
                        {item.quantity} × {item.name}
                      </p>
                      {(item.modifiers ?? []).length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {(item.modifiers ?? [])
                            .map((modifier) => modifier.name)
                            .join(', ')}
                        </p>
                      ) : null}
                      {item.specialRequest ? (
                        <p className="text-xs italic text-amber-700 dark:text-amber-300">
                          “{item.specialRequest}”
                        </p>
                      ) : null}
                      <span className="mt-0.5 inline-block text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.lineTotal, order.currencyCode)}
                      </span>
                      {canEdit && item.status !== 'VOIDED' ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() =>
                            setVoidLine({ id: item.id, name: item.name })
                          }
                        >
                          <Trash2 />
                          <span className="sr-only">Remove {item.name}</span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal, order.currencyCode)}</span>
              </div>
              {Number(order.discountTotal) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discounts</span>
                  <span>
                    −{formatMoney(order.discountTotal, order.currencyCode)}
                  </span>
                </div>
              ) : null}
              {Number(order.taxTotal) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatMoney(order.taxTotal, order.currencyCode)}</span>
                </div>
              ) : null}
              {Number(order.serviceChargeTotal) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service charge</span>
                  <span>
                    {formatMoney(order.serviceChargeTotal, order.currencyCode)}
                  </span>
                </div>
              ) : null}
              <div className="mt-1 flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatMoney(order.grandTotal, order.currencyCode)}</span>
              </div>
              {Number(order.amountPaid) > 0 ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Paid</span>
                  <span>{formatMoney(order.amountPaid, order.currencyCode)}</span>
                </div>
              ) : null}
            </div>

            {(order.payments ?? []).length > 0 ? (
              <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                  Payments
                </p>
                {(order.payments ?? []).map((payment) => (
                  <div key={payment.id} className="flex justify-between">
                    <span>{titleCase(payment.method)}</span>
                    <span className="tabular-nums">
                      {formatMoney(payment.amount, order.currencyCode)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {showFire ? (
              <Button className="mt-4 w-full" onClick={fire}>
                <Flame data-icon="inline-start" /> {fireLabel}
              </Button>
            ) : null}
          </section>
        </div>

        {/* Mobile sticky summary */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur xl:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {liveItems.length} item{liveItems.length === 1 ? '' : 's'}
              </p>
              <p className="text-base font-bold">
                {formatMoney(order.grandTotal, order.currencyCode)}
              </p>
            </div>
            {showFire ? (
              <Button onClick={fire}>
                <Flame data-icon="inline-start" /> {fireLabel}
              </Button>
            ) : canTakePayment ? (
              <Button onClick={() => setPaymentOpen(true)}>Take payment</Button>
            ) : (
              <StatusPill status={order.status} />
            )}
          </div>
        </div>

        <ItemConfigDialog
          open={Boolean(configItemId)}
          onOpenChange={(open) => {
            if (!open) {
              setConfigItemId(null)
            }
          }}
          orderId={order.id}
          menuItemId={configItemId}
          currencyCode={order.currencyCode}
        />

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          order={{
            id: order.id,
            orderNumber: order.orderNumber,
            grandTotal: order.grandTotal,
            amountPaid: order.amountPaid,
            currencyCode: order.currencyCode,
          }}
        />

        <ReasonDialog
          open={voidOrderOpen}
          onOpenChange={setVoidOrderOpen}
          title={`Void ${order.orderNumber}?`}
          description="Voided orders are closed permanently and excluded from sales."
          confirmLabel="Void order"
          isPending={mutations.voidOrder.isPending}
          onConfirm={async (reason) => {
            await mutations.voidOrder.mutateAsync({ id: order.id, reason })
          }}
        />

        {voidLine ? (
          <ReasonDialog
            open={Boolean(voidLine)}
            onOpenChange={(open) => {
              if (!open) {
                setVoidLine(null)
              }
            }}
            title={`Remove ${voidLine.name}?`}
            description="The line is voided and totals are recalculated. The kitchen keeps an audit trail."
            confirmLabel="Remove item"
            isPending={mutations.voidItem.isPending}
            onConfirm={async (reason) => {
              await mutations.voidItem.mutateAsync({
                orderId: order.id,
                itemId: voidLine.id,
                reason,
              })
            }}
          />
        ) : null}
      </div>
    </AccessGuard>
  )
}

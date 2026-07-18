'use client'

import { Link } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import {
  useMyNotifications,
  useNotificationMutations,
} from '#/features/notifications/use-notifications'
import {
  usePurchaseReporting,
  useRefreshPurchaseReporting,
} from '#/features/purchasing/use-reporting'

const LANES: Array<{
  to:
    | '/purchase/suppliers'
    | '/purchase/rfqs'
    | '/purchase/quotations'
    | '/purchase/approvals'
    | '/purchase/invoices'
    | '/purchase/payments'
  title: string
  description: string
  meta: string
}> = [
  {
    to: '/purchase/suppliers',
    title: 'Suppliers',
    description:
      'Vendor master with contacts, addresses, bank accounts, categories, rating, and running balance.',
    meta: 'Master data',
  },
  {
    to: '/purchase/rfqs',
    title: 'RFQs',
    description:
      'Invite suppliers, track responses and revisions, and award from the comparison matrix.',
    meta: 'Sourcing',
  },
  {
    to: '/purchase/quotations',
    title: 'Quotations',
    description:
      'Supplier quotations with tax, freight, and insurance — reviewed, approved, and converted to POs.',
    meta: 'Sourcing',
  },
  {
    to: '/purchase/approvals',
    title: 'Approvals',
    description:
      'Your amount-gated approval inbox — approve, reject, or delegate purchase documents.',
    meta: 'Governance',
  },
  {
    to: '/purchase/invoices',
    title: 'Supplier Invoices',
    description:
      'Three-way match against PO and GRN, then post to payables with retention and withholding.',
    meta: 'Payables',
  },
  {
    to: '/purchase/payments',
    title: 'Payments',
    description:
      'Settle invoices with allocations and advances; supplier balances and aging update automatically.',
    meta: 'Settlement',
  },
]

const AGING_LABELS: Record<string, string> = {
  current: 'Current',
  '1_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_plus': '90+ days',
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value)
}

export function PurchaseOverviewWorkspace() {
  const reportingQuery = usePurchaseReporting()
  const refresh = useRefreshPurchaseReporting()
  const notificationsQuery = useMyNotifications()
  const notificationMutations = useNotificationMutations()

  const snapshot = reportingQuery.data
  const outstandingTotal =
    snapshot?.payablesAging.reduce(
      (sum, bucket) => sum + Number(bucket.outstanding),
      0,
    ) ?? 0
  const notifications = notificationsQuery.data?.notifications ?? []
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Purchasing"
      title="Run procurement end to end: source, order, receive, match, and pay."
      description="Live control room over the purchasing spine — open commitments, payables aging, match variances, spend, and your alerts, all tenant-scoped."
      metrics={[
        {
          label: 'Open POs',
          value: snapshot ? `${snapshot.openPurchaseOrders.poCount}` : '—',
          hint: snapshot
            ? `${formatMoney(snapshot.openPurchaseOrders.openValue)} committed`
            : 'Open purchase order exposure',
          tone: 'red',
        },
        {
          label: 'Outstanding AP',
          value: snapshot ? formatMoney(outstandingTotal) : '—',
          hint: 'Posted, unpaid supplier invoices',
          tone: 'accent',
        },
        {
          label: 'Alerts',
          value: notificationsQuery.data ? String(unreadCount) : '—',
          hint: 'Unread notifications',
          tone: unreadCount > 0 ? 'red' : 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Procurement lanes"
        title="Jump into a workflow"
        description="Each lane is permission-gated and shares the supplier, numbering, approval, and audit backbone."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {LANES.map((lane) => (
            <Link key={lane.to} to={lane.to} className="block">
              <WorkspaceDetailCard
                title={lane.title}
                description={lane.description}
                meta={lane.meta}
              />
            </Link>
          ))}
        </div>
      </WorkspacePanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Payables"
          title="AP aging"
          description="Outstanding posted invoices bucketed by days overdue."
        >
          {snapshot && snapshot.payablesAging.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {snapshot.payablesAging.map((bucket) => (
                  <tr
                    key={bucket.agingBucket}
                    className="border-b border-border/60"
                  >
                    <td className="py-2 pr-4">
                      {AGING_LABELS[bucket.agingBucket] ?? bucket.agingBucket}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {bucket.invoiceCount} inv
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(bucket.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <WorkspaceEmptyState
              title="Nothing outstanding"
              description="Post supplier invoices to see the aging profile."
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Exposure"
          title="Top supplier balances"
          description="Current balance and open invoices per supplier."
        >
          {snapshot && snapshot.supplierBalances.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {snapshot.supplierBalances.slice(0, 8).map((row) => (
                  <tr
                    key={row.supplierId}
                    className="border-b border-border/60"
                  >
                    <td className="py-2 pr-4">
                      <span className="font-medium">{row.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.code}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.openInvoiceCount} open
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(row.totalOutstanding)} {row.currencyCode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <WorkspaceEmptyState
              title="No supplier balances"
              description="Balances appear once invoices are posted."
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Trend"
          title="Spend by month"
          description="From the spend-analysis materialized view — refresh to pick up new orders."
        >
          <div className="mb-3">
            <Button
              size="xs"
              variant="outline"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              {refresh.isPending ? 'Refreshing…' : 'Refresh reporting data'}
            </Button>
            {refresh.isError ? (
              <p className="mt-1 text-sm text-red-600">
                {refresh.error instanceof Error
                  ? refresh.error.message
                  : 'Refresh failed.'}
              </p>
            ) : null}
          </div>
          {snapshot && snapshot.spendByMonth.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <tbody>
                {snapshot.spendByMonth.map((row) => (
                  <tr
                    key={`${row.period}-${row.currencyCode}`}
                    className="border-b border-border/60"
                  >
                    <td className="py-2 pr-4">{row.period}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.orderCount} orders
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(row.spend)} {row.currencyCode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <WorkspaceEmptyState
              title="No spend data yet"
              description="Refresh the reporting views after confirming purchase orders."
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Inbox"
          title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          description="Approval requests, decisions, and delegations addressed to you."
        >
          {notifications.length > 0 ? (
            <>
              <div className="mb-3">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={
                    unreadCount === 0 ||
                    notificationMutations.markAllRead.isPending
                  }
                  onClick={() => notificationMutations.markAllRead.mutate()}
                >
                  Mark all read
                </Button>
              </div>
              <ul className="space-y-2">
                {notifications.slice(0, 10).map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-2"
                  >
                    <div>
                      <p
                        className={`text-sm ${notification.isRead ? 'text-muted-foreground' : 'font-medium'}`}
                      >
                        {notification.title}
                      </p>
                      {notification.body ? (
                        <p className="text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notification.isRead ? (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={notificationMutations.markRead.isPending}
                        onClick={() =>
                          notificationMutations.markRead.mutate(notification.id)
                        }
                      >
                        Read
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <WorkspaceEmptyState
              title="Inbox zero"
              description="You will be alerted here when approvals need you or your documents are decided."
            />
          )}
        </WorkspacePanel>
      </div>

      {snapshot && snapshot.matchVariances.length > 0 ? (
        <WorkspacePanel
          eyebrow="Control"
          title="3-way-match exceptions"
          description="Invoices whose billed amounts diverge from PO cost or receipt coverage."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Invoice</th>
                  <th className="py-2 pr-4 font-medium">Match</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 pr-4 text-right font-medium">Matched</th>
                  <th className="py-2 text-right font-medium">
                    Price variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.matchVariances.map((row) => (
                  <tr key={row.invoiceId} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">
                      {row.documentNumber}
                    </td>
                    <td className="py-2 pr-4 capitalize">
                      {row.matchStatusCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatMoney(row.grandTotal)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatMoney(row.matchedAmount)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-red-600">
                      {formatMoney(row.priceVariance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkspacePanel>
      ) : null}
    </WorkspacePage>
  )
}

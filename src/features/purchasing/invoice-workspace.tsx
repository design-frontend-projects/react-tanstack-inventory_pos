'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { listPurchaseOrdersServerFn } from '#/features/purchasing/server-functions'
import {
  useSupplierInvoiceMutations,
  useSupplierInvoices,
} from '#/features/purchasing/use-invoices'

const MATCH_TONE: Record<string, string> = {
  matched: 'text-emerald-600',
  partially_matched: 'text-amber-600',
  variance: 'text-red-600',
  unmatched: 'text-muted-foreground',
}

function formatMoney(value: string): string {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value
}

export function InvoiceWorkspace() {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)
  const invoicesQuery = useSupplierInvoices()
  const mutations = useSupplierInvoiceMutations()
  const [selectedPoId, setSelectedPoId] = useState('')

  const posQuery = useQuery({
    queryKey: ['purchase-orders', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error('You must be signed in to view purchase orders.')
      }

      return listPurchaseOrdersServerFn({
        data: { accessToken, tenantId: tenantId as string },
      })
    },
  })

  const invoices = invoicesQuery.data ?? []
  const outstandingTotal = invoices
    .filter((invoice) => invoice.isPosted)
    .reduce((sum, invoice) => sum + Number(invoice.outstandingAmount), 0)
  const varianceCount = invoices.filter(
    (invoice) => invoice.matchStatusCode === 'variance',
  ).length

  const busy =
    mutations.createFromPo.isPending ||
    mutations.match.isPending ||
    mutations.submit.isPending ||
    mutations.post.isPending ||
    mutations.dispute.isPending ||
    mutations.resolveDispute.isPending ||
    mutations.cancel.isPending

  const receivablePos = (posQuery.data ?? []).filter((po) =>
    ['PARTIALLY_RECEIVED', 'RECEIVED', 'CONFIRMED', 'CLOSED'].includes(
      po.status,
    ),
  )

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Supplier invoices"
      title="Run accounts payable with a 3-way match."
      description="Capture supplier bills against purchase orders, match them to accepted receipts, route them through approval, and post them into the AP subledger — every step audited and event-sourced."
      metrics={[
        {
          label: 'Invoices',
          value: invoicesQuery.data ? String(invoices.length) : '—',
          hint: 'All non-cancelled supplier invoices',
          tone: 'red',
        },
        {
          label: 'Outstanding',
          value: invoicesQuery.data
            ? formatMoney(String(outstandingTotal))
            : '—',
          hint: 'Posted, unpaid AP balance',
          tone: 'accent',
        },
        {
          label: 'Variances',
          value: invoicesQuery.data ? String(varianceCount) : '—',
          hint: '3-way-match price variances to resolve',
          tone: varianceCount > 0 ? 'red' : 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Capture"
        title="Invoice a purchase order"
        description="Bills exactly what has been accepted on posted receipts and not yet invoiced, at the agreed PO cost."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 min-w-64 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedPoId}
            onChange={(event) => setSelectedPoId(event.target.value)}
          >
            <option value="">Select a purchase order…</option>
            {receivablePos.map((po) => (
              <option key={po.id} value={po.id}>
                {po.documentNumber} — {formatMoney(po.grandTotal)}{' '}
                {po.currencyCode}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!selectedPoId || busy}
            onClick={() => {
              mutations.createFromPo.mutate(
                { purchaseOrderId: selectedPoId },
                { onSuccess: () => setSelectedPoId('') },
              )
            }}
          >
            Create invoice
          </Button>
          {mutations.createFromPo.isError ? (
            <p className="text-sm text-red-600">
              {mutations.createFromPo.error instanceof Error
                ? mutations.createFromPo.error.message
                : 'Could not create the invoice.'}
            </p>
          ) : null}
        </div>
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Ledger"
        title="Supplier invoices"
        description="Match, submit, and post invoices. Posting is blocked on price variances unless explicitly overridden."
      >
        {invoicesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : invoicesQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load invoices"
            description="Check your connection and permissions, then retry."
          />
        ) : invoices.length === 0 ? (
          <WorkspaceEmptyState
            title="No supplier invoices yet"
            description="Create the first invoice from a received purchase order above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-224 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Document</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Match</th>
                  <th className="py-2 pr-4 font-medium">Payment</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Outstanding
                  </th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">
                      <span className="font-medium">
                        {invoice.documentNumber}
                      </span>
                      {invoice.supplierInvoiceNumber ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {invoice.supplierInvoiceNumber}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 capitalize">
                      {invoice.statusCode.replace(/_/g, ' ')}
                    </td>
                    <td
                      className={`py-2 pr-4 capitalize ${MATCH_TONE[invoice.matchStatusCode] ?? ''}`}
                    >
                      {invoice.matchStatusCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-4 capitalize">
                      {invoice.paymentStatusCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatMoney(invoice.grandTotal)} {invoice.currencyCode}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {invoice.isPosted
                        ? formatMoney(invoice.outstandingAmount)
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {!invoice.isPosted &&
                        invoice.statusCode !== 'cancelled' ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => mutations.match.mutate(invoice.id)}
                          >
                            Match
                          </Button>
                        ) : null}
                        {invoice.statusCode === 'draft' ? (
                          <>
                            <Button
                              size="xs"
                              disabled={busy}
                              onClick={() =>
                                mutations.submit.mutate(invoice.id)
                              }
                            >
                              Submit
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                mutations.cancel.mutate(invoice.id)
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {invoice.statusCode === 'approved' ? (
                          <>
                            <Button
                              size="xs"
                              disabled={busy}
                              onClick={() => {
                                const hasVariance =
                                  invoice.matchStatusCode === 'variance'

                                if (
                                  hasVariance &&
                                  !window.confirm(
                                    'This invoice has a 3-way-match price variance. Post anyway?',
                                  )
                                ) {
                                  return
                                }

                                mutations.post.mutate({
                                  id: invoice.id,
                                  overrideVariance: hasVariance,
                                })
                              }}
                            >
                              Post
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                mutations.dispute.mutate(invoice.id)
                              }
                            >
                              Dispute
                            </Button>
                          </>
                        ) : null}
                        {invoice.statusCode === 'disputed' ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              mutations.resolveDispute.mutate(invoice.id)
                            }
                          >
                            Resolve
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  )
}

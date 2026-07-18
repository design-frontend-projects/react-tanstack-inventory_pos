'use client'

import { useState } from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useSuppliers } from '#/features/suppliers/use-suppliers'
import { useSupplierInvoices } from '#/features/purchasing/use-invoices'
import {
  useSupplierPaymentMutations,
  useSupplierPayments,
} from '#/features/purchasing/use-payments'

function formatMoney(value: string | number): string {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value)
}

export function PaymentWorkspace() {
  const paymentsQuery = useSupplierPayments()
  const suppliersQuery = useSuppliers({ pageSize: 200 })
  const invoicesQuery = useSupplierInvoices()
  const mutations = useSupplierPaymentMutations()

  const [supplierId, setSupplierId] = useState('')
  const [amount, setAmount] = useState('')
  const [isAdvance, setIsAdvance] = useState(false)
  const [allocatingId, setAllocatingId] = useState<string | null>(null)
  const [allocationInvoiceId, setAllocationInvoiceId] = useState('')
  const [allocationAmount, setAllocationAmount] = useState('')

  const payments = paymentsQuery.data ?? []
  const suppliers = suppliersQuery.data?.items ?? []
  const invoices = invoicesQuery.data ?? []

  const unallocatedTotal = payments
    .filter((payment) => payment.isPosted)
    .reduce((sum, payment) => sum + Number(payment.unallocatedAmount), 0)

  const busy =
    mutations.create.isPending ||
    mutations.allocate.isPending ||
    mutations.submit.isPending ||
    mutations.post.isPending ||
    mutations.cancel.isPending

  const allocating = payments.find((payment) => payment.id === allocatingId)
  const payableInvoices = allocating
    ? invoices.filter(
        (invoice) =>
          invoice.isPosted &&
          invoice.supplierId === allocating.supplierId &&
          Number(invoice.outstandingAmount) > 0,
      )
    : []

  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.name ?? id.slice(0, 8)

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Supplier payments"
      title="Settle payables and track advances."
      description="Create payments, allocate them to posted invoices with over-allocation guards, route them through approval, and post them — supplier balances and invoice payment status update automatically."
      metrics={[
        {
          label: 'Payments',
          value: paymentsQuery.data ? String(payments.length) : '—',
          hint: 'All non-cancelled supplier payments',
          tone: 'red',
        },
        {
          label: 'Advances',
          value: paymentsQuery.data ? formatMoney(unallocatedTotal) : '—',
          hint: 'Posted, unallocated amounts',
          tone: 'accent',
        },
        {
          label: 'Guarded',
          value: 'No overpay',
          hint: 'Allocation caps at invoice outstanding',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Capture"
        title="Record a payment"
        description="An unallocated payment acts as an advance — it reduces the supplier balance once posted."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="">Select a supplier…</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <Input
            className="h-9 w-36"
            placeholder="Amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={isAdvance}
              onChange={(event) => setIsAdvance(event.target.checked)}
            />
            Advance
          </label>
          <Button
            size="sm"
            disabled={!supplierId || !/^\d+(\.\d+)?$/.test(amount) || busy}
            onClick={() => {
              mutations.create.mutate(
                { supplierId, amount, isAdvance },
                {
                  onSuccess: () => {
                    setAmount('')
                    setIsAdvance(false)
                  },
                },
              )
            }}
          >
            Record payment
          </Button>
          {mutations.create.isError ? (
            <p className="text-sm text-red-600">
              {mutations.create.error instanceof Error
                ? mutations.create.error.message
                : 'Could not record the payment.'}
            </p>
          ) : null}
        </div>
      </WorkspacePanel>

      {allocating && !allocating.isPosted ? (
        <WorkspacePanel
          eyebrow="Allocate"
          title={`Allocate ${allocating.documentNumber}`}
          description={`Unallocated ${formatMoney(allocating.unallocatedAmount)} ${allocating.currencyCode} — pick a posted invoice and an amount.`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 min-w-64 rounded-md border border-input bg-background px-3 text-sm"
              value={allocationInvoiceId}
              onChange={(event) => setAllocationInvoiceId(event.target.value)}
            >
              <option value="">Select a posted invoice…</option>
              {payableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.documentNumber} — outstanding{' '}
                  {formatMoney(invoice.outstandingAmount)}
                </option>
              ))}
            </select>
            <Input
              className="h-9 w-36"
              placeholder="Amount"
              inputMode="decimal"
              value={allocationAmount}
              onChange={(event) => setAllocationAmount(event.target.value)}
            />
            <Button
              size="sm"
              disabled={
                !allocationInvoiceId ||
                !/^\d+(\.\d+)?$/.test(allocationAmount) ||
                busy
              }
              onClick={() => {
                mutations.allocate.mutate(
                  {
                    id: allocating.id,
                    input: {
                      allocations: [
                        ...allocating.allocations
                          .filter((row) => row.supplierInvoiceId)
                          .map((row) => ({
                            supplierInvoiceId: row.supplierInvoiceId as string,
                            amount: row.allocatedAmount,
                          })),
                        {
                          supplierInvoiceId: allocationInvoiceId,
                          amount: allocationAmount,
                        },
                      ],
                    },
                  },
                  {
                    onSuccess: () => {
                      setAllocationInvoiceId('')
                      setAllocationAmount('')
                    },
                  },
                )
              }}
            >
              Add allocation
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAllocatingId(null)}
            >
              Done
            </Button>
            {mutations.allocate.isError ? (
              <p className="text-sm text-red-600">
                {mutations.allocate.error instanceof Error
                  ? mutations.allocate.error.message
                  : 'Could not allocate.'}
              </p>
            ) : null}
          </div>
        </WorkspacePanel>
      ) : null}

      <WorkspacePanel
        eyebrow="Settlement"
        title="Supplier payments"
        description="Allocate, submit, and post. Posting applies allocations to invoices and refreshes the supplier balance."
      >
        {paymentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading payments…</p>
        ) : paymentsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load payments"
            description="Check your connection and permissions, then retry."
          />
        ) : payments.length === 0 ? (
          <WorkspaceEmptyState
            title="No supplier payments yet"
            description="Record the first payment above."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-224 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Document</th>
                  <th className="py-2 pr-4 font-medium">Supplier</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Allocated
                  </th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">
                      {payment.documentNumber}
                    </td>
                    <td className="py-2 pr-4">
                      {supplierName(payment.supplierId)}
                    </td>
                    <td className="py-2 pr-4 capitalize">
                      {payment.statusCode.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatMoney(payment.amount)} {payment.currencyCode}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatMoney(payment.allocatedAmount)}
                    </td>
                    <td className="py-2 pr-4">
                      {payment.isAdvance ? 'Advance' : 'Settlement'}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {!payment.isPosted &&
                        payment.statusCode !== 'cancelled' ? (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setAllocatingId(payment.id)}
                          >
                            Allocate
                          </Button>
                        ) : null}
                        {payment.statusCode === 'draft' ? (
                          <>
                            <Button
                              size="xs"
                              disabled={busy}
                              onClick={() =>
                                mutations.submit.mutate(payment.id)
                              }
                            >
                              Submit
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                mutations.cancel.mutate(payment.id)
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {payment.statusCode === 'approved' ? (
                          <Button
                            size="xs"
                            disabled={busy}
                            onClick={() => mutations.post.mutate(payment.id)}
                          >
                            Post
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

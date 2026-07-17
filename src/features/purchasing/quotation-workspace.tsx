'use client'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { useQuotations } from '#/features/purchasing/use-sourcing'

function StatusBadge({ statusCode }: { statusCode: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium capitalize">
      {statusCode.replace(/_/g, ' ')}
    </span>
  )
}

export function QuotationWorkspace() {
  const quotationsQuery = useQuotations({})
  const quotations = quotationsQuery.data ?? []
  const inFlight = quotations.filter((quotation) =>
    ['submitted', 'under_review'].includes(quotation.statusCode),
  ).length
  const awarded = quotations.filter(
    (quotation) => quotation.statusCode === 'awarded',
  ).length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Quotations"
      title="Compare supplier quotations line by line before committing spend."
      description="Quotations flow draft → submitted → under review → approved → awarded. Totals include freight, insurance, and tax so comparisons are landed-cost honest."
      metrics={[
        {
          label: 'Quotations',
          value: quotationsQuery.data ? String(quotations.length) : '—',
          hint: 'All supplier submissions',
          tone: 'red',
        },
        {
          label: 'In review',
          value: quotationsQuery.data ? String(inFlight) : '—',
          hint: 'Submitted or under review',
          tone: 'accent',
        },
        {
          label: 'Awarded',
          value: quotationsQuery.data ? String(awarded) : '—',
          hint: 'Converted or ready for PO',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Supplier responses"
        title="Quotation register"
        description="Grand totals are recomputed from lines by the database, so what you compare is what was recorded."
      >
        {quotationsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading quotations…</p>
        ) : quotationsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load quotations"
            description="Check your connection and permissions, then retry."
          />
        ) : quotations.length === 0 ? (
          <WorkspaceEmptyState
            title="No quotations yet"
            description="Record a supplier quotation against an open RFQ — or standalone — to start the comparison."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-176 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Number</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Lines</th>
                  <th className="py-2 pr-4 font-medium">Currency</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Grand total
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Lead time
                  </th>
                  <th className="py-2 font-medium">Valid until</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {quotation.documentNumber}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge statusCode={quotation.statusCode} />
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {quotation.items.length}
                    </td>
                    <td className="py-2 pr-4">{quotation.currencyCode}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {quotation.grandTotal}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {quotation.leadTimeDays ?? '—'}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {quotation.validUntil
                        ? new Date(quotation.validUntil).toLocaleDateString()
                        : '—'}
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

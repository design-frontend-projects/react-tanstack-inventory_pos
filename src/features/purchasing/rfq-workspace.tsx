'use client'

import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { useRfqs } from '#/features/purchasing/use-sourcing'

function StatusBadge({ statusCode }: { statusCode: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium capitalize">
      {statusCode.replace(/_/g, ' ')}
    </span>
  )
}

export function RfqWorkspace() {
  const rfqsQuery = useRfqs({})
  const rfqs = rfqsQuery.data ?? []
  const openCount = rfqs.filter((rfq) => rfq.statusCode === 'open').length
  const awardedCount = rfqs.filter((rfq) => rfq.statusCode === 'awarded').length

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="RFQs"
      title="Invite suppliers, collect quotations, and award on evidence."
      description="Each request for quotation tracks its invited suppliers, responses, revisions, and expiry — feeding the comparison matrix that backs the award decision."
      metrics={[
        {
          label: 'RFQs',
          value: rfqsQuery.data ? String(rfqs.length) : '—',
          hint: 'All requests in this workspace',
          tone: 'red',
        },
        {
          label: 'Open',
          value: rfqsQuery.data ? String(openCount) : '—',
          hint: 'Awaiting supplier responses',
          tone: 'accent',
        },
        {
          label: 'Awarded',
          value: rfqsQuery.data ? String(awardedCount) : '—',
          hint: 'Winner selected',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Sourcing pipeline"
        title="Requests for quotation"
        description="Invited vs responded counts update as suppliers submit quotations."
      >
        {rfqsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading RFQs…</p>
        ) : rfqsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load RFQs"
            description="Check your connection and permissions, then retry."
          />
        ) : rfqs.length === 0 ? (
          <WorkspaceEmptyState
            title="No RFQs yet"
            description="Create an RFQ from an approved requisition — or directly — to start collecting supplier quotations."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-176 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Number</th>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 text-right font-medium">Rev</th>
                  <th className="py-2 pr-4 text-right font-medium">Lines</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Responded / invited
                  </th>
                  <th className="py-2 font-medium">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((rfq) => {
                  const responded = rfq.suppliers.filter(
                    (supplier) => supplier.statusCode !== 'invited',
                  ).length

                  return (
                    <tr key={rfq.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {rfq.documentNumber}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {rfq.title ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge statusCode={rfq.statusCode} />
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {rfq.revision}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {rfq.items.length}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {responded} / {rfq.suppliers.length}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {rfq.expiryDate
                          ? new Date(rfq.expiryDate).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </WorkspacePanel>
    </WorkspacePage>
  )
}

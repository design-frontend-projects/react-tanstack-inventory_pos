'use client'

import {
  WorkspaceEmptyState,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import {
  useMovementTrend,
  useWarehouseSummaries,
} from '#/features/inventory/use-inventory-analytics'

// Analytics strip for the warehouses screen: value distribution across sites,
// the in/out flow for the selected warehouse, and a per-warehouse KPI table.
export function WarehouseAnalyticsPanel({
  selectedWarehouseId,
  selectedWarehouseName,
}: {
  selectedWarehouseId: string | null
  selectedWarehouseName: string | null
}) {
  const summariesQuery = useWarehouseSummaries()
  const trendQuery = useMovementTrend({
    warehouseId: selectedWarehouseId ?? undefined,
    days: 30,
  })

  const summaries = summariesQuery.data ?? []
  const valueByWarehouse = summaries.map((summary) => ({
    name: summary.code,
    value: Number(summary.totalValue),
  }))
  const trend = (trendQuery.data ?? []).map((point) => ({
    day: point.day.slice(5),
    inQty: Number(point.inQty),
    outQty: Number(point.outQty),
  }))

  return (
    <WorkspacePanel
      eyebrow="Warehouse analytics"
      title="Stock value & flow"
      description="Valuation split across sites and the last 30 days of physical movements."
    >
      {summariesQuery.isError || trendQuery.isError ? (
        <WorkspaceEmptyState
          title="Could not load warehouse analytics"
          description="Check your connection and permissions, then retry."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Stock value by warehouse</p>
            {valueByWarehouse.length === 0 ? (
              <WorkspaceEmptyState
                title="No stock yet"
                description="Values appear once movements are posted."
              />
            ) : (
              <SimpleBarChart
                data={valueByWarehouse}
                xKey="name"
                series={[{ key: 'value', label: 'Stock value' }]}
                height={240}
              />
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">
              Movements — last 30 days
              {selectedWarehouseName
                ? ` · ${selectedWarehouseName}`
                : ' · all warehouses'}
            </p>
            {trend.length === 0 ? (
              <WorkspaceEmptyState
                title="No movements in range"
                description="Post receipts, sales, or transfers to see the flow."
              />
            ) : (
              <SimpleLineChart
                data={trend}
                xKey="day"
                series={[
                  { key: 'inQty', label: 'Inbound qty' },
                  { key: 'outQty', label: 'Outbound qty' },
                ]}
                height={240}
              />
            )}
          </div>
        </div>
      )}

      {summaries.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-160 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Warehouse</th>
                <th className="py-2 pr-4 text-right font-medium">SKUs</th>
                <th className="py-2 pr-4 text-right font-medium">Locations</th>
                <th className="py-2 pr-4 text-right font-medium">On hand</th>
                <th className="py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr
                  key={summary.warehouseId}
                  className="border-b border-border/60"
                >
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs">{summary.code}</span>
                    <span className="ml-2 font-medium">{summary.name}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {summary.skuCount}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {summary.locationCount}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {Number(summary.onHand).toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(summary.totalValue).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </WorkspacePanel>
  )
}

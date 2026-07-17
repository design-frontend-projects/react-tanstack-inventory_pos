'use client'

import * as React from 'react'
import {
  WorkspaceEmptyState,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'
import { Button } from '#/components/ui/button'
import { SimpleBarChart } from '#/components/charts/simple-bar-chart'
import { SimpleLineChart } from '#/components/charts/simple-line-chart'
import { ReorderRuleDialog } from '#/features/inventory/reorder-rule-dialog'
import type { ReorderRulePrefill } from '#/features/inventory/reorder-rule-dialog'
import {
  useInventoryKpis,
  useMovementTrend,
  useReorderSuggestions,
  useStockByCategory,
  useTopProductsByValue,
} from '#/features/inventory/use-inventory-analytics'
import { useProductsPage } from '#/features/products/use-products'
import { useWarehouses } from '#/features/warehouses/use-warehouses'

export function InventoryDashboard() {
  const [trendWarehouseId, setTrendWarehouseId] = React.useState('')
  const [ruleDialog, setRuleDialog] = React.useState(false)
  const [rulePrefill, setRulePrefill] = React.useState<ReorderRulePrefill>(null)

  const kpisQuery = useInventoryKpis()
  const byCategoryQuery = useStockByCategory()
  const topProductsQuery = useTopProductsByValue(10)
  const trendQuery = useMovementTrend({
    warehouseId: trendWarehouseId || undefined,
    days: 30,
  })
  const suggestionsQuery = useReorderSuggestions()
  const warehousesQuery = useWarehouses()
  // Lookup pool for resolving suggestion product/warehouse IDs to names.
  const productsQuery = useProductsPage({ take: 200 })

  const kpis = kpisQuery.data
  const categoryData = (byCategoryQuery.data ?? []).slice(0, 12).map((row) => ({
    name: row.categoryName,
    value: Number(row.totalValue),
  }))
  const topProducts = (topProductsQuery.data ?? []).map((row) => ({
    name: row.sku,
    value: Number(row.totalValue),
  }))
  const trend = (trendQuery.data ?? []).map((point) => ({
    day: point.day.slice(5),
    inQty: Number(point.inQty),
    outQty: Number(point.outQty),
  }))

  const productName = new Map(
    (productsQuery.data?.items ?? []).map((product) => [
      product.id,
      `${product.sku} — ${product.name}`,
    ]),
  )
  const warehouseName = new Map(
    (warehousesQuery.data ?? []).map((warehouse) => [
      warehouse.id,
      warehouse.name,
    ]),
  )
  const suggestions = suggestionsQuery.data ?? []

  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory overview"
      title="Stock health at a glance: value, distribution, flow, and reorder pressure."
      description="Live analytics built on the movement ledger and the materialized balances — every figure traces back to posted documents."
      metrics={[
        {
          label: 'Products',
          value: kpis ? String(kpis.productCount) : '—',
          hint: kpis ? `${kpis.activeProductCount} active` : 'Catalog size',
          tone: 'red',
        },
        {
          label: 'Low stock',
          value: kpis ? String(kpis.lowStockCount) : '—',
          hint: 'Below their reorder point',
          tone: 'accent',
        },
        {
          label: 'Stock value',
          value: kpis ? Number(kpis.totalValue).toLocaleString() : '—',
          hint: kpis
            ? `${Number(kpis.totalOnHand).toLocaleString()} units on hand`
            : 'Weighted-average valuation',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Distribution"
          title="Stock value by category"
          description="Where the inventory investment sits across the catalog."
        >
          {byCategoryQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load category distribution"
              description="Check your permissions, then retry."
            />
          ) : categoryData.length === 0 ? (
            <WorkspaceEmptyState
              title="No stock value yet"
              description="Post receipts or opening balances to populate this chart."
            />
          ) : (
            <SimpleBarChart
              data={categoryData}
              xKey="name"
              series={[{ key: 'value', label: 'Stock value' }]}
              height={260}
            />
          )}
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Concentration"
          title="Top products by value"
          description="The ten SKUs holding the most inventory value."
        >
          {topProductsQuery.isError ? (
            <WorkspaceEmptyState
              title="Could not load top products"
              description="Check your permissions, then retry."
            />
          ) : topProducts.length === 0 ? (
            <WorkspaceEmptyState
              title="No stock value yet"
              description="Top products appear once stock is on hand."
            />
          ) : (
            <SimpleBarChart
              data={topProducts}
              xKey="name"
              series={[
                { key: 'value', label: 'Stock value', color: 'var(--chart-3)' },
              ]}
              height={260}
              horizontal
            />
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel
        eyebrow="Flow"
        title="Movements — last 30 days"
        description="Physical inbound vs outbound quantities from the ledger (reservation holds excluded)."
      >
        <div className="mb-4">
          <select
            value={trendWarehouseId}
            onChange={(event) => setTrendWarehouseId(event.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
          >
            <option value="">All warehouses</option>
            {(warehousesQuery.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
        {trendQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load the movement trend"
            description="Check your permissions, then retry."
          />
        ) : trend.length === 0 ? (
          <WorkspaceEmptyState
            title="No movements in range"
            description="The flow chart fills up as documents post movements."
          />
        ) : (
          <SimpleLineChart
            data={trend}
            xKey="day"
            series={[
              { key: 'inQty', label: 'Inbound qty' },
              { key: 'outQty', label: 'Outbound qty' },
            ]}
            height={280}
          />
        )}
      </WorkspacePanel>

      <WorkspacePanel
        eyebrow="Replenishment"
        title="Reorder pressure"
        description="Products whose available stock sits below the reorder point of an active rule."
      >
        {suggestionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Checking reorder rules…
          </p>
        ) : suggestionsQuery.isError ? (
          <WorkspaceEmptyState
            title="Could not load reorder suggestions"
            description="Check your permissions, then retry."
          />
        ) : suggestions.length === 0 ? (
          <WorkspaceEmptyState
            title="No lines below reorder point"
            description="All tracked products are above their thresholds, or no reorder rules exist yet."
          >
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setRulePrefill(null)
                setRuleDialog(true)
              }}
            >
              Create reorder rule
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 font-medium">Warehouse</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Available
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Reorder point
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Suggested qty
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Lead time
                  </th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr
                    key={`${suggestion.productId}-${suggestion.warehouseId}`}
                    className="border-b border-border/60"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {productName.get(suggestion.productId) ??
                        suggestion.productId}
                    </td>
                    <td className="py-2 pr-4">
                      {warehouseName.get(suggestion.warehouseId) ??
                        suggestion.warehouseId}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {Number(suggestion.available).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {Number(suggestion.reorderPoint).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-primary">
                      {Number(suggestion.suggestedQty).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {suggestion.leadTimeDays ?? '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setRulePrefill({
                            productId: suggestion.productId,
                            warehouseId: suggestion.warehouseId,
                          })
                          setRuleDialog(true)
                        }}
                      >
                        Adjust rule
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </WorkspacePanel>

      <ReorderRuleDialog
        open={ruleDialog}
        onOpenChange={setRuleDialog}
        prefill={rulePrefill}
      />
    </WorkspacePage>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/')({
  component: InventoryOverviewPage,
})

function InventoryOverviewPage() {
  return (
    <WorkspacePage
      eyebrow="Inventory overview"
      title="Stock health stays visual, not buried."
      description="The inventory group is tuned for operators who need outlet context, replenishment visibility, and catalog discipline without bouncing between disconnected tables."
      metrics={[
        { label: 'Tracked SKUs', value: '10.4k', hint: 'Across all active tenants', tone: 'teal' },
        { label: 'Low stock lanes', value: '28', hint: 'Auto-prioritized by threshold', tone: 'amber' },
        { label: 'Coverage window', value: '4.8d', hint: 'Median forecast until reorder', tone: 'neutral' },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <WorkspacePanel
          eyebrow="Replenishment wave"
          title="Next moves"
          description="A calm two-column treatment replaces the usual inventory card mosaic."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Dry goods', '8 items below threshold'],
              ['Beverage line', '3 outlets need top-up'],
              ['Frozen prep', 'Temperature logs verified'],
              ['Packaging', 'Supplier lead time widened by 1 day'],
            ].map(([label, note]) => (
              <div key={label} className="rounded-[1.2rem] border border-border/60 bg-background/50 p-4">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-2 text-sm text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </WorkspacePanel>
        <WorkspacePanel
          eyebrow="Route anchors"
          title="Next pages ready"
          description="Catalog, outlets, and stock ledger pages already sit under the inventory menu group."
        >
          <ul className="grid gap-3 text-sm text-muted-foreground">
            <li>/inventory/catalog for product structure and assortment.</li>
            <li>/outlets for location coverage and map-aware operations.</li>
            <li>/inventory/stock for movement posture and threshold review.</li>
          </ul>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}

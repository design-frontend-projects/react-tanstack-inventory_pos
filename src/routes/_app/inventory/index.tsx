import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/')({
  component: InventoryOverviewPage,
})

function InventoryOverviewPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Inventory overview"
      title="Inventory stays readable when replenishment, coverage, and movement live in one compact frame."
      description="This overview is tuned for operators who need outlet context, replenishment posture, and catalog discipline without flipping between dense tables."
      metrics={[
        {
          label: 'Tracked SKUs',
          value: '10.4k',
          hint: 'Across all active tenants',
          tone: 'teal',
        },
        {
          label: 'Low stock lanes',
          value: '28',
          hint: 'Auto-prioritized by threshold',
          tone: 'amber',
        },
        {
          label: 'Coverage window',
          value: '4.8d',
          hint: 'Median forecast until reorder',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <WorkspacePanel
          eyebrow="Replenishment wave"
          title="Next inventory moves"
          description="A two-column card grid replaces the old mosaic so teams can spot the next wave without noise."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Dry goods', '8 items below threshold', 'Escalate before noon'],
              ['Beverage line', '3 outlets need top-up', 'Merge into the next route'],
              ['Frozen prep', 'Temperature logs verified', 'Hold until next dispatch'],
              ['Packaging', 'Supplier lead time widened by 1 day', 'Update coverage model'],
            ].map(([title, description, meta]) => (
              <WorkspaceDetailCard
                key={title}
                title={title}
                description={description}
                meta={meta}
              />
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Route anchors"
          title="Next pages ready"
          description="Catalog, outlets, and the stock ledger remain one jump away from the overview."
        >
          <div className="flex flex-col gap-3">
            {[
              ['/inventory/catalog', 'Catalog structure and assortment posture'],
              ['/outlets', 'Location coverage and geo-aware operations'],
              ['/inventory/stock', 'Movement posture and threshold review'],
            ].map(([route, note]) => (
              <WorkspaceTimelineItem
                key={route}
                leading={route}
                title={note}
                description="Navigation anchor"
                className="items-start"
              />
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}

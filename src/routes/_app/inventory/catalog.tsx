import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/catalog')({
  component: CatalogPage,
})

function CatalogPage() {
  return (
    <WorkspacePage
      eyebrow="Catalog"
      title="Structure the assortment before it leaks into operations."
      description="This page is reserved for naming, taxonomy, unit-of-measure discipline, and price architecture."
      metrics={[
        { label: 'Active lines', value: '1,482', hint: 'Sellable or trackable items', tone: 'teal' },
        { label: 'Hybrid items', value: '126', hint: 'Shared by restaurant + POS', tone: 'amber' },
        { label: 'Draft changes', value: '14', hint: 'Awaiting admin approval', tone: 'neutral' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Assortment posture"
        title="A few sharper panels beat a sea of mini widgets."
        description="Use this route to house catalog forms, variant rules, and pricing strategy once the backend layer is ready."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {['Naming system', 'Variant stack', 'Price architecture'].map((label) => (
            <div key={label} className="rounded-[1.2rem] border border-border/60 bg-background/55 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">{label}</p>
              <p className="mt-2">Reserved for the next implementation slice.</p>
            </div>
          ))}
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}

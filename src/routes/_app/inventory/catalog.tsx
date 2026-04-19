import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
  WorkspaceTimelineItem,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/inventory/catalog')({
  component: CatalogPage,
})

function CatalogPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Catalog"
      title="Keep item structure, variants, and price logic in one controlled publishing lane."
      description="Catalog work should feel compact and auditable. This screen is reserved for naming discipline, unit setup, variant rules, and release-ready pricing."
      metrics={[
        {
          label: 'Active lines',
          value: '1,482',
          hint: 'Sellable or trackable items',
          tone: 'teal',
        },
        {
          label: 'Hybrid items',
          value: '126',
          hint: 'Shared by restaurant + POS',
          tone: 'amber',
        },
        {
          label: 'Draft changes',
          value: '14',
          hint: 'Awaiting admin approval',
          tone: 'neutral',
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <WorkspacePanel
          eyebrow="Publishing rail"
          title="Assortment blocks ready for editing"
          description="A smaller card rail replaces the oversized hero treatment so catalog editors can move directly into rules and forms."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                'Naming system',
                'Lock down naming patterns, SKUs, and search aliases before an item reaches live lanes.',
                'Taxonomy gate',
              ],
              [
                'Variant stack',
                'Bundle sizes, modifiers, and kitchen crossover flags stay grouped in a single publishing surface.',
                'Variant rules',
              ],
              [
                'Price architecture',
                'Stage list price, service rules, and channel overrides before the next release window.',
                'Release 14:30',
              ],
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
          eyebrow="Control checks"
          title="Guardrails before changes go live"
          description="Catalog edits should move through a short approval sequence, not a loose backlog."
        >
          <div className="flex flex-col gap-3">
            {[
              ['01', 'Unit consistency review', 'Catch conflicting pack and measure definitions'],
              ['02', 'Channel visibility check', 'Confirm restaurant, POS, and inventory exposure'],
              ['03', 'Price release slot', 'Publish into the next tenant-approved release window'],
            ].map(([leading, title, description]) => (
              <WorkspaceTimelineItem
                key={leading}
                leading={leading}
                title={title}
                description={description}
              />
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}

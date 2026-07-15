import { createFileRoute } from '@tanstack/react-router'
import {
  WorkspaceDetailCard,
  WorkspacePage,
  WorkspacePanel,
} from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/restaurant/settings')({
  component: RestaurantSettingsPage,
})

function RestaurantSettingsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Restaurant setup"
      title="Configure restaurants, branches, and the floor from one surface."
      description="This screen manages the restaurant master data — restaurants and branches, dining areas and tables, service types, kitchen stations, tax and service-charge rules, and per-branch numbering — all backed by the res_ tables and the restaurant master-data server functions."
      metrics={[
        { label: 'Restaurants', value: '—', hint: 'Brands under this tenant', tone: 'teal' },
        { label: 'Active branches', value: '—', hint: 'Operational outlets', tone: 'neutral' },
        { label: 'Service types', value: '—', hint: 'Dine-in, delivery, takeaway…', tone: 'neutral' },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <WorkspacePanel
          eyebrow="Structure"
          title="Restaurant → branch → floor"
          description="Create the brand and its branches; each branch provisions its own order/invoice/ticket number sequences and a settings row automatically."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['Restaurants & branches', 'Brand, outlets, warehouse mapping, hours'],
              ['Dining areas & tables', 'Areas, sections, tables, and QR codes'],
              ['Service types', 'Dine-in, takeaway, pickup, delivery, QR, third-party'],
              ['Kitchen stations', 'Prep routing targets and printers'],
            ].map(([title, description]) => (
              <WorkspaceDetailCard key={title} title={title} description={description} />
            ))}
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          eyebrow="Financial configuration"
          title="Taxes, charges, and numbering"
          description="Everything is configuration-driven: multiple tax configs and service-charge rules per branch, plus atomic per-branch document numbering."
        >
          <div className="grid gap-3">
            {[
              ['Tax configuration', 'Inclusive/exclusive rates applied to orders, lines, or delivery'],
              ['Service charge rules', 'Percent or fixed, gated by service type and guest count'],
              ['Number sequences', 'Order, invoice, kitchen-ticket, and reservation numbering'],
            ].map(([title, description]) => (
              <WorkspaceDetailCard key={title} title={title} description={description} />
            ))}
          </div>
        </WorkspacePanel>
      </div>
    </WorkspacePage>
  )
}

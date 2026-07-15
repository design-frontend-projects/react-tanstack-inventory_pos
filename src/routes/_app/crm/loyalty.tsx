import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/crm/loyalty')({
  component: CrmLoyaltyPage,
})

function CrmLoyaltyPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Loyalty program"
      title="Points, tiers, and rewards without spreadsheets."
      description="This screen is reserved for loyalty settings, tier management, earn rules, the points ledger, and manual adjustments — backed by the append-only loyalty ledger."
      metrics={[
        {
          label: 'Points liability',
          value: '—',
          hint: 'Outstanding redeemable points',
          tone: 'amber',
        },
        {
          label: 'Members',
          value: '—',
          hint: 'Customers with loyalty accounts',
          tone: 'teal',
        },
        {
          label: 'Redemptions (30d)',
          value: '—',
          hint: 'Points redeemed at POS',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Program controls"
        title="Configure earning and redemption"
        description="Tenant loyalty settings, Bronze→VIP tiers, and rule-based earning land here once wired to the loyalty server functions."
      >
        <div />
      </WorkspacePanel>
    </WorkspacePage>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/pos/returns')({
  component: PosReturnsPage,
})

function PosReturnsPage() {
  return (
    <WorkspacePage
      eyebrow="Returns"
      title="Return handling sits beside checkout, but it deserves a stricter surface."
      description="This route is reserved for reversal reasons, inventory impact, and approval controls."
      metrics={[
        { label: 'Today', value: '3', hint: 'Below tolerance band', tone: 'neutral' },
        { label: 'Approval needed', value: '1', hint: 'High-value basket', tone: 'amber' },
        { label: 'Restocked lines', value: '8', hint: 'Ready to sync into stock movements', tone: 'teal' },
      ]}
    >
      <WorkspacePanel
        eyebrow="Return gate"
        title="Use a narrow, auditable flow."
        description="The page intentionally leaves room for reasons, stock reversals, and manager sign-off."
      >
        <div className="rounded-[1.3rem] border border-border/60 bg-background/55 px-5 py-10 text-center text-sm text-muted-foreground">
          Return and approval workflow placeholder.
        </div>
      </WorkspacePanel>
    </WorkspacePage>
  )
}

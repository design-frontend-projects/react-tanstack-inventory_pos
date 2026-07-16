import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePage, WorkspacePanel } from '#/components/layout/workspace-page'

export const Route = createFileRoute('/_app/crm/analytics')({
  component: CrmAnalyticsPage,
})

function CrmAnalyticsPage() {
  return (
    <WorkspacePage
      variant="compact"
      eyebrow="Customer analytics"
      title="Customer intelligence, pre-aggregated."
      description="This screen is reserved for CRM dashboards: lifecycle distribution, top customers, RFM heatmap, churn-risk list, and loyalty performance — all read from incrementally maintained projections."
      metrics={[
        {
          label: 'Avg order value',
          value: '—',
          hint: 'Across active customers',
          tone: 'red',
        },
        {
          label: 'Churn risk',
          value: '—',
          hint: 'Customers above threshold',
          tone: 'accent',
        },
        {
          label: 'Repeat rate',
          value: '—',
          hint: 'Customers with 2+ purchases',
          tone: 'neutral',
        },
      ]}
    >
      <WorkspacePanel
        eyebrow="Dashboards"
        title="No replays, no heavy queries"
        description="Every KPI here reads crm_customer_metrics and the monthly trend rows maintained by the event projector."
      >
        <div />
      </WorkspacePanel>
    </WorkspacePage>
  )
}

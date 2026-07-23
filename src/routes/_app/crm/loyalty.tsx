import { createFileRoute } from '@tanstack/react-router'
import { CrmLoyaltyWorkspace } from '#/features/crm/loyalty-workspace'

export const Route = createFileRoute('/_app/crm/loyalty')({
  component: CrmLoyaltyPage,
})

function CrmLoyaltyPage() {
  return <CrmLoyaltyWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { RfqWorkspace } from '#/features/purchasing/rfq-workspace'

export const Route = createFileRoute('/_app/purchase/rfqs')({
  component: RfqsPage,
})

function RfqsPage() {
  return <RfqWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { CrmSegmentsWorkspace } from '#/features/crm/segments-workspace'

export const Route = createFileRoute('/_app/crm/segments')({
  component: CrmSegmentsPage,
})

function CrmSegmentsPage() {
  return <CrmSegmentsWorkspace />
}

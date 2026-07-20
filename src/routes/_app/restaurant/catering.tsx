import { createFileRoute } from '@tanstack/react-router'
import { CateringWorkspace } from '#/features/restaurant/events/catering-workspace'

export const Route = createFileRoute('/_app/restaurant/catering')({
  component: CateringPage,
})

function CateringPage() {
  return <CateringWorkspace />
}

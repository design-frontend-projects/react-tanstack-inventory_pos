import { createFileRoute } from '@tanstack/react-router'
import { TakeawayWorkspace } from '#/features/restaurant/guests/takeaway-workspace'

export const Route = createFileRoute('/_app/restaurant/takeaway')({
  component: TakeawayPage,
})

function TakeawayPage() {
  return <TakeawayWorkspace />
}

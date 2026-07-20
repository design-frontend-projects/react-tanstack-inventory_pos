import { createFileRoute } from '@tanstack/react-router'
import { WaitlistWorkspace } from '#/features/restaurant/guests/waitlist-workspace'

export const Route = createFileRoute('/_app/restaurant/waitlist')({
  component: WaitlistPage,
})

function WaitlistPage() {
  return <WaitlistWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { EventsWorkspace } from '#/features/restaurant/events/events-workspace'

export const Route = createFileRoute('/_app/restaurant/events')({
  component: EventsPage,
})

function EventsPage() {
  return <EventsWorkspace />
}

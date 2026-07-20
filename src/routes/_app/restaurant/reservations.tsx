import { createFileRoute } from '@tanstack/react-router'
import { ReservationsWorkspace } from '#/features/restaurant/guests/reservations-workspace'

export const Route = createFileRoute('/_app/restaurant/reservations')({
  component: ReservationsPage,
})

function ReservationsPage() {
  return <ReservationsWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { ReservationWorkspace } from '#/features/inventory/reservation-workspace'

export const Route = createFileRoute('/_app/inventory/reservations')({
  component: ReservationsPage,
})

function ReservationsPage() {
  return <ReservationWorkspace />
}

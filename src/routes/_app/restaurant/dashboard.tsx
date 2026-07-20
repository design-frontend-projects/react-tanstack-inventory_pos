import { createFileRoute } from '@tanstack/react-router'
import { RestaurantDashboardWorkspace } from '#/features/restaurant/dashboard/dashboard-workspace'

export const Route = createFileRoute('/_app/restaurant/dashboard')({
  component: RestaurantDashboardPage,
})

function RestaurantDashboardPage() {
  return <RestaurantDashboardWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { RestaurantReportsWorkspace } from '#/features/restaurant/reports/reports-workspace'

export const Route = createFileRoute('/_app/restaurant/reports')({
  component: RestaurantReportsPage,
})

function RestaurantReportsPage() {
  return <RestaurantReportsWorkspace />
}

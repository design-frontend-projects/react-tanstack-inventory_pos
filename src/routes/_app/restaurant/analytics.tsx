import { createFileRoute } from '@tanstack/react-router'
import { RestaurantAnalyticsWorkspace } from '#/features/restaurant/reports/analytics-workspace'

export const Route = createFileRoute('/_app/restaurant/analytics')({
  component: RestaurantAnalyticsPage,
})

function RestaurantAnalyticsPage() {
  return <RestaurantAnalyticsWorkspace />
}

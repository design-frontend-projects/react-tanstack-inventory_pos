import { createFileRoute } from '@tanstack/react-router'
import { RestaurantSettingsWorkspace } from '#/features/restaurant/settings/settings-workspace'

export const Route = createFileRoute('/_app/restaurant/settings')({
  component: RestaurantSettingsPage,
})

function RestaurantSettingsPage() {
  return <RestaurantSettingsWorkspace />
}

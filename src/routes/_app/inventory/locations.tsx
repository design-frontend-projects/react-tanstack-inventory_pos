import { createFileRoute } from '@tanstack/react-router'
import { LocationWorkspace } from '#/features/warehouses/location-workspace'

export const Route = createFileRoute('/_app/inventory/locations')({
  component: WarehouseLocationsPage,
})

function WarehouseLocationsPage() {
  return <LocationWorkspace />
}

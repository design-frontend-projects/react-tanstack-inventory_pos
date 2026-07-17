import { createFileRoute } from '@tanstack/react-router'
import { WarehouseWorkspace } from '#/features/warehouses/warehouse-workspace'

export const Route = createFileRoute('/_app/outlets/')({
  component: OutletsPage,
})

function OutletsPage() {
  return <WarehouseWorkspace />
}

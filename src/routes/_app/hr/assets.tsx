import { createFileRoute } from '@tanstack/react-router'
import { AssetsWorkspace } from '#/features/hr/assets-workspace'

export const Route = createFileRoute('/_app/hr/assets')({
  component: AssetsPage,
})

function AssetsPage() {
  return <AssetsWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { EssWorkspace } from '#/features/hr/ess-workspace'

export const Route = createFileRoute('/_app/hr/self-service')({
  component: SelfServicePage,
})

function SelfServicePage() {
  return <EssWorkspace />
}

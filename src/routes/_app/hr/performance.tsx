import { createFileRoute } from '@tanstack/react-router'
import { PerformanceWorkspace } from '#/features/hr/performance-workspace'

export const Route = createFileRoute('/_app/hr/performance')({
  component: PerformancePage,
})

function PerformancePage() {
  return <PerformanceWorkspace />
}

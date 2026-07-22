import { createFileRoute } from '@tanstack/react-router'
import { JobGradeWorkspace } from '#/features/hr/org-master-workspaces'

export const Route = createFileRoute('/_app/hr/job-grades')({
  component: JobGradesPage,
})

function JobGradesPage() {
  return <JobGradeWorkspace />
}

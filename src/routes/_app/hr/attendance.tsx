import { createFileRoute } from '@tanstack/react-router'
import { AttendanceWorkspace } from '#/features/hr/attendance-workspace'

export const Route = createFileRoute('/_app/hr/attendance')({
  component: AttendancePage,
})

function AttendancePage() {
  return <AttendanceWorkspace />
}

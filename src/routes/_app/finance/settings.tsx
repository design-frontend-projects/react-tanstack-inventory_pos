import { createFileRoute } from '@tanstack/react-router'
import { FinanceSettingsWorkspace } from '#/features/finance/settings-workspace'

export const Route = createFileRoute('/_app/finance/settings')({
  component: FinanceSettingsPage,
})

function FinanceSettingsPage() {
  return <FinanceSettingsWorkspace />
}

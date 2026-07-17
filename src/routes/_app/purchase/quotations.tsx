import { createFileRoute } from '@tanstack/react-router'
import { QuotationWorkspace } from '#/features/purchasing/quotation-workspace'

export const Route = createFileRoute('/_app/purchase/quotations')({
  component: QuotationsPage,
})

function QuotationsPage() {
  return <QuotationWorkspace />
}

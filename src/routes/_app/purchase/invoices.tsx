import { createFileRoute } from '@tanstack/react-router'
import { InvoiceWorkspace } from '#/features/purchasing/invoice-workspace'

export const Route = createFileRoute('/_app/purchase/invoices')({
  component: InvoicesPage,
})

function InvoicesPage() {
  return <InvoiceWorkspace />
}

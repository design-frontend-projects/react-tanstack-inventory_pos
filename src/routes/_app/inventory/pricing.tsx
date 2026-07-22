import { createFileRoute } from '@tanstack/react-router'
import { PricingWorkspace } from '#/features/pricing/pricing-workspace'

export const Route = createFileRoute('/_app/inventory/pricing')({
  component: ProductPricingPage,
})

function ProductPricingPage() {
  return <PricingWorkspace />
}

import { createFileRoute } from '@tanstack/react-router'
import { GoodsReceiptWorkspace } from '#/features/purchasing/goods-receipt-workspace'

export const Route = createFileRoute('/_app/purchase/receipts')({
  component: GoodsReceiptPage,
})

function GoodsReceiptPage() {
  return <GoodsReceiptWorkspace />
}

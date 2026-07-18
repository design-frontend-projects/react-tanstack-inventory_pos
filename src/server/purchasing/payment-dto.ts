import type { SupplierPaymentWithAllocations } from '#/server/repos/pod-supplier-payment-repo'

// Stringify Decimal columns on supplier payments for the network boundary.

export function serializeSupplierPayment(
  payment: SupplierPaymentWithAllocations,
) {
  return {
    ...payment,
    exchangeRate: payment.exchangeRate.toString(),
    amount: payment.amount.toString(),
    allocatedAmount: payment.allocatedAmount.toString(),
    unallocatedAmount: payment.unallocatedAmount.toString(),
    allocations: payment.allocations.map((allocation) => ({
      ...allocation,
      allocatedAmount: allocation.allocatedAmount.toString(),
    })),
  }
}

export type SupplierPaymentDto = ReturnType<typeof serializeSupplierPayment>

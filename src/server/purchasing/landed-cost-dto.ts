import type { LandedCostVoucherWithRelations } from '#/server/repos/pod-landed-cost-repo'

// Stringify Decimal columns on landed-cost vouchers for the network boundary.

export function serializeLandedCostVoucher(
  voucher: LandedCostVoucherWithRelations,
) {
  return {
    ...voucher,
    exchangeRate: voucher.exchangeRate.toString(),
    totalCharges: voucher.totalCharges.toString(),
    charges: voucher.charges.map((charge) => ({
      ...charge,
      amount: charge.amount.toString(),
      taxAmount: charge.taxAmount.toString(),
    })),
    allocations: voucher.allocations.map((allocation) => ({
      ...allocation,
      basisValue: allocation.basisValue.toString(),
      allocatedAmount: allocation.allocatedAmount.toString(),
    })),
  }
}

export type LandedCostVoucherDto = ReturnType<typeof serializeLandedCostVoucher>

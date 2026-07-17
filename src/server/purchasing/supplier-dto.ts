import type {
  PodSupplierAddress,
  PodSupplierBankAccount,
  PodSupplierCategory,
  PodSupplierContact,
  Supplier,
} from '#/server/db/generated/prisma/client'
import type { SupplierDetail } from '#/server/repos/supplier-repo'

// Stringify Decimal columns for the network boundary (Prisma.Decimal is not JSON safe).

function dec(value: { toString: () => string } | null): string | null {
  return value === null ? null : value.toString()
}

export function serializeSupplierSummary(supplier: Supplier) {
  return {
    ...supplier,
    creditLimit: dec(supplier.creditLimit),
    currentBalance: supplier.currentBalance.toString(),
    rating: dec(supplier.rating),
  }
}

export function serializeSupplierContact(contact: PodSupplierContact) {
  return contact
}

export function serializeSupplierAddress(address: PodSupplierAddress) {
  return address
}

export function serializeSupplierBankAccount(bank: PodSupplierBankAccount) {
  return bank
}

export function serializeSupplierCategory(category: PodSupplierCategory) {
  return category
}

export function serializeSupplierDetail(supplier: SupplierDetail) {
  return {
    ...serializeSupplierSummary(supplier),
    contacts: supplier.contacts.map(serializeSupplierContact),
    addresses: supplier.addresses.map(serializeSupplierAddress),
    bankAccounts: supplier.bankAccounts.map(serializeSupplierBankAccount),
  }
}

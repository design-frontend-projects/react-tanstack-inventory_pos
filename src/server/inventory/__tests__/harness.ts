import { prisma } from '#/server/db/client'
import type { Prisma } from '#/server/db/generated/prisma/client'

// DB-test harness for the inventory domain. Repo/engine invariants (row locking,
// oversell, weighted-average cost) are database behaviours, so they are verified
// against a real Postgres rather than a mock. To avoid ever mutating a shared
// environment, DB-touching helpers are inert unless `INVENTORY_DB_TESTS=1` and a
// dedicated `INVENTORY_TEST_DATABASE_URL` are set. Pure-logic tests
// (state machine, costing math, document-number formatting) need none of this.

export function inventoryDbTestsEnabled(): boolean {
  return (
    process.env.INVENTORY_DB_TESTS === '1' &&
    typeof process.env.INVENTORY_TEST_DATABASE_URL === 'string' &&
    process.env.INVENTORY_TEST_DATABASE_URL.length > 0
  )
}

class RollbackSignal extends Error {
  constructor() {
    super('__inventory_test_rollback__')
    this.name = 'RollbackSignal'
  }
}

// Runs `fn` inside a transaction that is always rolled back, leaving the database
// pristine and tests parallel-safe. Use for repo tests that do NOT open their own
// transaction. Services that own a `$transaction` internally must instead use
// `resetInventoryTables()` in `afterEach`.
export async function withRollbackTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let captured: T

  try {
    await prisma.$transaction(async (tx) => {
      captured = await fn(tx)
      throw new RollbackSignal()
    })
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error
    }
  }

  return captured!
}

// Order matters: children before parents to satisfy FK constraints. Extend as
// ledger/document tables land in later phases.
const INVENTORY_TABLES_CHILD_FIRST = [
  'product_tag_links',
  'product_attribute_values',
  'attribute_options',
  'attributes',
  'bundle_components',
  'product_prices',
  'price_lists',
  'product_suppliers',
  'product_barcodes',
  'product_images',
  'product_variants',
  'products',
  'product_tags',
  'uom_conversions',
  'units_of_measure',
  'product_categories',
  'brands',
  'suppliers',
  'customers',
  'tax_rates',
  'document_sequences',
] as const

export async function resetInventoryTables(): Promise<void> {
  if (!inventoryDbTestsEnabled()) {
    throw new Error(
      'resetInventoryTables refused: set INVENTORY_DB_TESTS=1 and INVENTORY_TEST_DATABASE_URL to run DB tests.'
    )
  }

  const list = INVENTORY_TABLES_CHILD_FIRST.map((table) => `"${table}"`).join(', ')

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}

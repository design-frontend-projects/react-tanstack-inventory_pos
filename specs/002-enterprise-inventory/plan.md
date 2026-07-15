# Implementation Plan — Enterprise Inventory (Feature 002)

Dependency-ordered phases. Each phase = one additive Prisma migration + repos +
services + server functions + RBAC catalog entries (+ reseed) + tests. Never edit a
prior migration. Full architecture rationale: master plan at
`~/.claude/plans/act-as-a-principal-glimmering-dawn.md`.

## Layering (reuses feature 001 patterns)

- `prisma/schema.prisma` — all models/enums (additive migrations).
- `src/server/repos/*` — functional repos; **every function takes a trailing `client: PrismaClientLike = prisma`** (`src/server/db/types.ts`) so it can enlist in a `$transaction`.
- `src/server/inventory/*` — domain services: `state-machine.ts`, `document-number-service.ts`, `catalog-service.ts`, and (later) `movement-engine.ts`, `costing.ts`, `reservation-service.ts`, `documents/*`.
- `src/features/<domain>/*` — `createServerFn` + Zod validation + DTOs; guards `requireAuth → requireTenantAccess → requirePermission`.
- RBAC via `rbac-catalog.ts` + `module-catalog.ts` + `pnpm db:seed`.

## Phases

- **Phase 0 — Transaction foundation. ✅ Done.** `DocumentSequence` + `DocumentType`; `document-number-service.ts` (atomic upsert); `state-machine.ts` (all document lifecycles); `audit-log-repo` gains optional `tx`; test harness (`src/server/inventory/__tests__/harness.ts`, DB helpers gated behind `INVENTORY_DB_TESTS`).
- **Phase 1 — Catalog + master data. ✅ Done.** Full catalog + Supplier/Customer/TaxRate; repos (`product/brand/category/uom/supplier/customer/tax-rate`); `catalog-service.ts`; `features/products/{validation,server-functions}.ts` + `catalog-dto.ts`; RBAC `product.*` + `supplier.*`/`customer.*`/`tax.manage` + `inventory_manager` role.
- **Phase 2 — Warehousing.** Warehouse + WarehouseLocation (ltree/GIST via raw-SQL migration). RBAC `warehouse.*`.
- **Phase 3 — Ledger core (KEYSTONE).** StockBalance, InventoryMovement (month-partitioned), CostLayer, `movement-engine.ts` (`postMovement` under `SELECT … FOR UPDATE`), `costing.ts` (WAC), StockAdjustment, opening balances. RBAC `inventory.*`, `adjustment.*`. Integration tests: no-oversell, `onHand==ΣqtyDelta`, WAC vectors, concurrency.
- **Phase 4 — Transfers.** Two-leg ship/receive + in-transit. RBAC `transfer.*`.
- **Phase 5 — Purchasing.** Requisition→PO→GoodsReceipt(→PURCHASE_RECEIPT)→PurchaseReturn/DebitNote + landed cost. RBAC `purchase.*`.
- **Phase 6 — Sales / POS.** Customer pricing, SalesOrder, SalesInvoice, PosSale + PosSession + Payment(→SALE). RBAC `sales.*`, `pos.*`.
- **Phase 7 — Returns & credit/debit notes.**
- **Phase 8 — Reservations.** Wired into SO confirm→reserve, fulfillment→convert.
- **Phase 9 — Batch/Serial/Expiry enforcement.** Lot/SerialNumber, FEFO, trackingPolicy enforcement in engine.
- **Phase 10 — Manufacturing.** BOM, ProductionOrder, consumption/output, cost roll-up.
- **Phase 11 — Reorder, snapshots, valuation reporting.**

## Testing

Pure logic (state machine, costing, document-number formatting, RBAC) → Vitest unit
tests. Engine invariants → real-Postgres integration tests via the harness
(`withRollbackTx` for repo tests; `resetInventoryTables` for services that own a
`$transaction`), gated behind `INVENTORY_DB_TESTS=1` + `INVENTORY_TEST_DATABASE_URL`.
Do not mock Prisma for the engine.

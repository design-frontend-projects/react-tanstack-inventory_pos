# Tasks — Enterprise Inventory (Feature 002)

## Phase 0 — Transaction foundation ✅

- [X] T001 Enum `DocumentType` + `DocumentSequence` model + migration
- [X] T002 `src/server/inventory/state-machine.ts` (all document lifecycles + `assertTransition`)
- [X] T003 `src/server/inventory/document-number-service.ts` (atomic `ON CONFLICT` counter)
- [X] T004 `audit-log-repo` optional `tx` param + `src/server/db/types.ts` (`PrismaClientLike`)
- [X] T005 Test harness `src/server/inventory/__tests__/harness.ts` (gated DB helpers)
- [X] T006 Unit tests: state machine, document-number formatting

## Phase 1 — Catalog + master data ✅

- [X] T010 Schema: catalog + master enums & models + migration + generate
- [X] T011 Repos: `brand`, `category`, `uom`, `product`, `supplier`, `customer`, `tax-rate` (tx-aware)
- [X] T012 `src/server/inventory/catalog-service.ts` (+ `catalog-dto.ts` Decimal serialization)
- [X] T013 `src/features/products/{validation,server-functions}.ts`
- [X] T014 RBAC: `product.*`, `supplier.*`, `customer.*`, `tax.manage`, `inventory_manager` role + reseed
- [X] T015 Unit tests: catalog RBAC wiring

### Phase 1 follow-ups (not yet done)

- [ ] T016 Repos + server-fns for `product_variants`, `product_barcodes`, `product_images`, `price_lists`/`product_prices`, `attributes`/`options`, `bundle_components`, `uom_conversions`
- [ ] T017 `features/products` client hooks (`use-products-query.ts` etc.) + wire the `inventory/catalog` route to real data
- [ ] T018 Integration tests (harness): SKU uniqueness per tenant, category hierarchy `path`/`depth`, UoM conversion math

## Phase 2 — Warehousing ✅

- [X] T020 Warehouse + WarehouseLocation (adjacency + materialized path; ltree/GIST deferred) + migration
- [X] T021 `warehouse-repo`, `location-repo` (tx-aware) + `warehouse-service.ts`
- [X] T022 `features/warehouses/{validation,server-functions}.ts` + `warehouse.*` RBAC

## Phase 3 — Ledger core (KEYSTONE) ✅

- [X] T030 StockBalance (projection) + InventoryMovement (immutable) + CostLayer (partitioning deferred to Phase 11)
- [X] T031 `movement-engine.ts` (`postMovement`: ensure-then-`SELECT … FOR UPDATE`, oversell guard, WAC + cost layer) + `costing.ts` (pure WAC)
- [X] T032 StockAdjustment document + `stock-adjustment-service.ts` (transactional post) + `inventory.*`/`adjustment.*` RBAC + `features/inventory/*`
- [X] T033 Repos: `stock-balance` (lock), `movement`, `cost-layer`, `stock-adjustment`
- [X] T034 Unit tests: WAC golden vectors (10@2+10@4→avg 3; issue 5→onHand 15/avg 3), ledger RBAC
- [ ] T035 Integration tests (harness, gated): no-oversell under concurrency, `onHand==ΣqtyDelta`, adjustment post end-to-end
- [ ] T036 Opening-balance bulk import + UoM conversion in the engine (currently qty treated as base-UoM)

## Phases 4–11

- [ ] T040 Transfers · T050 Purchasing · T060 Sales/POS · T070 Returns
- [ ] T080 Reservations · T090 Batch/Serial/Expiry · T100 Manufacturing · T110 Reorder/Snapshots/Valuation

Status legend: [X] done · [ ] pending.

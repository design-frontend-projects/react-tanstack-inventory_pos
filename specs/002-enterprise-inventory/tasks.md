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

## Phase 4 — Transfers ✅

- [X] T040 StockTransfer + StockTransferLine + `TransferStatus` + migration
- [X] T041 `stock-transfer-repo` + `stock-transfer-service` (create / ship→TRANSFER_OUT / receive→TRANSFER_IN, value conserved via out-leg cost lookup)
- [X] T042 `features/transfers/*` + `transfer.*` RBAC

## Phase 5 — Purchasing ✅

- [X] T050 PurchaseRequisition, PurchaseOrder, GoodsReceipt, PurchaseReturn (+lines) + status enums + migration
- [X] T051 Repos (requisition/po/goods-receipt/purchase-return) + DTO serializers
- [X] T052 Services: PO (create/approve/confirm/cancel, no inventory effect), GoodsReceipt (post→PURCHASE_RECEIPT + PO qty reconcile), PurchaseReturn (post→PURCHASE_RETURN), Requisition (create/submit/approve/convert→PO)
- [X] T053 `features/purchasing/*` + `purchase.*` RBAC + `purchasing_officer` role
- [ ] T054 DebitNote (financial note; deferred), tax computation on PO lines, requisition→PO cost seeding

## Phase 6 — Sales / POS ✅

- [X] T060 SalesOrder, SalesInvoice, PosSale/Line/Payment, PosSession (+lines) + status enums + migration
- [X] T061 Repos (sales-order/sales-invoice/pos-sale/pos-session) + sales DTO serializers
- [X] T062 Services: PosSale (create/complete→SALE + costAtSale + payments/void), PosSession (open/close + cash reconcile), SalesOrder (create/confirm/fulfil→SALE/cancel), SalesInvoice (from order/issue/record payment)
- [X] T063 `features/pos/*` + `features/sales/*` + `sales.*`/`pos.*` RBAC + `sales_manager`/`pos_cashier` roles
- [X] T064 Drift fix: shadow-safe `auth.uid()` migration — `prisma migrate dev` works again (no reset)
- [ ] T065 Reservation integration at SO confirm (Phase 8); tax computation; separate AR Payment ledger; UoM conversion in sale lines

## Phase 7 — Returns + credit/debit notes ✅

- [X] T070 SalesReturn/SalesReturnLine (+ SalesReturnStatus/SalesReturnReason), FinancialNote (+ NoteType/NoteStatus), PosSaleLine.refundedQty + migration + generate
- [X] T071 Repos (`sales-return-repo`, `financial-note-repo`) + `returns-dto.ts` serializers + `pos-sale-repo.incrementLineRefundedQty`
- [X] T072 Services: SalesReturn (create / submit / approve / reject / cancel / receive→SALES_RETURN IN at costAtReturn) + `refundPosSale` (one-shot POS refund → SALES_RETURN IN, tracks refundedQty, advances sale to REFUNDED/PARTIALLY_REFUNDED) + FinancialNote (credit-from-return, debit-from-purchase-return, issue/apply/cancel)
- [X] T073 `features/returns/{validation,server-functions}.ts` + `returns.*`/`note.manage` RBAC (sales_manager, pos_cashier refund, purchasing_officer debit notes) + reseed
- [X] T074 Unit tests: return + note state machines, POS refund status flow, RBAC wiring (`tests/unit/returns.test.ts`)
- [ ] T075 Non-restock disposition to `damaged`/`expired` buckets (currently non-restock lines credit but do not post); separate AR/AP ledger posting from notes; UoM conversion on return lines

## Phases 8–11 (pending)

- [ ] T080 Reservations · T090 Batch/Serial/Expiry · T100 Manufacturing · T110 Reorder/Snapshots/Valuation

Status legend: [X] done · [ ] pending.

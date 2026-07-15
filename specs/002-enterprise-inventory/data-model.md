# Data Model — Enterprise Inventory (Feature 002)

Conventions (match feature 001): `String @id @default(uuid()) @db.Uuid`; camelCase
fields → snake_case `@map`; tenant-owned models carry `tenantId` + `TenantAccount`
relation `onDelete: Cascade`; `@@unique([tenantId, …])`; tenantId-leading indexes;
catalog/registry entities soft-delete via `deletedAt`. Composition/ownership uses
real relations; lookup FKs (category/brand/uom/tax/supplier refs) are scalar Uuid
columns with app-enforced integrity (mirroring the app-enforced tenant isolation).
Money `Decimal(19,4)`, quantity `Decimal(18,4)`, unit cost `Decimal(19,6)`.

The authoritative schema is `prisma/schema.prisma`. This document tracks the domain
model and its build status.

## Implemented — Phase 0 + Phase 1

### Phase 0 — transaction foundation
- **DocumentSequence** (`document_sequences`) — per-tenant, per-`DocumentType`, per-scope/period counter for document numbering. Advanced atomically via `INSERT … ON CONFLICT DO UPDATE … RETURNING` in `document-number-service.ts`.
- Enum **DocumentType** (14 values covering all document types across later phases).

### Phase 1 — product catalog + master data
- **Product** (`products`) — root. `productType` (SIMPLE/VARIANT/BUNDLE/KIT/SERVICE/COMPOSITE), `trackingPolicy` (NONE/LOT/SERIAL/LOT_SERIAL), `isStockTracked`, `hasExpiry`/`shelfLifeDays`, base/sales/purchase UoM, `costingMethod` (default WEIGHTED_AVERAGE), pricing/cost, tax, barcode, product-level reorder defaults, `status`.
- **ProductVariant** (`product_variants`) — SKU-per-variant, attribute JSON, price/cost overrides.
- **ProductCategory** (`product_categories`) — self-hierarchy via `parentId` + materialized `path`/`depth` (ltree deferred to Phase 2 warehouse locations).
- **Brand**, **UnitOfMeasure**, **UomConversion** (global or product-specific pack factor).
- **ProductBarcode** (per-pack, multiple), **ProductImage**, **ProductAttributeValue**, **Attribute**/**AttributeOption**, **ProductTag**/**ProductTagLink**.
- **ProductSupplier** (sourcing/lead time/preferred), **PriceList**/**ProductPrice** (tiered, tax-in/out, validity), **BundleComponent** (KIT_STATIC / BUNDLE_PRICED).
- Master data: **Supplier**, **Customer** (`customerType`), **TaxRate** (`taxType`).
- Enums: ProductType, TrackingPolicy, CostingMethod, ProductStatus, UomType, AttributeInputType, BarcodeType, PriceListType, BundleComponentType, TaxType, CustomerType.

## Implemented — Phase 2 + Phase 3

### Phase 2 — warehousing
- **Warehouse** (`warehouses`) — `warehouseType`, `allowNegativeStock`, default flag.
- **WarehouseLocation** (`warehouse_locations`) — unlimited hierarchy via `parentId` + materialized `path`/`depth`; `locationType` (ZONE→BIN…), `isStockable`/`isPickable`/`pickSequence`. Enums WarehouseType, LocationType.

### Phase 3 — ledger core (keystone)
- **StockBalance** (`stock_balances`) — materialized projection at grain tenant × product × variant × location × lot × serial (nullable components collapse to `-` surrogate keys for the unique index). Stored buckets on_hand/reserved/allocated/damaged/expired/in_transit/returned, WAC `avg_unit_cost`/`total_value`, `version`. Written ONLY by the engine under `SELECT … FOR UPDATE`. `available` is computed, never stored.
- **InventoryMovement** (`inventory_movements`) — immutable append-only ledger: signed `qty_delta`, historical `unit_cost`, `running_on_hand`/`running_avg_cost` snapshots, source-doc trace, reversal links. Enums MovementType (21), SourceDocType. (Month-range partitioning deferred to Phase 11.)
- **CostLayer** (`cost_layers`) — written on each receipt (FIFO/landed readiness; not consumed under WAC).
- **StockAdjustment** / **StockAdjustmentLine** — first document that posts movements. Enums AdjustmentStatus, AdjustmentReason.
- Engine: `movement-engine.ts` `postMovement` (oversell guard, WAC via `costing.ts`), `stock-adjustment-service.ts` (transactional post), `stock-query-service.ts` (balances/movements/summary).

## Implemented — Phase 4 (transfers) + Phase 5 (purchasing)

- **StockTransfer** / **StockTransferLine** (`TransferStatus`) — two-leg: ship posts `TRANSFER_OUT` at the source, receive posts `TRANSFER_IN` at the destination valued at the out-leg's issue cost (value conserved).
- **PurchaseRequisition** / line (`RequisitionStatus`) — create → submit → approve → convert to a draft PO.
- **PurchaseOrder** / line (`PurchaseOrderStatus`) — records intent only; **no inventory effect**. Header stores subtotal/taxTotal/grandTotal; lines track ordered vs received qty.
- **GoodsReceipt** / line (`ReceiptStatus`) — posting emits `PURCHASE_RECEIPT` (IN) per accepted line, increments PO line received qty, and reconciles PO status to PARTIALLY_RECEIVED/RECEIVED.
- **PurchaseReturn** / line (`PurchaseReturnStatus`) — posting emits `PURCHASE_RETURN` (OUT).
- All posting services run in one `$transaction` (RepeatableRead) and route through `postMovement`.

## Implemented — Phase 6 (sales / POS)

- **SalesOrder** / line (`SalesOrderStatus`) — create → confirm → **fulfil** (posts `SALE` OUT per line at its pick location, stamps `costAtSale` from WAC) → invoiced. Reduces stock only at fulfilment.
- **SalesInvoice** / line (`InvoiceStatus`) — built from a fulfilled order (or direct); issue → record payment → PARTIALLY_PAID/PAID.
- **PosSale** / line + **PosPayment** (`PosSaleStatus`, `PosOrderType`, `PaymentMethod`) — **complete** posts `SALE` (OUT) immediately, stamps `costAtSale`, captures payments, computes change; void supported.
- **PosSession** (`PosSessionStatus`) — open/close with cash reconciliation (expected = opening float + cash taken on completed sales; variance computed).
- All posting runs through `postMovement` in one `$transaction` (RepeatableRead).

**Ops note:** `profiles.auth_user_id` drift resolved — the schema now declares `@default(dbgenerated("auth.uid()"))` and a shadow-DB-safe migration seeds a guarded `auth.uid()` stub, so `prisma migrate dev` runs cleanly (no reset).

## Implemented — Phase 7 (returns + credit/debit notes)

- **SalesReturn** / line (`SalesReturnStatus`, `SalesReturnReason`) — lifecycle draft → requested → approved → (in_transit) → **received** → credited → closed. **Receiving** posts a `SALES_RETURN` (IN) per *restockable* line, re-entering stock at the line's `costAtReturn` (the original `costAtSale`, so returns don't leak margin into WAC; falls back to current WAC when unknown) and stamps `restockValue`. Non-restock lines (damaged/scrapped) still credit the customer but post no movement. Reuses `postMovement` in one `$transaction` (RepeatableRead).
- **POS refund** (`refundPosSale`) — one-shot counter refund sourced from a completed `PosSale`: creates an already-approved `SalesReturn` (origin POS_SALE), re-enters stock immediately, increments `PosSaleLine.refundedQty`, and advances the sale to `REFUNDED` / `PARTIALLY_REFUNDED` (supports repeated partial refunds up to the sold quantity).
- **FinancialNote** (`NoteType` CREDIT/DEBIT, `NoteStatus`) — unified AR credit note (from a received sales return, carries its grand total, flips the return to CREDITED) and AP debit note (from a shipped purchase return, valued Σ qty×unitCost). No inventory effect; issue → apply (partial keeps ISSUED, full → APPLIED) → cancel. Cross-aggregate links (`salesReturnId`, `purchaseReturnId`, `customerId`, `supplierId`, `salesInvoiceId`) are scalar lookups with app-enforced integrity.

## Implemented — Phase 8 (reservations)

- **StockReservation** (`ReservationStatus`, `ReservationType`) — a soft hold at grain product × variant × warehouse × location × lot × serial. Placing a hold locks the balance row (`ensureAndLockBalance`), checks `available (= on_hand − reserved − allocated) ≥ qty`, and raises the `reserved` bucket — **never `on_hand`, and never a ledger movement**, so `available` drops without touching stock or WAC. Tracks `quantity`/`fulfilledQty`/`releasedQty`; carries `sourceDocType`/`sourceDocId`/`sourceDocLineId` back to the driving document and an optional `expiresAt`.
- **Sales-order integration** — `reserveSalesOrder` (confirmed → **reserved**) places a `SALES_ORDER` hold per line for the unreserved remainder and stamps `SalesOrderLine.reservedQty`. `fulfillSalesOrder` converts any open hold for the line first (releasing it off `reserved`) and *then* posts the `SALE` (OUT) — so the oversell guard never counts the same units as both reserved and on-hand. `cancelSalesOrder` releases all open holds back to available. Direct confirmed → fulfilled (no reservation) still works unchanged.
- **Lifecycle & expiry** — the `reservation` state machine (active → partially_fulfilled → fulfilled / released / expired) is enforced via `assertTransition`. `expireReservations` is a batched sweep that releases (as EXPIRED) any active hold past its `expiresAt`, intended to be driven by a scheduled job. Every `reserved` mutation flows through `reservation-service` under the same balance lock the movement engine uses.

## Implemented — Phase 9 (batch / serial / expiry)

- **Lot** (`LotStatus` ACTIVE/QUARANTINE/EXPIRED/RECALLED/DEPLETED) — batch master keyed `[tenant, product, lotNumber]` with `manufactureDate`/`expiryDate`/`receivedDate`, supplier + source-doc provenance. The lot's on-hand quantity lives in `StockBalance` (grained by `lotId`), not on the master. FEFO index `(tenant, product, expiryDate)`; `listActiveLotsFefo` returns nearest-expiry-first (nulls last).
- **SerialNumber** (`SerialStatus` IN_STOCK/RESERVED/SOLD/IN_TRANSIT/RETURNED/SCRAPPED/IN_REPAIR) — one row per physical unit, unique `[tenant, product, serialNumber]`, carrying `currentWarehouseId`/`currentLocationId`, optional `lotId`, warranty, and `soldAt`. Single-location by construction (the movement is authoritative for its whereabouts).
- **Tracking-policy enforcement** — `tracking-policy.ts` holds the pure rules; the movement engine calls `assertTrackingCompliance` on every line: **LOT** requires a `lotId`, **SERIAL** requires a `serialId` at **quantity 1**, **LOT_SERIAL** both. The policy is looked up once (or passed by the caller to skip the lookup). After posting, `serialTransition` advances the serial's status + location (SALE→SOLD, TRANSFER_OUT→IN_TRANSIT, IN→IN_STOCK at target, DAMAGE/LOST→SCRAPPED). Manual lifecycle changes (quarantine/recall/repair) go through `setLotStatus`/`setSerialStatus`, guarded by the `lot`/`serial` state machines.
- **Goods-receipt integration** — the entry point for lots/serials into stock: a lot-tracked line materializes (or reuses) a `Lot` and passes `lotId` into the movement; a serialized line splits into one Lot-linked `SerialNumber` + one qty-1 `PURCHASE_RECEIPT` movement per serial (rejected if fewer serials than accepted units). `expireLots` is a batched sweep flipping lapsed lots to EXPIRED, for a scheduled job.

## Implemented — Phase 10 (manufacturing)

- **BillOfMaterials** (`BomStatus`) + **BomComponent** — the recipe: components (quantity + `scrapPercent`) per `outputQty` batch of a finished product, with a batch-level `overheadCost`. `explodeComponentQty` scales a component to a run: `perOutput × (plannedQty / outputQty) × (1 + scrap)`.
- **ProductionOrder** (`ProductionOrderStatus`) + **ProductionMaterial** + **ProductionOutput** — lifecycle draft → planned → released → **in_progress** (materials consumed) → **completed** (finished goods received) → closed. Creating from a BOM explodes its components into planned material lines (drawn from a single source location); ad-hoc orders pass explicit materials.
- **Consumption** (`consumeMaterials`) posts a `PRODUCTION_CONSUMPTION` (OUT) per material at current WAC; the issue costs accumulate into the order's `materialCost`.
- **Completion** (`completeProduction`) posts a `PRODUCTION_OUTPUT` (IN) for the finished good at the rolled-up unit cost `rollupOutputUnitCost = (materialCost + overheadCost) / producedQty`, which flows into the finished product's weighted average through the engine like any receipt. Lot/serial-tracked finished goods materialize their `Lot`/`SerialNumber` masters (split into qty-1 movements per serial), mirroring goods receipt. All posting runs through `postMovement` in one `$transaction` (RepeatableRead).

## Implemented — Phase 11 (reorder + valuation)

- **ReorderRule** — per product×warehouse override of the product-level reorder defaults: min/max/safety/`reorderPoint`/`reorderQty`, optional `economicOrderQty`, `leadTimeDays`, `preferredSupplierId`, `isActive`. Unique `[tenant, product, warehouse]`. The **reorder-suggestion** query aggregates live balances per rule, computes `available = on-hand − reserved`, and (for rules at/below their point) suggests `reorderQty` — or the amount to top back up to max when no reorder qty is set — with the preferred supplier and lead time.
- **StockSnapshot** — a point-in-time valuation row per product×variant×warehouse per `periodKey` (`YYYY-MM`). `takeSnapshot` aggregates the current balances (`groupBy`) and rewrites the period's rows atomically (delete-then-insert, idempotent) — intended for a monthly job so historical valuation doesn't require replaying the whole ledger.
- **Live valuation** — `getValuationSummary` rolls up on-hand + total value per product×warehouse from the materialized balances plus a grand total with the blended weighted-average cost (pure `aggregateValuation`).

## Spec 002 — build complete (Phases 0–11)

The ledger-first core (immutable `InventoryMovement` + materialized `StockBalance` + the single `postMovement` engine, Moving Weighted Average) now underpins every business document: catalog & master data, warehousing, adjustments, transfers, purchasing, sales/POS, returns & credit/debit notes, reservations, batch/serial/expiry, manufacturing, and reorder/valuation. Cross-cutting hardening still open: `inventory_movements` month partitioning, ltree/GIST hierarchies, in-engine UoM conversion, serial picking on issue, a separate AR/AP payment ledger, and the gated DB-integration suite.

## Superseded from feature 001 (never migrated)

| 001 (simplified) | 002 (enterprise) |
|---|---|
| `CatalogItem` | `Product` + `ProductVariant` |
| `StockRecord` (mutable onHand/reserved) | `StockBalance` (movement-driven projection) |
| `StockMovement` (thin log) | `InventoryMovement` (immutable ledger) |
| `Outlet` | `Warehouse` (type OUTLET/STORE) + locations |
| `PosOrder` / `PosOrderLine` | `PosSale` / `PosSaleLine` document posting SALE movements |

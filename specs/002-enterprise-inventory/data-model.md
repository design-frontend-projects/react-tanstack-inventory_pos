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

## Planned — later phases (see plan.md)

- **Phase 8–11:** StockReservation; Lot/SerialNumber; BillOfMaterials/ProductionOrder/MaterialConsumption/FinishedGoodsReceipt; ReorderRule/StockSnapshot/valuation views.

## Superseded from feature 001 (never migrated)

| 001 (simplified) | 002 (enterprise) |
|---|---|
| `CatalogItem` | `Product` + `ProductVariant` |
| `StockRecord` (mutable onHand/reserved) | `StockBalance` (movement-driven projection) |
| `StockMovement` (thin log) | `InventoryMovement` (immutable ledger) |
| `Outlet` | `Warehouse` (type OUTLET/STORE) + locations |
| `PosOrder` / `PosOrderLine` | `PosSale` / `PosSaleLine` document posting SALE movements |

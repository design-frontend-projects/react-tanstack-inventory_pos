-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('warehouse', 'store', 'outlet', 'virtual', 'transit', 'quarantine');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('zone', 'aisle', 'rack', 'shelf', 'bin', 'dock', 'staging');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('opening_balance', 'purchase_receipt', 'purchase_return', 'sale', 'sales_return', 'transfer_out', 'transfer_in', 'adjustment_inc', 'adjustment_dec', 'production_output', 'production_consumption', 'damage', 'expired', 'lost', 'cycle_count_inc', 'cycle_count_dec', 'reservation', 'reservation_release', 'reservation_conversion', 'revaluation', 'landed_cost_adjustment');

-- CreateEnum
CREATE TYPE "SourceDocType" AS ENUM ('opening', 'purchase_order', 'goods_receipt', 'sales_order', 'pos_sale', 'sales_invoice', 'transfer', 'adjustment', 'count', 'production', 'return', 'reservation');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'posted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('damage', 'expiry', 'loss', 'found', 'correction', 'revaluation');


-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_type" "WarehouseType" NOT NULL DEFAULT 'warehouse',
    "address_json" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_type" "LocationType" NOT NULL DEFAULT 'bin',
    "path" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "is_stockable" BOOLEAN NOT NULL DEFAULT true,
    "is_pickable" BOOLEAN NOT NULL DEFAULT true,
    "pick_sequence" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "variant_key" TEXT NOT NULL DEFAULT '-',
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "lot_key" TEXT NOT NULL DEFAULT '-',
    "serial_id" UUID,
    "serial_key" TEXT NOT NULL DEFAULT '-',
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "damaged" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "expired" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "in_transit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "returned" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "last_movement_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "counterparty_location_id" UUID,
    "lot_id" UUID,
    "serial_id" UUID,
    "qty_delta" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID NOT NULL,
    "qty_in_base_uom" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(19,6) NOT NULL,
    "total_cost" DECIMAL(19,4) NOT NULL,
    "running_on_hand" DECIMAL(18,4) NOT NULL,
    "running_avg_cost" DECIMAL(19,6) NOT NULL,
    "source_doc_type" "SourceDocType" NOT NULL,
    "source_doc_id" UUID,
    "source_doc_line_id" UUID,
    "source_doc_number" TEXT,
    "performed_by_profile_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversal_of_movement_id" UUID,
    "reversed_by_movement_id" UUID,
    "correlation_id" UUID,
    "notes" TEXT,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_layers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "source_movement_id" UUID NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "original_qty" DECIMAL(18,4) NOT NULL,
    "remaining_qty" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(19,6) NOT NULL,
    "landed_cost_per_unit" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "is_depleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'draft',
    "reason_code" "AdjustmentReason" NOT NULL,
    "notes" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "posted_by_profile_id" UUID,
    "approved_by_profile_id" UUID,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "adjustment_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "serial_id" UUID,
    "uom_id" UUID NOT NULL,
    "system_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "adjusted_qty" DECIMAL(18,4) NOT NULL,
    "qty_delta" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(19,6),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouses_tenant_type_idx" ON "warehouses"("tenant_id", "warehouse_type");

-- CreateIndex
CREATE INDEX "warehouses_tenant_active_idx" ON "warehouses"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_code_unique" ON "warehouses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_locations_tenant_wh_idx" ON "warehouse_locations"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "warehouse_locations_tenant_parent_idx" ON "warehouse_locations"("tenant_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_locations_wh_code_unique" ON "warehouse_locations"("tenant_id", "warehouse_id", "code");

-- CreateIndex
CREATE INDEX "stock_balances_product_wh_idx" ON "stock_balances"("tenant_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_balances_location_idx" ON "stock_balances"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_balances_wh_idx" ON "stock_balances"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_grain_unique" ON "stock_balances"("tenant_id", "product_id", "variant_key", "location_id", "lot_key", "serial_key");

-- CreateIndex
CREATE INDEX "movements_product_time_idx" ON "inventory_movements"("tenant_id", "product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "movements_wh_time_idx" ON "inventory_movements"("tenant_id", "warehouse_id", "occurred_at");

-- CreateIndex
CREATE INDEX "movements_doc_idx" ON "inventory_movements"("tenant_id", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE INDEX "movements_type_time_idx" ON "inventory_movements"("tenant_id", "movement_type", "occurred_at");

-- CreateIndex
CREATE INDEX "movements_lot_idx" ON "inventory_movements"("tenant_id", "lot_id");

-- CreateIndex
CREATE INDEX "movements_serial_idx" ON "inventory_movements"("tenant_id", "serial_id");

-- CreateIndex
CREATE INDEX "cost_layers_fifo_idx" ON "cost_layers"("tenant_id", "product_id", "location_id", "received_at");

-- CreateIndex
CREATE INDEX "cost_layers_source_idx" ON "cost_layers"("tenant_id", "source_movement_id");

-- CreateIndex
CREATE INDEX "stock_adjustments_tenant_status_idx" ON "stock_adjustments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "stock_adjustments_tenant_wh_idx" ON "stock_adjustments"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_tenant_number_unique" ON "stock_adjustments"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "stock_adjustment_lines_adjustment_idx" ON "stock_adjustment_lines"("tenant_id", "adjustment_id");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


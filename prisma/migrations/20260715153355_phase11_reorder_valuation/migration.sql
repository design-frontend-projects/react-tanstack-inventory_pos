-- CreateTable
CREATE TABLE "reorder_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "min_stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "safety_stock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "economic_order_qty" DECIMAL(18,4),
    "lead_time_days" INTEGER,
    "preferred_supplier_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_snapshots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_key" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID,
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "allocated" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avg_unit_cost" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reorder_rules_tenant_wh_idx" ON "reorder_rules"("tenant_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "reorder_rules_tenant_product_idx" ON "reorder_rules"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "reorder_rules_tenant_product_wh_unique" ON "reorder_rules"("tenant_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_snapshots_tenant_period_idx" ON "stock_snapshots"("tenant_id", "period_key");

-- CreateIndex
CREATE INDEX "stock_snapshots_tenant_product_idx" ON "stock_snapshots"("tenant_id", "product_id");

-- AddForeignKey
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_snapshots" ADD CONSTRAINT "stock_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('draft', 'planned', 'released', 'in_progress', 'partially_completed', 'completed', 'closed', 'on_hold', 'cancelled');

-- CreateTable
CREATE TABLE "bills_of_materials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BomStatus" NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "output_qty" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "uom_id" UUID NOT NULL,
    "overhead_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_components" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "component_product_id" UUID NOT NULL,
    "component_variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID NOT NULL,
    "scrap_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bom_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "document_number" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "bom_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "output_location_id" UUID NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'draft',
    "planned_qty" DECIMAL(18,4) NOT NULL,
    "produced_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "material_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "overhead_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "output_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "planned_start_date" TIMESTAMP(3),
    "planned_end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_profile_id" UUID,
    "correlation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_materials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "component_product_id" UUID NOT NULL,
    "component_variant_id" UUID,
    "from_location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "planned_qty" DECIMAL(18,4) NOT NULL,
    "consumed_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(19,6),
    "lot_id" UUID,
    "serial_id" UUID,
    "is_consumed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_outputs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "to_location_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(19,6) NOT NULL,
    "lot_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boms_tenant_product_idx" ON "bills_of_materials"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "boms_tenant_status_idx" ON "bills_of_materials"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "bom_components_bom_idx" ON "bom_components"("tenant_id", "bom_id");

-- CreateIndex
CREATE INDEX "bom_components_product_idx" ON "bom_components"("tenant_id", "component_product_id");

-- CreateIndex
CREATE INDEX "production_orders_tenant_status_idx" ON "production_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "production_orders_tenant_product_idx" ON "production_orders"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_tenant_number_unique" ON "production_orders"("tenant_id", "document_number");

-- CreateIndex
CREATE INDEX "production_materials_order_idx" ON "production_materials"("tenant_id", "production_order_id");

-- CreateIndex
CREATE INDEX "production_materials_product_idx" ON "production_materials"("tenant_id", "component_product_id");

-- CreateIndex
CREATE INDEX "production_outputs_order_idx" ON "production_outputs"("tenant_id", "production_order_id");

-- AddForeignKey
ALTER TABLE "bills_of_materials" ADD CONSTRAINT "bills_of_materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bills_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

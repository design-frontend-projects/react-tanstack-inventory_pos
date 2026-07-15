-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('active', 'quarantine', 'expired', 'recalled', 'depleted');

-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('in_stock', 'reserved', 'sold', 'in_transit', 'returned', 'scrapped', 'in_repair');

-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN     "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "lot_number" TEXT NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'active',
    "manufacture_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3),
    "supplier_id" UUID,
    "initial_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "source_doc_type" "SourceDocType",
    "source_doc_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_numbers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "serial_number" TEXT NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'in_stock',
    "current_warehouse_id" UUID,
    "current_location_id" UUID,
    "lot_id" UUID,
    "supplier_id" UUID,
    "warranty_expires_at" TIMESTAMP(3),
    "source_doc_type" "SourceDocType",
    "source_doc_id" UUID,
    "sold_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lots_fefo_idx" ON "lots"("tenant_id", "product_id", "expiry_date");

-- CreateIndex
CREATE INDEX "lots_tenant_status_idx" ON "lots"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "lots_expiry_idx" ON "lots"("tenant_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "lots_tenant_product_number_unique" ON "lots"("tenant_id", "product_id", "lot_number");

-- CreateIndex
CREATE INDEX "serials_tenant_status_idx" ON "serial_numbers"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "serials_location_idx" ON "serial_numbers"("tenant_id", "current_location_id");

-- CreateIndex
CREATE INDEX "serials_lot_idx" ON "serial_numbers"("tenant_id", "lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "serials_tenant_product_number_unique" ON "serial_numbers"("tenant_id", "product_id", "serial_number");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

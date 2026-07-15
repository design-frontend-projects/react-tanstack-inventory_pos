-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'partially_fulfilled', 'fulfilled', 'released', 'expired');

-- CreateEnum
CREATE TYPE "ReservationType" AS ENUM ('sales_order', 'transfer', 'production', 'manual');

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reservation_type" "ReservationType" NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lot_id" UUID,
    "serial_id" UUID,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "fulfilled_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "released_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "source_doc_type" "SourceDocType",
    "source_doc_id" UUID,
    "source_doc_line_id" UUID,
    "source_doc_number" TEXT,
    "expires_at" TIMESTAMP(3),
    "reserved_by_profile_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_reservations_tenant_status_idx" ON "stock_reservations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "stock_reservations_source_idx" ON "stock_reservations"("tenant_id", "source_doc_type", "source_doc_id");

-- CreateIndex
CREATE INDEX "stock_reservations_source_line_idx" ON "stock_reservations"("tenant_id", "source_doc_line_id");

-- CreateIndex
CREATE INDEX "stock_reservations_product_wh_idx" ON "stock_reservations"("tenant_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "stock_reservations_expiry_idx" ON "stock_reservations"("tenant_id", "expires_at");

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
